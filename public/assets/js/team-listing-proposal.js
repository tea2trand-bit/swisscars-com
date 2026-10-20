/* Uses the existing authenticated team store and the existing proposal API fields. */
(()=>{
 let current=null,busy=false;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dialog=document.createElement('dialog');dialog.className='team-listing-proposal-dialog';
 dialog.innerHTML='<header><strong>Predlog vozila</strong><button class="b" type="button" data-close>Zatvori</button></header><iframe title="Priprema predloga vozila"></iframe>';
 document.body.append(dialog);const frame=dialog.querySelector('iframe');
 dialog.querySelector('[data-close]').onclick=()=>{if(!busy)dialog.close();};
 function open(lead){current=lead._id;frame.src='/intern/predlog-vozila/';dialog.showModal();}
 function getLead(){return LEADS.find(l=>l._id===current);}
 window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||!current)return;
  const lead=getLead();if(!lead||!canWrite)return;
  if(event.data?.type==='swiscars-proposal-ready'){
   const record={id:lead._id,name:lead.name||lead.contact||'Klijent',brand:lead.brand||'',model:lead.model||'',budget:String(lead.budget||''),yearFrom:String(lead.yearFrom||''),mileage:String(lead.mileage||''),fuel:lead.fuel||'',gearbox:lead.gearbox||'',color:lead.color||'',equip:lead.equip||[],notes:lead.note||''};
   frame.contentWindow.postMessage({type:'swiscars-proposal-record',record},location.origin);return;
  }
  if(event.data?.type==='swiscars-proposal-contact'){dialog.close();openTeamContact('lead',lead._id);return;}
  if(event.data?.type!=='swiscars-proposal-publish'||busy)return;
  busy=true;try{
   const {fields,equipment,photos,quote}=event.data;
   if(!fields||!Number.isFinite(quote?.total)||quote.total<=0||!Number.isFinite(quote.packageChf)||quote.adChf!==Number(fields.price)||!fields.title||!Array.isArray(photos)||!photos.length||photos.length>50)throw Error('Proverite podatke i obračun pre slanja.');
   const source=new URL(fields.url);if(source.protocol!=='https:'||source.hostname!=='www.autoscout24.ch'||source.username||source.password||source.port)throw Error('Izvorni link nije podržan.');
   if(!/^\/de\/d\/(?:[a-z0-9-]+-)?\d+\/?$/.test(source.pathname))throw Error('Link nije pojedinačni AutoScout oglas.');
   const listingId=source.pathname.match(/(\d+)\/?$/)?.[1];
   const safePhotos=photos.filter(value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.hostname==='listing-images.autoscout24.ch'&&u.pathname.includes('/'+listingId+'/');}catch{return false;}});
   if(!listingId||safePhotos.length!==photos.length)throw Error('Fotografije ne odgovaraju izvornom oglasu.');
   const p={id:'p'+Date.now().toString(36),title:String(fields.title).slice(0,220),year:Number(fields.year),km:Number(fields.mileage),fuel:SCProposalFacts.specValue('fuel',fields.fuel),gear:SCProposalFacts.specValue('transmission',fields.transmission),adChf:Number(fields.price),place:String(fields.place||'').slice(0,220),price:quote.total,commission:quote.packageChf,photos:safePhotos,adNote:SCProposalFacts.describe(fields,equipment),internalListingUrl:source.href,at:Date.now(),photosAt:Date.now(),by:actor(),answer:null};
   if(!Number.isInteger(p.year)||p.year<1900||p.year>2100||!Number.isFinite(p.km)||p.km<0)throw Error('Proverite godište i kilometražu.');
   // A source URL stays in an internal, non-projected field. adNote contains only
   // the human-readable vehicle facts already supported by sc_order_view.
   const latest=getLead();if(!latest||latest.carId||['odustao','predato','kupio'].includes(latest.status))throw Error('Upit više nije otvoren za novi predlog.');
   const patch={proposals:[...(latest.proposals||[]),p],status:'ponudjeno'};if(!latest.token)patch.token=newToken();
   await db.doc('leads/'+latest._id).update(patch);
   frame.contentWindow.postMessage({type:'swiscars-proposal-published',ok:true},location.origin);
   toast('Predlog je na linku klijenta.');
  }catch(error){frame.contentWindow.postMessage({type:'swiscars-proposal-published',ok:false,error:error.message||'Predlog nije sačuvan.'},location.origin);}finally{busy=false;}
 });
 let scheduled=false;
 function attach(){scheduled=false;if(typeof LEADS==='undefined'||typeof canWrite==='undefined'||!canWrite)return;for(const card of document.querySelectorAll('#leadList [data-lead-card]')){const lead=LEADS.find(l=>l._id===card.dataset.leadCard);if(!lead||lead.carId||teamLeadHasListing(lead)||['odustao','predato','kupio'].includes(lead.status)||card.querySelector('[data-add-listing-proposal]'))continue;const body=card.querySelector('.team-lead-body');if(!body)continue;const bar=document.createElement('div');bar.className='team-add-listing-proposal';bar.innerHTML='<button class="b primary" type="button" data-add-listing-proposal>Dodaj predlog iz oglasa</button>';bar.querySelector('button').onclick=()=>open(lead);body.prepend(bar);}}
 const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(attach);}});observer.observe(document.getElementById('leadList'),{childList:true,subtree:true});attach();
})();
