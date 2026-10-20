// One read per request: open the listing in a normal tab of this browser, let it load
// normally, read the rendered page with the same snapshot function as the local reader,
// expand only equipment/specification lists, then close the tab and return the snapshot.
// No form input or human-verification clicks, no debugger,
// no cookie access. If the site shows an access check, the tab stays in front so the
// person can complete it; the same read then continues.
import {snapshotScript} from './snapshot.js';
import {expandListingDetails} from './expand-details.js';

const LISTING = /^https:\/\/www\.autoscout24\.ch\/de\/d\/(?:[a-z0-9-]+-)?\d+\/?$/;
function allowedCard(sender){
  try{const url=new URL(sender?.url||'');const origin=sender?.origin;
    if(origin&&origin!=='null'&&origin!==url.origin)return false;
    return (url.origin==='https://swiscars.com'&&url.pathname.startsWith('/intern/predlog-vozila/'))||(/^http:\/\/127\.0\.0\.[12]:4193$/.test(url.origin)&&url.pathname.startsWith('/predlog-kartice/'));
  }catch{return false;}
}
const CHECK = /nur einen moment|sicherheitsüberprüfung|bestätigen sie, dass sie ein mensch|just a moment|verify you are human|enable javascript and cookies to continue|check the box below and complete the task/i;
const WAIT_MS = 180000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

chrome.runtime.onConnect.addListener(port => {
  if(port.name!=='swiscars-read'){port.disconnect();return;}
  if(!allowedCard(port.sender)){try{port.postMessage({type:'error',reason:'reader_source_rejected'});}catch{}return;}
  const cardTab = port.sender.tab;
  let closed = false, started = false;
  port.onDisconnect.addListener(() => { closed = true; });
  const post = m => { if (!closed) try { port.postMessage(m); } catch {} };
  port.onMessage.addListener(async msg => {
    if (msg?.type !== 'read' || started) return;
    started = true;post({type:'stage',stage:'reader_connected'});
    let tabId = null, sawCheck = false;
    try {
      let url;
      try { url = new URL(String(msg.url)); } catch { throw Error('invalid_url'); }
      url.hash = ''; url.search = '';
      if (!LISTING.test(url.href)) throw Error('unsupported_source');
      const tab = await chrome.tabs.create({url: url.href, active: true, windowId: cardTab?.windowId, index: cardTab ? cardTab.index + 1 : undefined, openerTabId: cardTab?.id});
      tabId = tab.id;
      post({type: 'stage', stage: 'page_loading'});
      const deadline = Date.now() + WAIT_MS;
      let lastKey = '';
      while (!closed && Date.now() < deadline) {
        await sleep(1000);
        try { await chrome.tabs.get(tabId); } catch { throw Error('tab_closed'); }
        let snap;
        try { [{result: snap}] = await chrome.scripting.executeScript({target: {tabId}, func: snapshotScript}); }
        catch { continue; } // page still navigating, or on a host this extension may not read
        if (!snap) continue;
        if (new URL(snap.url).hostname !== 'www.autoscout24.ch') throw Error('unexpected_redirect');
        const requestedId=url.pathname.match(/(\d+)\/?$/)?.[1];
        if(new URL(snap.url).pathname.match(/(\d+)\/?$/)?.[1]!==requestedId)throw Error('unexpected_redirect');
        if (CHECK.test(snap.title + '\n' + snap.heading + '\n' + snap.text)) {
          if (!sawCheck) { sawCheck = true; post({type: 'stage', stage: 'access_check'}); }
          lastKey = ''; continue;
        }
        const ready = snap.readyState === 'complete' && snap.heading && /\bCHF\s*[\d'’]/.test(snap.text) && /\bkm\b/.test(snap.text) && /\/de\/d\//.test(snap.url);
        if (!ready) { lastKey = ''; continue; }
        if (sawCheck) { post({type: 'stage', stage: 'access_check_cleared'}); sawCheck = false; }
        const [{result:expanded}]=await chrome.scripting.executeScript({target:{tabId},func:expandListingDetails});
        if(expanded){lastKey='';continue;}
        // Two equal reads one second apart: gallery and data have finished rendering.
        const key = JSON.stringify([snap.url, snap.heading, snap.photos, snap.place, snap.vehicleDetails, snap.equipment]);
        if (key === lastKey) { post({type: 'snapshot', snapshot: snap}); return; }
        lastKey = key;
      }
      throw Error(closed ? 'cancelled' : sawCheck ? 'access_check_timeout' : 'source_unavailable');
    } catch (error) {
      post({type: 'error', reason: error.message});
    } finally {
      if (tabId !== null) await chrome.tabs.remove(tabId).catch(() => {});
      if (cardTab?.id) await chrome.tabs.update(cardTab.id, {active: true}).catch(() => {});
    }
  });
});
