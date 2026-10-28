// SPDX-License-Identifier: AGPL-3.0-only
import {pwa} from './pwa.mjs?v=__PWA_SOURCE__';
const query=new URLSearchParams(location.search);
const target=new URL('app/',location.href);
const build=document.querySelector('meta[name="mobile-maia-build"]')?.content;if(build&&!build.startsWith('__'))target.searchParams.set('v',build);
for(const name of ['model','qa','offlineqa','renderer'])if(query.has(name))target.searchParams.set(name,query.get(name));
document.getElementById('app').src=target.href;
// Isolated QA data belongs to this test, never to a normal app session.
const qa=query.get('qa')?.match(/^[a-z0-9-]{1,60}$/)?.[0];
if(qa){
  const inspect=document.createElement('button');inspect.type='button';inspect.textContent='Show QA diagnostics';
  const output=document.createElement('pre');output.style.cssText='white-space:pre-wrap;font-size:11px;max-width:470px;max-height:300px;overflow:auto';
  inspect.onclick=async()=>{
    const app=document.getElementById('app');
    const data=app?.contentWindow.mobileMaiaNative ? await app.contentWindow.mobileMaiaNative.invoke('maia_chess/engine','systemDiagnostics') : null;
    output.textContent=JSON.stringify({pwa:await pwa.status(),app:data},null,2);
  };
  document.querySelector('.trial-intro').append(inspect,output);
  const end=document.createElement('button');end.type='button';end.id='qa-end';end.textContent='End this test and clear its data';
  const status=document.createElement('p');status.id='qa-status';status.setAttribute('role','status');
  document.querySelector('.trial-intro').append(end,status);
  end.onclick=async()=>{
    end.disabled=true;document.getElementById('app').remove();
    try{
      await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('mobile-maia-app-qa-'+qa);r.onsuccess=resolve;r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Test database is still open'));});
      for(const key of Object.keys(localStorage))if(key.startsWith('mobileMaiaQa.'+qa+'.')||key.startsWith('flutter.mobileMaiaQa.'+qa+'.'))localStorage.removeItem(key);
      await caches.delete('mobile-maia-engine-qa-'+qa);
      if(location.hostname==='127.0.0.1'&&location.port==='8773'){
        for(const r of await navigator.serviceWorker.getRegistrations())if(r.scope===new URL('./',location.href).href)await r.unregister();
        for(const name of await caches.keys())if(name.startsWith('mobile-maia-shell-') || name==='mobile-maia-fonts-v1')await caches.delete(name);
      }
      status.textContent='Test data cleared. App workers closed.';
    }catch(error){status.textContent='Test cleanup: '+error.message;end.disabled=false;}
  };
}
