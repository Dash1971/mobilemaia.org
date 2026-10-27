// Optional offline tuning tool: node tools/compare_play_startup.mjs MODEL WASM [LEVEL]
// Requires the pinned original binaries; no downloads, installs or writes.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { encode, sha256, whiteScore, statistics } from '../site/lab/inference/core.mjs';
import * as ort from '../site/lab/inference/vendor/ort.wasm.min.mjs';
const base = new URL('../site/lab/inference/', import.meta.url);
const config = JSON.parse(await readFile(new URL('config.json', base)));
const model = await readFile(process.argv[2]), wasm = await readFile(process.argv[3]);
assert.equal(await sha256(model), config.models['5m'].sha256);
assert.equal(await sha256(wasm), config.runtime.assets.wasm.sha256);
ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; ort.env.wasm.wasmBinary = wasm;
ort.env.wasm.wasmPaths = { mjs: new URL('vendor/ort-wasm-simd-threaded.mjs', base).href };
const fixtures = JSON.parse(await readFile(new URL('fixtures-5m.json', base)));
const results = [];
for (const level of process.argv[4] ? [process.argv[4]] : ['all', 'basic', 'extended']) {
  assert.ok(['all', 'basic', 'extended'].includes(level));
  const start = performance.now();
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: level, executionMode: 'sequential', enableMemPattern: false });
  const creationMs = performance.now() - start;
  const timings = [], checks = [];
  for (const fixture of [...fixtures, ...fixtures]) {
    const before = performance.now();
    const rating = new BigInt64Array([BigInt(fixture.elo)]);
    const feeds = { tokens: new ort.Tensor('float32', encode(fixture.historyFens, fixture.history), [1,64,97]), self_elo: new ort.Tensor('int64', rating, [1]), opponent_elo: new ort.Tensor('int64', rating, [1]) };
    const outputs = await session.run(feeds);
    const policy = await outputs.move_logits.getData(), values = await outputs.value_logits.getData();
    const error = Math.abs(whiteScore(values, fixture.historyFens.at(-1)) - fixture.whiteScore);
    const policyError = Math.max(...fixture.nativePolicySamples.map(sample => Math.abs(policy[sample.index] - sample.logit)));
    assert.ok(error <= .0005 && policyError <= .002, `${level} native mismatch`);
    timings.push(performance.now() - before); checks.push({ error, policyError });
    for (const tensor of [...Object.values(outputs), ...Object.values(feeds)]) tensor.dispose();
  }
  await session.release();
  results.push({ level, creationMs, firstInferenceMs: timings[0], warm: statistics(timings.slice(8)), checks });
}
console.log(JSON.stringify({ environment: 'Node WebAssembly CPU, desktop; sequential sessions share a compiled runtime', runtime: ort.env.versions.web, modelSha256: await sha256(model), results }, null, 2));
