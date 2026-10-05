/* Deliberately offline: no API calls, emails, database or persistent writes. */
(() => {
  const $=id=>document.getElementById(id);
  let data={"version":2,"overall":"oprez","vehicle":{"vin":"DEMO — nije stvarni VIN","km":185000,"date":"2026-10-03","by":"Stefan (primer)"},"checks":{"documents":"attention","body":"defect","interior":"defect","engine":"ok","running":"unseen","tyres":"ok"},"notes":{"body":"PROBNI NALAZ: sitna ogrebotina na zadnjem braniku.","interior":"PROBNI NALAZ: oštećenje presvlake sedišta.","documents":"PRIMER: nedostaje račun za poslednji servis.","running":"PRIMER: probna vožnja nije bila dostupna.","tyres":"PRIMER: šara deluje dobra, nema uočenog neravnomernog habanja."},"tyres":{"sets":"both","count":"8"}};
  const initialPhotos=['/demo/illustration-bumper.svg','/demo/illustration-interior.svg'];let photoUrls=[...initialPhotos],objectUrls=[];
  const panels=document.querySelectorAll('[data-demo-panel]'),tabs=document.querySelectorAll('[data-demo-tab]');
  function show(name){panels.forEach(p=>p.hidden=p.dataset.demoPanel!==name);tabs.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.demoTab===name)));}
  tabs.forEach(b=>b.onclick=()=>show(b.dataset.demoTab));document.querySelector('[data-demo-open-report]').onclick=()=>show('report');
  SCInspectionReport.mount($('demo-checklist'));
  $('demo-checklist').querySelectorAll('[data-ir-check]').forEach(el=>el.value=data.checks[el.dataset.irCheck]||'unseen');
  $('demo-checklist').querySelectorAll('[data-ir-group]').forEach(el=>el.value=data.notes[el.dataset.irGroup]||'');
  $('demo-checklist').querySelectorAll('[data-ir-field]').forEach(el=>{const key=el.dataset.irField;el.value=['sets','count'].includes(key)?data.tyres[key]??'':data.vehicle[key]??'';});
  $('demo-checklist').querySelector('[data-ir-overall]').value=data.overall;
  function draw(){ document.querySelector('.demo-verdict').textContent='Primer: '+SCInspectionReport.verdicts[data.overall];$('demo-report').innerHTML=SCInspectionReport.render(data,'sr');$('demo-report-conclusion').textContent=$('demo-conclusion').value;const gallery=$('demo-gallery');gallery.replaceChildren();photoUrls.forEach((url,i)=>{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';const img=document.createElement('img');img.src=url;img.alt='Probni prikaz fotografije '+(i+1);a.append(img);gallery.append(a);});}
  $('demo-choose').onclick=()=>$('demo-files').click();
  $('demo-files').onchange=()=>{objectUrls.forEach(URL.revokeObjectURL);objectUrls=[...$('demo-files').files].filter(f=>f.type.startsWith('image/')).map(f=>URL.createObjectURL(f));photoUrls=objectUrls.length?objectUrls:[...initialPhotos];$('demo-files-count').textContent=objectUrls.length?'Izabrano fotografija: '+objectUrls.length+'. Slike ostaju samo u vašem browseru.':'U primeru su ilustracije. Vaše slike ostaju samo u ovoj probi.';};
  $('demo-preview').onclick=()=>{const next=SCInspectionReport.read($('demo-checklist'));if(!next)return;next.vehicle.by='Stefan (primer)';data=next;draw();show('report');};
  const messages=[{id:'1',sender:'client',author:'Klijent',body:'PROBNA PORUKA: Molim proverite gume i oštećenje na sedištu.',at:'2026-10-03T09:00:00Z'},{id:'2',sender:'team',author:'Stefan (primer)',body:'PROBNI ODGOVOR: Nalaz i fotografije ćete videti u izveštaju ovde, uz vaš upit.',at:'2026-10-03T09:10:00Z'}];let seq=2;
  const call=async(fn,p)=>{if(fn.includes('send_message')){const team=fn.startsWith('sc_team');const id=String(++seq);messages.push({id,sender:team?'team':'client',author:team?'Stefan (primer)':'Klijent',body:p.p_text,at:new Date().toISOString()});return {ok:true,id};}return {messages:[...messages],hasMore:false};};
  SCConversation.mount($('demo-client-chat'),{lang:'sr',key:{p_token:'demo'},call});SCConversation.mount($('demo-team-chat'),{lang:'sr',team:true,key:{p_lead_id:'demo'},call});draw();
})();
