const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../public/assets/js',name),'utf8');
function setup(options={}){const events={},writes=[],posts=[],button={},frame={contentWindow:{postMessage:v=>posts.push(v)}},close={},importStatus={textContent:'',dataset:{}},body={prepend(){}},card={dataset:{leadCard:'test-lead'},querySelector:s=>s==='.sc-import-status'?importStatus:s==='.team-lead-body'?body:null};
 const dialog={querySelector:s=>s==='iframe'?frame:close,open:false,addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}},bar={querySelector:()=>button};
 const ctx={URL,console,queueMicrotask,setTimeout:()=>0,clearTimeout(){},location:{origin:'https://swiscars.com'},MutationObserver:class{observe(){}},document:{createElement:t=>t==='dialog'?dialog:bar,body:{append(){}},getElementById:()=>({}),querySelectorAll:()=>[card]},LEADS:[{_id:'test-lead',name:'Miroslav Ilić',model:'Golf 7',status:'novo',proposals:[],...(options.listing?{listingUrl:options.listing}:{})}],canWrite:true,teamLeadHasListing:lead=>!!lead.listingUrl,actor:()=> 'Test',newToken:()=> 'a'.repeat(24),toast(){},openTeamContact(){},db:{doc:p=>({update:async v=>writes.push({path:p,value:v})})}};
 ctx.window=ctx;ctx.globalThis=ctx;ctx.addEventListener=(name,fn)=>events[name]=fn;vm.createContext(ctx);
 for(const name of ['purchase-flow.js','listing-details.js','proposal-facts.js','listing-snapshot-parser.js','team-listing-proposal.js'])vm.runInContext(read(name),ctx);
 return {ctx,writes,posts,events,button,frame,importStatus,dialog};
}
const snap={url:'https://www.autoscout24.ch/de/d/vw-golf-20885147',title:'VW Golf Kaufen',heading:'VW Golf',text:"CHF 8'990.–\n12.2018\nErstzulassung / Baujahr\n145'000 km\nKilometerstand\ngrau\nAussen\nschwarz\nInnen\nDiesel\nTreibstoff\nHalbautomatisches Getriebe\nGetriebe\n115 PS (85 kW)\nLeistung\nAusstattungen\nSerienmässige Ausstattung\n2 Schlüssel mit Fernbedienung\nEnergie & Emissionen",photos:['https://listing-images.autoscout24.ch/listing/147/20885147/a.jpg','https://listing-images.autoscout24.ch/listing/999/99999/b.jpg'],place:'9464 Lienz'};
test('production parser uses visible facts and rejects another listing photo or challenge',()=>{const {ctx}=setup(),p=ctx.SCListingSnapshotParser.readCapturedListing(snap);assert.equal(p.color,'grau');assert.equal(p.power,'115 PS (85 kW)');assert.equal(p.photos.length,1);assert.throws(()=>ctx.SCListingSnapshotParser.readCapturedListing({...snap,title:'Nur einen Moment',text:'Verify you are human'}));});
test('client facts use Serbian labels and KS and omit contacts and source URLs',()=>{const {ctx}=setup(),p=ctx.SCListingSnapshotParser.readCapturedListing(snap);const text=ctx.SCProposalFacts.describe({...p,description:'Service https://seller.invalid info@seller.invalid'},p.equipment);assert.match(text,/Spoljašnja boja: Siva/);assert.match(text,/115 KS/);assert.match(text,/Dva ključa/);assert.doesNotMatch(text,/seller\.invalid|Halbautomatisches/);assert.match(ctx.SCProposalFacts.markup({adNote:text},{}),/Podaci vozila/);});
test('only the current authenticated team dialog can publish, with internal source separated',async()=>{const s=setup();s.button.onclick();const p=s.ctx.SCListingSnapshotParser.readCapturedListing(snap),fields={...p,url:snap.url,mileage:p.mileage,price:p.price};const data={type:'swiscars-proposal-publish',fields,equipment:p.equipment,photos:p.photos,quote:{total:15025.34,packageChf:700,adChf:p.price}};
 await s.events.message({origin:'https://attacker.invalid',source:s.frame.contentWindow,data});assert.equal(s.writes.length,0);
 await s.events.message({origin:'https://swiscars.com',source:{},data});assert.equal(s.writes.length,0);
 await s.events.message({origin:'https://swiscars.com',source:s.frame.contentWindow,data});assert.equal(s.writes.length,1);const proposal=s.writes[0].value.proposals[0];assert.equal(proposal.internalListingUrl,snap.url);assert.equal(proposal.url,undefined);assert.equal(proposal.price,15025.34);assert.match(proposal.adNote,/Dva ključa/);assert.equal(s.posts.at(-1).ok,true);
});
test('invalid photo provenance and stale quotes never write a proposal',async()=>{const s=setup();s.button.onclick();const p=s.ctx.SCListingSnapshotParser.readCapturedListing(snap);const data={type:'swiscars-proposal-publish',fields:{...p,url:snap.url},equipment:p.equipment,photos:['https://listing-images.autoscout24.ch/listing/999/99999/a.jpg'],quote:{total:15000,packageChf:700,adChf:p.price}};await s.events.message({origin:'https://swiscars.com',source:s.frame.contentWindow,data});assert.equal(s.writes.length,0);data.photos=p.photos;data.quote.adChf=1;await s.events.message({origin:'https://swiscars.com',source:s.frame.contentWindow,data});assert.equal(s.writes.length,0);});

test('reading a customer listing stores vehicle facts without accepting a proposal, payment or availability',async()=>{
 const s=setup();s.ctx.LEADS[0].listingUrl=snap.url;s.ctx.teamLeadHasListing=lead=>!!lead.listingUrl;s.button.onclick();
 const fields=s.ctx.SCListingSnapshotParser.readCapturedListing(snap);
 await s.events.message({origin:'https://swiscars.com',source:s.frame.contentWindow,data:{type:'swiscars-proposal-publish',fields:{...fields,url:snap.url},equipment:fields.equipment,photos:fields.photos,quote:null}});
 assert.equal(s.writes.length,1);const patch=s.writes[0].value;assert.equal(patch.listingVehicle.title,'VW Golf');assert.equal(patch.listingVehicle.adChf,8990);assert.equal(patch.listingVehicle.photos.length,1);
 assert.equal(patch.proposals,undefined);assert.equal(patch.status,undefined);assert.equal(patch.listingCheck,undefined);assert.equal(patch.inspectionPaid,undefined);assert.equal(patch.listingVehicle.avail,undefined);
});

test('an incoming listing starts the same reader automatically and exposes a real failure on the card without a write',async()=>{
 const s=setup({listing:snap.url});
 assert.equal(s.frame.src,'/intern/predlog-vozila/');assert.equal(s.dialog.open,false);
 await s.events.message({origin:'https://swiscars.com',source:s.frame.contentWindow,data:{type:'swiscars-proposal-ready'}});
 assert.equal(s.posts.at(-1).record.entry,'listing');assert.equal(s.posts.at(-1).record.autoImport,true);assert.equal(s.posts.at(-1).record.listingUrl,snap.url);
 await s.events.message({origin:'https://attacker.invalid',source:s.frame.contentWindow,data:{type:'swiscars-proposal-import-status',state:'error',detail:'forged'}});
 assert.doesNotMatch(s.importStatus.textContent,/forged/);
 await s.events.message({origin:'https://swiscars.com',source:s.frame.contentWindow,data:{type:'swiscars-proposal-import-status',state:'error',detail:'SWISCARS čitač nije povezan.'}});await Promise.resolve();
 assert.match(s.importStatus.textContent,/čitač nije povezan/);assert.equal(s.button.hidden,false);assert.equal(s.writes.length,0);
 const p=s.ctx.SCListingSnapshotParser.readCapturedListing(snap);await s.events.message({origin:'https://swiscars.com',source:s.frame.contentWindow,data:{type:'swiscars-proposal-publish',fields:{...p,url:snap.url},equipment:p.equipment,photos:p.photos}});assert.equal(s.writes.length,0,'a stale callback after failure cannot save');
});
