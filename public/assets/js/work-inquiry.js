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
 function selectKind(counts,current){return ['inspection','car','budget'].includes(current)&&counts[current]>0?current:['inspection','car','budget'].find(k=>counts[k]>0)||'inspection';}
 function primaryAction(html){
  return String(html||'').replace(/<button\b([^>]*?)class="([^"]*)"/,(_m,attrs,classes)=>'<button'+attrs+'class="'+classes.replace(/\binquiry-primary\b/g,'').trim()+' inquiry-primary"');
 }
 function summary(c,options){
  const step=stepFor(c.action,c.status),title=steps.find(s=>s.value===step).title;
  if(c.serviceCard){
   const service=c.kind==='inspection'?(c.kindLabel||'Pregled vozila'):c.kind==='budget'?'Pronalazak auta':'Kupovina vozila';
   const action=step==='check-payment'||String(c.action||'').includes('data-inquiry-expand')?'':primaryAction(c.action);
   const request=c.criteria?'<span class="sc-request"><span>Klijent je tražio:</span> <strong>'+escape(c.criteria)+'</strong></span>':'';
   const vehicle=c.vehiclePending?'':'<span class="sc-vehicle"><span><small>'+(c.kind==='inspection'?'Vozilo za pregled':c.kind==='budget'?'Izabrano vozilo':'Vozilo iz oglasa')+'</small><strong>'+escape(c.vehicle||'Vozilo još nije izabrano')+'</strong><span class="sc-location">'+options.location+'</span></span><span class="sc-ad">'+(c.contact||'')+'</span><span class="sc-price"><small>'+escape(c.amountLabel)+'</small><strong>'+escape(c.amount)+'</strong></span></span>';
   return '<summary class="inquiry-summary is-service-card" data-work-step="'+step+'">'+
    '<span class="sc-service"><span>Usluga <strong>'+escape(service)+'</strong></span></span>'+
    '<span class="sc-identity"><span class="sc-client"><small>Klijent</small><strong>'+escape(c.person||'Ime nije upisano')+'</strong></span>'+request+'<span class="sc-contact">'+(c.personContact||'')+'</span></span>'+
    vehicle+
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
 const api={steps,stepFor,selectStep,kindGroup,selectKind,summary,nextFlow};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SCWorkInquiry=api;
})(typeof window==='undefined'?this:window);
