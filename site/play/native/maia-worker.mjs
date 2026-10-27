// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
import { CACHE_NAME, encode, sha256 } from '../../lab/inference/core.mjs?v=20261027-5m';

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
  const model = config.models[config.browserModel || '5m']; diagnostics.modelId = config.browserModel || '5m';
  const asset = config.runtime.assets.wasm;
  diagnostics.startedAt = new Date().toISOString();
  diagnostics.modelSha256 = model.sha256;
  diagnostics.runtimeVersion = config.runtime.version;
  diagnostics.phase = 'download';
  // Independent downloads overlap; no native-reference or synthetic warm-up runs.
  const modulePromise = import('../../lab/inference/' + asset.module);
  const [weights, wasm] = await Promise.all([load(model, 'Maia 5M', keep), load(asset, 'CPU runtime', keep)]);
  ort = await modulePromise;
  if (ort.env.versions.web !== config.runtime.version) throw new Error('Unexpected runtime version');
  ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = { mjs: new URL('../../lab/inference/' + asset.loader, self.location.href).href };
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

async function predict(job) {
  await initPromise;
  const args = job.arguments, started = performance.now();
  const feeds = {
    tokens: new ort.Tensor('float32', args.tokens, [1,64,97]),
    self_elo: new ort.Tensor('int64',new BigInt64Array([BigInt(args.selfElo)]),[1]),
    opponent_elo: new ort.Tensor('int64',new BigInt64Array([BigInt(args.opponentElo)]),[1])
  };
  let outputs;
  try {
    outputs = await session.run(feeds);
    const policy = new Float32Array(await outputs.move_logits.getData());
    const values = new Float32Array(await outputs.value_logits.getData());
    if (policy.length !== 4352 || values.length !== 3 || !policy.every(Number.isFinite) || !values.every(Number.isFinite)) throw new Error('Invalid Maia output');
    diagnostics.inferences.push({ms:performance.now()-started,at:new Date().toISOString()});
    if(diagnostics.inferences.length>200)diagnostics.inferences.shift();
    notify({type:'prediction',id:job.id,policy,values,diagnostics});
  } finally {
    for(const tensor of [...Object.values(outputs || {}),...Object.values(feeds)])tensor.dispose();
  }
}
let tail = Promise.resolve();
self.onmessage = ({data}) => {
  if(data.type === 'init' && !initPromise) {
    initPromise = init(data.config, !data.config.browserQa);
    initPromise.catch(error => notify({type:'error',error:error.message,diagnostics}));
  } else if(data.type === 'predict') {
    tail = tail.catch(()=>{}).then(()=>predict(data)).catch(error=>notify({type:'error',id:data.id,error:error.message,diagnostics}));
  }
};
