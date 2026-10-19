(function(root){
 'use strict';
 const labels={all:'Svi upiti',budget:'Potraga po budžetu',listing:'Kupovina iz oglasa',message:'Upit porukom',team:'Uneo tim',inspection:'Samo pregled',unknown:'Vrsta nije navedena'};
 function kind(d){
  const flow=typeof module==='object'&&module.exports?require('./purchase-flow.js'):root.SCPurchaseFlow;
  if(flow.request(d).url)return 'listing';
  if(d.intakeChannel==='message'||['message','whatsapp','viber','email'].includes(d.source))return 'message';
  if(d.source==='rucno'||d.source==='team')return 'team';
  if(d.model||d.brand||Number(d.budget)>0)return 'budget';
  return 'unknown';
 }
 const api={labels,kind};if(typeof module==='object'&&module.exports)module.exports=api;else root.SCInquiryView=api;
})(typeof window==='undefined'?this:window);
