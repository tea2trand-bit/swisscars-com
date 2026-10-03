const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../intern/index.html'),'utf8');
const start=html.indexOf('$("saveInspectionPrice").addEventListener("click",async()=>{');
const end=html.indexOf('$("s_inspKmRate").addEventListener("keydown"',start);
assert(start>0&&end>start);
const handler=html.slice(start,end);
async function run(value,role='admin',canWrite=true,fail=false){
  let save;const writes=[];
  const els={s_inspKmRate:{value,reportValidity:()=>true},inspectionPriceStatus:{textContent:''},saveInspectionPrice:{disabled:false,addEventListener:(event,fn)=>{save=fn;}}};
  const context={savingInspectionPrice:false,canWrite,me:{role},$:(id)=>els[id],db:{doc:p=>({update:async body=>{if(fail)throw new Error('offline');writes.push({path:p,body});}})},fillSettings:()=>{},toast:()=>{},fail:()=>{}};
  vm.runInNewContext(handler,context);await save();return {writes,status:els.inspectionPriceStatus.textContent,saving:context.savingInspectionPrice};
}
test('inspection rate save removes base fee and writes no other settings',async()=>{
  const r=await run('1.5');assert.equal(r.writes.length,1);assert.equal(r.writes[0].path,'settings/main');assert.equal(JSON.stringify(r.writes[0].body),'{"inspKmRate":1.5,"inspBaseFee":0}');assert.equal(r.saving,false);
});
test('inspection rate save requires admin access and a valid bounded number',async()=>{
  assert.equal((await run('1.5','member')).writes.length,0);assert.equal((await run('1.5','admin',false)).writes.length,0);
  for(const value of ['', '-1', '100.01', 'NaN'])assert.equal((await run(value)).writes.length,0);
});
test('failed inspection rate save reports failure and releases the lock',async()=>{
  const r=await run('1.5','admin',true,true);assert.equal(r.writes.length,0);assert.match(r.status,/nije uspelo/);assert.equal(r.saving,false);
});
