const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const flow=require('../public/assets/js/purchase-flow.js');
test('the submitted listing price survives the existing notes-based database contract',()=>{
 const source=fs.readFileSync(require.resolve('../public/assets/js/main.js'),'utf8');
 const start=source.indexOf('if(listingForm){const details=order.notes'),end=source.indexOf('const primary=await fetch',start);
 assert.ok(start>=0&&end>start);const formValues=new Map();
 const context={listingForm:true,listingPrice:47490,order:{listingUrl:'https://www.autoscout24.ch/de/d/audi-rs3-20851760',notes:'Želim podatke vozila.'},fd:{set:(k,v)=>formValues.set(k,v)}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const persisted={note:context.order.notes,budget:null};assert.equal(flow.request(persisted).listingPriceChf,47490);assert.equal(flow.request(persisted).url,context.order.listingUrl);assert.equal(formValues.get('notes'),persisted.note);assert.match(persisted.note,/Želim podatke vozila/);
});
test('a search budget is never presented as the advertised CHF price',()=>{
 assert.equal(flow.request({budget:15000,note:'Upit za pomoć pri kupovini izabranog auta. Oglas: https://www.autoscout24.ch/de/d/audi-123'}).listingPriceChf,null);
 assert.equal(flow.request({listingPriceChf:-1}).listingPriceChf,null);
});
