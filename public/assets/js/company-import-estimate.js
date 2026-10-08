(function(root, factory) {
  'use strict';
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./stage/public/assets/js/import-calculator.js'));
  else root.SCCompanyImportEstimate=factory(root.SCImportCalculator);
})(typeof window==='undefined'?this:window,function(calculator){
  'use strict';
  const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
  function number(value,name,{optional=false,max=1000000}={}){
    if(optional&&(value==null||value===''))return null;
    if(value==null||typeof value==='boolean'||String(value).trim()==='')throw Error(name);
    const n=Number(value);if(!Number.isFinite(n)||n<0||n>max)throw Error(name);return n;
  }
  function calculate(input){
    const price=number(input.price,'price'),rate=number(input.rate,'rate',{max:10});
    const vat=number(input.swissVatPct??8.1,'swissVatPct',{max:100});
    const favorable=input.favorable===true;
    // The single switch is a scenario. Actual ads retain two independent facts.
    const refund=typeof input.refundEligible==='boolean'?input.refundEligible:favorable;
    const origin=typeof input.originEligible==='boolean'?input.originEligible:favorable;
    const reserve=number(input.reserve??0,'reserve');
    const result=calculator.calculate({...input,price:refund?price/(1+vat/100):price,rate,origin:origin?'preferential':'standard'});
    const scenario=result.scenarios[0],gross=cents(input.currency==='CHF'?price*rate:price);
    const refundAmount=cents(gross-result.car),total=cents(scenario.total+reserve);
    const sale=number(input.sale,'sale',{optional:true}),goal=number(input.goal??0,'goal');
    const missing=result.missing;
    const pre= sale===null?null:cents(sale-total);
    return Object.freeze({version:2,basis:'cash-difference-before-profit-tax',price,currency:input.currency,rate,
      grossPurchase:gross,refundEligible:refund,originEligible:origin,refundAmount,netPurchase:result.car,
      customsValue:result.customsValue,dutyPct:scenario.dutyPct,duty:scenario.duty,vat:scenario.vat,
      costs:result.costs,reserve,importTotal:scenario.total,total,upfrontCash:cents(total+refundAmount),
      sale,goal,profitBeforeTax:pre,requiredSale:cents(total+goal),meetsGoal:pre!==null&&pre>=goal,
      missing,complete:missing.length===0});
  }
  function maxPurchase(input,budget){
    budget=number(budget,'budget');
    const refund=typeof input.refundEligible==='boolean'?input.refundEligible:input.favorable===true;
    let lo=refund?1+number(input.swissVatPct??8.1,'swissVatPct',{max:100})/100:1,hi=1000000;
    const eligible=price=>{try{const x=calculate({...input,price});return x.meetsGoal&&x.upfrontCash<=budget;}catch{return false;}};
    if(!eligible(lo))return 0;
    for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(eligible(mid))lo=mid;else hi=mid;}
    const value=Math.floor(lo*100)/100;
    return eligible(value)?value:Math.max(0,value-.01);
  }
  return Object.freeze({calculate,maxPurchase});
});
