// Copyright 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only
import { CACHE_NAME, encode, sha256, whiteScore, statistics } from './core.mjs';

let lastProgress = 0;
const report = { schema: 1, status: 'running', startedAt: new Date().toISOString(), downloads: [], checks: [], timingsMs: [] };
function stage(name, message, extra = {}) {
  report.lastStage = name;
  self.postMessage({ type: 'progress', stage: name, message, ...extra });
}

async function loadVerified(asset, label, keep) {
  stage('download', `Loading ${label}…`, { loaded: 0, total: asset.bytes });
  const started = performance.now();
  let cache;
  if (keep && self.caches) {
    try { cache = await caches.open(CACHE_NAME); } catch { /* Private storage can be unavailable. */ }
  }
  let response = cache && await cache.match(asset.url);
  const source = response ? 'prototype cache' : 'network';
  if (!response) response = await fetch(asset.url, { credentials: 'omit', cache: 'no-store' });
  if (!response.ok || response.type === 'opaque') throw new Error(`${label} download failed: HTTP ${response.status}`);
  // Consume the cache branch concurrently, so the streaming tee does not buffer
  // an entire second copy in JS. Every cached load is still hash-checked below.
  let cacheSaved = source === 'prototype cache';
  let saving = Promise.resolve();
  if (cache && source === 'network') saving = cache.put(asset.url, response.clone()).then(() => { cacheSaved = true; }).catch(() => {});
  const bytes = new Uint8Array(asset.bytes);
  const reader = response.body.getReader();
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > bytes.length) throw new Error(`${label} exceeded its pinned size`);
      bytes.set(value, offset); offset += value.length;
      if (performance.now() - lastProgress > 150) {
        stage('download', `Loading ${label} (${source})…`, { loaded: offset, total: asset.bytes });
        lastProgress = performance.now();
      }
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  if (offset !== asset.bytes) {
    await saving; if (cache) await cache.delete(asset.url);
    throw new Error(`${label} has ${offset} bytes; expected ${asset.bytes}`);
  }
  const transferMs = performance.now() - started;
  stage('verify', `Verifying ${label} SHA-256…`, { loaded: asset.bytes, total: asset.bytes });
  const hashStart = performance.now();
  const actual = await sha256(bytes);
  await saving;
  if (actual !== asset.sha256) {
    if (cache) await cache.delete(asset.url);
    throw new Error(`${label} SHA-256 mismatch; saved copy removed`);
  }
  report.downloads.push({ label, source, bytes: offset, sha256: actual, transferMs, hashMs: performance.now() - hashStart, cacheSaved });
  return bytes;
}

self.onmessage = async ({ data }) => {
  const { config, fixtures, backend, iterations, keep } = data;
  report.model = config.model;
  report.runtime = { version: config.runtime.version, backendRequested: backend, numThreads: 1,
    graphOptimizationLevel: 'all', allModelOutputs: true,
    providerNote: backend === 'webgpu' ? 'WebGPU preferred; unsupported nodes may execute on CPU. Per-node placement is not measured.' : 'Single-thread WebAssembly CPU baseline.' };
  report.reference = config.reference;
  let session;
  try {
    if (backend === 'webgpu') {
      stage('capability', 'Checking WebGPU adapter…');
      if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser. Try WebAssembly CPU.');
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('No WebGPU adapter is available. Try WebAssembly CPU.');
      report.gpu = adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, description: adapter.info.description } : { available: true };
    }
    // Validate the input port before spending bandwidth or creating a session.
    for (const fixture of fixtures) {
      if (await sha256(encode(fixture.historyFens, fixture.history)) !== fixture.tokensSha256) throw new Error('Reference input encoding mismatch');
    }
    const runtimeAsset = config.runtime.assets[backend];
    report.runtime.asset = runtimeAsset;
    let model = await loadVerified(config.model, 'Maia model', keep);
    let wasm = await loadVerified(runtimeAsset, 'inference runtime', keep);
    stage('initialization', 'Creating inference session. This can take a while on a phone…');
    const ort = await import('./' + runtimeAsset.module);
    report.runtime.loadedVersion = ort.env.versions.web;
    if (report.runtime.loadedVersion !== config.runtime.version) throw new Error('Runtime version does not match the pinned configuration');
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = { mjs: new URL('./' + runtimeAsset.loader, self.location.href).href };
    ort.env.wasm.wasmBinary = wasm;
    const initStart = performance.now();
    session = await ort.InferenceSession.create(model, {
      executionProviders: [backend],
      graphOptimizationLevel: 'all', executionMode: 'sequential', enableMemPattern: false,
    });
    report.sessionCreationMs = performance.now() - initStart;
    report.inputs = session.inputNames;
    report.outputs = session.outputNames;
    model = null; wasm = null;

    async function infer(fixture) {
      const start = performance.now();
      const feeds = {
        tokens: new ort.Tensor('float32', encode(fixture.historyFens, fixture.history), [1, 64, 97]),
        self_elo: new ort.Tensor('int64', new BigInt64Array([BigInt(fixture.elo)]), [1]),
        opponent_elo: new ort.Tensor('int64', new BigInt64Array([BigInt(fixture.elo)]), [1]),
      };
      let outputs;
      try {
        outputs = await session.run(feeds);
        const arrays = {};
        for (const [name, tensor] of Object.entries(outputs)) {
          arrays[name] = await tensor.getData();
          if (!Array.from(arrays[name]).every(Number.isFinite)) throw new Error(`Non-finite ${name} output`);
        }
        if (arrays.move_logits.length !== 4352) throw new Error('Unexpected move-policy shape');
        const score = whiteScore(arrays.value_logits, fixture.historyFens.at(-1));
        return { ms: performance.now() - start, whiteScore: score };
      } finally {
        for (const tensor of [...Object.values(outputs || {}), ...Object.values(feeds)]) tensor.dispose();
      }
    }
    stage('validation', 'Running eight native-reference checks and warm-up…');
    for (const [i, fixture] of fixtures.entries()) {
      const result = await infer(fixture);
      if (i === 0) report.firstInferenceMs = result.ms;
      const error = Math.abs(result.whiteScore - fixture.whiteScore);
      report.checks.push({ name: fixture.name, elo: fixture.elo, history: fixture.history,
        expectedWhiteScore: fixture.whiteScore, actualWhiteScore: result.whiteScore, absoluteError: error,
        passed: error <= config.reference.whiteScoreTolerance });
      if (error > config.reference.whiteScoreTolerance) throw new Error(`Native-reference mismatch (${fixture.name}, ${fixture.elo}, history ${fixture.history})`);
    }
    stage('benchmark', 'Measuring warmed inference…', { loaded: 0, total: iterations });
    for (let i = 0; i < iterations; i++) {
      const result = await infer(fixtures[i % fixtures.length]);
      report.timingsMs.push(result.ms);
      stage('benchmark', `Measured ${i + 1} of ${iterations} inferences`, { loaded: i + 1, total: iterations });
    }
    report.statistics = statistics(report.timingsMs);
    report.status = 'completed';
  } catch (error) {
    report.status = 'failed'; report.error = String(error.message || error);
  } finally {
    if (session) await session.release().catch(() => {});
    report.finishedAt = new Date().toISOString();
    self.postMessage({ type: 'result', report });
  }
};
