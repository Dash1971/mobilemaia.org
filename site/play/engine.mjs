// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
import { CACHE_NAME, encode, sha256 } from '../lab/inference/core.mjs?v=20261027-5m';
import { sampleMove } from './policy.mjs?v=20261027-play2';

let session, ort, initPromise, latest, running = false;
const diagnostics = { schema: 1, modelId: '5m', backend: 'wasm', numThreads: 1,
  graphOptimizationLevel: 'all', warmupRuns: 0, downloads: [], inferences: [] };
const notify = data => self.postMessage(data);

async function load(asset, name, keep) {
  const entry = { name, expectedBytes: asset.bytes, loadedBytes: 0, source: 'network', status: 'loading' };
  diagnostics.downloads.push(entry);
  const started = performance.now();
  let cache, saving = Promise.resolve(), reader;
  try {
    if (keep && self.caches) { try { cache = await caches.open(CACHE_NAME); } catch {} }
    let response = cache && await cache.match(asset.url);
    if (response) entry.source = 'prototype cache';
    else response = await fetch(asset.url, { credentials: 'omit', cache: 'no-store' });
    entry.httpStatus = response.status;
    if (!response.ok || response.type === 'opaque') throw new Error(`${name}: HTTP ${response.status}`);
    if (cache && entry.source === 'network') saving = cache.put(asset.url, response.clone()).then(() => { entry.cacheSaved = true; }).catch(error => { entry.cacheError = error.name; });
    entry.cacheSaved = entry.source === 'prototype cache';
    const bytes = new Uint8Array(asset.bytes);
    reader = response.body.getReader();
    let last = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (entry.loadedBytes + value.length > bytes.length) throw new Error(`${name}: exceeded pinned size`);
      bytes.set(value, entry.loadedBytes); entry.loadedBytes += value.length;
      if (performance.now() - last > 120) {
        notify({ type: 'progress', downloads: diagnostics.downloads }); last = performance.now();
      }
    }
    entry.transferMs = performance.now() - started;
    if (entry.loadedBytes !== asset.bytes) throw new Error(`${name}: incomplete download`);
    const hashStart = performance.now();
    entry.sha256 = await sha256(bytes);
    entry.hashMs = performance.now() - hashStart;
    await saving;
    if (entry.sha256 !== asset.sha256) throw new Error(`${name}: SHA-256 mismatch`);
    entry.status = 'verified';
    notify({ type: 'progress', downloads: diagnostics.downloads });
    return bytes;
  } catch (error) {
    if (reader) await reader.cancel().catch(() => {});
    await saving;
    if (cache) await cache.delete(asset.url).catch(() => {});
    entry.status = 'failed'; entry.error = { name: error.name, message: error.message };
    entry.elapsedMs = performance.now() - started;
    throw error;
  }
}

async function init(config, keep) {
  const start = performance.now();
  const model = config.models['5m'];
  const asset = config.runtime.assets.wasm;
  diagnostics.startedAt = new Date().toISOString();
  diagnostics.modelSha256 = model.sha256;
  diagnostics.runtimeVersion = config.runtime.version;
  diagnostics.phase = 'download';
  // Independent downloads overlap; no native-reference or synthetic warm-up runs.
  const modulePromise = import('../lab/inference/' + asset.module);
  const [weights, wasm] = await Promise.all([load(model, 'Maia 5M', keep), load(asset, 'CPU runtime', keep)]);
  ort = await modulePromise;
  if (ort.env.versions.web !== config.runtime.version) throw new Error('Unexpected runtime version');
  ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = { mjs: new URL('../lab/inference/' + asset.loader, self.location.href).href };
  ort.env.wasm.wasmBinary = wasm;
  notify({ type: 'initializing' });
  diagnostics.phase = 'session creation';
  const sessionStart = performance.now();
  session = await ort.InferenceSession.create(weights, { executionProviders: ['wasm'],
    graphOptimizationLevel: diagnostics.graphOptimizationLevel, executionMode: 'sequential', enableMemPattern: false });
  diagnostics.sessionCreationMs = performance.now() - sessionStart;
  diagnostics.workerReadyMs = performance.now() - start;
  diagnostics.inputs = session.inputNames; diagnostics.outputs = session.outputNames;
  diagnostics.phase = 'ready';
  notify({ type: 'ready', diagnostics });
}

async function infer(job) {
  diagnostics.phase = 'inference';
  const start = performance.now();
  const feeds = {
    tokens: new ort.Tensor('float32', encode([job.fen], false), [1, 64, 97]),
    self_elo: new ort.Tensor('int64', new BigInt64Array([BigInt(job.rating)]), [1]),
    opponent_elo: new ort.Tensor('int64', new BigInt64Array([BigInt(job.rating)]), [1]),
  };
  let outputs;
  try {
    outputs = await session.run(feeds);
    const policy = await outputs.move_logits.getData();
    const values = await outputs.value_logits.getData();
    if (!Array.from(values).every(Number.isFinite)) throw new Error('Non-finite value output');
    const move = sampleMove(job.legal, policy, job.fen.split(' ')[1] === 'b');
    const ms = performance.now() - start;
    diagnostics.inferences.push({ ms, at: new Date().toISOString() });
    if (diagnostics.inferences.length > 500) diagnostics.inferences.shift();
    diagnostics.firstInferenceMs ??= ms;
    diagnostics.phase = 'ready';
    notify({ type: 'move', id: job.id, fen: job.fen, move, ms, diagnostics });
  } finally {
    for (const tensor of [...Object.values(outputs || {}), ...Object.values(feeds)]) tensor.dispose();
  }
}

async function drain() {
  if (running) return;
  running = true;
  while (latest) {
    const job = latest; latest = null;
    try { await initPromise; await infer(job); }
    catch (error) { diagnostics.failedPhase = diagnostics.phase; diagnostics.phase = 'failed'; notify({ type: 'error', id: job.id, error: error.message, diagnostics }); }
  }
  running = false;
}
self.onmessage = ({ data }) => {
  if (data.type === 'init' && !initPromise) {
    initPromise = init(data.config, data.keep);
    initPromise.catch(error => { diagnostics.failedPhase = diagnostics.phase; diagnostics.phase = 'failed'; notify({ type: 'error', error: error.message, diagnostics }); });
  } else if (data.type === 'move') { latest = data; drain(); }
};
