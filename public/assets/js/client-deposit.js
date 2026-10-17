(function(){
 'use strict';
 const texts={
 sr:{amount:'Kapara',pay:'Podaci za uplatu',notify:'Uplatio sam kaparu',notified:'Uplata prijavljena',checking:'Prijavili ste uplatu kapare. Tim proverava banku; kupovina počinje tek posle potvrđenog prijema.',missing:'Tim još nije uneo podatke za uplatu. Obratite nam se kroz Razgovor.',saving:'Prijavljujem uplatu…',error:'Prijava nije sačuvana. Pokušajte ponovo.',basis:'od ukupne procene'},
 de:{amount:'Anzahlung',pay:'Zahlungsangaben',notify:'Ich habe die Anzahlung überwiesen',notified:'Zahlung gemeldet',checking:'Die Zahlung wurde gemeldet. Das Team prüft den Bankeingang. Der Kauf beginnt erst nach bestätigtem Eingang.',missing:'Das Team hat noch keine Zahlungsangaben hinterlegt. Bitte kontaktieren Sie uns im Gespräch.',saving:'Zahlung wird gemeldet…',error:'Meldung nicht gespeichert. Bitte erneut versuchen.',basis:'der Gesamtschätzung'},
 en:{amount:'Deposit',pay:'Payment details',notify:'I have paid the deposit',notified:'Payment reported',checking:'You reported the payment. The team checks the bank; purchase starts only after receipt is confirmed.',missing:'The team has not entered payment details yet. Please contact us in the conversation.',saving:'Reporting payment…',error:'Your report was not saved. Please try again.',basis:'of the total estimate'}
 };
 function render({host,record,proposal:p,lang,token,rpc,onChange}){
  host.querySelectorAll('.client-deposit').forEach(x=>x.remove());
  if(!p||record.car||['arhiva','odustao','otkazano'].includes(record.status)||p.choice!=='buy'||p.serviceMode!=='package'||p.depositPaidAt||p.depositRefundAt)return;
  const plan=p.depositPlan||SCDepositPlan.quote(record,p,{depositPct:record.depositPct});if(!plan||!(Number(plan.amount)>0))return;
  const t=texts[lang]||texts.sr,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const amount=new Intl.NumberFormat(lang==='de'?'de-CH':lang==='en'?'en-GB':'sr-Latn-RS',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Number(plan.amount));
  const reported=Number(p.depositReportedAt)>0,node=document.createElement('section');node.className='client-deposit';
  node.innerHTML='<div class="client-deposit-actions"><span>'+esc(t.amount)+' <strong>'+esc(amount)+'</strong></span><button type="button" class="btn btn-outline" data-deposit-pay>'+esc(t.pay)+'</button><button type="button" class="btn btn-gold" data-deposit-notify'+(reported?' disabled':'')+'>'+esc(reported?t.notified:t.notify)+'</button></div><div class="client-deposit-pay" hidden>'+esc(record.pay||t.missing)+'</div><p class="client-deposit-feedback" role="status"></p>';
  host.append(node);
  if(reported){const status=host.querySelector(':scope > div');if(status)status.textContent=t.checking;}
  node.querySelector('[data-deposit-pay]').onclick=()=>{const box=node.querySelector('.client-deposit-pay');box.hidden=!box.hidden;};
  node.querySelector('[data-deposit-notify]').onclick=async()=>{const b=node.querySelector('[data-deposit-notify]'),feedback=node.querySelector('[role="status"]');b.disabled=true;feedback.textContent=t.saving;try{const r=await rpc('sc_order_deposit_notice',{p_token:token,p_id:p.id,p_expected_amount:Number(plan.amount)}),result=await r.json();if(!r.ok||result?.ok!==true)throw Error('not_saved');await onChange();}catch{feedback.textContent=t.error;b.disabled=false;}};
 }
 window.SCClientDeposit={render};
})();
