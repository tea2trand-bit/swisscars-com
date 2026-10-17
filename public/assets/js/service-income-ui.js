/* Service receipts are separate from vehicle sale profit and outgoing bonuses. */
const serviceRateKinds=[['expert_commission','Ekspert'],['local_transport_commission','Lokalni transport'],['international_transport_commission','Međunarodni transport']];
function serviceDeductions(summary){const result={};for(const field of ['refunds','paidCosts','plannedCosts'])for(const [currency,value] of Object.entries(summary[field]))result[currency]=Math.round(((result[currency]||0)+value)*100)/100;return result;}
function renderServiceIncome(month){
 const report=SCServiceIncome.summarize({money:TEAM_MONEY,leads:LEADS,inspections:INSPS,month}),total=report.total;
 const metric=(label,values)=>'<div><span>'+esc(label)+'</span><strong>'+esc(CF.money(values))+'</strong></div>';
 $('serviceIncomeTotals').innerHTML=metric('Naplaćeno',total.income)+metric('Troškovi i povraćaji',serviceDeductions(total))+metric('Preostaje',total.remaining);
 $('serviceIncomeTable').tBodies[0].innerHTML=report.categories.filter(c=>c.id!=='transport_commission'||c.records.length).map(c=>'<tr><td><b>'+esc(c.label)+'</b>'+(Object.keys(c.expected).length?'<small>Čeka naplatu: '+esc(CF.money(c.expected))+'</small>':'')+'</td><td class="n">'+esc(CF.money(c.income))+'</td><td class="n">'+esc(CF.money(serviceDeductions(c)))+'</td><td class="n">'+esc(CF.money(c.remaining))+'</td></tr>').join('');
 const rates=SET.serviceCommissionRates||{};
 $('serviceRatesSummary').textContent=serviceRateKinds.map(([key,label])=>label+': '+(rates[key]==null?'—':fmt(rates[key])+'%')).join(' · ');
 $('serviceIncomeRecords').innerHTML=report.records.length?'<h3>Stavke obračuna</h3>'+report.records.map(row=>'<div class="service-income-record"><div><b>'+esc(row.what||row.serviceLabel)+'</b><span>'+esc(row.serviceLabel)+' · '+esc(row.date)+(row.commissionPct!=null?' · '+esc(fmt(row.commissionBase))+' '+esc(row.currency||'EUR')+' × '+esc(fmt(row.commissionPct))+'%':'')+' · '+(row.moneyStatus==='planned'?'Planirano':row.moneyKind==='income'?'Primljeno':row.moneyKind==='refund'?'Vraćeno':'Plaćeno')+'</span></div><strong>'+esc(row.amount==null?'Iznos nije upisan':(row.moneyKind==='income'?'+':'−')+CF.money({[row.currency||'EUR']:Number(row.amount)}))+'</strong></div>').join(''):'<p class="finance-empty"><strong>Nema evidentiranih usluga za ovaj mesec.</strong></p>';
}
async function saveServiceRates(documentRef,rates){
 for(const [key] of serviceRateKinds)if(rates[key]!==null&&(!Number.isFinite(rates[key])||rates[key]<0||rates[key]>100))throw Error('Procenat mora biti od 0 do 100.');
 const patch={serviceCommissionRates:rates},before=await documentRef.get();if(before.exists)await documentRef.update(patch);else await documentRef.set(patch);
 const saved=await documentRef.get(),actual=saved.exists?saved.data()?.serviceCommissionRates:null;
 if(!actual||serviceRateKinds.some(([key])=>actual[key]!==rates[key]))throw Error('Procenti nisu sačuvani. Pokušaj ponovo.');
 return rates;
}
function openServiceRates(){
 if(!canWrite||me?.role!=='admin')return;
 const pane=document.createElement('dialog');pane.className='service-finance-dialog service-rates-dialog';pane.setAttribute('aria-labelledby','serviceRatesTitle');
 const rates=SET.serviceCommissionRates||{};
 pane.innerHTML='<div class="service-dialog-head"><h2 id="serviceRatesTitle">B2B procenti</h2><button class="b" type="button" data-service-close aria-label="Zatvori">×</button></div><form><div class="service-rate-fields">'+serviceRateKinds.map(([key,label])=>'<label>'+esc(label)+'<span><input name="'+key+'" type="number" min="0" max="100" step="0.01" inputmode="decimal" required value="'+(rates[key]??'')+'"><b>%</b></span></label>').join('')+'</div><p data-service-result role="status"></p><div class="service-dialog-actions"><button class="b primary" type="submit">Sačuvaj</button></div></form>';
 document.body.append(pane);let busy=false;pane.oncancel=e=>{if(busy)e.preventDefault();};pane.addEventListener('close',()=>pane.remove(),{once:true});pane.querySelector('[data-service-close]').onclick=()=>{if(!busy)pane.close();};
 const form=pane.querySelector('form');
 form.onsubmit=async e=>{e.preventDefault();if(busy)return;const values={};for(const [key]of serviceRateKinds)values[key]=Number(form.elements[key].value);busy=true;const button=form.querySelector('[type=submit]');button.disabled=true;try{SET.serviceCommissionRates=await saveServiceRates(db.doc('settings/main'),values);renderCompanyMonth();pane.close();toast('B2B procenti su sačuvani');}catch(error){pane.querySelector('[data-service-result]').textContent=error.message;}finally{busy=false;button.disabled=false;}};
 pane.showModal();
}
function openServiceCommission(){
 if(!canWrite||!me?.active)return;
 const pane=document.createElement('dialog');pane.className='service-finance-dialog';pane.setAttribute('aria-labelledby','serviceCommissionTitle');
 pane.innerHTML='<div class="service-dialog-head"><h2 id="serviceCommissionTitle">Nova provizija</h2><button class="b" type="button" data-service-close aria-label="Zatvori">×</button></div><form><div class="service-entry-fields"><label>Vrsta usluge<select name="kind">'+serviceRateKinds.map(([key,label])=>'<option value="'+key+'">'+esc(label)+'</option>').join('')+'</select></label><label>Partner<input name="partner" maxlength="120" required placeholder="Ime ili naziv firme"></label><label>Cena usluge<input name="base" type="number" min="0.01" step="0.01" inputmode="decimal" required></label><label>Valuta<select name="currency"><option>CHF</option><option>EUR</option><option>RSD</option></select></label><label>Naš procenat, %<input name="pct" type="number" min="0" max="100" step="0.01" inputmode="decimal" required></label><div class="service-commission-preview"><span>Naša provizija</span><output>—</output></div><label>Status<select name="status"><option value="planned">Čeka naplatu</option><option value="paid">Primljeno</option></select></label><label>Datum<input name="date" type="date" value="'+today()+'" required></label></div><p data-service-result role="status"></p><div class="service-dialog-actions"><button class="b primary" type="submit">Sačuvaj proviziju</button></div></form>';
 document.body.append(pane);const form=pane.querySelector('form'),output=pane.querySelector('output');let busy=false;const id='service-commission-'+crypto.randomUUID();
 const preview=()=>{try{output.textContent=teamMoneyFormat(SCServiceIncome.commission(form.elements.base.value,form.elements.pct.value))+' '+form.elements.currency.value;}catch{output.textContent='—';}};
 const fillRate=()=>{form.elements.pct.value=SET.serviceCommissionRates?.[form.elements.kind.value]??'';preview();};form.addEventListener('input',preview);form.elements.currency.onchange=preview;form.elements.kind.onchange=fillRate;fillRate();
 pane.oncancel=e=>{if(busy)e.preventDefault();};pane.addEventListener('close',()=>pane.remove(),{once:true});pane.querySelector('[data-service-close]').onclick=()=>{if(!busy)pane.close();};
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||!canWrite)return;const result=pane.querySelector('[data-service-result]'),f=form.elements;
  try{const amount=SCServiceIncome.commission(f.base.value,f.pct.value);if(!(amount>0))throw Error('Provizija za evidentiranje mora biti veća od nule.');if(f.status.value==='paid'&&f.date.value>today())throw Error('Datum primljene uplate ne može biti u budućnosti.');
   if(!f.partner.value.trim())throw Error('Upiši naziv partnera.');
   const row={type:'money',moneyKind:'income',moneyStatus:f.status.value,phase:f.kind.value,serviceKind:f.kind.value,commissionBase:Number(f.base.value),commissionPct:Number(f.pct.value),amount,currency:f.currency.value,date:f.date.value,partnerName:f.partner.value.trim(),what:'Provizija · '+f.partner.value.trim(),recordedBy:actor(),actor:actor(),by:me?.id||null,created:Date.now(),at:Date.now()};
   busy=true;form.querySelector('[type=submit]').disabled=true;await db.doc('events/'+id).set(row);const check=await db.doc('events/'+id).get();if(!check.exists||Number(check.data()?.amount)!==amount)throw Error('Provizija nije sačuvana.');teamMoneyLocal('events',id,row);render();pane.close();toast('Provizija je evidentirana');
  }catch(error){result.textContent=error.message;busy=false;form.querySelector('[type=submit]').disabled=false;}
 };
 pane.showModal();
}
