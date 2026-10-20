(function(root){
 'use strict';
 const steps=[
  ['check-data','Proveri podatke','Podaci auta','Podaci'],
  ['price','Upiši cenu pregleda','Cena pregleda','Cena'],
  ['check-payment','Proveri uplatu','Uplata pregleda','Uplata'],
  ['schedule','Zakaži termin','Termin pregleda','Termin'],
  ['inspection','Obavi pregled','Pregled auta','Pregled'],
  ['report','Pošalji izveštaj','Izveštaj','Izveštaj'],
  ['search','Pronađi auto','Potraga za autom','Potraga'],
  ['client','Čeka odgovor klijenta','Odgovor klijenta','Odgovor'],
  ['deposit','Čeka kaparu','Kapara','Kapara'],
  ['purchase','Završi kupovinu','Kupovina','Kupovina'],
  ['transport','Organizuj transport','Transport','Prevoz'],
  ['customs','Carinjenje','Carinjenje','Carina'],
  ['prepare','Pripremi vozilo','Priprema vozila','Priprema'],
  ['handover','Predaj vozilo','Predaja vozila','Predaja'],
  ['review','Otvori zadatak','Zadatak','Zadatak'],
  ['archive','Završeni poslovi','Završeno','Završeno']
 ].map(([value,label,title,short])=>({value,label,title,short}));
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=html=>String(html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 function stepFor(action,status=''){
  const a=text(action),context=a+' '+text(status);
  if(/(?:arhivir|zatvoren|završeno|otkazan|izveštaj poslat$)/i.test(context)&&/Otvori detalje|Pogledaj poruku|^$/i.test(a))return 'archive';
  if(/Proveri(?:ti)? (?:podatke|dostupnost|poreklo|oglas)|^Proveri$/i.test(a)||/data-(?:team-checks|team-listing|listing-data|inspection-precheck)=/.test(action))return 'check-data';
  if(/(?:upiši|upisati|sačuvaj) cenu/i.test(a))return 'price';
  if(/(?:proveri|čeka|primljena).*uplat|kapara prijavljena|proveri (?:banku|prijem)/i.test(a))return 'check-payment';
  if(/zakaži|zakazati|uneti termin|promeni termin/i.test(a))return 'schedule';
  if(/izveštaj.*(?:poslat|čeka odluku)|čeka (?:izbor|zahtev|odgovor)|klijent zakazuje|čeka.*paket/i.test(context))return 'client';
  if(/izveštaj|čeka slanje/i.test(a))return 'report';
  if(/^(?:pregled|obavi pregled|unesi pregled)$/i.test(a))return 'inspection';
  if(/kapar/i.test(a))return /primljena.*kupovin|završi/i.test(a)?'purchase':'deposit';
  if(/kupovin|kupljen/i.test(a))return 'purchase';
  if(/transport|prevoz/i.test(a))return 'transport';
  if(/carin/i.test(a))return 'customs';
  if(/priprem|garaž|garaz/i.test(a))return 'prepare';
  if(/preda|prodaj/i.test(a))return 'handover';
  if(/potrag|pronađ|kriterijum|drugi auto/i.test(a))return 'search';
  return 'review';
 }
 function selectStep(counts,current){
  if(steps.some(s=>s.value===current)&&counts[current]>0)return current;
  return steps.find(s=>counts[s.value]>0)?.value||'check-data';
 }
 function kindGroup(kind){return kind==='inspection'?'inspection':kind==='budget'?'budget':'car';}
 const queues=[['budget','Pronađite auto',1],['car','Upiti sa oglasom',1],['company','Pronađi vozilo za firmu',1],['documents','Provera dokumentacije',2],['inspection','Pregledi',3],['purchase','Kupovina',4],['transport','Transport',5],['customs','Carina',6],['delivery','Predaja klijentu',7],['sale','Spremno za prodaju',8]].map(([value,label,number])=>({value,label,number}));
 function carQueue(car){
  if(!car)return null;
  if(car.status==='prodaja'&&!car.orderId&&car.readyFor!=='handover')return 'sale';
  if(car.status==='garaza')return 'customs';
  if(['prodaja','prodat'].includes(car.status))return 'delivery';
  return {carinjen:'customs',transport:'transport',kupljen:'purchase'}[car.status]||null;
 }
 function queue(record,{kind='budget',car=null}={}){
  if(kind==='inspection')return record.needsVehicleCheck?'documents':'inspection';
  const savedCarQueue=carQueue(car);if(savedCarQueue)return savedCarQueue==='sale'&&record.carId&&!record.internalRequest?'delivery':savedCarQueue;
  if(record.status==='predato')return 'delivery';
  const proposals=(record.proposals||[]).filter(p=>p.answer!=='ne'&&p.avail!=='ne'&&!p.depositRefundAt&&!['refund','continue','other'].includes(p.choice));
  if(record.status==='kupljeno'||proposals.some(p=>p.choice==='buy'))return 'purchase';
  if(proposals.some(p=>p.inspectionPaid===true||p.inspAt||p.plannedAt||p.inspectionScheduled===true))return 'inspection';
  const selected=proposals.filter(p=>p.answer==='zelim'||p.serviceFlow==='inspection-first');
  if(selected.length)return selected.every(p=>p.avail==='da'&&typeof p.originProofVerified==='boolean'&&typeof p.chVatRefundVerified==='boolean')?'inspection':'documents';
  if(record.listingReview&&typeof record.listingVehicle?.originProofVerified==='boolean'&&typeof record.listingVehicle?.chVatRefundVerified==='boolean')return 'inspection';
  if(record.listingVehicle||record.listingCheck?.status==='available')return 'documents';
  return kindGroup(kind);
 }
 function companyQueue(find,inspection,{conditionsReviewed=false,purchaseReady=false}={}){
  if(purchaseReady)return 'purchase';
  if(inspection)return 'inspection';
  return ['favoriti','izabrano','evidencija','pogledano','favorit','pregled'].includes(find.status)?(conditionsReviewed?'inspection':'documents'):'company';
 }
 function selectKind(counts,current){return ['inspection','car','budget'].includes(current)&&counts[current]>0?current:['inspection','car','budget'].find(k=>counts[k]>0)||'inspection';}
 function primaryAction(html){
  return String(html||'').replace(/<button\b([^>]*?)class="([^"]*)"/,(_m,attrs,classes)=>'<button'+attrs+'class="'+classes.replace(/\binquiry-primary\b/g,'').trim()+' inquiry-primary"');
 }
 function summary(c,options){
  const step=stepFor(c.action,c.status),title=steps.find(s=>s.value===step).title;
  if(c.serviceCard){
   const phase=queues.find(q=>q.value===(c.workQueue||kindGroup(c.kind)))||queues[0];
   const phaseLabel=phase.value==='car'?'Kupovina vozila (upit sa oglasom)':phase.label;
   const action=step==='check-payment'||String(c.action||'').includes('data-inquiry-expand')?'':primaryAction(c.action);
   const request=c.requestFacts?'<span class="sc-request" aria-label="Klijent je tražio"><strong class="sc-request-model">'+escape(c.requestFacts.model)+'</strong><span class="sc-request-facts">'+c.requestFacts.facts.map(([label,value])=>'<span><small>'+escape(label)+'</small><strong>'+escape(value)+'</strong></span>').join('')+'</span></span>':c.criteria?'<span class="sc-request"><span>Klijent je tražio:</span> <strong>'+escape(c.criteria)+'</strong></span>':'';
   const person=escape(c.person||'Ime nije upisano');
   const client=c.personContact?c.personContact.replace(/<button\b/,'<button title="Otvori kontakt" aria-label="Kontakt: '+person+'"').replace(/class="([^"]*)"/,'class="$1 sc-client-link"').replace(/>[^<]*<\/button>/,()=>'>'+person+'</button>'):'<strong>'+person+'</strong>';
   const photo=/^https:\/\//.test(c.thumbnail||'')?'<img class="sc-vehicle-photo" src="'+escape(c.thumbnail)+'" alt="Fotografija vozila" loading="lazy" referrerpolicy="no-referrer">':'';
   const vehicle=c.vehiclePending?'':'<span class="sc-vehicle">'+photo+'<span class="sc-vehicle-info"><strong>'+escape(c.vehicle||'Podaci vozila još nisu preuzeti')+'</strong>'+(c.vehicleMeta?'<span class="sc-location">'+escape(c.vehicleMeta)+'</span>':'')+(options.location?'<span class="sc-location">'+options.location+'</span>':'')+'</span><span class="sc-ad">'+(c.contact||'')+'</span><span class="sc-price"><small>'+escape(c.amountLabel)+'</small><strong>'+escape(c.amount)+'</strong></span></span>';
   return '<summary class="inquiry-summary is-service-card" data-work-step="'+step+'">'+
    '<span class="sc-service"><span class="sc-phase"><b class="sc-phase-number">'+phase.number+'.</b><strong>'+escape(phaseLabel)+'</strong></span>'+(c.headerActionHtml?'<span class="sc-header-action">'+c.headerActionHtml+'</span>':'<span class="sc-purpose">'+(c.company?'Za firmu':'Za klijenta')+'</span>')+'</span>'+
    '<span class="sc-identity"><span class="sc-client">'+client+'</span>'+request+'</span>'+
    vehicle+
    '<span class="sc-proposal-slot"></span>'+
    '<span class="sc-next"><span><small>Status</small><strong>'+escape(c.status||title)+'</strong></span>'+(action||'<span class="sc-expand">Detalji upita <span aria-hidden="true">⌄</span></span>')+'</span>'+(c.quoteHtml||'')+'</summary>';
  }
  const kind='<span class="iq-kind iq-kind-'+escape(c.kind)+'">'+escape(c.kindLabel||options.kindLabel)+'</span>';
  const progress=c.progressHtml?c.progressHtml.replace('<span class="iq-progress">','<span class="iq-progress"><span class="iq-progress-status">'+escape(c.status)+'</span>'):'';
  return '<summary class="inquiry-summary is-compact-row'+(c.kind==='inspection'?' is-inspection':'')+(c.quoteHtml?' has-inline-quote':'')+'" data-work-step="'+step+'">'+
   '<span class="iq-now"><small>Trenutni korak</small><strong>'+escape(title)+'</strong></span>'+
   '<span class="iq-person"><span class="iq-name-row"><b>'+escape(c.person||'Bez imena')+'</b>'+(c.personContact||'')+'</span><small>'+escape(c.ref)+'</small></span>'+
   '<span class="iq-vehicle"><span class="iq-vehicle-title"><strong>'+escape(c.vehicle||'Vozilo još nije izabrano')+'</strong>'+(c.contact||'')+'</span><small class="iq-location">'+options.location+'</small></span>'+
   '<span class="iq-contact">'+kind+'</span><span class="iq-amount"><small>'+escape(c.amountLabel)+'</small><b>'+escape(c.amount)+'</b></span>'+(c.quoteHtml||'')+
   '<span class="iq-status"><small>Status</small><span>'+escape(c.status)+'</span></span>'+
   '<span class="iq-next">'+primaryAction(c.action)+'</span>'+progress+'</summary>';
 }
 function nextFlow(checks,allowed){return checks.find(s=>s.flow&&s.field!=='deposit'&&!s.done&&allowed(s.field))||null;}
 const api={steps,stepFor,selectStep,kindGroup,selectKind,summary,nextFlow,queues,queue,carQueue,companyQueue};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SCWorkInquiry=api;
})(typeof window==='undefined'?this:window);
