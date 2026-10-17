(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./import-calculator.js'));else root.SCListingQuote=factory(root.SCImportCalculator);})(typeof window==='undefined'?this:window,function(calculator){
'use strict';
const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
function amount(value,name){if(value==null||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)throw Error(name);return Number(value);}
function calculate(vehicle,costs,fx,checks={}){
 const adChf=amount(vehicle.adChf,'price');if(adChf<1)throw Error('price');
 const rate=Number(fx?.eurPerCHF);if(!Number.isFinite(rate)||rate<=0)throw Error('rate');
 const netChf=checks.vat===true?amount(checks.netChf,'netPrice'):adChf;if(netChf<1||netChf>adChf)throw Error('netPrice');
 const input={price:netChf,currency:'CHF',origin:checks.origin===true?'preferential':'standard',rate,transport:amount(costs.transport,'transport'),export:amount(costs.export,'export'),eco:amount(costs.eco,'eco'),broker:amount(costs.broker,'broker'),testing:amount(costs.testing,'testing'),other:amount(costs.other,'other'),domestic:amount(costs.domestic,'domestic'),customs:costs.customs===''||costs.customs==null?null:Number(costs.customs)};
 const quote=calculator.calculate(input),scenario=quote.scenarios[0],packageChf=amount(costs.packageChf,'package'),serviceEur=cents(packageChf*rate);
 return {adChf,netChf,chVatDeductionChf:cents(adChf-netChf),input,quote,scenario,packageChf,serviceEur,total:cents(scenario.total+serviceEur)};
}
function packageBalance(packageChf,paidInspectionChf){return cents(Math.max(0,amount(packageChf,'package')-amount(paidInspectionChf,'inspection')));}
return Object.freeze({calculate,packageBalance});
});
