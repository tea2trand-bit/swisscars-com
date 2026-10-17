(function(root){'use strict';
function positive(value){const n=Number(value);return typeof value!=='boolean'&&Number.isFinite(n)&&n>0?n:null;}
function quote(record,proposal,settings={}){
 const p=proposal||{},saved=p.depositNoticeQuote;
 if(saved&&positive(saved.amount))return {...saved};
 const base=positive(record?.listingQuote?.result?.total)??positive(p.quoteCalculation?.totalEur)??positive(p.price);
 const pct=Number(p.depositPct??settings.depositPct??record?.depositPct??10),fixed=positive(p.deposit);
 if(fixed)return {base,percent:pct,amount:fixed,currency:'EUR',fixed:true};
 if(!base||!Number.isFinite(pct)||pct<=0||pct>100)return null;
 return {base,percent:pct,amount:Math.ceil(base*pct/1000)*10,currency:'EUR',rounding:10};
}
const api={quote};if(typeof module==='object'&&module.exports)module.exports=api;else root.SCDepositPlan=api;
})(typeof window==='undefined'?this:window);
