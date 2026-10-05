(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./import-calculator.js'));
  else root.SCOrderQuote=factory(root.SCImportCalculator);
})(typeof window==='undefined'?this:window,function(calculator){
  'use strict';
  function calculate(p,settings,fx){
    if(settings?.version!==1||!fx||!Number.isFinite(fx.eurPerCHF)||fx.eurPerCHF<=0)throw Error('quote_unavailable');
    const fee=Number(p.commission??settings.serviceChf);
    if(!Number.isFinite(fee)||fee<0)throw Error('service_unavailable');
    const base={price:Number(p.adChf),currency:'CHF',origin:p.originProofVerified===true?'preferential':'standard',rate:fx.eurPerCHF,transport:Number(settings.transport),export:Number(settings.export),eco:Number(settings.eco),broker:0,testing:200,other:0,domestic:0,customs:null};
    if(p.chVatRefundVerified===true)base.price/=1.081;
    const quote=calculator.calculate(base),scenario=quote.scenarios[0],service=fee*base.rate,total=Math.round((scenario.total+service+Number.EPSILON)*100)/100;
    return {base,quote,scenario,fee,service,total};
  }
  return Object.freeze({calculate});
});
