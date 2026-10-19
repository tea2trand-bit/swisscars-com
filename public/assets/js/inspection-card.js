(function(){
'use strict';
const $=s=>document.querySelector(s),id=new URLSearchParams(location.search).get('session');
let current;
const money=n=>Number(n).toLocaleString('sr-Latn-RS',{minimumFractionDigits:2,maximumFractionDigits:2})+' CHF';
async function call(endpoint,body){const r=await fetch('/__preview/inspection-card/'+endpoint,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok||d.error)throw Error(d.error||'Plaćanje nije dostupno.');return d;}
function render(d){current=d;if(d.serviceMode==='swiscars'){$('.back').textContent='← Pregled SWISCARS';$('.back').href='/pregled/';}$('#car').textContent=d.car;$('#place').textContent=d.place;$('#amount').textContent=money(d.amountCents/100);const simulation=d.mode==='local_simulation';$('#notice').textContent=simulation?'Lokalna simulacija — prava kartica se ne unosi i nema stvarne naplate.':'Stripe probni režim — nema stvarne naplate.';
 const paid=d.status==='paid';$('#heading').textContent=paid?'Uplata je potvrđena':d.status==='cancelled'?'Plaćanje je otkazano':d.status==='failed'?'Plaćanje nije uspelo':d.status==='expired'?'Vreme za plaćanje je isteklo':d.status==='payment_review'?'Uplata je na proveri':'Potvrdite plaćanje';
 $('#explanation').textContent=paid?(d.serviceMode==='swiscars'?'SWISCARS tim sada dogovara termin sa prodavcem. Termin će biti vidljiv u vašem upitu.':'Dogovor termina je sada otključan ekspertu. Termin će biti vidljiv u vašem upitu.'):simulation?'Ovo prikazuje tok plaćanja. Podaci prave kartice se ovde ne unose.':'Čeka se potvrda Stripe servisa. Povratak na ovu stranicu sam po sebi ne potvrđuje uplatu.';
 $('#pay').hidden=!simulation||d.status!=='pending';$('#cancel').hidden=!simulation||d.status!=='pending';$('#tools').hidden=!simulation||d.status!=='pending';$('#pay').disabled=false;$('#pay').textContent='Potvrdi plaćanje · '+money(d.amountCents/100);
 if(d.customerUrl){const u=new URL(d.customerUrl,location.origin);if(u.origin===location.origin){$('#return').href=u.href;$('#return').hidden=!paid&&d.status==='pending';}}
 $('#status').className='status'+(paid?' done':'');$('#status').textContent=paid?(simulation?'Potvrđeno samo u lokalnoj simulaciji.':'Potvrđeno u Stripe probnom režimu.'):' ';
}
async function outcome(value){$('#pay').disabled=true;$('#cancel').disabled=true;try{await call('simulate',{id,outcome:value});render(await call('session?id='+encodeURIComponent(id)));}catch(e){$('#status').textContent=e.message;$('#status').className='status error';}finally{$('#pay').disabled=false;$('#cancel').disabled=false;}}
$('#pay').onclick=()=>outcome('success');$('#cancel').onclick=()=>outcome('cancel');$('#fail').onclick=()=>outcome('fail');
if(!id){$('#car').textContent='Plaćanje nije pronađeno';$('#status').textContent='Otvorite plaćanje iz svog upita.';return;}
call('session?id='+encodeURIComponent(id)).then(render).catch(e=>{$('#car').textContent='Plaćanje nije dostupno';$('#status').textContent=e.message;$('#status').className='status error';});
})();
