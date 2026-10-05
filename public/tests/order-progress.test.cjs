const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../assets/js/order-progress.js');
test('Team and client use the same stage for new, searched and proposed requests',()=>{
  for(const [lead,expected] of [[{},0],[{status:'trazimo'},1],[{aiCheckedAt:1},1],[{proposals:[{answer:null}]},2],[{proposals:[{answer:'zelim',depositPaidAt:1}]},2],[{proposals:[{choice:'buy'}]},3]]){
    assert.equal(P.stage(lead),expected);
    assert.equal(P.stage({...lead,aiAt:lead.aiCheckedAt,aiCheckedAt:undefined}),expected);
  }
});
test('Linked vehicle stages match the public request and retain closed state',()=>{
  for(const [status,expected] of [['kupljen',3],['transport',4],['carinjen',5],['garaza',6],['prodaja',6],['prodat',7]]){
    assert.equal(P.stage({}, {status}),expected);
    assert.equal(P.stage({car:{status}}),expected);
    assert.equal(P.stage({status:'odustao'}, {status}),-1);
  }
  assert.equal(P.stage({status:'predato'}),7);
  assert.equal(P.labels[2],'Kapara i pregled');
});
test('Numbered steps distinguish completed, current, next and future',()=>{
  const html=P.markup(2);
  assert.equal((html.match(/class="step-number"/g)||[]).length,8);
  assert.equal((html.match(/class="done"/g)||[]).length,2);
  assert.equal((html.match(/aria-current="step"/g)||[]).length,1);
  assert.equal((html.match(/class="next"/g)||[]).length,1);
  assert.match(html,/U toku/);assert.match(html,/Sledeće/);
  assert.doesNotMatch(P.markup(-1),/aria-current|class="done"|class="next"/);
  assert.match(P.markup(0,['<script>']),/&lt;script&gt;/);
});
