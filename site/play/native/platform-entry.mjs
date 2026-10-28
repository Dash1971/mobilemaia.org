// SPDX-License-Identifier: AGPL-3.0-only
const version=new URL(import.meta.url).search;
const {usesWebKitCompatibility}=await import(new URL('runtime-route.mjs'+version,import.meta.url));
const {stockfishBytes}=await import(new URL('platform.mjs'+version,import.meta.url));
const host=globalThis.mobileMaiaNative,standardInvoke=host.invoke;
const methods=new Set(['prepare','predict','release','samplingMetadata','systemDiagnostics','pwaStatus','prepareOffline']);
let compatibility;
host.invoke=async(channel,method,args)=>{
  if(channel==='maia_chess/engine' && methods.has(method)
      && usesWebKitCompatibility(host.compiler,navigator.userAgent)){
    const adapter=await(compatibility??=import(new URL('platform-compat.mjs'+version,import.meta.url))
      .then(module=>module.createCompatibility({stockfishBytes})).catch(error=>{compatibility=null;throw error;}));
    return adapter.invoke(method,args);
  }
  return standardInvoke(channel,method,args);
};
