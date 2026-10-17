(function(root){
'use strict';
function time(v){if(v==null||typeof v==='boolean'||v==='')return null;const n=typeof v==='number'||/^\d+$/.test(String(v))?Number(v):Date.parse(v);return Number.isFinite(n)&&n>0?n:null;}
function state(d){
 const car=d.car,all=(d.proposals||[]).filter(p=>p.answer!=='ne'&&p.avail!=='ne'&&!p.depositRefundAt&&!['refund','continue','other'].includes(p.choice)),p=all.find(p=>p.choice==='buy')||all.find(p=>p.inspectionPaid===true)||all.find(p=>p.answer==='zelim')||all[0];
 const report=!!p&&!!time(p.inspAt)&&p.inspectionReviewed!==false&&(p.serviceFlow!=='inspection-first'&&String(p.quoteCalculation?.version)!=='1'||p.inspectionPaid===true),positive=report&&(p.insp==='ok'||p.insp==='da'||p.insp==='oprez'||['da','oprez'].includes(p.inspChecklist?.overall))&&p.insp!=='ne'&&p.inspChecklist?.overall!=='ne';
 let current=0;
 if(['arhiva','odustao','otkazano'].includes(d.status))current=-1;
 else if(d.status==='predato'||car?.status==='prodat')current=6;
 else if(car?.status==='prodaja')current=5;
 else if(car&&['kupljen','transport','carinjen','garaza'].includes(car.status)||positive&&p.choice==='buy'&&time(p.depositPaidAt)&&!p.depositRefundAt&&(p.serviceFlow!=='inspection-first'||p.serviceMode==='package')||d.status==='kupljeno')current=4;
 else if(positive&&p.choice==='buy'&&(p.serviceFlow!=='inspection-first'||p.serviceMode==='package'))current=3;
 else if(report)current=2;
 else if(d.listingCheck?.status==='available'||all.some(p=>p.avail==='da'||p.inspectionPaid===true||p.plannedAt||p.inspectionScheduled===true))current=1;
 const latestAt=[d.created,d.statusChangedAt,d.listingCheck?.at,d.listingReview?.at,p?.at,p?.answeredAt,p?.inspectionPaidAt,p?.inspAt,p?.choiceAt,p?.serviceSelectedAt,p?.depositPaidAt,...Object.values(car?.statusDates||{})].map(time).filter(Boolean).sort((a,b)=>b-a)[0]||null;
 return {current,latestAt};
}
function labels(lang,listing){return (lang==='de'?[listing?'Fahrzeugprüfung':'Fahrzeugauswahl','Inspektion','Entscheidung','Anzahlung','Kauf und Import','Übernahme']:lang==='en'?[listing?'Car check':'Car selection','Inspection','Decision','Deposit','Purchase and import','Collection']:[listing?'Provera auta':'Izbor auta','Pregled','Odluka','Kapara','Kupovina i uvoz','Preuzimanje']);}
const api={state,labels};if(typeof module==='object'&&module.exports)module.exports=api;else root.SCClientProgress=api;
})(typeof window==='undefined'?this:window);
