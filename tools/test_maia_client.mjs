// Regression tests for cancellation/deadlines outside the Wasm worker.
import assert from 'node:assert/strict';
import {MaiaClient} from '../site/play/native/maia-client.mjs';
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function setup(config=async()=>({})){
  let time=0,id=0;const timers=new Map(),workers=[];
  const client=new MaiaClient({config,now:()=>time,
    setTimer:(fn,ms)=>{timers.set(++id,{fn,at:time+ms});return id;},clearTimer:id=>timers.delete(id),
    worker:()=>{const w={messages:[],postMessage(data){this.messages.push(data);},terminate(){this.terminated=true;},emit(data){this.onmessage({data});}};workers.push(w);return w;},
    limits:{boot:20,downloadIdle:30,downloadTotal:180,session:45,inference:45,cooldown:10}});
  const tick=async ms=>{const until=time+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next || next[1].at>until)break;time=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}time=until;await flush();};
  return {client,workers,timers,tick};
}
const rejected=p=>p.then(()=>({unexpected:true}),error=>error);
// Native browser timer functions reject an arbitrary receiver. Exercise the
// default adapters too, rather than testing only injected fake-clock functions.
{
 const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
 globalThis.setTimeout=function(){assert.ok(this===undefined || this===globalThis);return 1;};
 globalThis.clearTimeout=function(){assert.ok(this===undefined || this===globalThis);};
 try{const c=new MaiaClient({config:()=>new Promise(()=>{}),worker:()=>{throw new Error('unused');}});const p=rejected(c.prepare());c.release();assert.match((await p).message,/released/);}
 finally{globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}
}
// Release must reject both initialization and a waiting prediction. A stale
// config resolution or worker event must not terminate the subsequent worker.
let resolveConfig;
{
 const s=setup(()=>new Promise(r=>{resolveConfig=r;}));
 const p=rejected(s.client.prepare()),prediction=rejected(s.client.predict({tokens:[]}));
 s.client.release();assert.match((await p).message,/released/);assert.match((await prediction).message,/released/);
 resolveConfig({});await flush();assert.equal(s.workers.length,0);assert.equal(s.timers.size,0);
}
{
 const s=setup();const p=rejected(s.client.prepare());await flush();const old=s.workers[0];
 s.client.release();assert.match((await p).message,/released/);
 const next=s.client.prepare();await flush();const worker=s.workers[1];
 old.onerror({message:'stale crash'});old.emit({type:'error',error:'stale failure'});
 worker.emit({type:'ready'});await next;assert.equal(worker.terminated,undefined);assert.equal(s.timers.size,0);
 const prediction=s.client.predict({tokens:[1],includeValue:true});await flush();
 const job=worker.messages.at(-1);worker.emit({type:'prediction',id:job.id,policy:[1],values:[2]});
 assert.deepEqual(await prediction,{move_logits:[1],value_logits:[2]});
 s.client.release();assert.equal(worker.terminated,true);
}
{
 const s=setup();const ready=s.client.prepare();await flush();s.workers[0].emit({type:'ready'});await ready;
 const stalePrediction=rejected(s.client.predict({tokens:[]}));
 s.client.release();const fresh=s.client.prepare();await flush();
 assert.match((await stalePrediction).message,/released/);
 assert.equal(s.workers[1].messages.filter(m=>m.type==='predict').length,0);
 s.workers[1].emit({type:'ready'});await fresh;s.client.release();
}
// Heartbeats do not extend the session deadline. A blocked worker cannot keep
// the main-thread watchdog waiting forever, and retries do not loop immediately.
{
 const s=setup();const p=rejected(s.client.prepare());await flush();const w=s.workers[0];
 w.emit({type:'initializing'});await s.tick(30);w.emit({type:'heartbeat'});await s.tick(15);
 assert.match((await p).message,/session creation/);assert.equal(w.terminated,true);
 assert.equal(s.client.snapshot().failure.kind,'timeout');assert.equal(s.client.snapshot().failure.stage,'session creation');
 assert.equal(s.client.snapshot().failure.elapsedMs,45);assert.equal(s.client.snapshot().failure.lastHeartbeatAgoMs,15);
 assert.match((await rejected(s.client.prepare())).message,/stopped responding/);assert.equal(s.workers.length,1);
 await s.tick(10);const next=s.client.prepare();await flush();s.workers[1].emit({type:'ready'});await next;s.client.release();
}
// Real download byte progress extends idle timeout; duplicate progress and
// heartbeats do not. Total download duration stays bounded even with progress.
{
 const s=setup();const p=rejected(s.client.prepare());await flush();const w=s.workers[0];
 const progress=n=>w.emit({type:'progress',downloads:[{loadedBytes:n}]});
 w.emit({type:'stage',phase:'download'});await s.tick(25);progress(1);await s.tick(25);progress(1);w.emit({type:'heartbeat'});
 await s.tick(5);assert.match((await p).message,/download/);assert.equal(w.terminated,true);
}
{
 const s=setup();const p=rejected(s.client.prepare());await flush();const w=s.workers[0];
 w.emit({type:'stage',phase:'download'});
 for(let i=1;i<9;i++){await s.tick(20);w.emit({type:'progress',downloads:[{loadedBytes:i}]});}
 await s.tick(20);assert.match((await p).message,/download/);assert.equal(w.terminated,true);
}
// Startup/config hangs and inference hangs are independently bounded, all
// pending callers settle and idle timers leave no test-owned work running.
{
 const s=setup(()=>new Promise(()=>{}));const p=rejected(s.client.prepare());await s.tick(20);
 assert.match((await p).message,/configuration/);assert.equal(s.timers.size,0);
}
{
 const s=setup();const p=s.client.prepare();await flush();const w=s.workers[0];w.emit({type:'ready'});await p;
 const one=rejected(s.client.predict({tokens:[]})),two=rejected(s.client.predict({tokens:[]}));await flush();
 await s.tick(45);assert.match((await one).message,/inference/);assert.match((await two).message,/inference/);
 assert.equal(w.terminated,true);assert.equal(s.timers.size,0);
}
console.log('PASS: init/predict cancellation, stale-attempt isolation, session/download/inference deadlines, retry cooldown and local diagnostic snapshots.');
