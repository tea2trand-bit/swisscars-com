const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const W=require('../public/assets/js/work-inquiry.js');
const html=fs.readFileSync(require.resolve('../public/intern/index.html'),'utf8');

test('service card separates client, requested criteria, selected vehicle and the next step',()=>{
 const card=W.summary({serviceCard:true,kind:'budget',person:'Miroslav <Ilić>',criteria:'Golf 7 · bela · do 150.000 km',vehicle:'VW Golf Variant',amountLabel:'Cena oglasa',amount:'8.990 CHF',status:'Čeka uplatu pregleda',personContact:'<button>Kontakt</button>',contact:'<a>Oglas</a>',action:'<button data-inquiry-expand>Čeka uplatu</button>'},{kindLabel:'Pronađi',location:'Lienz'});
 assert.match(card,/is-service-card/);assert.match(card,/data-work-step="check-payment"/);
 assert.match(card,/Miroslav &lt;Ilić&gt;/);assert.match(card,/Klijent je tražio:/);
 assert.ok(card.indexOf('sc-identity')<card.indexOf('sc-vehicle'));
 assert.ok(card.indexOf('Kontakt')<card.indexOf('sc-vehicle'));
 assert.match(card,/Detalji upita/);assert.doesNotMatch(card,/Otvori karticu|sc-stage|>Čeka uplatu<\/button>/);
 const pending=W.summary({serviceCard:true,vehiclePending:true,kind:'budget',person:'Miroslav Ilić',criteria:'Golf 7 · siva',vehicle:'Golf 7',status:'Upit primljen',action:'<button data-inquiry-expand>Pregledaj kriterijume</button>'},{kindLabel:'Pronađi',location:''});
 assert.doesNotMatch(pending,/Izabrano vozilo|sc-vehicle/);assert.match(pending,/Klijent je tražio:/);
});

test('only concrete types and work steps are offered; all is not a hidden fallback',()=>{
 assert.ok(!W.steps.some(s=>s.value==='all'));
 assert.doesNotMatch(html,/data-inquiry-(?:kind|step)="all"|inquiryKindFilter===?"all"/);
 assert.equal(W.selectKind({inspection:1,budget:1,car:0},'all'),'inspection');
 assert.equal(W.selectKind({inspection:0,budget:1,car:0},'inspection'),'budget');
 assert.equal(W.selectKind({inspection:1,budget:1,car:0},'budget'),'budget');
 for(const kind of ['listing','message','team','unknown'])assert.equal(W.kindGroup(kind),'car');
});

test('work queues follow recorded business state across both entry points without changing the record',()=>{
 for(const kind of ['budget','listing']){
  const d={status:'novo',proposals:[]};assert.equal(W.queue(d,{kind}),kind==='listing'?'car':'budget');
  d.proposals=[{answer:'zelim',avail:'da'}];assert.equal(W.queue(d,{kind}),'documents');Object.assign(d.proposals[0],{originProofVerified:true,chVatRefundVerified:false});assert.equal(W.queue(d,{kind}),'inspection');
  d.proposals[0].choice='buy';assert.equal(W.queue(d,{kind}),'purchase');
  for(const [status,queue] of [['kupljen','purchase'],['transport','transport'],['carinjen','customs'],['garaza','customs']]){const before=JSON.stringify(d);assert.equal(W.queue(d,{kind,car:{status}}),queue);assert.equal(JSON.stringify(d),before);}
 }
 assert.equal(W.queue({status:'novo'},{kind:'inspection'}),'inspection');
});

test('numbered phases distinguish three parallel entries, document checks and the two destinations',()=>{
 assert.equal(W.queues.length,10);assert.deepEqual(W.queues.map(q=>q.number),[1,1,1,2,3,4,5,6,7,8]);
 assert.equal(W.queue({listingVehicle:{title:'Audi'}},{kind:'listing'}),'documents');
 assert.equal(W.queue({listingReview:{at:1},listingVehicle:{originProofVerified:null}},{kind:'listing'}),'documents');
 assert.equal(W.queue({listingReview:{at:1},listingVehicle:{originProofVerified:true,chVatRefundVerified:false}},{kind:'listing'}),'inspection');
 assert.equal(W.companyQueue({status:'favoriti'},null),'documents');
 assert.equal(W.companyQueue({status:'favoriti'},null,{conditionsReviewed:true}),'inspection');
 assert.equal(W.companyQueue({status:'pregled'},{internalReportAt:1},{purchaseReady:true}),'purchase');
 assert.equal(W.carQueue({status:'prodaja',readyFor:'sale'}),'sale');
 assert.equal(W.carQueue({status:'prodaja',orderId:'client'}),'delivery');
 assert.equal(W.queue({carId:'client-car'},{kind:'budget',car:{status:'prodaja'}}),'delivery');
 assert.equal(W.carQueue({status:'garaza'}),'customs','preparation must not be called ready for sale');
 const card=W.summary({serviceCard:true,kind:'listing',workQueue:'car',vehicle:'Audi RS3',vehicleMeta:'2023 · 73.500 km',person:'Miroslav Ilić',action:'',status:'Upit primljen'},{location:'6850 Mendrisio'});
 assert.equal((card.match(/Audi RS3/g)||[]).length,1);assert.doesNotMatch(card,/Vozilo iz oglasa|Grad nije upisan/);
 assert.match(card,/sc-phase-number">Faza 1/);assert.match(card,/Kupovina vozila \(upit sa oglasom\)/);
});

test('the client name is the single accessible contact control and retains its existing handler',()=>{
 const card=W.summary({serviceCard:true,kind:'budget',vehiclePending:true,person:'Stefan <Stanić>',personContact:'<button class="b small" data-contact-toggle="inquiry-1">Kontakt</button>',status:'Primljeno',action:''},{location:''});
 assert.match(card,/data-contact-toggle="inquiry-1"/);assert.match(card,/sc-client-link/);assert.match(card,/aria-label="Kontakt: Stefan &lt;Stanić&gt;"/);assert.match(card,/>Stefan &lt;Stanić&gt;<\/button>/);
 assert.doesNotMatch(card,/>Kontakt<|<small>Klijent<\/small>/);
});

test('discarded and archived findings never count as active work and discarded URLs stay excluded on reimport',()=>{
 const old={status:'odbijeno',url:'https://www.autoscout24.ch/de/d/audi-rs3-123456?ref=old'};
 assert.equal(W.findExcluded(old),true);assert.equal(W.findExcluded({status:'arhiva'}),true);
 assert.equal(W.findExcluded({status:'novo',url:'https://www.autoscout24.ch/it/d/nuovo-titolo-123456'},[old]),true);
 assert.equal(W.findExcluded({status:'novo',url:'https://www.autoscout24.ch/de/d/audi-rs3-765432'},[old]),false);
 assert.equal(W.findExcluded({status:'novo',url:'https://www.comparis.ch/carfinder/marktplatz/details/show/888?source=new'},[{status:'odbijeno',url:'https://www.comparis.ch/carfinder/marktplatz/details/show/888'}]),true);
 assert.equal(W.findExcluded({status:'novo',excludeFromSearch:true}),true);
 const card=W.summary({serviceCard:true,company:true,workQueue:'company',person:'SWISCARS',vehicle:'Audi',action:'<button>Pregledaj vozilo</button>',secondaryActionHtml:'<button data-work-remove="find-1">Ukloni vozilo</button>'},{location:''});
 assert.match(card,/Faza 1/);assert.match(card,/Za firmu · SWISCARS/);assert.doesNotMatch(card,/sc-identity/);assert.match(card,/data-work-remove="find-1"/);
});

test('company jobs do not duplicate client-linked vehicles or finds already converted into a vehicle',()=>{
 const source=html.slice(html.indexOf('function teamCompanyWorkJobs('),html.indexOf('\nfunction renderCompanyWorkCards('));
 const context={SCWorkInquiry:W,leadFilter:'open',LEADS:[{carId:'client-car'}],CARS:[{_id:'client-car',status:'transport'},{_id:'own-car',status:'prodaja',fromFind:'old-find'},{_id:'own-linked',status:'kupljen',orderId:'client'}],FINDS:[{_id:'old-find',status:'kupljeno'},{_id:'new-find',status:'favoriti'},{_id:'client-find',status:'novo',client:true}],isCompanyFind:f=>!f.client,companyFindExcluded:f=>W.findExcluded(f),companyFindUnavailable:()=>false,companyFindInspection:()=>null,companyFindConditionsReviewed:()=>false,companyFindPurchaseReady:()=>false,matchesLeadQuery:()=>true};
 vm.createContext(context);vm.runInContext(source,context);const before=JSON.stringify([context.LEADS,context.CARS,context.FINDS]);
 assert.deepEqual(Array.from(context.teamCompanyWorkJobs(),j=>[j.record._id,j.queue]),[['own-car','sale'],['new-find','documents']]);assert.equal(JSON.stringify([context.LEADS,context.CARS,context.FINDS]),before);
});

test('each actionable stage remains reachable after removing all steps',()=>{
 const examples={
  'check-data':['Proveri podatke','Proveri dostupnost','Proveri'],
  price:['Upiši cenu pregleda'],
  'check-payment':['Proveri uplatu','Čeka uplatu','Kapara prijavljena — proveri banku'],
  schedule:['Zakaži termin','Zakaži pregled'],
  inspection:['Pregled'],report:['Pošalji izveštaj','Unesi izveštaj'],
  search:['Pregledaj kriterijume','Potraga u toku','Dogovori drugi auto'],
  client:['Čeka izbor klijenta','Izveštaj poslat — čeka odluku klijenta'],
  deposit:['Čeka se kapara'],purchase:['Evidentiraj kupovinu'],transport:['Otvori transport'],
  customs:['Otvori carinjenje'],prepare:['Priprema'],handover:['Predaj vozilo'],review:['Otvori zadatak']
 };
 for(const [step,actions] of Object.entries(examples))for(const action of actions)assert.equal(W.stepFor(action),step,action);
 assert.equal(W.stepFor('<button>Otvori detalje</button>','Otkazano'),'archive');
});

test('empty or completed filter advances to a step with work; choice is retained while it has work',()=>{
 assert.equal(W.selectStep({'check-data':0,schedule:2,transport:1},'check-data'),'schedule');
 assert.equal(W.selectStep({'check-data':1,schedule:2},'schedule'),'schedule');
 assert.equal(W.selectStep({transport:1},'all'),'transport');
 const counts=Object.fromEntries(W.steps.map(s=>[s.value,1]));
 for(const step of W.steps)assert.equal(W.selectStep(counts,step.value),step.value);
});

test('the selected queue shows all its work steps together and retains the job count',()=>{
 const source=html.slice(html.indexOf('function applyInquiryStepFilter('),html.indexOf('\nfunction refreshInquiryKinds('));
 const row=step=>({hidden:false,parentElement:{id:'leadList'},querySelector:()=>({dataset:{workStep:step}})});
 const rows=[row('check-data'),row('check-payment'),row('schedule')];
 const controls={mobileInquiryStep:{options:W.steps.map(s=>({value:s.value,dataset:{label:s.label},textContent:''}))},pgSheet:{},teamInquiryCount:{},leadEmpty:{}};
 const context={SCWorkInquiry:W,teamPendingInquiry:'',inquiryStepFilter:'all',leadFilter:'open',$:id=>controls[id],document:{querySelectorAll:q=>q.startsWith('#pgList')?rows:[]}};
 vm.createContext(context);vm.runInContext(source,context);context.applyInquiryStepFilter();
 assert.deepEqual(rows.map(r=>r.hidden),[false,false,false]);
 assert.equal(context.inquiryStepFilter,'check-data');
 assert.equal(controls.teamInquiryCount.textContent,'Aktivni poslovi: 3');
 context.inquiryStepFilter='schedule';context.applyInquiryStepFilter();
 assert.deepEqual(rows.map(r=>r.hidden),[false,false,false]);
 context.leadFilter='done';context.applyInquiryStepFilter();
 assert.equal(context.inquiryStepFilter,'archive');
 assert.deepEqual(rows.map(r=>r.hidden),[false,false,false]);
 assert.equal(controls.teamInquiryCount.textContent,'Arhiva: 3');
 rows.splice(0);context.applyInquiryStepFilter();
 assert.equal(controls.mobileInquiryStep.disabled,false,'search must remain available when no results match');
});

test('search in the filter finds names, selected vehicles and proposal links across work types',()=>{
 const source=html.slice(html.indexOf('function refreshInquiryKinds('),html.indexOf('\nfunction renderInsp('));
 const controls={teamInquiryTitle:{},teamInquiryPlanner:{}};
 const context={
  SCWorkInquiry:W,SCInquiryView:require('../public/assets/js/inquiry-view.js'),SCPurchaseFlow:require('../public/assets/js/purchase-flow.js'),
  teamPendingInquiry:'',leadFilter:'open',leadQuery:'golf',inquiryKindFilter:'inspection',inquiryKindPinned:false,
  teamCompanyWorkJobs:()=>[],teamInquiryQueue:record=>W.queue(record,{kind:'budget'}),
  LEADS:[{_id:'lead-1',name:'Jelena Ilić',model:'Volkswagen',proposals:[{title:'VW Golf',url:'https://example.test/vehicle/123'}]}],
  INSPS:[{_id:'inspection-1',name:'Marko',car:'Toyota'}],FINDS:[],
  leadStage:()=>({done:false}),activeInspectionInquiry:()=>true,teamInquiryReference:x=>x._id,buildTeamWorkTasks:()=>[],
  $:id=>controls[id],document:{querySelectorAll:()=>[]}
 };
 vm.createContext(context);vm.runInContext(source,context);context.refreshInquiryKinds();
 assert.equal(context.inquiryKindFilter,'budget');
 assert.equal(context.matchesLeadQuery(context.LEADS[0]),true);
 for(const query of ['jelena ilic','vehicle/123','vw golf']){context.leadQuery=query;assert.equal(context.matchesLeadQuery(context.LEADS[0]),true,query);}
 context.leadQuery='nepostojeci';assert.equal(context.matchesLeadQuery(context.LEADS[0]),false);
 context.leadQuery='';assert.equal(context.matchesLeadQuery(context.LEADS[0]),true);
});

test('card shows one specific primary action and puts the ad link with the vehicle',()=>{
 const card=W.summary({kind:'budget',person:'Kupac <X>',ref:'UP-123',vehicle:'VW Golf',context:'St. Gallen',amountLabel:'Cena oglasa',amount:'8.900 CHF',status:'Proveriti dostupnost',contact:'<a class="team-field-ad" href="https://example.test/car">Oglas ↗</a>',action:'<button class="b small team-lead-next" data-team-checks="lead-1">Proveri podatke</button>'},{kindLabel:'Pronađi',location:'St. Gallen'});
 assert.equal((card.match(/inquiry-primary/g)||[]).length,1);
 assert.match(card,/data-work-step="check-data"/);
 assert.match(card,/Trenutni korak<\/small><strong>Podaci auta/);
 assert.ok(card.indexOf('team-field-ad')<card.indexOf('class="iq-contact"'));
 assert.ok(card.includes('Kupac &lt;X&gt;'));
 assert.doesNotMatch(card,/>Proveri<|Sledeći korak/);
});

test('payment and scheduling cards name the actual action rather than selection of a car',()=>{
 for(const [action,expected] of [['Proveri uplatu','Uplata pregleda'],['Zakaži termin','Termin pregleda'],['Unesi izveštaj','Izveštaj']]){
  const card=W.summary({kind:'inspection',action:'<button class="b inquiry-primary">'+action+'</button>',status:'',amount:'120 CHF'},{kindLabel:'Pregled',location:''});
  assert.match(card,new RegExp('Trenutni korak<\\/small><strong>'+expected));
  assert.equal((card.match(/inquiry-primary/g)||[]).length,1);
 }
});

test('compact next action retains the existing business gates for purchase, transport and customs',()=>{
 const start=html.indexOf('function teamProposalFlowGate('),end=html.indexOf('\nfunction teamOrderPhase(',start);
 const context={teamProposalCar:(_l,p)=>p.car,teamOrderDepositPaid:p=>!!p.depositPaidAt,teamOrderInspectionCompleted:p=>!!p.inspAt};
 vm.createContext(context);vm.runInContext(html.slice(start,end),context);
 const next=(p,l={})=>W.nextFlow([
  {field:'deposit',flow:true,done:!!p.depositPaidAt},
  {field:'purchase',flow:true,done:!!p.car},
  {field:'transport',flow:true,done:['transport','carinjen'].includes(p.car?.status)},
  {field:'customs',flow:true,done:p.car?.status==='carinjen'}
 ],field=>context.teamProposalFlowGate(l,p,field).allowed)?.field||null;
 assert.equal(next({inspectionPaid:false}),null);
 assert.equal(next({inspectionPaid:true,inspAt:1,choice:'buy'}),null);
 assert.equal(next({inspectionPaid:true,inspAt:1,choice:'buy',depositPaidAt:2}),'purchase');
 assert.equal(next({car:{status:'kupljen'}}),'transport');
 assert.equal(next({car:{status:'transport'}}),'customs');
 assert.equal(next({car:{status:'carinjen'}}),null);
 assert.equal(next({car:{status:'kupljen'}},{status:'odustao'}),null);
 assert.equal(next({car:{status:'kupljen'},avail:'ne'}),null);
});
