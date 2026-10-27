// Built-in Node tests; no package install or model download.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { encode, sha256, whiteScore, statistics, selectedModel, downloadBytes } from '../site/lab/inference/core.mjs';

const root = new URL('../site/lab/inference/', import.meta.url);
const fixtures = JSON.parse(await readFile(new URL('fixtures.json', root)));
const config = JSON.parse(await readFile(new URL('config.json', root)));
assert.equal(fixtures.length, 8);
assert.equal(config.defaultModel, '5m');
assert.equal(selectedModel(config).id, '5m');
assert.equal(selectedModel(config, '79m').bytes, 316034244);
assert.throws(() => selectedModel(config, 'other'), /Unknown/);
assert.equal(downloadBytes(config, '5m', 'wasm'), 36195504);
assert.equal(downloadBytes(config, '5m', 'webgpu'), 50094390);
assert.equal(downloadBytes(config, '79m', 'wasm'), 330883096);
assert.equal(downloadBytes(config, '79m', 'webgpu'), 344781982);
assert.throws(() => downloadBytes(config, '5m', 'other'), /Unknown/);
const smallFixtures = JSON.parse(await readFile(new URL(config.models['5m'].fixtures, root)));
assert.equal(smallFixtures.length, 8);
for (const [i, small] of smallFixtures.entries()) {
  const large = fixtures[i];
  for (const field of ['name', 'elo', 'history', 'historyFens', 'tokensSha256']) assert.deepEqual(small[field], large[field]);
  assert.notEqual(small.whiteScore, large.whiteScore, '5M must use its own native scores');
  assert.equal(small.nativeValueLogits.length, 3);
  assert.ok(small.nativePolicySamples.some(s => s.index === 4351));
  assert.equal(await sha256(encode(small.historyFens, small.history)), small.tokensSha256);
}
for (const model of Object.values(config.models)) {
  const bytes = await readFile(new URL(model.fixtures, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), model.reference.fixturesSha256);
}
const generator = await readFile(new URL('./make_5m_reference.py', import.meta.url));
assert.equal(createHash('sha256').update(generator).digest('hex'), config.models['5m'].reference.generator.sha256);
const nativeReference = JSON.parse(await readFile(new URL('../docs/browser-inference-5m-2026-10-27/native-reference.json', import.meta.url)));
assert.equal(nativeReference.fixturesSha256, config.models['5m'].reference.fixturesSha256);
assert.equal(nativeReference.modelSha256, config.models['5m'].sha256);
for (const fixture of fixtures) {
  const tokens = encode(fixture.historyFens, fixture.history);
  assert.equal(tokens.length, 64 * 97);
  assert.equal(await sha256(tokens), fixture.tokensSha256, `${fixture.name}, ${fixture.elo}, history ${fixture.history}`);
  assert.ok(tokens.every((value, i) => i % 97 !== 96 || value === 0));
  assert.ok(Math.abs(fixture.whiteScore - fixture.referenceWhiteScore) < 1e-12);
}
assert.equal(whiteScore([0, 0, 0], '8/8/8/8/8/8/8/8 w - - 0 1'), 0.5);
const white = whiteScore([-1000, 0, 1000], '8/8/8/8/8/8/8/8 w - - 0 1');
const black = whiteScore([-1000, 0, 1000], '8/8/8/8/8/8/8/8 b - - 0 1');
assert.equal(white, 1); assert.equal(black, 0);
assert.throws(() => whiteScore([NaN, 0, 1], ''), /Invalid/);
assert.throws(() => encode([], false), /No reference/);
const values = Array.from({ length: 20 }, (_, i) => 20 - i);
const stats = statistics(values);
assert.equal(stats.medianMs, 10.5); assert.equal(stats.meanMs, 10.5); assert.equal(stats.p95Ms, 19);
assert.equal(values[0], 20); assert.throws(() => statistics([]), /Invalid/);
for (const file of config.runtime.files) {
  const bytes = await readFile(new URL(file.path, root));
  assert.equal(bytes.length, file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
}
assert.equal(config.models['79m'].sha256, '3454b03ae78baa64a87b345fdb1a457265d912caec531039b074f07eda0d8010');
assert.equal(config.models['5m'].sha256, 'ddae2aa893b5ca7ec94d24178871f1c337d09fd72ff38abe8d76b8ecf08cb942');
assert.notEqual(config.models['5m'].url, config.models['79m'].url);
for (const backend of ['wasm', 'webgpu']) {
  assert.match(config.runtime.assets[backend].url, /onnxruntime-web@1\.31\.1\//);
  assert.ok(config.runtime.files.some(f => f.path === config.runtime.assets[backend].module));
  assert.ok(config.runtime.files.some(f => f.path === config.runtime.assets[backend].loader));
}
assert.match(config.runtime.assets.webgpu.loader, /asyncify/);
assert.equal(config.runtime.assets.wasm.loader, 'vendor/ort-wasm-simd-threaded.mjs');
assert.match(config.runtime.sourceCommit, /^[a-f0-9]{40}$/);
console.log('PASS: 16 model-specific cases, 5M default, download sizes, input tensors, score/statistics and pinned artifact integrity.');
