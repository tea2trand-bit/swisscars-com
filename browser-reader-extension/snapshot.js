// GENERATED from cloud-reader-runtime.mjs snapshotScript — do not edit by hand.
export const snapshotScript = function snapshotScript(){
  const listingId=location.pathname.match(/(\d+)\/?$/)?.[1];
  const httpsOf=v=>{try{const u=new URL(v,location.href);return u.protocol==='https:'&&u.hostname==='listing-images.autoscout24.ch'&&new RegExp('^/listing/\\d+/'+listingId+'/[^/]+$').test(u.pathname)?u.href:'';}catch(_){return '';}};
  const photos=[];
  const identities=new Set();
  const add=v=>{const h=httpsOf(v);if(!h)return;const u=new URL(h),identity=u.origin+u.pathname;if(!identities.has(identity)){identities.add(identity);photos.push(h);}};
  for(const img of document.querySelectorAll('img')){
    const src=img.currentSrc||img.src||'';
    if(/-image-\d+$/.test(img.alt||'')||(src&&httpsOf(src)))add(src);
  }
  for(const source of document.querySelectorAll('picture source[srcset]'))add(String(source.srcset).split(',')[0].trim().split(/\s+/)[0]);
  const og=document.querySelector('meta[property="og:image"]')?.content;if(og)add(og);
  const place=Array.from(document.querySelectorAll('a[href]')).find(a=>{try{const u=new URL(a.href);return /(^|\.)google\.[a-z.]+$/.test(u.hostname)&&u.pathname.startsWith('/maps/search')&&/\b\d{4}\b/.test(a.innerText);}catch(_){return false;}})?.innerText.trim()||'';
  const cards=Array.from(document.querySelectorAll('a[href]')).filter(a=>/\/details\/show\/\d+|\/auto-oglasi\/\d+/.test(a.getAttribute('href')||'')&&a.innerText.trim()).map(a=>({url:a.href,text:a.innerText.trim().slice(0,3000)})).slice(0,100);
  const labelled=label=>{const node=Array.from(document.querySelectorAll('p')).find(p=>p.innerText.trim()===label);return (node?.previousElementSibling?.innerText||'').trim().slice(0,300);};
  const vehicleDetails={};
  for(const [key,label] of Object.entries({color:'Aussen',interiorColor:'Innen',fuel:'Treibstoff',transmission:'Getriebe',drive:'Antrieb',body:'Aufbauart',power:'Leistung'}))vehicleDetails[key]=labelled(label);
  const afterLabel=(root,label)=>{const p=Array.from(root?.querySelectorAll('p')||[]).find(p=>p.innerText.trim()===label);return (p?.nextElementSibling?.innerText||'').trim().slice(0,300);};
  vehicleDetails.accident=afterLabel(document.getElementById('expandable-warranty-and-returns'),'Unfallfahrzeug');
  vehicleDetails.mfk=afterLabel(document.getElementById('expandable-technical-inspection'),'Ab MFK');
  vehicleDetails.mfkDate=afterLabel(document.getElementById('expandable-technical-inspection'),'Letzte MFK');
  const description=document.getElementById('expandable-description')?.innerText.trim().slice(0,12000)||'';
  const descriptionComplete=!document.querySelector('#expandable-description button[aria-controls="expandable-remarks"][aria-expanded="false"]');
  const items=root=>root?Array.from(root.querySelectorAll('li')).map(li=>li.querySelector(':scope > span')?.innerText||li.innerText).map(s=>s.trim().replace(/\s+/g,' ').slice(0,300)).filter(Boolean).slice(0,200):[];
  const optional=document.getElementById('expandable-equipment-optional'),standard=document.getElementById('expandable-equipment-standard');
  const extrasHeading=Array.from(document.querySelectorAll('h3')).find(h=>h.innerText.trim()==='Extras');
  const partial=Array.from(document.querySelectorAll('button[aria-expanded="false"]')).some(b=>/^Alle .*Ausstattung anzeigen$/.test(b.innerText.trim())||b.innerText.trim()==='Ausstattungen');
  const equipment={optional:items(optional),standard:items(standard),extra:items(extrasHeading?.nextElementSibling),complete:Boolean(optional||standard||extrasHeading)&&!partial};
  return {url:location.href,readyState:document.readyState,title:document.title,heading:document.querySelector('h1')?.innerText.trim()||'',text:document.body?.innerText.slice(0,50000)||'',photos:photos.slice(0,50),place,cards,vehicleDetails,equipment,description,descriptionComplete};
};
