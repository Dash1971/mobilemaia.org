// Real ORT/5M regression. Downloads stay in one explicitly owned scratch root.
import assert from 'node:assert/strict';
import {readFile,writeFile,statfs} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {encode,whiteScore} from '../site/lab/inference/core.mjs';

const args=new Map();for(let i=2;i<process.argv.length;i+=2)args.set(process.argv[i],process.argv[i+1]);
assert.ok(args.get('--scratch'),'Provide --scratch with an existing task owner.json');
const scratch=resolve(args.get('--scratch')),mode=args.get('--mode') || 'bounded';
assert.ok(['bounded','baseline','reject-upstream','compare'].includes(mode));
assert.ok(JSON.parse(await readFile(join(scratch,'owner.json'))).owner);
if(mode==='compare'){
 const baseline=JSON.parse(await readFile(join(scratch,'memory-baseline.json')));
 const bounded=JSON.parse(await readFile(join(scratch,'memory-bounded.json')));
 const rejected=JSON.parse(await readFile(join(scratch,'memory-reject-upstream.json')));
 for(const report of [baseline,bounded,rejected])assert.equal(report.sharedArrayBufferGlobalHidden,true);
 assert.equal(baseline.modelSha256,bounded.modelSha256);assert.equal(baseline.wasmSha256,bounded.wasmSha256);
 assert.equal(bounded.results.length,16);assert.equal(baseline.results.length,16);
 for(let i=0;i<16;i++){
  assert.equal(baseline.results[i].policySha256,bounded.results[i].policySha256);
  assert.deepEqual(baseline.results[i].values,bounded.results[i].values);
 }
 assert.match(rejected.expectedError,/Out of memory/);
 const report={result:'PASS',completePolicyAndValueTensorsBitIdentical:16,
  modelSha256:bounded.modelSha256,wasmSha256:bounded.wasmSha256,
  sharedMemoryMaximumBytes:256*1024**2,observedWasmHeapBytes:bounded.allocations.at(-1).currentBytes,
  originalReservationRejectedBySimulation:true,sharedArrayBufferGlobalHidden:true,physicalIOSAcceptance:false};
 await writeFile(join(scratch,'memory-comparison.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));process.exit(0);
}
const disk=await statfs(scratch);assert.ok(disk.bavail*disk.bsize>10*1024**3,'Preserve 10 GiB reserve');
const root=new URL('../site/lab/inference/',import.meta.url);
const config=JSON.parse(await readFile(new URL('config.json',root)));
const model=config.models['5m'],asset=config.runtime.assets.wasm;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function download(asset,name){
 const path=join(scratch,name);let data;
 try{data=await readFile(path);}catch{
  const response=await fetch(asset.url);assert.equal(response.status,200);
  data=new Uint8Array(await response.arrayBuffer());
  assert.equal(data.byteLength,asset.bytes);assert.equal(hash(data),asset.sha256);
  await writeFile(path,data);
 }
 assert.equal(data.byteLength,asset.bytes);assert.equal(hash(data),asset.sha256);return data;
}
const [weights,wasm]=await Promise.all([download(model,'5m.onnx'),download(asset,'ort.wasm')]);
// This is an allocation-ceiling simulation, not an iOS emulator. Both real
// runtime variants run in isolated Node processes; baseline has no imposed cap.
const Memory=WebAssembly.Memory,allocations=[];
// GitHub Pages has no COOP/COEP: exercise the loader's zero-page memory path
// for obtaining the shared buffer constructor when its global is hidden.
Object.defineProperty(globalThis,'SharedArrayBuffer',{value:undefined,configurable:true});
WebAssembly.Memory=new Proxy(Memory,{construct(target,[descriptor]){
 const entry={descriptor:{...descriptor}};allocations.push(entry);
 if(mode!=='baseline' && descriptor.shared && descriptor.maximum>4096){
  entry.rejected=true;throw new RangeError('Out of memory (test rejects shared reservations over 256 MiB)');
 }
 const memory=new target(descriptor);entry.memory=memory;return memory;
}});
globalThis.require=createRequire(import.meta.url);
const ort=await import(new URL('vendor/ort.wasm.min.mjs',root));
ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmBinary=wasm;
ort.env.wasm.wasmPaths={mjs:mode==='bounded'
 ? new URL('../site/play/native/ort-5m-256m.mjs',import.meta.url).href
 : new URL(asset.loader,root).href};
const started=performance.now();let session,error;
try{session=await ort.InferenceSession.create(weights,{executionProviders:['wasm'],graphOptimizationLevel:'all',executionMode:'sequential',enableMemPattern:false});}
catch(caught){error=caught;}
const report={mode,sharedArrayBufferGlobalHidden:true,modelSha256:model.sha256,wasmSha256:asset.sha256,sessionCreationMs:performance.now()-started,results:[]};
if(mode==='reject-upstream'){
 assert.match(error?.message || '',/Out of memory/);assert.ok(allocations.some(a=>a.rejected&&a.descriptor.maximum===65536));
 report.expectedError=error.message;
}else{
 if(error)throw error;
 const fixtures=JSON.parse(await readFile(new URL(model.fixtures,root)));
 for(let repeat=0;repeat<2;repeat++)for(const fixture of fixtures){
  const feeds={tokens:new ort.Tensor('float32',encode(fixture.historyFens,fixture.history),[1,64,97]),
   self_elo:new ort.Tensor('int64',new BigInt64Array([BigInt(fixture.elo)]),[1]),
   opponent_elo:new ort.Tensor('int64',new BigInt64Array([BigInt(fixture.elo)]),[1])};
  const before=performance.now();const outputs=await session.run(feeds,['move_logits','value_logits']);
  const policy=outputs.move_logits.data,values=outputs.value_logits.data;
  assert.equal(policy.length,4352);assert.equal(values.length,3);assert.ok(policy.every(Number.isFinite));
  for(const sample of fixture.nativePolicySamples)assert.ok(Math.abs(policy[sample.index]-sample.logit)<model.reference.logitTolerance,fixture.name+' policy');
  for(let i=0;i<3;i++)assert.ok(Math.abs(values[i]-fixture.nativeValueLogits[i])<model.reference.logitTolerance,fixture.name+' value');
  const score=whiteScore(values,fixture.historyFens.at(-1));assert.ok(Math.abs(score-fixture.whiteScore)<model.reference.whiteScoreTolerance);
  report.results.push({name:fixture.name,elo:fixture.elo,history:fixture.history,repeat,ms:performance.now()-before,policySha256:hash(new Uint8Array(policy.buffer,policy.byteOffset,policy.byteLength)),values:[...values],whiteScore:score});
  for(const tensor of [...Object.values(outputs),...Object.values(feeds)])tensor.dispose();
 }
 await session.release();
}
report.allocations=allocations.map(({descriptor,rejected,memory})=>({descriptor,rejected:!!rejected,currentBytes:memory?.buffer.byteLength}));
if(mode==='bounded'){
 assert.ok(report.allocations.some(a=>a.descriptor.maximum===4096 && !a.rejected));
 for(const allocation of allocations.filter(a=>a.memory&&a.descriptor.maximum===4096)){
  assert.throws(()=>allocation.memory.grow(4097-allocation.memory.buffer.byteLength/65536),RangeError);
 }
}
await writeFile(join(scratch,'memory-'+mode+'.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,results:report.results.length}));
