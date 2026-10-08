const {test}=require('node:test');
const assert=require('node:assert/strict');
const {calculate}=require('../assets/js/import-calculator.js');
const base={price:10000,currency:'CHF',origin:'unknown',rate:1.057,transport:500,export:100,eco:155,broker:'',testing:'',other:'',domestic:0,customs:''};
test('CHF conversion and separate duty scenarios; VAT includes duty and import levy',()=>{
  const r=calculate(base);assert.equal(r.car,10570);assert.equal(r.customsValue,11170);
  assert.deepEqual(r.scenarios,[{dutyPct:0,duty:0,vatBase:11325,vat:2265,total:13590},{dutyPct:12.5,duty:1396.25,vatBase:12721.25,vat:2544.25,total:15265.5}]);
  assert.deepEqual(r.missing,['broker','testing','other']);
});
test('EUR price is not converted; accepted proof selects only zero duty',()=>{
  const r=calculate({...base,currency:'EUR',origin:'preferential'});assert.equal(r.car,10000);assert.equal(r.scenarios.length,1);assert.equal(r.scenarios[0].duty,0);assert.equal(r.scenarios[0].total,12906);
});
test('vehicle prices have no fixed upper ceiling and retain the same cost calculation',()=>{
  for(const [price,total] of [[50000,60906],[1500000,1800906]]) {
    const r=calculate({...base,price,currency:'EUR',origin:'preferential'});
    assert.equal(r.car,price);assert.equal(r.scenarios[0].total,total);
  }
});
test('known gross services added once; explicit zero is different from unknown',()=>{
  const r=calculate({...base,broker:150,testing:100,other:0});assert.equal(r.scenarios[0].total,13840);assert.deepEqual(r.missing,[]);
});
test('domestic transport excluded from duty base, retained in import VAT base',()=>{
  const r=calculate({...base,origin:'standard',domestic:100});assert.equal(r.customsValue,11070);assert.equal(r.scenarios[0].duty,1383.75);assert.equal(r.scenarios[0].vatBase,12708.75);
});
test('broker-confirmed customs value changes taxes without changing purchase cost',()=>{
  const r=calculate({...base,origin:'standard',customs:12000});assert.equal(r.customsValue,12000);assert.equal(r.car,10570);assert.equal(r.scenarios[0].duty,1500);assert.equal(r.scenarios[0].vat,2731);assert.equal(r.scenarios[0].total,15556);
});
test('no service package or commission is added',()=>{
  const r=calculate({...base,swissPackageFee:900,commission:1000});assert.equal(r.scenarios[0].total,13590);
});
test('invalid, negative, missing and excessive values rejected',()=>{
  for(const patch of [{price:''},{price:-1},{price:Infinity},{rate:0},{transport:''},{broker:-1},{domestic:501},{currency:'RSD'},{origin:'invented'},{customs:0},{eco:100001}])assert.throws(()=>calculate({...base,...patch}));
});
test('decimal comma supported and no special return of Swiss VAT assumed',()=>{
  const r=calculate({...base,rate:'1,057',price:'10000,50'});assert.equal(r.car,10570.53);
});
