// SPDX-License-Identifier: AGPL-3.0-only
import { CACHE_NAME, sha256 } from '../../lab/inference/core.mjs?v=20261027-5m';
import { pwa } from '../pwa.mjs';
const qa = new URLSearchParams(location.search).get('qa')?.match(/^[a-z0-9-]{1,60}$/)?.[0];
const offlineQa = !!qa && new URLSearchParams(location.search).get('offlineqa') === '1';
const keepEngines = !qa || offlineQa;
const engineCacheName = qa ? 'mobile-maia-engine-qa-' + qa : CACHE_NAME;
let configPromise;
function modelConfig() {
  return configPromise ??= fetch('../../lab/inference/config.json', {cache: 'no-store'})
    .then(response => { if (!response.ok) throw new Error('Model configuration unavailable'); return response.json(); })
    .catch(error => { configPromise = null; throw error; });
}
const records = new Map();
let db, storageTail=Promise.resolve(), storageFailure;
async function storageReady() {
  db = await new Promise((resolve,reject)=>{
    const open=indexedDB.open(qa ? 'mobile-maia-app-qa-'+qa : 'mobile-maia-app-v1',1);
    open.onupgradeneeded=()=>open.result.createObjectStore('files');
    open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
  });
  await new Promise((resolve,reject)=>{
    const transaction=db.transaction('files','readonly'), store=transaction.objectStore('files');
    const cursor=store.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){records.set(c.key,c.value);c.continue();}};
    transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);
  });
}
function store(kind,key,value) {
  if(storageFailure) throw storageFailure;
  storageTail=storageTail.then(()=>new Promise((resolve,reject)=>{
    const transaction=db.transaction('files','readwrite'), target=transaction.objectStore('files');
    if(kind==='put')target.put(value,key);else target.delete(key);
    transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error || new Error('Storage aborted'));
  })).catch(error=>{storageFailure=error;});
}
async function flush(){await storageTail;if(storageFailure)throw storageFailure;}
const files={get:key=>records.get(key) ?? null,keys:()=>[...records.keys()],put(key,value){store('put',key,value);records.set(key,value);},remove(key){store('remove',key);records.delete(key);}};
let maia, ready, pending=new Map(), sequence=0, maiaDiagnostics;
const modelId = new URLSearchParams(location.search).get('model') === '79m' ? '79m' : '5m';
function releaseMaia(){maia?.terminate();maia=null;ready=null;for(const p of pending.values())p.reject(new Error('Maia released'));pending.clear();}
async function prepareMaia(){
  if(ready)return ready;
  ready=(async()=>{
    const config={...await modelConfig(),browserModel:modelId,browserQa:!!qa,browserOfflineQa:offlineQa,browserCacheName:engineCacheName};
    await new Promise((resolve,reject)=>{
      const workerUrl=new URL('maia-worker.mjs',import.meta.url);workerUrl.search=new URL(import.meta.url).search;maia=new Worker(workerUrl,{type:'module'});
      maia.onmessage=({data})=>{
        maiaDiagnostics=data.diagnostics || maiaDiagnostics;
        if(data.type==='progress')maiaDiagnostics={...maiaDiagnostics,phase:'download',downloads:data.downloads};
        if(data.type==='initializing')maiaDiagnostics={...maiaDiagnostics,phase:'session creation'};
        if(data.type==='ready')resolve();
        else if(data.type==='error'){
          if(data.id!==undefined){const p=pending.get(data.id);pending.delete(data.id);p?.reject(new Error(data.error));}
          else {reject(new Error(data.error));for(const p of pending.values())p.reject(new Error(data.error));pending.clear();}
        } else if(data.type==='prediction'){
          const p=pending.get(data.id);pending.delete(data.id);p?.resolve(p.values?{move_logits:data.policy,value_logits:data.values}:data.policy);
        }
      };
      maia.onerror=event=>{reject(new Error(event.message));for(const p of pending.values())p.reject(new Error(event.message));pending.clear();};
      maia.postMessage({type:'init',config,keep:true});
    });
  })().catch(error=>{releaseMaia();throw error;});return ready;
}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;}
function openPgn(){return new Promise((resolve,reject)=>{const input=document.createElement('input');input.type='file';input.accept='.pgn,text/plain,application/x-chess-pgn';input.onchange=async()=>{try{const file=input.files[0];if(!file)return resolve(null);if(file.size>2*1024*1024)throw new Error('PGN exceeds 2 MB');resolve(await file.text());}catch(e){reject(e);}};input.oncancel=()=>resolve(null);input.click();});}
const sounds = new Map();
let wake;
async function invoke(channel,method,args={}){
  args ??={};
  if(channel==='storage'){await flush();return null;}
  if(channel==='maia_chess/sound_effect'){
    if(method==='load'){const audio=new Audio(new URL((document.querySelector('meta[name="mobile-maia-asset-base"]')?.content || '')+'assets/'+args.path,document.baseURI));audio.preload='auto';sounds.set(args.soundId,audio);return null;}
    if(method==='play'){const audio=sounds.get(args.soundId);if(audio){audio.volume=args.volume;audio.currentTime=0;await audio.play().catch(()=>{});}return null;}
    if(method==='release'){for(const audio of sounds.values())audio.pause();sounds.clear();}return null;
  }
  switch(method){
    case 'prepare':await prepareMaia();return null;
    case 'pwaStatus':return offlineStatus();
    case 'pwaInstall':return pwa.install();
    case 'prepareOffline':await prepareOffline();return null;
    case 'predict':{await prepareMaia();const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject,values:args.includeValue});maia.postMessage({type:'predict',id,arguments:{...args,tokens:new Float32Array(args.tokens)}});});}
    case 'release':releaseMaia();return null;
    case 'getPendingPgn':return null;
    case 'openPgnFile':return openPgn();
    case 'savePgnFile':case 'sharePgn':return download(args.pgn,'mobile-maia-game-'+Date.now()+'.pgn','application/x-chess-pgn');
    case 'shareFen':await navigator.clipboard.writeText(args.fen);return true;
    case 'openUrl':{const url=new URL(args.url);if(url.protocol!=='https:')throw new Error('Unsupported URL');window.open(url.href,'_blank','noopener,noreferrer');return null;}
    case 'dataDirectory':return '/mobile-maia';
    case 'samplingMetadata':return {backend:'onnx-web-wasm',model:modelId,modelSha256:maiaDiagnostics?.modelSha256 || '',runtime:'1.31.1'};
    case 'systemDiagnostics':return {flavor:'browser',model:modelId,maia:maiaDiagnostics,pwa:await offlineStatus(),storage:'IndexedDB'};
    case 'saveSamplingData':{await flush();const path=args.readable?'/mobile-maia/sampling-data/report.html':'/mobile-maia/sampling-data/export.jsonl';const record=JSON.parse(records.get(path) || 'null');if(!record)throw new Error('Sampling export is unavailable');return download(record.text,args.readable?'mobile-maia-sampling.html':'mobile-maia-sampling.jsonl',args.readable?'text/html':'application/x-ndjson');}
    case 'setKeepScreenOn':try{if(args.enabled&&!wake)wake=await navigator.wakeLock?.request('screen');else if(!args.enabled&&wake){await wake.release();wake=null;}}catch{}return null;
    default:throw new Error('Browser platform method is not implemented: '+method);
  }
}
async function stockfishBytes(){
  const config=await(await fetch('../stockfish.json',{cache:'no-store'})).json(), asset=config.wasm;
  let cache;if(keepEngines)try{cache=await caches.open(engineCacheName);}catch{}
  const saved=await cache?.match(asset.url), response=saved || await fetch(asset.url,{cache:'no-store',credentials:'omit'});
  if(!response.ok)throw new Error('Stockfish download failed: '+response.status);
  const bytes=await response.arrayBuffer();if(bytes.byteLength!==asset.bytes || await sha256(new Uint8Array(bytes))!==asset.sha256){await cache?.delete(asset.url);throw new Error('Stockfish integrity check failed');}
  if(cache&&!saved)await cache.put(asset.url,new Response(bytes,{headers:{'Content-Type':'application/wasm'}})).catch(()=>{});
  return {config,bytes};
}
async function createStockfish(listener){
  const {config,bytes}=await stockfishBytes();
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/wasm'}));
  const worker=new Worker(new URL('../'+config.loader,import.meta.url).href+'#'+encodeURIComponent(url));
  worker.onmessage=({data})=>listener(String(data));worker.onerror=e=>listener('info string Browser worker error: '+e.message);
  return {post:command=>worker.postMessage(command),close(){worker.terminate();URL.revokeObjectURL(url);}};
}
let offlinePreparation, offlinePhase, cachedUntil=0, enginesSaved=false;
async function cachedEngines(force=false) {
  if (!force && Date.now() < cachedUntil) return enginesSaved;
  cachedUntil=Date.now()+3000;
  enginesSaved=false;
  if (!keepEngines || !globalThis.caches) return false;
  try {
    const config=await modelConfig();
    const stockfish=await(await fetch('../stockfish.json')).json();
    const cache=await caches.open(engineCacheName);
    const assets=[config.models[modelId],config.runtime.assets.wasm,stockfish.wasm];
    enginesSaved=(await Promise.all(assets.map(asset=>cache.match(asset.url)))).every(Boolean);
  } catch {}
  return enginesSaved;
}
async function offlineStatus() {
  const status=await pwa.status();
  const downloads=maiaDiagnostics?.downloads || [];
  const total=downloads.reduce((sum,item)=>sum+item.expectedBytes,0);
  const loaded=downloads.reduce((sum,item)=>sum+item.loadedBytes,0);
  return {...status,offlineReady:status.shellReady && await cachedEngines(),
    phase:offlinePhase || (maiaDiagnostics?.phase==='ready' ? 'Maia is ready.' : maiaDiagnostics?.phase==='session creation' ? 'Initializing Maia…' : 'Downloading and checking Maia and its runtime…'),
    downloadProgress:offlinePhase==='Saving the app…' ? status.shellProgress : total && loaded<total ? loaded/total : null, model:modelId};
}
async function prepareOffline() {
  if (offlinePreparation) return offlinePreparation;
  offlinePreparation=(async()=>{
    if (!keepEngines || !globalThis.caches) throw new Error('Persistent engine storage is unavailable.');
    offlinePhase='Saving the app…';await pwa.saveShell();
    offlinePhase=null;await prepareMaia();
    offlinePhase='Saving Stockfish…';await stockfishBytes();
    if (!await cachedEngines(true)) throw new Error('Engine files could not be saved. Check free storage and retry.');
    offlinePhase='Ready for offline play and analysis.';
  })().finally(()=>{offlinePreparation=null;});
  return offlinePreparation;
}
globalThis.mobileMaiaNative={invoke,createStockfish,files,modelName:modelId === '5m' ? '5M' : '79M',preferencePrefix:qa ? 'mobileMaiaQa.'+qa+'.' : 'mobileMaiaNative.'};
try{
  await storageReady();
  const script=document.createElement('script');script.src=document.querySelector('meta[name="mobile-maia-bootstrap"]')?.content || 'flutter_bootstrap.js';document.body.append(script);
}catch(error){document.body.textContent='Mobile Maia could not open browser storage. '+error.message;}
