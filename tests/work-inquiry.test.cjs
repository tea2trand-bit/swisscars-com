const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const W=require('../public/assets/js/work-inquiry.js');
const html=fs.readFileSync(require.resolve('../public/intern/index.html'),'utf8');

test('only concrete types and work steps are offered; all is not a hidden fallback',()=>{
 assert.ok(!W.steps.some(s=>s.value==='all'));
 assert.doesNotMatch(html,/data-inquiry-(?:kind|step)="all"|inquiryKindFilter===?"all"/);
 assert.equal(W.selectKind({inspection:1,budget:1,car:0},'all'),'inspection');
 assert.equal(W.selectKind({inspection:0,budget:1,car:0},'inspection'),'budget');
 assert.equal(W.selectKind({inspection:1,budget:1,car:0},'budget'),'budget');
 for(const kind of ['listing','message','team','unknown'])assert.equal(W.kindGroup(kind),'car');
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

test('actual list filtering shows only the selected work step and counts all jobs in its type',()=>{
 const source=html.slice(html.indexOf('function applyInquiryStepFilter('),html.indexOf('\nfunction refreshInquiryKinds('));
 const row=step=>({hidden:false,parentElement:{id:'leadList'},querySelector:()=>({dataset:{workStep:step}})});
 const rows=[row('check-data'),row('check-payment'),row('schedule')];
 const controls={mobileInquiryStep:{options:W.steps.map(s=>({value:s.value,dataset:{label:s.label},textContent:''}))},pgSheet:{},teamInquiryCount:{},leadEmpty:{}};
 const context={SCWorkInquiry:W,teamPendingInquiry:'',inquiryStepFilter:'all',leadFilter:'open',$:id=>controls[id],document:{querySelectorAll:q=>q.startsWith('#pgList')?rows:[]}};
 vm.createContext(context);vm.runInContext(source,context);context.applyInquiryStepFilter();
 assert.deepEqual(rows.map(r=>r.hidden),[false,true,true]);
 assert.equal(context.inquiryStepFilter,'check-data');
 assert.equal(controls.teamInquiryCount.textContent,'Aktivni upiti: 3');
 context.inquiryStepFilter='schedule';context.applyInquiryStepFilter();
 assert.deepEqual(rows.map(r=>r.hidden),[true,true,false]);
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
  teamPendingInquiry:'',leadFilter:'open',leadQuery:'golf',inquiryKindFilter:'inspection',
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
