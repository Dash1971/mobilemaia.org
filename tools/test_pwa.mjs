// Lifecycle/contract checks for the actual service worker and install controller.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {MessageChannel} from 'node:worker_threads';
import vm from 'node:vm';
const origin='https://mobilemaia.org';
const key=value=>new URL(typeof value==='string'?value:value.url,origin).href;
const store=new Map();
const caches={async keys(){return [...store.keys()];},async delete(name){return store.delete(name);},async open(name){
  if(!store.has(name))store.set(name,new Map());const data=store.get(name);
  return {async match(request){const saved=data.get(key(request))?.clone();if(saved)Object.defineProperty(saved,'url',{value:key(request)});return saved;},async put(request,response){data.set(key(request),response.clone());},async delete(request){return data.delete(key(request));}};
}};
const files=new Map([
  ['/play/index.html','<title>Host</title>'],['/play/app/index.html','<title>App</title>'],
  ['/play/app/bundle-test/main.dart.wasm','wasm-data'],['/lab/inference/core.mjs','export const version=1;'],
  ['/play/app/bundle-test/main.dart.js','js-app'],['/play/app/bundle-test/canvaskit/canvaskit.js','renderer-js'],
  ['/play/app/bundle-test/canvaskit/canvaskit.wasm','renderer-wasm'],
  ['/play/vendor/stockfish.js','worker-code'],
]);
const assets=[...files].map(([url,data])=>({url,bytes:Buffer.byteLength(data),sha256:createHash('sha256').update(data).digest('hex')}));
const template=await readFile(new URL('../browser-app/pwa/sw.js',import.meta.url),'utf8');
let offline=false, corrupt=false, calls=0, claims=0;
const listeners=new Map();
const context=vm.createContext({URL,Response,crypto:webcrypto,console,caches,
 Request:class extends Request{constructor(url,options){super(key(url),options);}},
 fetch:async request=>{calls++;if(offline)throw new Error('Network offline');const path=new URL(key(request)).pathname;const data=files.get(path);return new Response(corrupt&&path.endsWith('.wasm')?'corrupt':data,{status:data===undefined?404:200});},
 self:{location:{origin},clients:{async claim(){claims++;},async matchAll(){return [];}},addEventListener(name,listener){listeners.set(name,listener);}},
});
vm.runInContext(template.replace('__PWA_RELEASE__','"new"').replace('__PWA_ASSETS__',JSON.stringify(assets)),context);
async function event(name,extra={}){const pending=[];let response;listeners.get(name)({waitUntil(value){pending.push(value);},respondWith(value){response=value;},...extra});await Promise.all(pending);return response===undefined?undefined:await response;}
const complete=origin+'/play/offline-complete';
await(await caches.open('mobile-maia-shell-old')).put(complete,new Response('old'));
await(await caches.open('unrelated-user-cache')).put('/keep',new Response('user'));
await(await caches.open('mobile-maia-browser-inference')).put('/model',new Response('model'));
corrupt=true;
await assert.rejects(event('install'),/integrity mismatch/);
assert.equal(store.has('mobile-maia-shell-new'),false);
assert.equal(store.has('mobile-maia-shell-old'),true);
corrupt=false;await event('install');
assert.ok(await(await caches.open('mobile-maia-shell-new')).match(complete));
// A waiting update has not claimed clients or deleted the working old shell.
assert.equal(claims,0);assert.equal(store.has('mobile-maia-shell-old'),true);
await event('activate');assert.equal(claims,0,'Do not take over an already running, uncontrolled app');assert.equal(store.has('mobile-maia-shell-old'),false);
assert.equal(store.has('unrelated-user-cache'),true);assert.equal(store.has('mobile-maia-browser-inference'),true);
offline=true;const before=calls;
for(const [url,expected] of [['/play/?source=pwa','<title>Host</title>'],['/play/app/?qa=test&v=new','<title>App</title>'],['/lab/inference/core.mjs?v=1','export const version=1;']]){
 const response=await event('fetch',{request:{method:'GET',mode:url.startsWith('/play/')?'navigate':'cors',url:origin+url}});assert.equal(await response.text(),expected);
}
for(const [url,expected] of files) {
 const response=await event('fetch',{request:{method:'GET',mode:'cors',url:origin+url}});
 assert.equal(await response.text(),expected,'Every compiler/renderer asset must be available with all network denied');
}
assert.equal(calls,before,'Offline app should not try a network request');
const workerResponse=await event('fetch',{request:{method:'GET',mode:'same-origin',url:origin+'/play/vendor/stockfish.js#blob%3Averified-wasm'}});
assert.equal(await workerResponse.text(),'worker-code');
assert.equal(workerResponse.url,'','Cached worker responses must preserve the requested fragment/verified WASM URL');
for(const url of ['/research/','/about.html','https://example.com/model']){
 assert.equal(await event('fetch',{request:{method:'GET',mode:'navigate',url:new URL(url,origin).href}}),undefined);
}
assert.equal(await event('fetch',{request:{method:'POST',url:origin+'/play/'}}),undefined);
const cache=await caches.open('mobile-maia-shell-new');await cache.delete('/play/app/bundle-test/main.dart.wasm');
const replies=[];await event('message',{data:{type:'SAVE_SHELL'},ports:[{postMessage(value){replies.push(value);}}]});
assert.match(replies.at(-1).error,/offline/);assert.equal(await cache.match(complete),undefined);
offline=false;await event('message',{data:{type:'SAVE_SHELL'},ports:[{postMessage(value){replies.push(value);}}]});
assert.equal(replies.at(-1).done,true);assert.ok(await cache.match(complete));
const statuses=[];await event('message',{data:{type:'STATUS'},ports:[{postMessage(value){statuses.push(value);}}]});assert.equal(statuses[0].shellReady,true);

// Installation is an explicit action, with no shell/model download on a visit.
let registrations=0, prevented=false;const pageEvents=new Map();
const page=vm.createContext({URL,MessageChannel,setTimeout,clearTimeout,isSecureContext:true,
 location:{href:origin+'/play/'},matchMedia:()=>({matches:false}),addEventListener:(name,callback)=>pageEvents.set(name,callback),
 navigator:{serviceWorker:{addEventListener(){},async getRegistration(){return undefined;},async register(){registrations++;return {active:{scriptURL:origin+'/play/sw.js',postMessage(data,ports){ports[0].postMessage({shellReady:true,progress:1});ports[0].close();}}};}}},
 parent:null,window:{},console,
});
const module=new vm.SourceTextModule(await readFile(new URL('../site/play/pwa.mjs',import.meta.url),'utf8'),{context:page});await module.link(()=>{});await module.evaluate();
await module.namespace.pwa.status();assert.equal(registrations,0);
pageEvents.get('beforeinstallprompt')({preventDefault(){prevented=true;},async prompt(){},userChoice:Promise.resolve({outcome:'accepted'})});
assert.equal(prevented,true);assert.equal((await module.namespace.pwa.status()).canInstall,true);
assert.equal(await module.namespace.pwa.install(),true);assert.equal(registrations,1);
assert.equal((await module.namespace.pwa.status()).shellReady,true,'Completed-install progress must not swallow a status reply');

const manifest=JSON.parse(await readFile(new URL('../site/play/manifest.webmanifest',import.meta.url)));
assert.equal(manifest.scope,'/play/');assert.equal(manifest.start_url,'/play/?source=pwa');assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons){const data=await readFile(new URL('../site/play/'+icon.src,import.meta.url));assert.equal(data.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(data.readUInt32BE(20),Number(icon.sizes.split('x')[1]));}
assert.equal(template.includes('skipWaiting('),false);
console.log('PASS: opt-in installation, icon dimensions, full hash-checked offline shell, offline routing, failed-install rollback/retry, waiting-update safety and cache isolation.');
