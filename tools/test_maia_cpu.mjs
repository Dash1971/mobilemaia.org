// Real-model parity and binary-memory checks for the model-scoped CPU build.
import assert from 'node:assert/strict';
import {readFile,writeFile,statfs} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {encode,whiteScore} from '../site/lab/inference/core.mjs';
const args=new Map();for(let i=2;i<process.argv.length;i+=2)args.set(process.argv[i],process.argv[i+1]);
const scratch=resolve(args.get('--scratch')),mode=args.get('--mode');
assert.ok(JSON.parse(await readFile(join(scratch,'owner.json'))).owner);
assert.ok(['original','custom','compare'].includes(mode));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(mode==='compare'){
 const old=JSON.parse(await readFile(join(scratch,'cpu-original-full.json'))),next=JSON.parse(await readFile(join(scratch,'cpu-custom-full.json')));
 assert.equal(old.modelSha256,next.modelSha256);assert.equal(old.results.length,16);assert.equal(next.results.length,16);
 let maxPolicyError=0,maxValueError=0,maxScoreError=0;
 for(let i=0;i<16;i++){
  const a=old.results[i],b=next.results[i];assert.equal(a.name,b.name);
  for(let j=0;j<4352;j++)maxPolicyError=Math.max(maxPolicyError,Math.abs(a.policy[j]-b.policy[j]));
  for(let j=0;j<3;j++)maxValueError=Math.max(maxValueError,Math.abs(a.values[j]-b.values[j]));
  maxScoreError=Math.max(maxScoreError,Math.abs(a.whiteScore-b.whiteScore));
 }
 assert.ok(maxPolicyError<.002);assert.ok(maxValueError<.002);assert.ok(maxScoreError<.0005);
 const report={result:'PASS',runs:16,referenceCases:8,completePolicyAndValueTensorsCompared:true,maxPolicyError,maxValueError,maxScoreError,
  modelSha256:next.modelSha256,runtimeSha256:next.runtimeSha256,runtimeBytes:next.runtimeBytes,originalRuntimeBytes:old.runtimeBytes,
  memory:next.memory,observedWasmHeapBytes:next.observedWasmHeapBytes,originalSessionMs:old.sessionMs,customSessionMs:next.sessionMs,
  physicalIOSAcceptance:false,results:next.results.map(({policy,...rest})=>rest)};
 await writeFile(join(scratch,'cpu-comparison.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,results:report.results.length}));process.exit(0);
}
const disk=await statfs(scratch);assert.ok(disk.bavail*disk.bsize>10*1024**3);
const root=new URL('../site/lab/inference/',import.meta.url),config=JSON.parse(await readFile(new URL('config.json',root))),model=config.models['5m'];
async function get(asset,name){let bytes;const path=join(scratch,name);try{bytes=await readFile(path);}catch{const r=await fetch(asset.url);assert.equal(r.status,200);bytes=new Uint8Array(await r.arrayBuffer());await writeFile(path,bytes);}assert.equal(bytes.length,asset.bytes);assert.equal(sha(bytes),asset.sha256);return bytes;}
const weights=await get(model,'5m.onnx');
let wasm,loader,memory=[];
if(mode==='original'){
 wasm=await get(config.runtime.assets.wasm,'ort.wasm');loader=new URL(config.runtime.assets.wasm.loader,root).href;
}else{
 const packagePath=resolve(args.get('--runtime')),manifest=JSON.parse(await readFile(join(packagePath,'manifest.json')));
 assert.equal(manifest.sourceCommit,config.runtime.sourceCommit);assert.equal(manifest.profile,'maia5m-simd-unshared');
 assert.equal(manifest.sharedMemory,false);assert.equal(manifest.memoryMaximumMiB,256);
 for(const [name,pin] of Object.entries(manifest.files)){const bytes=await readFile(join(packagePath,name));assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256);}
 wasm=await readFile(join(packagePath,'ort-wasm-simd.wasm'));
 // Inspect imported AND defined memory types, not just a loader's JS options.
 let p=8;const leb=()=>{let value=0,shift=0,b;do{b=wasm[p++];value+=(b&127)*2**shift;shift+=7;}while(b&128);return value;};
 const string=()=>{const n=leb();p+=n;};const limits=()=>{const flags=leb(),initial=leb(),maximum=flags&1?leb():null;return {flags,initial,maximum,shared:!!(flags&2)};};
 while(p<wasm.length){const section=wasm[p++],size=leb(),end=p+size;
  if(section===2){const count=leb();for(let i=0;i<count;i++){string();string();const kind=wasm[p++];if(kind===0)leb();else if(kind===1){p++;limits();}else if(kind===2)memory.push(limits());else if(kind===3)p+=2;else if(kind===4){p++;leb();}else throw new Error('Unknown import kind');}}
  else if(section===5){const count=leb();for(let i=0;i<count;i++)memory.push(limits());}p=end;
 }
 assert.equal(memory.length,1);assert.equal(memory[0].shared,false);assert.equal(memory[0].maximum,4096);
 const factory=pathToFileURL(join(packagePath,'ort-wasm-simd.mjs')).href;
 const wrapper=join(scratch,'capture-cpu.mjs');
 await writeFile(wrapper,`import factory from ${JSON.stringify(factory)};export default async options=>{const module=await factory(options);globalThis.maiaTestModule=module;return module;};\n`);
 loader=pathToFileURL(wrapper).href;
 const Memory=WebAssembly.Memory;
 WebAssembly.Memory=new Proxy(Memory,{construct(target,[descriptor]){assert.ok(!descriptor.shared,'Custom build must not create shared memory');return new target(descriptor);}});
}
Object.defineProperty(globalThis,'SharedArrayBuffer',{value:undefined,configurable:true});
globalThis.require=createRequire(import.meta.url);
const ort=await import(new URL('vendor/ort.wasm.min.mjs',root));
ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.initTimeout=30000;
ort.env.wasm.wasmBinary=wasm;ort.env.wasm.wasmPaths={mjs:loader};
const start=performance.now();
const session=await ort.InferenceSession.create(weights,{executionProviders:['wasm'],graphOptimizationLevel:'all',executionMode:'sequential',enableMemPattern:false});
const report={mode,modelSha256:model.sha256,runtimeSha256:sha(wasm),runtimeBytes:wasm.length,memory,sessionMs:performance.now()-start,results:[]};
const fixtures=JSON.parse(await readFile(new URL(model.fixtures,root)));
for(let repeat=0;repeat<2;repeat++)for(const fixture of fixtures){
 const feeds={tokens:new ort.Tensor('float32',encode(fixture.historyFens,fixture.history),[1,64,97]),self_elo:new ort.Tensor('int64',new BigInt64Array([BigInt(fixture.elo)]),[1]),opponent_elo:new ort.Tensor('int64',new BigInt64Array([BigInt(fixture.elo)]),[1])};
 const started=performance.now();const outputs=await session.run(feeds,['move_logits','value_logits']);
 const policy=outputs.move_logits.data,values=outputs.value_logits.data;
 assert.equal(policy.length,4352);assert.equal(values.length,3);assert.ok(policy.every(Number.isFinite));assert.ok(values.every(Number.isFinite));
 for(const sample of fixture.nativePolicySamples)assert.ok(Math.abs(policy[sample.index]-sample.logit)<model.reference.logitTolerance,fixture.name+' policy');
 for(let i=0;i<3;i++)assert.ok(Math.abs(values[i]-fixture.nativeValueLogits[i])<model.reference.logitTolerance,fixture.name+' value');
 const score=whiteScore(values,fixture.historyFens.at(-1));assert.ok(Math.abs(score-fixture.whiteScore)<model.reference.whiteScoreTolerance);
 report.results.push({name:fixture.name,repeat,ms:performance.now()-started,policy:[...policy],values:[...values],whiteScore:score});
 for(const tensor of [...Object.values(outputs),...Object.values(feeds)])tensor.dispose();
}
report.observedWasmHeapBytes=globalThis.maiaTestModule?.HEAPU8.buffer.byteLength;
if(mode==='custom')assert.equal(Object.prototype.toString.call(globalThis.maiaTestModule.HEAPU8.buffer),'[object ArrayBuffer]');
await session.release();await writeFile(join(scratch,'cpu-'+mode+'-full.json'),JSON.stringify(report)+'\n');
console.log(JSON.stringify({...report,results:report.results.length}));
// ORT's successful initTimeout race leaves its timer alive. All work above is
// awaited and the session released; do not keep this CLI process for that timer.
process.exit(0);
