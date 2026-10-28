// Browser adapter contract: no chess UI/rules are duplicated in JavaScript.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
const bytes=new Uint8Array([1,2,3,4]);
const hash=createHash('sha256').update(bytes).digest('hex');
const events=[], waiting=[]; let disposed=0, feedsSeen=[], invalid=false;
const context=vm.createContext({URL,Response,Uint8Array,Float32Array,BigInt64Array,Array,Number,Math,Date,performance,crypto:webcrypto,console,
 fetch:async()=>new Response(bytes),setTimeout,clearTimeout,setInterval,clearInterval});
context.self={location:{href:'https://mobilemaia.org/play/native/maia-worker.mjs'},postMessage(value){value=structuredClone(value);events.push(value);for(const item of [...waiting])if(item.predicate(value)){waiting.splice(waiting.indexOf(item),1);clearTimeout(item.timer);item.resolve(value);}}};
function next(predicate){const found=events.find(predicate);if(found)return Promise.resolve(found);return new Promise((resolve,reject)=>{const item={predicate,resolve,timer:setTimeout(()=>reject(new Error('Worker response timed out')),2000)};waiting.push(item);});}
class Tensor { constructor(type,data,dims){this.type=type;this.data=data;this.dims=dims;} dispose(){disposed++;} }
const ort={env:{versions:{web:'1.31.1'},wasm:{}},Tensor,InferenceSession:{async create(weights){assert.equal(weights.length,4);return {inputNames:['tokens','self_elo','opponent_elo'],outputNames:['move_logits','value_logits'],async run(feeds,fetches){assert.deepEqual([...fetches],['move_logits','value_logits']);feedsSeen.push(feeds);return {move_logits:{async getData(){const values=new Float32Array(4352);values[796]=invalid?NaN:1.25;return values;},dispose(){disposed++;}},value_logits:{async getData(){return new Float32Array([-.5,0,.5]);},dispose(){disposed++;}}};}};}}};
const ortModule=new vm.SyntheticModule(['env','Tensor','InferenceSession'],function(){for(const key of ['env','Tensor','InferenceSession'])this.setExport(key,ort[key]);},{context});
await ortModule.link(()=>{});await ortModule.evaluate();
const core=new vm.SourceTextModule(await readFile(new URL('../site/lab/inference/core.mjs',import.meta.url),'utf8'),{context});await core.link(()=>{});await core.evaluate();
const workerSource=await readFile(new URL('../site/play/native/maia-compat-worker.mjs',import.meta.url),'utf8');
const workerOptions={context,initializeImportMeta(meta){meta.url='https://mobilemaia.org/play/native/maia-worker.mjs?v=runtime-hash';},importModuleDynamically:async()=>ortModule};
const worker=new vm.SourceTextModule(workerSource,workerOptions);
await worker.link(async()=>core);await worker.evaluate();
const config={models:{'5m':{url:'https://example.invalid/model',bytes:4,sha256:hash}},runtime:{version:'1.31.1',assets:{wasm:{url:'https://example.invalid/runtime',module:'fake.mjs',loader:'fake-loader.mjs',bytes:4,sha256:hash}}},browserRuntime5m:{version:'1.31.1',profile:'maia5m-simd-unshared',sharedMemory:false,wasm:{url:'https://example.invalid/cpu',loader:'/play/runtime/pinned/ort-wasm-simd.mjs',bytes:4,sha256:hash}},browserQa:true};
context.self.onmessage({data:{type:'init',config}});await next(e=>e.type==='ready');
assert.equal(ort.env.wasm.wasmPaths.mjs,'https://mobilemaia.org/play/runtime/pinned/ort-wasm-simd.mjs');
assert.equal(events.find(e=>e.type==='ready').diagnostics.wasmMemoryMaxMiB,256);
assert.equal(events.find(e=>e.type==='ready').diagnostics.sharedMemory,false);
assert.equal(ort.env.wasm.initTimeout,30000);
const tokens=new Float32Array(6208);tokens[23]=1;tokens[6190]=.5;
for(const id of [1,2,3])context.self.onmessage({data:{type:'predict',id,arguments:{tokens,selfElo:1500,opponentElo:2600}}});
for(const id of [1,2,3]){
 const result=await next(e=>e.type==='prediction'&&e.id===id);
 assert.equal(result.policy.length,4352);assert.equal(result.policy[796],1.25);
 assert.deepEqual([...result.values],[-.5,0,.5]);assert.equal(result.move,undefined);
}
assert.equal(feedsSeen.length,3);assert.equal(disposed,15);
for(const feed of feedsSeen){
 assert.deepEqual([...feed.tokens.dims],[1,64,97]);assert.equal(feed.tokens.type,'float32');
 assert.equal(feed.tokens.data.length,6208);assert.equal(feed.tokens.data[23],1);assert.equal(feed.tokens.data[6190],.5);
 assert.equal(feed.self_elo.type,'int64');assert.deepEqual([...feed.self_elo.data],[1500n]);assert.deepEqual([...feed.opponent_elo.data],[2600n]);
}
invalid=true;context.self.onmessage({data:{type:'predict',id:4,arguments:{tokens,selfElo:1500,opponentElo:1500}}});
assert.match((await next(e=>e.type==='error'&&e.id===4)).error,/Invalid Maia output/);assert.equal(disposed,20);
assert.equal(events.find(e=>e.type==='error'&&e.id===4).diagnostics.failure.message,'Invalid Maia output');
assert.equal(events.find(e=>e.type==='error'&&e.id===4).diagnostics.failure.stage,'inference');
// The 79M comparison retains the upstream loader/memory limit.
const largeWorker=new vm.SourceTextModule(workerSource,workerOptions);await largeWorker.link(async()=>core);await largeWorker.evaluate();
context.self.onmessage({data:{type:'init',config:{...config,browserModel:'79m',models:{'79m':config.models['5m']}}}});
await next(e=>e.type==='ready'&&e.diagnostics.modelId==='79m');
assert.equal(ort.env.wasm.wasmPaths.mjs,'https://mobilemaia.org/lab/inference/fake-loader.mjs');
assert.equal(events.find(e=>e.type==='ready'&&e.diagnostics.modelId==='79m').diagnostics.wasmMemoryMaxMiB,4096);
const createSession=ort.InferenceSession.create;
ort.InferenceSession.create=async()=>{throw new RangeError('Out of memory');};
const failedWorker=new vm.SourceTextModule(workerSource,workerOptions);await failedWorker.link(async()=>core);await failedWorker.evaluate();
context.self.onmessage({data:{type:'init',config}});
const failedInit=await next(e=>e.type==='error'&&e.error==='Out of memory');
assert.equal(failedInit.diagnostics.phase,'failed');
assert.equal(failedInit.diagnostics.failure.stage,'session creation');
assert.equal(failedInit.diagnostics.wasmMemoryMaxMiB,256);
ort.InferenceSession.create=createSession;
const root=new URL('../site/play/',import.meta.url),manifest=JSON.parse(await readFile(new URL('assets.json',root)));
for(const asset of manifest.files){const data=await readFile(new URL(asset.path,root));assert.equal(data.length,asset.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);}
console.log('PASS: raw app tensors/ratings, serialized complete policy+value replies, no JS sampling, finite-output failures, tensor disposal and pinned Stockfish integrity.');
