// Card side of the SWISCARS reader extension. Talks only to this window (the extension's
// content script relays it). Returns the rendered-page snapshot of the requested listing.
(() => {
  'use strict';
  const api = {
    available: () => document.documentElement.dataset.swiscarsReaderExtension === '1',
    ready() {
      if(api.available())return Promise.resolve(true);
      return new Promise(resolve=>{const done=()=>{clearTimeout(timer);observer.disconnect();resolve(api.available());};const observer=new MutationObserver(()=>{if(api.available())done();});const timer=setTimeout(done,1500);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-swiscars-reader-extension']});});
    },
    read(url, {onStage} = {}) {
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', onMessage); };
        const onMessage = event => {
          if (event.source !== window || event.origin !== location.origin) return;
          const m = event.data;
          if (!m || m.source !== 'swiscars-ext' || m.id !== id) return;
          if (m.type === 'stage') { onStage?.(m.stage); return; }
          cleanup();
          if (m.type === 'snapshot' && m.snapshot && typeof m.snapshot === 'object') resolve(m.snapshot);
          else reject(Error(m.reason || 'source_unavailable'));
        };
        const timer = setTimeout(() => {
          cleanup();
          window.postMessage({source: 'swiscars-card', type: 'cancel'}, location.origin);
          reject(Error('extension_disconnected'));
        }, 210000);
        window.addEventListener('message', onMessage);
        window.postMessage({source: 'swiscars-card', type: 'read', id, url}, location.origin);
      });
    },
    cancel() { window.postMessage({source: 'swiscars-card', type: 'cancel'}, location.origin); }
  };
  window.SCReaderExtension = Object.freeze(api);
})();
