(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SCCompanyBudgetPlan=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const cents=value=>{if(typeof value!=='number'||!Number.isFinite(value))return null;const n=Math.round(value*100);return Number.isSafeInteger(n)?n:null;};
 const money=n=>n/100;
 function recommend(candidates,options){
  const budget=cents(options?.budget),goal=cents(options?.minProfit),preference=options?.preference;
  if(!(budget>0)||goal===null||goal<0||!['profit','demand'].includes(preference))throw Error('Proveri budžet, zaradu po autu i prioritet.');
  const seen=new Set(),eligible=[];
  for(const candidate of candidates||[]){
   const cash=cents(candidate.cash),cost=cents(candidate.cost),profit=cents(candidate.profit),id=String(candidate.id||''),identity=String(candidate.identity||id);
   if(!id||seen.has(identity)||!(cash>0)||!(cost>0)||cash<cost||cash>budget||profit===null||profit<goal)continue;
   seen.add(identity);eligible.push({...candidate,id,identity,cash,cost,profit,demandVerified:candidate.demandVerified===true&&Number.isFinite(candidate.demandScore)&&candidate.demandScore>=0&&candidate.demandScore<=1});
  }
  const demandKnown=eligible.length>0&&eligible.every(c=>c.demandVerified),rankDemand=preference==='demand'&&demandKnown;
  const compare=(a,b)=>(rankDemand?b.demand-a.demand:0)||b.profit-a.profit||a.cash-b.cash;
  let states=[{items:[],cash:0,cost:0,profit:0,demand:0}],bounded=false;
  // A bounded search proposes a combination; it never claims a global market optimum.
  for(const candidate of eligible){
   const next=states.slice();
   for(const state of states){
    const cash=state.cash+candidate.cash;if(cash>budget)continue;
    next.push({items:state.items.concat(candidate),cash,cost:state.cost+candidate.cost,profit:state.profit+candidate.profit,demand:state.demand+(candidate.demandVerified?candidate.demandScore:0)});
   }
   const byCash=new Map();
   for(const state of next){const old=byCash.get(state.cash);if(!old||compare(state,old)<0)byCash.set(state.cash,state);}
   states=[...byCash.values()];
   if(states.length>2048){bounded=true;states.sort(compare);const keep=new Set(states.slice(0,1536));for(const state of [...states].sort((a,b)=>a.cash-b.cash).slice(0,512))keep.add(state);states=[...keep];}
  }
  const chosen=states.filter(s=>s.items.length).sort(compare)[0]||{items:[],cash:0,cost:0,profit:0,demand:0};
  return {version:1,budget:money(budget),minProfit:money(goal),preference,items:chosen.items.map(c=>({id:c.id,cash:money(c.cash),cost:money(c.cost),profit:money(c.profit),provisional:c.provisional!==false})),count:chosen.items.length,requiredCash:money(chosen.cash),totalCost:money(chosen.cost),totalProfit:money(chosen.profit),remainingCash:money(budget-chosen.cash),eligibleCount:eligible.length,demandVerified:demandKnown,ranking:rankDemand?'verified-demand':'profit',bounded,provisional:chosen.items.some(c=>c.provisional!==false)};
 }
 function validate(plan,candidates,options){
  if(!plan||plan.version!==1||!Array.isArray(plan.items)||!plan.items.length)return false;
  const budget=cents(options?.budget),goal=cents(options?.minProfit);if(!(budget>0)||goal===null||goal<0)return false;
  const records=new Map((candidates||[]).map(c=>[String(c.id),c])),seen=new Set();let cash=0,cost=0,profit=0;
  for(const item of plan.items){
   const c=records.get(String(item.id));if(!c)return false;
   const identity=String(c.identity||c.id),cCash=cents(c.cash),cCost=cents(c.cost),cProfit=cents(c.profit);
   if(seen.has(identity)||!(cCash>0)||!(cCost>0)||cCash<cCost||cProfit===null||cProfit<goal)return false;
   seen.add(identity);cash+=cCash;cost+=cCost;profit+=cProfit;
   if(cents(item.cash)!==cCash||cents(item.cost)!==cCost||cents(item.profit)!==cProfit)return false;
  }
  return cash<=budget&&cents(plan.budget)===budget&&cents(plan.minProfit)===goal&&plan.count===plan.items.length&&cents(plan.requiredCash)===cash&&cents(plan.totalCost)===cost&&cents(plan.totalProfit)===profit&&cents(plan.remainingCash)===budget-cash;
 }
 return {recommend,validate};
});
