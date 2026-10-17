(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();else root.SCServiceIncome=factory();
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const kinds=[['inspection','Pregledi'],['package','Selekcija / paket'],['expert_commission','Provizije eksperata'],['local_transport_commission','Lokalni transport'],['international_transport_commission','Međunarodni transport'],['transport_commission','Transport · vrsta nije navedena']];
 const key=row=>{
   const value=row.serviceKind||row.phase;
   return kinds.some(([kind])=>kind===value)?value:null;
 };
 const owner=row=>row.inspectionId?'inspection:'+row.inspectionId:row.orderId&&row.proposalId?'proposal:'+row.orderId+':'+row.proposalId:'';
 function date(row){
   if(/^\d{4}-\d{2}-\d{2}$/.test(String(row.date||'')))return row.date;
   const raw=row.paidAt||row.date||row.created||row.at;
   if(!raw)return '';
   const d=new Date(raw);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';
 }
 const validAmount=row=>row.amount!=null&&row.amount!==''&&Number.isFinite(Number(row.amount))&&Number(row.amount)>=0;
 const add=(totals,currency,value)=>{totals[currency]=Math.round(((totals[currency]||0)+value)*100)/100;};
 function summarize({money=[],leads=[],inspections=[],month=''}){
   // A paid planned expense can exist in events and costs with the same ID.
   const unique=new Map();money.forEach((row,i)=>unique.set(row._id||row.id||'row:'+i,row));
   const records=[...unique.values()].filter(row=>key(row)&&['income','expense','refund'].includes(row.moneyKind));
   const existing=new Set(records.filter(row=>key(row)==='inspection'&&row.moneyKind==='income'&&row.moneyStatus!=='planned').map(owner).filter(Boolean));
   const source=(identity,row)=>{if(!existing.has(identity)){records.push(row);existing.add(identity);}};
   for(const lead of leads)for(const p of lead.proposals||[]){
     if(p.inspectionPaid!==true)continue;
     const identity='proposal:'+(lead._id||lead.id)+':'+p.id;
     source(identity,{_id:'source:'+identity,moneyKind:'income',moneyStatus:'paid',phase:'inspection',orderId:lead._id||lead.id,proposalId:p.id,amount:p.inspectionPaymentAmount??p.inspFee,currency:p.inspectionPaymentCurrency||'CHF',paidAt:p.inspectionPaidAt,created:p.at,what:'Pregled · '+(lead.name||'Klijent'),source:true});
   }
   for(const inspection of inspections){
     if(!inspection.paidAt||inspection.purpose==='company'||inspection.ownerScope==='company'||inspection.companyFindId)continue;
     const identity='inspection:'+(inspection._id||inspection.id);
     source(identity,{_id:'source:'+identity,moneyKind:'income',moneyStatus:'paid',phase:'inspection',inspectionId:inspection._id||inspection.id,amount:inspection.paymentAmount??inspection.fee,currency:inspection.paymentCurrency||'CHF',paidAt:inspection.paidAt,what:'Pregled · '+(inspection.name||'Klijent'),source:true});
   }
   const categories=kinds.map(([id,label])=>({id,label,income:{},refunds:{},paidCosts:{},plannedCosts:{},expected:{},remaining:{},records:[],missingAmounts:0}));
   const rows=records.filter(row=>!month||date(row).slice(0,7)===month);
   for(const row of rows){
     const category=categories.find(c=>c.id===key(row));category.records.push({...row,date:date(row)});
     if(!validAmount(row)){category.missingAmounts++;continue;}
     const currency=row.currency||'EUR',amount=Number(row.amount),planned=row.moneyStatus==='planned';
     const target=row.moneyKind==='income'?(planned?'expected':'income'):row.moneyKind==='refund'?(planned?null:'refunds'):(planned?'plannedCosts':'paidCosts');
     if(target)add(category[target],currency,amount);
   }
   const total={income:{},refunds:{},paidCosts:{},plannedCosts:{},expected:{},remaining:{},missingAmounts:0};
   for(const category of categories){
     for(const field of ['income','refunds','paidCosts','plannedCosts','expected'])for(const [currency,value] of Object.entries(category[field]))add(total[field],currency,value);
     const currencies=new Set(['income','refunds','paidCosts','plannedCosts'].flatMap(field=>Object.keys(category[field])));
     for(const currency of currencies){category.remaining[currency]=Math.round(((category.income[currency]||0)-(category.refunds[currency]||0)-(category.paidCosts[currency]||0)-(category.plannedCosts[currency]||0))*100)/100;add(total.remaining,currency,category.remaining[currency]);}
     total.missingAmounts+=category.missingAmounts;
   }
   // Tariffs and the quoted full package are never added as a second receipt:
   // an inspection receipt of 120 plus a received package balance of 580 is 700.
   return {categories,total,records:categories.flatMap(c=>c.records.map(r=>({...r,serviceLabel:c.label}))).sort((a,b)=>b.date.localeCompare(a.date))};
 }
 function commission(base,pct){
   if(base==null||base===''||pct==null||pct===''||!Number.isFinite(Number(base))||!Number.isFinite(Number(pct))||Number(base)<0||Number(pct)<0||Number(pct)>100)throw Error('Unesi cenu usluge i procenat od 0 do 100.');
   return Math.round((Number(base)*Number(pct)/100+Number.EPSILON)*100)/100;
 }
 function packageBalance({lead,proposal,packageChf,money=[]}){
   const scoped=money.filter(r=>r.orderId===(lead._id||lead.id)&&r.proposalId===proposal?.id&&['inspection','package'].includes(key(r)));
   const report=summarize({money:scoped,leads:[{...lead,proposals:proposal?[proposal]:[]}]}),net={};
   for(const currency of new Set([...Object.keys(report.total.income),...Object.keys(report.total.refunds)]))net[currency]=Math.round(((report.total.income[currency]||0)-(report.total.refunds[currency]||0))*100)/100;
   return {packageChf:Number(packageChf),received:net,remaining:Object.keys(net).some(c=>c!=='CHF'&&net[c]!==0)?null:Math.max(0,Math.round((Number(packageChf)-(net.CHF||0))*100)/100)};
 }
 return Object.freeze({summarize,date,key,kinds,commission,packageBalance});
});
