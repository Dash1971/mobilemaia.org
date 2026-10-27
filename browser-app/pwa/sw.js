// SPDX-License-Identifier: AGPL-3.0-only
// Generated with the deployed shell's exact URLs and SHA-256s. Only /play/
// clients are controlled; homepage/research and the verified engine cache stay separate.
const RELEASE = __PWA_RELEASE__;
const ASSETS = __PWA_ASSETS__;
const PREFIX = 'mobile-maia-shell-';
const CACHE = PREFIX + RELEASE;
const FONT_CACHE = 'mobile-maia-fonts-v1';
const COMPLETE = new URL('/play/offline-complete', self.location.origin).href;
const assets = new Map(ASSETS.map(asset => [new URL(asset.url, self.location.origin).href, asset]));
let installProgress;

async function fetchAsset(cache, asset) {
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const request = new Request(asset.url, {cache: attempt ? 'reload' : 'no-cache', credentials: 'same-origin'});
      response = await fetch(request);
      if (!response.ok) throw new Error('Download returned HTTP ' + response.status);
      const bytes = await response.clone().arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map(value => value.toString(16).padStart(2, '0')).join('');
      if (bytes.byteLength !== asset.bytes || hash !== asset.sha256) throw new Error('Offline shell integrity mismatch');
      break;
    } catch (error) {
      if (attempt) throw new Error(asset.url + ': ' + error.message);
    }
  }
  await cache.put(new URL(asset.url, self.location.origin).href, response.clone());
  return response;
}
async function precache(progress = () => {}) {
  const cache = await caches.open(CACHE);
  await cache.delete(COMPLETE);
  const queue = [...ASSETS];
  let completed = 0, failure;
  await Promise.all(Array.from({length: 4}, async () => {
      while (queue.length && !failure) {
        const asset = queue.shift();
        try {
          if (!await cache.match(new URL(asset.url, self.location.origin).href)) await fetchAsset(cache, asset);
          progress(++completed / ASSETS.length);
        } catch (error) {
          failure = error;
        }
      }
  }));
  if (failure) throw failure;
  await cache.put(COMPLETE, new Response(RELEASE));
}
self.addEventListener('install', event => event.waitUntil((async () => {
  try { await precache(value => { installProgress = value; }); }
  catch (error) {
    await caches.delete(CACHE);
    const message = error.name === 'QuotaExceededError' ? 'Not enough browser storage to save the offline app.' : error.message;
    for (const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})) {
      if (new URL(client.url).pathname.startsWith('/play/')) client.postMessage({type:'PWA_INSTALL_ERROR',message});
    }
    throw error;
  }
})()));
// No skipWaiting: an update waits for existing games/tabs to close.
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
  }
  // Existing uncontrolled pages may be an older app build. Leave them alone;
  // the saved worker controls the next launch/navigation within /play/.
})()));
self.addEventListener('message', event => {
  if (event.data?.type === 'STATUS') {
    event.waitUntil((async () => event.ports[0]?.postMessage({release: RELEASE,
      shellReady: !!await (await caches.open(CACHE)).match(COMPLETE), progress: installProgress, cache: CACHE}))());
  } else if (event.data?.type === 'SAVE_SHELL') {
    event.waitUntil(precache(value => event.ports[0]?.postMessage({progress: value}))
      .then(() => event.ports[0]?.postMessage({done: true}))
      .catch(error => event.ports[0]?.postMessage({error: error.message})));
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  let key = url.origin + url.pathname;
  if (url.origin === self.location.origin && event.request.mode === 'navigate') {
    if (url.pathname === '/play/' || url.pathname === '/play/index.html') key = url.origin + '/play/index.html';
    else if (url.pathname === '/play/app/' || url.pathname === '/play/app/index.html') key = url.origin + '/play/app/index.html';
    else return;
  }
  if (assets.has(key)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const response = await cache.match(key) || await fetchAsset(cache, assets.get(key));
      // A cached Response.url can replace a worker's requested URL, dropping its
      // fragment. Stockfish uses that fragment for its verified WASM blob URL.
      // A synthetic response keeps the original request URL/fragment as the base.
      return new Response(response.body, {status: response.status,
        statusText: response.statusText, headers: response.headers});
    })());
  } else if (url.origin === 'https://fonts.gstatic.com') {
    // Previously used language/symbol fallbacks remain usable offline. A language
    // never opened online may still need its extra font download.
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const saved = await cache.match(event.request);
      if (saved) return saved;
      const response = await fetch(event.request);
      if (response.ok && response.type !== 'opaque') await cache.put(event.request, response.clone());
      return response;
    })());
  }
});
