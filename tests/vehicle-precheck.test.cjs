const test=require('node:test');
const assert=require('node:assert/strict');
const checks=require('../public/assets/js/vehicle-precheck.js');
const base={key:'lead|proposal',editable:true,canAvailability:true,available:null,origin:null,vat:null,extras:''};
test('vehicle checks contain only availability, origin and VAT, without workflow/payment controls',()=>{
 const html=checks.render(base);
 assert.equal((html.match(/class="team-vehicle-check-row"/g)||[]).length,3);
 assert.equal((html.match(/aria-pressed="false"/g)||[]).length,6);
 assert.equal((html.match(/Nije provereno/g)||[]).length,3);
 assert.ok(html.includes('EUR.1 / dokaz porekla'));
 assert.doesNotMatch(html,/inspectionPaid|inspectionScheduled|inspectionReviewed|data-proposal-flow|Pregled uplaćen|Kapara|Transport|Carina|team-process-check/);
});
test('a confirmed No remains distinct from an unanswered verification',()=>{
 const html=checks.render({...base,available:true,origin:false});
 assert.equal((html.match(/Nije provereno/g)||[]).length,1);
 assert.match(html,/data-check-field="originProofVerified" data-check-value="false"[^>]*aria-pressed="true"/);
 assert.match(html,/data-check-field="chVatRefundVerified" data-check-value="false"[^>]*aria-pressed="false"/);
});
test('read-only records offer no editing controls and preserve equipment text safely',()=>{
 const html=checks.render({...base,editable:false,extras:'Zimske felne <script>bad()</script>'});
 assert.doesNotMatch(html,/<button|<textarea|<script>/);
 assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));
});
test('already checked availability is read-only while unanswered proof fields remain editable',()=>{
 const html=checks.render({...base,canAvailability:false,available:true});
 assert.doesNotMatch(html,/data-pavok|data-pavno/);
 assert.match(html,/data-check-field="originProofVerified"/);
});
test('saving optional equipment changes no payment, report or workflow field',()=>{
 assert.deepEqual(checks.equipmentPatch('  Letnje i zimske felne  ','team-user',123),{vehicleExtras:'Letnje i zimske felne',checksUpdatedAt:123,checksUpdatedBy:'team-user'});
 assert.equal(checks.equipmentPatch('','team-user',123).vehicleExtras,'');
 assert.throws(()=>checks.equipmentPatch('x'.repeat(601),'team-user'),/600/);
 assert.throws(()=>checks.equipmentPatch({inspectionPaid:true},'team-user'),/600/);
});
