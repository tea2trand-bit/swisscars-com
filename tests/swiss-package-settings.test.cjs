const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../intern/index.html'),'utf8');
const start=html.indexOf('$("saveSwissPackage").addEventListener("click",async()=>{');
const end=html.indexOf('$("saveInspectionPrice").addEventListener',start);
assert(start>0&&end>start);
const actualHandler=html.slice(start,end);
async function run(value,role='admin',canWrite=true,fail=false){
  let save;const writes=[];const els={s_swissPackageFee:{value,reportValidity:()=>true},swissPackageStatus:{textContent:''},saveSwissPackage:{disabled:false,addEventListener:(event,fn)=>{save=fn;}}};
  const context={savingSwissPackage:false,canWrite,me:{role},$:(id)=>els[id],db:{doc:p=>({update:async body=>{if(fail)throw new Error('offline');writes.push({path:p,body});}})},fillSettings:()=>{},toast:()=>{},fail:()=>{}};
  vm.runInNewContext(actualHandler,context);await save();return {writes,status:els.swissPackageStatus.textContent,saving:context.savingSwissPackage};
}
test('save writes only the separate package price field',async()=>{
  const r=await run('950');assert.equal(r.writes.length,1);assert.equal(r.writes[0].path,'settings/main');assert.equal(JSON.stringify(r.writes[0].body),'{"swissPackageFee":950}');assert.equal(r.saving,false);
});
test('non-admin and read-only user cannot save',async()=>{
  assert.equal((await run('950','member')).writes.length,0);assert.equal((await run('950','admin',false)).writes.length,0);
});
test('blank, negative and excessive package prices are rejected',async()=>{
  for(const price of ['', '-1', '100001', 'NaN'])assert.equal((await run(price)).writes.length,0);
});
test('failed save does not claim success and releases duplicate-click lock',async()=>{
  const r=await run('950','admin',true,true);assert.equal(r.writes.length,0);assert.match(r.status,/nije uspelo/);assert.equal(r.saving,false);
});
