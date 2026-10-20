import { createHash, timingSafeEqual } from 'node:crypto';

export const API = 'https://api.browser-use.com/api/v4/browsers';
export const browserOptions = Object.freeze({solveCaptchas:false,proxyCountryCode:null,timeout:1,enableRecording:false});
const publicReason=/^(invalid_url|not_configured|provider_http_\d{3}|missing_browser_connection|invalid_session|invalid_browser_connection|unexpected_redirect|browser_cleanup_failed|browser_connection_failed|browser_connection_http_\d{3}|browser_disconnected|browser_command_failed|navigation_failed|timeout)$/;
const networkCodes=new Set(['EACCES','EPERM','ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENETUNREACH','EHOSTUNREACH']);
export function sanitizedReason(error,signal) {
  if(error?.message==='browser_cleanup_failed')return 'browser_cleanup_failed';
  if(signal?.aborted||error?.name==='TimeoutError'||error?.name==='AbortError')return 'timeout';
  const reason=error?.message||'';
  if(publicReason.test(reason)||(reason.startsWith('network_')&&networkCodes.has(reason.slice(8))))return reason;
  const queue=[error];
  for(let i=0;i<queue.length&&i<12;i++){
    const item=queue[i];if(!item||typeof item!=='object')continue;
    if(networkCodes.has(item.code))return 'network_'+item.code;
    if(item.cause)queue.push(item.cause);
    if(Array.isArray(item.errors))queue.push(...item.errors.slice(0,4));
  }
  return 'read_failed';
}
export function shouldStopProbe(reason) {
  return /^(browser_|provider_http_|network_)/.test(reason||'')||['not_configured','read_failed','timeout','invalid_browser_connection','missing_browser_connection','invalid_session'].includes(reason);
}
const diagnosticStages=new Set(['browser_connection','discovery_request','discovery_response','discovery_redirect','websocket_resolved','websocket_connecting','websocket_open','page_reading']);
function diagnostic(callback,stage,connection,httpStatus) {
  if(typeof callback!=='function'||!diagnosticStages.has(stage))return;
  const event={stage};
  if(connection){
    event.protocol=connection.protocol;
    // Cloud browser hostnames can contain session identifiers; log only a provider family.
    const suffix=connection.hostname.match(/(?:^|\.)(cdp\d*|free-cdp\d*|connect|api|live)\.browser-use\.com$/);
    event.hostname=suffix?suffix[1]+'.browser-use.com':connection.hostname==='browser-use.com'||connection.hostname.endsWith('.browser-use.com')?'browser-use.com':'[external]';
  }
  if(Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599)event.httpStatus=httpStatus;
  try{callback(event);}catch(_){} // Diagnostics cannot change the read or cleanup lifecycle.
}
export function authorized(header, secret) {
  if(!secret||!header?.startsWith('Bearer '))return false;
  const hash=s=>createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(header.slice(7)),hash(secret));
}
export function allowedUrl(value) {
  let u;try{u=new URL(value);}catch(_){throw Error('invalid_url');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)throw Error('invalid_url');
  const ok=(u.hostname==='www.autoscout24.ch'&&/^\/de\/d\/(?:[a-z0-9-]+-)?\d+\/?$/.test(u.pathname))||
    (u.hostname==='www.comparis.ch'&&/^\/carfinder\/marktplatz(?:\/|$)/.test(u.pathname))||
    (u.hostname==='www.polovniautomobili.com'&&/^\/auto-oglasi\/(?:pretraga|\d+)(?:\/|$)/.test(u.pathname));
  if(!ok)throw Error('invalid_url');
  return u.href;
}
export function classify(snapshot) {
  const title=snapshot.title||'',text=snapshot.text||'';
  if(/just a moment|nur einen moment|sicherheitsüberprüfung|access denied|captcha|please enable js|verify you are human|proverite da ste čovek/i.test(title+'\n'+text))return 'blocked';
  const cards=(snapshot.cards||[]).filter(c=>c.text&&c.url);
  if(snapshot.heading&&/\bCHF\s*[\d’']/.test(text)&&/\bkm\b/.test(text)&&/\/de\/d\//.test(snapshot.url||''))return 'ok';
  if(cards.length&&/CHF|€/.test(text))return 'ok';
  // A result counter can temporarily be zero while the SPA is still fetching.
  if(/Leider\s+konnten\s+wir\s+keine\s+passenden\s+Ergebnisse\s+für\s+Ihre\s+Suchkriterien\s+finden|\bnema (?:rezultata|oglasa)|\bnijedan oglas/i.test(text))return 'ok';
  return 'error';
}
async function provider(path,method,key,body,fetchFn,signal) {
  const r=await fetchFn(path,{method,headers:{'X-Browser-Use-API-Key':key,'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  if(!r.ok)throw Error('provider_http_'+r.status);
  return r.json();
}
function providerConnection(value,protocols) {
  let u;try{u=new URL(value);}catch(_){throw Error('invalid_browser_connection');}
  if(!protocols.includes(u.protocol)||u.username||u.password||u.port||u.hash||!/(^|\.)browser-use\.com$/.test(u.hostname))throw Error('invalid_browser_connection');
  return u;
}
async function browserConnection(value,fetchFn,signal,onDiagnostic) {
  let cdp=providerConnection(value,['https:','wss:']);
  diagnostic(onDiagnostic,'browser_connection',cdp);
  if(cdp.protocol==='wss:')return cdp.href;
  // The official client preserves query tokens when adding the discovery path.
  cdp.pathname=cdp.pathname.replace(/\/+$/,'');
  if(!cdp.pathname.endsWith('/json/version'))cdp.pathname+='/json/version';
  let response;
  for(let redirects=0;;redirects++){
    diagnostic(onDiagnostic,'discovery_request',cdp);
    try{response=await fetchFn(cdp.href,{method:'GET',signal,redirect:'manual'});}
    catch(e){const reason=sanitizedReason(e,signal);throw Error(reason==='read_failed'?'browser_connection_failed':reason);}
    diagnostic(onDiagnostic,'discovery_response',cdp,response.status);
    if(response.redirected)throw Error('invalid_browser_connection');
    if(![301,302,303,307,308].includes(response.status))break;
    if(redirects>=2)throw Error('browser_connection_failed');
    const location=response.headers.get('location');
    if(!location)throw Error('browser_connection_failed');
    let target;try{target=new URL(location,cdp);}catch(_){throw Error('invalid_browser_connection');}
    // Validate every redirect before issuing another request, including relative URLs.
    cdp=providerConnection(target.href,['https:']);
    diagnostic(onDiagnostic,'discovery_redirect',cdp,response.status);
  }
  if(!response.ok)throw Error('browser_connection_http_'+response.status);
  let version;try{version=await response.json();}catch(_){throw Error('invalid_browser_connection');}
  const ws=providerConnection(version?.webSocketDebuggerUrl,['wss:']);
  diagnostic(onDiagnostic,'websocket_resolved',ws);
  return ws.href;
}
export async function readListing(url,key,{fetchFn=fetch,readPage=readCdpPage,deadlineMs=43000,onDiagnostic}={}) {
  url=allowedUrl(url);
  if(!key)throw Error('not_configured');
  const signal=AbortSignal.timeout(deadlineMs);
  let session,result,failure;
  try {
    session=await provider(API,'POST',key,browserOptions,fetchFn,signal);
    if(!/^[\da-f-]{36}$/i.test(session?.id||''))throw Error('invalid_session');
    if(!session.cdpUrl)throw Error('missing_browser_connection');
    const cdpUrl=await browserConnection(session.cdpUrl,fetchFn,signal,onDiagnostic);
    const snapshot=await readPage(cdpUrl,url,signal,{onDiagnostic});
    allowedUrl(snapshot.url);
    if(new URL(snapshot.url).hostname!==new URL(url).hostname)throw Error('unexpected_redirect');
    result={status:classify(snapshot),source:new URL(url).hostname,requestedUrl:url,readAt:Date.now(),snapshot};
  } catch(e) {failure=Error(sanitizedReason(e,signal));}
  finally {
    if(session?.id&&/^[\da-f-]{36}$/i.test(session.id)){
      try{await provider(API+'/'+session.id,'PATCH',key,{action:'stop'},fetchFn,AbortSignal.timeout(7000));}
      catch(_){failure=Error('browser_cleanup_failed');}
    }
  }
  if(failure)throw failure;
  return result;
}

// No page actions, logins or challenge handling: read rendered DOM only.
export async function readCdpPage(cdpUrl,url,signal,{WebSocketImpl=WebSocket,pollMs=700,emptyStableMs=5000,interstitialWaitMs=15000,now=()=>performance.now(),onDiagnostic}={}) {
  const connection=new URL(cdpUrl);
  diagnostic(onDiagnostic,'websocket_connecting',connection);
  const ws=new WebSocketImpl(cdpUrl),pending=new Map();let seq=0;
  const rejectAll=(error=Error('browser_disconnected'))=>{for(const p of pending.values())p.reject(error);pending.clear();};
  ws.addEventListener('message',event=>{
    let msg;try{msg=JSON.parse(event.data);if(!msg||typeof msg!=='object')throw Error();}catch(_){rejectAll(Error('browser_command_failed'));ws.close();return;}
    if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error){const error=Error('browser_command_failed');error.cdpMessage=String(msg.error.message||'');p.reject(error);}else p.resolve(msg.result);}
  });
  ws.addEventListener('close',()=>rejectAll());
  ws.addEventListener('error',()=>rejectAll(Error('browser_disconnected')));
  const abort=()=>{rejectAll(Error('timeout'));ws.close();};signal.addEventListener('abort',abort,{once:true});
  function send(method,params={},sessionId){
    if(signal.aborted)return Promise.reject(Error('timeout'));
    return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  }
  try {
    await new Promise((resolve,reject)=>{
      if(signal.aborted){reject(Error('timeout'));return;}
      const fail=()=>reject(Error('browser_connection_failed'));
      ws.addEventListener('open',()=>{diagnostic(onDiagnostic,'websocket_open',connection);resolve();},{once:true});ws.addEventListener('error',fail,{once:true});
      ws.addEventListener('close',fail,{once:true});
    });
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    await send('Page.enable',{},sessionId);
    const nav=await send('Page.navigate',{url},sessionId);
    if(nav.errorText)throw Error('navigation_failed');
    diagnostic(onDiagnostic,'page_reading',connection);
    const expression=`JSON.stringify({url:location.href,readyState:document.readyState,title:document.title,heading:document.querySelector('h1')?.innerText.trim()||'',text:document.body?.innerText.slice(0,50000)||'',photos:Array.from(document.querySelectorAll('img')).filter(img=>/-image-\\d+$/.test(img.alt||'')).map(img=>img.currentSrc||img.src).filter(Boolean).slice(0,50),place:Array.from(document.querySelectorAll('a[href]')).find(a=>{try{return /(^|\\.)google\\.[a-z.]+$/.test(new URL(a.href).hostname)&&new URL(a.href).pathname.startsWith('/maps/search')&&/\\b\\d{4}\\b/.test(a.innerText);}catch{return false;}})?.innerText.trim()||'',cards:Array.from(document.querySelectorAll('a[href]')).filter(a=>/\\/details\\/show\\/\\d+|\\/auto-oglasi\\/\\d+/.test(a.getAttribute('href')||'')&&a.innerText.trim()).map(a=>({url:a.href,text:a.innerText.trim().slice(0,3000)})).slice(0,100)})`;
    // Readiness is based on page contents; a loading screen never means zero listings.
    let stable='',emptySince=null,blockedSince=null;
    while(!signal.aborted){
      try{
        const v=await send('Runtime.evaluate',{expression,returnByValue:true},sessionId);
        const snapshot=JSON.parse(v.result.value),status=classify(snapshot);
        if(status==='blocked'){
          // A normal navigation can briefly show the site's automatic connection
          // check. Let the page finish its own loading, without clicks, challenge
          // handling, refreshes or changed browser settings. A persistent check
          // still ends the read and never becomes listing data.
          blockedSince??=now();
          if(now()-blockedSince>=interstitialWaitMs)return snapshot;
          stable='';emptySince=null;
        }else if(status==='ok'&&snapshot.readyState==='complete'){
          blockedSince=null;
          allowedUrl(snapshot.url);
          if(new URL(snapshot.url).hostname!==new URL(url).hostname)throw Error('unexpected_redirect');
          const populated=Boolean(snapshot.heading&&/\/de\/d\//.test(snapshot.url||''))||(snapshot.cards||[]).some(card=>card.text&&card.url);
          // Empty messages also appear during SPA transitions. Require the entire
          // rendered snapshot to remain unchanged for five seconds before zero.
          // Populated listings keep the fast two-read path despite changing footers.
          const current=JSON.stringify({url:snapshot.url,title:snapshot.title,...(snapshot.heading?{heading:snapshot.heading,photos:snapshot.photos,place:snapshot.place,text:snapshot.text}:populated?{}:{text:snapshot.text}),cards:snapshot.cards||[]});
          if(current===stable){
            if(populated||now()-emptySince>=emptyStableMs)return snapshot;
          }else{
            stable=current;
            emptySince=populated?null:now();
          }
        }else{stable='';emptySince=null;blockedSince=null;}
      }catch(e){
        // The navigation can replace a context while the first DOM read is in flight.
        if(!/execution context was destroyed|cannot find context with specified id|cannot find default execution context/i.test(e.cdpMessage||''))throw e;
        stable='';emptySince=null;
      }
      await new Promise(resolve=>{const finish=()=>{clearTimeout(t);signal.removeEventListener('abort',finish);resolve();};const t=setTimeout(finish,pollMs);signal.addEventListener('abort',finish,{once:true});});
    }
    throw Error('timeout');
  } finally {signal.removeEventListener('abort',abort);ws.close();}
}
