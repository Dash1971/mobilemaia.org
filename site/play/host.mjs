// SPDX-License-Identifier: AGPL-3.0-only
const query=new URLSearchParams(location.search);
const target=new URL('app/',location.href);
const build=document.querySelector('meta[name="mobile-maia-build"]')?.content;if(build&&!build.startsWith('__'))target.searchParams.set('v',build);
for(const name of ['model','qa'])if(query.has(name))target.searchParams.set(name,query.get(name));
document.getElementById('app').src=target.href;
// Isolated QA data belongs to this test, never to a normal app session.
const qa=query.get('qa')?.match(/^[a-z0-9-]{1,60}$/)?.[0];
if(qa){
  const end=document.createElement('button');end.type='button';end.id='qa-end';end.textContent='End this test and clear its data';
  const status=document.createElement('p');status.id='qa-status';status.setAttribute('role','status');
  document.querySelector('.trial-intro').append(end,status);
  end.onclick=async()=>{
    end.disabled=true;document.getElementById('app').remove();
    try{
      await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('mobile-maia-app-qa-'+qa);r.onsuccess=resolve;r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Test database is still open'));});
      for(const key of Object.keys(localStorage))if(key.startsWith('mobileMaiaQa.'+qa+'.')||key.startsWith('flutter.mobileMaiaQa.'+qa+'.'))localStorage.removeItem(key);
      if(location.hostname==='127.0.0.1'&&location.port==='8772'){
        for(const r of await navigator.serviceWorker.getRegistrations())if(r.scope===new URL('app/',location.href).href)await r.unregister();
        for(const name of await caches.keys())if(name.startsWith('flutter-'))await caches.delete(name);
      }
      status.textContent='Test data cleared. App workers closed.';
    }catch(error){status.textContent='Test cleanup: '+error.message;end.disabled=false;}
  };
}
