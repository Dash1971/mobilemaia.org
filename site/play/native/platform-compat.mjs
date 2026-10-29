// SPDX-License-Identifier: AGPL-3.0-only
import {CACHE_NAME} from '../../lab/inference/core.mjs?v=20261027-5m';
import {pwa} from '../pwa.mjs?v=__PWA_SOURCE__';
const {MaiaClient}=await import(new URL('maia-client.mjs'+new URL(import.meta.url).search,import.meta.url));
export function createCompatibility({stockfishBytes}) {
  const params=new URLSearchParams(location.search),qa=params.get('qa')?.match(/^[a-z0-9-]{1,60}$/)?.[0];
  const offlineQa=!!qa && params.get('offlineqa')==='1',keepEngines=!qa || offlineQa;
  const cacheName=qa?'mobile-maia-engine-qa-'+qa:CACHE_NAME;
  // Browser downloads are restricted to the non-LFS 5M model.
  const modelId='5m';
  let configPromise,offlinePreparation,offlinePhase;
  function config(){
    if(configPromise)return configPromise;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    const load=url=>fetch(url,{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Model configuration unavailable');return r.json();});
    return configPromise=Promise.all([load('../../lab/inference/config.json'),load('../maia-cpu.json')])
      .then(([config,cpu])=>({...config,browserRuntime5m:cpu,browserModel:modelId,browserQa:!!qa,browserOfflineQa:offlineQa,browserCacheName:cacheName}))
      .catch(error=>{configPromise=null;throw error;}).finally(()=>clearTimeout(timer));
  }
  const client=new MaiaClient({config,worker:()=>{
    const url=new URL('maia-compat-worker.mjs',import.meta.url);url.search=new URL(import.meta.url).search;
    return new Worker(url,{type:'module'});
  }});
  async function cachedEngines(){
    if(!keepEngines || !globalThis.caches)return false;
    try{
      const c=await config(),sf=await(await fetch('../stockfish.json')).json(),cache=await caches.open(cacheName);
      const assets=[c.models[modelId],modelId==='5m'?c.browserRuntime5m.wasm:c.runtime.assets.wasm,sf.wasm];
      return(await Promise.all(assets.map(asset=>cache.match(asset.url)))).every(Boolean);
    }catch{return false;}
  }
  async function offlineStatus(){
    const status=await pwa.status(),d=client.snapshot(),downloads=d.downloads || [];
    const total=downloads.reduce((sum,item)=>sum+item.expectedBytes,0),loaded=downloads.reduce((sum,item)=>sum+item.loadedBytes,0);
    return {...status,offlineReady:status.shellReady && await cachedEngines(),
      phase:offlinePhase || (d.phase==='ready'?'Maia is ready.':d.phase==='session creation'?'Initializing Maia…':'Downloading and checking Maia and its runtime…'),
      downloadProgress:offlinePhase==='Saving the app…'?status.shellProgress:total && loaded<total?loaded/total:null,model:modelId};
  }
  async function diagnosticStatus(){
    let timer;
    try{return await Promise.race([offlineStatus(),new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'unavailable',reason:'status timed out'}),1500);})]);}
    catch(error){return {status:'unavailable',reason:String(error.message).slice(0,200)};}
    finally{clearTimeout(timer);}
  }
  async function prepareOffline(){
    if(offlinePreparation)return offlinePreparation;
    return offlinePreparation=(async()=>{
      if(!keepEngines || !globalThis.caches)throw new Error('Persistent engine storage is unavailable.');
      offlinePhase='Saving the app…';await pwa.saveShell();offlinePhase=null;await client.prepare();
      offlinePhase='Saving Stockfish…';await stockfishBytes();
      if(!await cachedEngines())throw new Error('Engine files could not be saved. Check free storage and retry.');
      offlinePhase='Ready for offline play and analysis.';
    })().finally(()=>{offlinePreparation=null;});
  }
  return {async invoke(method,args={}){
    switch(method){
      case 'prepare':await client.prepare();return null;
      case 'predict':return client.predict(args);
      case 'release':client.release();return null;
      case 'samplingMetadata':return {backend:'onnx-web-wasm',model:modelId,modelSha256:client.snapshot().modelSha256 || '',runtime:'1.31.1'};
      case 'systemDiagnostics':return {flavor:'browser',compiler:globalThis.mobileMaiaNative.compiler,
        browser:navigator.userAgent,appBuild:document.querySelector('meta[name="mobile-maia-asset-base"]')?.content,
        compatibility:'webkit-javascript',model:modelId,maia:client.snapshot(),pwa:await diagnosticStatus(),storage:'IndexedDB'};
      case 'pwaStatus':return offlineStatus();
      case 'prepareOffline':await prepareOffline();return null;
      default:throw new Error('Unsupported compatibility method: '+method);
    }
  }};
}
