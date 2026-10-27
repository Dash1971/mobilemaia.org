// SPDX-License-Identifier: AGPL-3.0-only
// Shared by the page and its app iframe, so install prompts keep top-level context.
function createController() {
  let registration, prompt, failure = '', shellProgress;
  addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; });
  addEventListener('appinstalled', () => { prompt = null; void ensureRegistration().catch(error => { failure = error.message; }); });
  const supported = 'serviceWorker' in navigator && isSecureContext;
  if (supported) navigator.serviceWorker.addEventListener('message', event => {
    if (event.source?.scriptURL === new URL('/play/sw.js', location.href).href && event.data?.type === 'PWA_INSTALL_ERROR') failure=event.data.message;
  });
  // Keep the normal first visit light. Enable the offline shell when requested
  // or installed; an existing offline installation continues to update normally.
  const ready = supported ? navigator.serviceWorker.getRegistration('/play/')
    .then(value => {
      if (value?.active?.scriptURL === new URL('/play/sw.js', location.href).href) {
        registration = value; void value.update().catch(() => {});
      }
      return registration;
    })
    .catch(error => { failure = error.message; return null; }) : Promise.resolve(null);
  let registering;
  async function ensureRegistration() {
    await ready;
    if (!supported) throw new Error('Offline storage is unavailable in this browser.');
    if (registration && (registration.active || registration.installing || registration.waiting)) return registration;
    return registering ??= navigator.serviceWorker.register('/play/sw.js', {scope:'/play/', updateViaCache:'none'})
      .then(value => { registration=value;failure='';return value; })
      .finally(() => { registering=null; });
  }
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) {
    void ensureRegistration().catch(error => { failure=error.message; });
  }
  function message(worker, data, progress) {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      let timer;
      function finish(error, result) { clearTimeout(timer); channel.port1.close(); error ? reject(error) : resolve(result); }
      function resetTimer() { clearTimeout(timer); timer = setTimeout(() => finish(new Error('Offline setup timed out. Please retry.')), data.type === 'STATUS' ? 3000 : 120000); }
      channel.port1.onmessage = ({data: reply}) => {
        if (reply.error) finish(new Error(reply.error));
        else if (data.type !== 'STATUS' && reply.progress !== undefined) { resetTimer(); progress?.(reply.progress); }
        else finish(null, reply);
      };
      resetTimer();worker.postMessage(data, [channel.port2]);
    });
  }
  return {
    async status() {
      await ready;
      let state={};
      const worker = registration?.active || registration?.installing;
      if (worker) try { state=await message(worker,{type:'STATUS'}); failure=''; } catch(error) { failure=error.message; }
      return {
        supported,
        installed: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
        canInstall: !!prompt,
        shellReady: state.shellReady === true,
        registered: !!registration?.active,
        shellProgress: shellProgress ?? state.progress,
        updating: !!registration?.waiting,
        preparing: !!registration?.installing,
        workerState: registration?.active?.state || registration?.installing?.state || 'not registered',
        controller: navigator.serviceWorker?.controller?.scriptURL || '',
        release: state.release || '',
        error: failure,
      };
    },
    async saveShell() {
      await this.waitForShell();
      shellProgress=0;
      try { await message(registration.active,{type:'SAVE_SHELL'},value=>{shellProgress=value;}); }
      finally { shellProgress=null; }
    },
    async install() {
      if (!prompt) return false;
      const current = prompt; prompt = null;
      await current.prompt();
      const accepted = (await current.userChoice).outcome === 'accepted';
      if (accepted) await ensureRegistration();
      return accepted;
    },
    async waitForShell() {
      const value = await ensureRegistration();
      if (!value) throw new Error(failure || 'Offline storage is unavailable in this browser.');
      if (value.active) return;
      const worker = value.installing || value.waiting;
      if (!worker) throw new Error('Offline setup failed. Reopen while online to retry.');
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { worker.removeEventListener('statechange', changed); reject(new Error('Offline setup timed out. Reopen while online to retry.')); }, 120000);
        function changed() {
          if (worker.state === 'activated') { clearTimeout(timer); worker.removeEventListener('statechange', changed); resolve(); }
          if (worker.state === 'redundant') { clearTimeout(timer); worker.removeEventListener('statechange', changed); reject(new Error(failure || 'Offline setup failed. Check your connection and free space, then reopen.')); }
        }
        worker.addEventListener('statechange', changed); changed();
      });
    },
  };
}
let shared;
try { shared = parent !== window && parent.mobileMaiaPwa; } catch {}
export const pwa = shared || createController();
window.mobileMaiaPwa = pwa;
