// Relays requests only from this local card window. Each request gets one terminal reply.
(() => {
  document.documentElement.dataset.swiscarsReaderExtension = '1';
  document.documentElement.dataset.swiscarsReaderVersion = chrome.runtime.getManifest?.()?.version || '';
  let active = null;
  const reply = (id, data) => window.postMessage({source: 'swiscars-ext', id, ...data}, location.origin);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const msg = event.data;
    if (!msg || msg.source !== 'swiscars-card') return;
    if (msg.type === 'cancel') {
      if (active) {
        const request = active; active = null;
        reply(request.id, {type: 'error', reason: 'cancelled'});
        clearInterval(request.keepalive);request.port.disconnect();
      }
      return;
    }
    if (msg.type !== 'read' || typeof msg.url !== 'string' || typeof msg.id !== 'string' || active) return;
    let port;
    try { port = chrome.runtime.connect({name: 'swiscars-read'}); }
    catch { reply(msg.id, {type: 'error', reason: 'extension_disconnected'}); return; }
    const request = {id: msg.id, port, keepalive:null}; active = request;
    const finish = data => {
      if (active !== request) return;
      active = null; clearInterval(request.keepalive);reply(request.id, data); port.disconnect();
    };
    port.onMessage.addListener(data => {
      if (active !== request) return;
      if (data?.type === 'stage') reply(request.id, {type: 'stage', stage: String(data.stage)});
      else if (data?.type === 'snapshot') finish({type: 'snapshot', snapshot: data.snapshot});
      else if (data?.type === 'error') finish({type: 'error', reason: String(data.reason)});
    });
    port.onDisconnect.addListener(() => {
      const error=chrome.runtime.lastError?.message||'';
      if (active !== request) return;
      active = null;clearInterval(request.keepalive);reply(request.id, {type:'error',reason:/Receiving end does not exist|Could not establish connection/i.test(error)?'reader_background_unavailable':'extension_disconnected'});
    });
    try { port.postMessage({type: 'read', url: msg.url}); request.keepalive=setInterval(()=>{if(active!==request)return;try{port.postMessage({type:'keepalive'});}catch{finish({type:'error',reason:'extension_disconnected'});}},10000); }
    catch { finish({type: 'error', reason: 'extension_disconnected'}); }
  });
})();
