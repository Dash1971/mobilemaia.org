// SPDX-License-Identifier: AGPL-3.0-only
// The main thread owns deadlines: a blocked Wasm worker cannot police itself.
export class MaiaClient {
  constructor({config, worker, now=()=>Date.now(), setTimer=(fn,ms)=>setTimeout(fn,ms), clearTimer=id=>clearTimeout(id),
    limits={}}) {
    Object.assign(this,{config,worker,now,setTimer,clearTimer});
    this.limits={boot:20000, downloadIdle:30000, downloadTotal:180000,
      session:45000, inference:45000, cooldown:10000, ...limits};
    this.sequence=0;this.attempt=null;this.diagnostics={phase:'not started',trace:[]};
  }
  snapshot() {
    const time=this.now(), a=this.attempt, d=this.diagnostics;
    return {...d,trace:d.trace.slice(-16),inferences:d.inferences?.slice(-5),
      stageElapsedMs:time-(d.phaseAt ?? time),
      lastMessageAgoMs:a?.lastMessage === undefined ? null : time-a.lastMessage,
      lastHeartbeatAgoMs:a?.lastHeartbeat === undefined ? null : time-a.lastHeartbeat};
  }
  phase(value) {
    if(this.diagnostics.phase===value)return;
    const at=this.now();
    this.diagnostics={...this.diagnostics,phase:value,phaseAt:at,
      trace:[...this.diagnostics.trace,{phase:value,at}].slice(-16)};
  }
  timer(a,name,delay,callback) {
    this.clearTimer(a.timers.get(name));
    a.timers.set(name,this.setTimer(()=>{if(this.attempt===a)callback();},delay));
  }
  deadline(a,name,delay) {
    this.timer(a,name,delay,()=>this.fail(a,new Error(`Maia stopped responding during ${this.diagnostics.phase}. Please retry.`),'timeout'));
  }
  fail(a,error,kind='error') {
    if(this.attempt!==a)return;
    const stage=this.diagnostics.phase;
    const time=this.now();
    this.diagnostics.failure={...this.diagnostics.failure,stage,kind,message:String(error.message).slice(0,1500),at:time,
      elapsedMs:time-(this.diagnostics.phaseAt ?? time),
      lastMessageAgoMs:a.lastMessage===undefined?null:time-a.lastMessage,
      lastHeartbeatAgoMs:a.lastHeartbeat===undefined?null:time-a.lastHeartbeat};
    this.phase('failed');this.failedUntil=this.now()+this.limits.cooldown;
    this.dispose(a,error);
  }
  dispose(a,error) {
    this.attempt=null;
    for(const timer of a.timers.values())this.clearTimer(timer);
    a.worker?.terminate();
    a.reject(error);
    for(const p of a.pending.values())p.reject(error);
    a.pending.clear();
  }
  release() {
    const a=this.attempt;
    this.failedUntil=0;
    if(a){this.phase('released');this.dispose(a,new Error('Maia released'));}
  }
  prepare() {
    if(this.attempt)return this.attempt.ready;
    if(this.now()<(this.failedUntil || 0))return Promise.reject(new Error(this.diagnostics.failure.message));
    const a={timers:new Map(),pending:new Map(),downloadBytes:-1};
    a.ready=new Promise((resolve,reject)=>{a.resolve=resolve;a.reject=reject;});
    // A preparation can be speculative. Its rejection is still delivered to
    // callers, but is never an unhandled rejection if the screen closes first.
    a.ready.catch(()=>{});this.attempt=a;
    this.diagnostics={phase:this.diagnostics.phase,trace:this.diagnostics.trace};
    this.phase('configuration');this.deadline(a,'stage',this.limits.boot);
    (async()=>{
      const config=await this.config();if(this.attempt!==a)return;
      this.phase('worker startup');
      a.worker=this.worker();
      a.worker.onmessage=({data})=>this.message(a,data);
      a.worker.onerror=event=>this.fail(a,new Error(event.message || 'Maia worker failed'));
      a.worker.onmessageerror=()=>this.fail(a,new Error('Maia worker response could not be read'));
      a.worker.postMessage({type:'init',config,keep:true});
    })().catch(error=>this.fail(a,error));
    return a.ready;
  }
  message(a,data) {
    if(this.attempt!==a)return;
    a.lastMessage=this.now();
    if(data.type==='heartbeat'){a.lastHeartbeat=this.now();return;}
    if(data.diagnostics){
      // The controller's phase/timestamps belong to the main-thread watchdog.
      const {phase,trace,phaseAt,...details}=data.diagnostics;
      this.diagnostics={...this.diagnostics,...details};
    }
    if((data.type==='stage' && data.phase==='download') || data.type==='progress'){
      if(this.diagnostics.phase!=='download'){
        this.phase('download');this.clearTimer(a.timers.get('stage'));
        this.deadline(a,'total',this.limits.downloadTotal);
        this.deadline(a,'idle',this.limits.downloadIdle);
      }
      if(data.downloads)this.diagnostics.downloads=data.downloads;
      const bytes=(this.diagnostics.downloads || []).reduce((sum,d)=>sum+d.loadedBytes,0);
      if(bytes>a.downloadBytes){a.downloadBytes=bytes;this.deadline(a,'idle',this.limits.downloadIdle);}
    }else if(data.type==='initializing'){
      for(const name of ['idle','total'])this.clearTimer(a.timers.get(name));
      this.phase('session creation');this.deadline(a,'stage',this.limits.session);
    }else if(data.type==='ready'){
      for(const timer of a.timers.values())this.clearTimer(timer);
      a.timers.clear();this.phase('ready');delete this.diagnostics.failure;a.resolve();
    }else if(data.type==='error'){
      if(data.id===undefined)this.fail(a,new Error(data.error));
      else this.settle(a,data.id,new Error(data.error));
    }else if(data.type==='prediction'){
      this.settle(a,data.id,null,data);
    }
  }
  settle(a,id,error,data) {
    const p=a.pending.get(id);if(!p)return;
    this.clearTimer(a.timers.get('job-'+id));a.timers.delete('job-'+id);a.pending.delete(id);
    this.phase(a.pending.size ? 'inference' : 'ready');
    if(error)p.reject(error);
    else p.resolve(p.values ? {move_logits:data.policy,value_logits:data.values} : data.policy);
  }
  async predict(args) {
    const ready=this.prepare(),a=this.attempt;
    await ready;
    if(this.attempt!==a || !a)throw new Error('Maia released');
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{
      a.pending.set(id,{resolve,reject,values:args.includeValue});
      this.phase('inference');this.deadline(a,'job-'+id,this.limits.inference);
      try{a.worker.postMessage({type:'predict',id,arguments:{...args,tokens:new Float32Array(args.tokens)}});}
      catch(error){this.fail(a,error);}
    });
  }
}
