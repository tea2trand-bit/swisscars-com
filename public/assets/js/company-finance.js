(function(root){
 'use strict';
 const methods={cash:'Kasa firme',bank:'Račun firme',card:'Kartica firme'};
 const paid=k=>(!k.moneyKind||k.moneyKind==='expense')&&k.moneyStatus!=='planned';
 const day=k=>/^\d{4}-\d{2}-\d{2}$/.test(k.date||'')?k.date:new Date(k.paidAt||k.created||0).toISOString().slice(0,10);
 const recorder=k=>k.recordedBy||k.actor||k.payer||'Nije upisano';
 const source=k=>k.fundingSource==='company'?(methods[k.paymentMethod]||'Firma — način nije upisan'):'Raniji unos — izvor nije potvrđen';
 const currency=k=>k.currency||'EUR';
 const totals=rows=>rows.reduce((s,k)=>{if(Number.isFinite(Number(k.amount)))s[currency(k)]=Math.round(((s[currency(k)]||0)+Number(k.amount))*100)/100;return s;},{});
 const locale=()=>(typeof window!=='undefined'&&window.EV&&typeof window.EV.locale==='function')?window.EV.locale():'sr-Latn-RS'; // jezik evidencije; podrazumevano srpski
 const money=s=>Object.entries(s).map(([c,n])=>n.toLocaleString(locale(),{minimumFractionDigits:2,maximumFractionDigits:2})+' '+c).join(' · ')||'0';
 function month(rows,m){return rows.filter(k=>paid(k)&&day(k).slice(0,7)===m);}
 function groups(rows,key){const g=new Map();for(const k of rows){const name=key(k);if(!g.has(name))g.set(name,[]);g.get(name).push(k);}return [...g].map(([name,items])=>({name,n:items.length,totals:totals(items)}));}
 function csv(rows){const quote=v=>'"'+String(typeof v==='string'&&/^[\s]*[=+@-]/.test(v)?"'"+v:v??'').replace(/"/g,'""')+'"';return '\ufeff'+rows.map(row=>row.map(quote).join(';')).join('\r\n');}
 function vehicle(k,cars,leads,inspections=[]){const c=cars.find(c=>c._id===k.carId),l=leads.find(l=>l._id===k.orderId),p=l?.proposals?.find(p=>p.id===k.proposalId),i=inspections.find(i=>i._id===k.inspectionId);return c?c.model+(c.year?' · '+c.year:''):p?p.title+(p.year?' · '+p.year:''):i?i.car||i.title||'Pregled':'Opšti trošak firme';}
 function expenseCsv(rows,cars,leads,photos,inspections=[]){return csv([['ID','Datum plaćanja','Auto / pregled','VIN','Upit','Kategorija','Faza','Opis','Dobavljač / primalac','Mesto troška','Broj računa / dokumenta','Iznos','Valuta','Izvor novca','Ko je uneo','Račun / potvrda','Bonus ID','Napomena o isplati'],...rows.map(k=>[k._id||'',day(k),vehicle(k,cars,leads,inspections),cars.find(c=>c._id===k.carId)?.vin||'',k.orderId||k.inspectionId||'',k.category||'',k.phase||'',k.what||'',k.supplier||k.bonusRecipient||'',k.spendLocation||'',k.documentRef||'',Number(k.amount),currency(k),source(k),recorder(k),k.receipt?photos(k.receipt):'',k.bonusId||'',k.paymentNote||''])]);}
 function bonusCsv(rows,cars,leads,inspections=[]){return csv([['ID','Mesec rada','Primalac','Auto / pregled','Osnov','Dogovoreni iznos','Valuta','Status','Datum isplate','Evidentirana isplata','Dokument','Način plaćanja','Uneo','Napomena o isplati'],...rows.map(k=>[k._id,k.month,k.recipient,vehicle(k,cars,leads,inspections),k.what,Number(k.amount),currency(k),k.status==='paid'?'Isplata evidentirana':'Za obračun',k.paidDate||'',k.paidAmount==null?'':Number(k.paidAmount),k.paymentRef||k.documentRef||'',k.status==='paid'?methods[k.paymentMethod]||'':'',k.recordedBy||'',k.paymentNote||''])]);}
 const api={methods,paid,day,recorder,source,totals,money,month,groups,csv,vehicle,expenseCsv,bonusCsv};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SCCompanyFinance=api;
})(typeof window==='object'?window:globalThis);
