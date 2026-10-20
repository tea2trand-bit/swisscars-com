const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const criteria=require('../public/assets/js/inquiry-criteria.js');
test('the public submit path preserves exact model, year bounds and engine capacity through the notes-only RPC contract',()=>{
 const source=fs.readFileSync(require.resolve('../public/assets/js/main.js'),'utf8');
 const start=source.indexOf('if(!listingForm&&window.SCInquiryCriteria)'),end=source.indexOf('const primary=await fetch',start);assert.ok(start>=0&&end>start);
 const submitted={brand:'BMW',model:'320d Touring',yearFrom:2017,yearTo:2022,engineCapacity:1995,notes:'Želim siv auto sa parking senzorima.'},values=new Map();
 const context={listingForm:false,SCInquiryCriteria:criteria,window:{SCInquiryCriteria:criteria},order:{...submitted},fd:{set:(key,value)=>values.set(key,value)}};
 vm.createContext(context);vm.runInContext('(function(){'+source.slice(start,end)+'})()',context);
 // Existing RPC preserves known columns and notes; it drops unknown root keys.
 const persisted={brand:context.order.brand,model:context.order.model,yearFrom:context.order.yearFrom,note:values.get('notes')};
 assert.equal(persisted.model,'320d Touring');assert.deepEqual(criteria.read(persisted),{yearFrom:2017,yearTo:2022,engineCapacity:1995,note:submitted.notes});
 assert.equal(criteria.notes({...persisted,...criteria.read(persisted)}),persisted.note,'repeated editing does not duplicate metadata');
});
test('older inquiries have no invented variant, engine size or upper year',()=>{
 const inquiry={brand:'BMW',model:'Serija 3',yearFrom:2017,fuel:'Dizel',note:'Karavan.'},before=JSON.stringify(inquiry),values=criteria.read(inquiry);
 assert.equal(values.yearTo,null);assert.equal(values.engineCapacity,null);assert.equal(inquiry.model,'Serija 3');assert.equal(JSON.stringify(inquiry),before);
});
test('contradictory year ranges and invalid capacity cannot be saved',()=>{
 assert.throws(()=>criteria.notes({yearFrom:2020,yearTo:2017}),/Godište do/);
 for(const engineCapacity of [2,0,10001,1995.5,'unknown'])assert.throws(()=>criteria.notes({engineCapacity}),/kubikažu/);
 assert.equal(criteria.notes({yearTo:'',engineCapacity:'',notes:'Bez dodatnih ograničenja.'}),'Bez dodatnih ograničenja.');
});
