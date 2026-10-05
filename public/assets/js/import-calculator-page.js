(function () {
  'use strict';
  const $ = id => document.getElementById('import-' + id);
  const money = n => n.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0€';
  const names = { price: 'cenu vozila', rate: 'kurs', transport: 'prevoz', export: 'izvoznu dokumentaciju', eco: 'ekološku naknadu', broker: 'špeditera', testing: 'ispitivanje i dokumenta', other: 'ostale troškove', domestic: 'deo prevoza nakon granice', customs: 'carinsku vrednost' };
  const labels = { broker: 'špediter i carinski postupak', testing: 'AMSS — ispitivanje i takse (procena)', other: 'ostali troškovi' };
  const fields = ['price', 'currency', 'origin', 'rate', 'transport', 'export', 'eco', 'broker', 'testing', 'other', 'domestic', 'customs'];
  const fallback = { transport: 500, export: 0, eco: 155, testing: 200 };
  let fx = null; let fxReady=false; let pendingResultReveal=false;
  const touched = new Set();
  const priceStep = 100, priceMin = 1, priceMax = 30000;
  let activated = false; let packageMode=false;
  for (const [key, value] of Object.entries(fallback)) $(key).value = value;
  $('rate').value = ''; $('rate').readOnly = true;
  function applyRate(data) {
    fx = data; fxReady=true;
    $('rate').value = fx ? String(fx.eurPerCHF) : '';
    $('rate-status').textContent = fx ? `ECB · ${new Date(fx.asOf+'T12:00:00Z').toLocaleDateString('sr-RS')}${fx.status==='last-known'?' · poslednji poznati kurs':''}. Referentni kurs za procenu; bankarski kurs može se razlikovati.` : 'Dnevni kurs trenutno nije dostupan. Obračun u CHF čeka kurs; cenu u evrima možete obračunati.';
    render();
  }
  function requestResultReveal(){pendingResultReveal=true;$('example-status').hidden=false;$('example-status').textContent='Pripremamo obračun…';}
  function finishResultReveal(){if(!pendingResultReveal)return;pendingResultReveal=false;$('example-status').hidden=false;$('example-status').textContent='Obračun je spreman.';if(matchMedia('(max-width:760px)').matches)requestAnimationFrame(()=>{$('result-card').scrollIntoView({behavior:'smooth',block:'start'});$('result-card').focus({preventScroll:true});});}
  function updatePriceControls() {
    const currency = $('currency').value === 'EUR' ? 'EUR' : 'CHF';
    $('price-step').textContent = `Korak ${priceStep} ${currency}`;
    $('price-minus').setAttribute('aria-label', `Smanjite cenu za ${priceStep} ${currency}`);
    $('price-plus').setAttribute('aria-label', `Povećajte cenu za ${priceStep} ${currency}`);
    const raw = $('price').value.trim(), value = raw === '' ? null : Number(raw);
    const invalid = $('price').validity.badInput || value !== null && (!Number.isFinite(value) || value < priceMin || value > priceMax);
    $('price-minus').disabled = invalid || value === null || value <= priceMin;
    $('price-plus').disabled = invalid || value !== null && value >= priceMax;
  }
  function adjustPrice(direction) {
    updatePriceControls();
    if ($(direction < 0 ? 'price-minus' : 'price-plus').disabled) return;
    const current = $('price').value.trim() === '' ? 0 : Number($('price').value);
    const next = Math.max(priceMin, Math.min(priceMax, Math.round((current + direction * priceStep + Number.EPSILON) * 100) / 100));
    $('price').value = String(next);
    $('price').dispatchEvent(new Event('input', { bubbles: true }));
  }
  function renderScenarios(container, scenarios) {
    container.replaceChildren(); container.hidden = false;
    for (const scenario of scenarios) {
      const block = document.createElement('div'); block.className = 'import-scenario';
      const title = document.createElement('span'); title.textContent = scenario.dutyPct === 0 ? 'Bez carine (0%)' : 'Sa carinom 12,5%';
      const total = document.createElement('strong'); total.textContent = money(scenario.total);
      const detail = document.createElement('small'); detail.textContent = `Carina ${money(scenario.duty)} · PDV 20% ${money(scenario.vat)}`;
      block.append(title, total, detail); container.append(block);
    }
  }
  function render() {
    updatePriceControls();
    for (const key of fields) $(key).removeAttribute('aria-invalid');
    $('status').className = 'import-status'; $('status').hidden=true;
    if (!activated && !$('price').value) return;
    try {
      for (const key of fields) if ($(key).validity.badInput) throw new Error(key);
      if (Number($('price').value) > priceMax) throw new Error('price');
      const input = Object.fromEntries(fields.map(key => [key, $(key).value]));
      if (input.currency === 'CHF' && !fx) throw new Error('rate');
      // An EUR-only input needs no CHF conversion, even if the source is offline.
      input.rate = fx ? fx.eurPerCHF : 1;
      const originUnconfirmed=input.origin==='unknown'; if(originUnconfirmed)input.origin='standard'; $('origin-note').textContent=originUnconfirmed?'Dok poreklo nije potvrđeno, računamo carinu 12,5%.':input.origin==='preferential'?'Carina 0% uz prihvaćen dokaz porekla.':'Carina 12,5% bez prihvaćenog dokaza porekla.'; const original=SCImportCalculator.calculate(input); if(packageMode){if(!fx)throw new Error('rate');input.price=Number(input.price)/1.081;input.origin='preferential';} const possible = SCImportCalculator.calculate(input), possibleA=possible.scenarios[0]; const result=original,a=result.scenarios[0],b=result.scenarios.at(-1); const packageFee=packageMode?700*fx.eurPerCHF:0; $('package-fee-eur').hidden=!packageMode; $('package-fee-eur').textContent=packageMode?'700 CHF':''; if(packageMode){possibleA.total=Math.round((possibleA.total+packageFee)*100)/100;} const deductions=$('package-deductions'); deductions.replaceChildren(); deductions.hidden=!packageMode; const dutySaving=packageMode?original.scenarios[0].duty-possibleA.duty:0, chVatSaving=packageMode?original.car-possible.car:0, srVatSaving=packageMode?original.scenarios[0].vat-possibleA.vat:0; for(const [label,value] of [['Carina u Srbiji', '- '+money(dutySaving)],['Švajcarski PDV (8,1%)','- '+money(chVatSaving)],['Razlika PDV-a pri uvozu','- '+money(srVatSaving)],['Ukupno uz SWISCARS',money(packageMode?possibleA.total:original.scenarios[0].total)],['Moguća neto ušteda',money(packageMode?original.scenarios[0].total-possibleA.total:0)]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;if(label==='Moguća neto ušteda'){dd.className='import-net-saving';}if(label==='Ukupno uz SWISCARS'){dt.className='import-sum';dd.className='import-sum';}deductions.append(dt,dd);} $('package-info').hidden=!packageMode; const saving=original.scenarios[0].total-possibleA.total; $('package-difference').textContent=packageMode?(saving>=0?'Moguća neto ušteda: ':'Dodatni trošak paketa: ')+money(Math.abs(saving)):''; $('package-note').textContent=packageMode?'Uslovna procena: cena uključuje CH PDV 8,1%, povrat i dokaz porekla se potvrđuju. SR PDV ostaje uključen. Osnovni uvoz ne uključuje zaseban pregled.':'';
      $('empty').hidden = true; $('result').hidden = false;
      const rows = [['Vozilo ('+Number($('price').value).toLocaleString('sr-RS')+' '+input.currency+')', money(result.car)], ['Prevoz', money(result.costs.transport)], ['Ekološka naknada — procena', money(result.costs.eco)]];
      for (const key of ['broker', 'testing', 'other']) if (result.costs[key] !== null) rows.push([labels[key][0].toUpperCase() + labels[key].slice(1), money(result.costs[key])]);
      rows.push(['Carina u Srbiji (12,5%)', result.scenarios.length > 1 ? `${money(a.duty)} – ${money(b.duty)}` : money(a.duty)], ['PDV pri uvozu (20%)', result.scenarios.length > 1 ? `${money(a.vat)} – ${money(b.vat)}` : money(a.vat)]);
      const dutyControl=$('duty-control');
      rows.push(['Ukupno',result.scenarios.length>1?money(a.total)+' – '+money(b.total):money(a.total)]);
      const breakdown = $('breakdown'); breakdown.replaceChildren();
      for (const [label, value] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; if(label==='Ukupno'||label==='Mogući ukupni trošak'){dt.className='import-sum';dd.className='import-sum';} breakdown.append(dt, dd); }
      $('missing').hidden = true;
      $('missing').textContent = '';
      $('status').textContent = ''; finishResultReveal();
    } catch (error) {
      $('empty').hidden = false; $('result').hidden = true;
      const key = error.message;
      $(key)?.setAttribute('aria-invalid', 'true');
      $('status').className = 'import-status error'; $('status').hidden=false;
      $('status').textContent = key === 'rate' && !fx ? 'Sačekajte dnevni kurs ili unesite cenu u evrima.' : key === 'domestic' ? 'Deo prevoza nakon granice ne može biti veći od ukupnog prevoza.' : `Unesite ispravan iznos za ${names[key] || 'obračun'}.`;
      if(pendingResultReveal){$('example-status').hidden=false;$('example-status').textContent=key==='rate'&&!fx&&!fxReady?'Učitavamo dnevni kurs. Obračun će se prikazati čim bude spreman.':key==='rate'&&!fx?'Dnevni kurs nije dostupan. Unesite cenu u evrima.':$('status').textContent;if(!(key==='rate'&&!fx&&!fxReady))pendingResultReveal=false;}
    }
  }
  for (const key of ['price','currency','origin']) $(key).addEventListener('input', () => { touched.add(key); activated = true; render(); });
  $('price-minus').addEventListener('click', () => adjustPrice(-1));
  $('price-plus').addEventListener('click', () => adjustPrice(1));

  for(const [id,value] of [['origin-yes','preferential'],['origin-no','standard']]) $(id).addEventListener('click',()=>{$('origin').value=value;$('origin-yes').setAttribute('aria-pressed',String(value==='preferential'));$('origin-no').setAttribute('aria-pressed',String(value==='standard'));activated=true;render();});
  $('package-check').addEventListener('change',()=>{packageMode=$('package-check').checked;activated=true;render();});
  updatePriceControls();
  $('form').addEventListener('submit', e => { e.preventDefault(); requestResultReveal(); activated=true; render(); if($('result').hidden&&!(pendingResultReveal&&!fxReady))$('price').focus(); });
  $('example').addEventListener('click', () => { requestResultReveal(); $('price').value = '10000'; $('currency').value = 'CHF'; touched.add('price'); touched.add('currency'); activated = true; render(); });
  SCServicePrices.ready.then(data => {
    const defaults = data?.importDefaults;
    if (defaults) {
      for (const [key, value] of Object.entries(defaults)) if (key in fallback && key!=='export' && !touched.has(key) && Number.isFinite(value)) $(key).value = value;
      document.getElementById('defaults-status').textContent = 'Početne procene troškova iz podešavanja SWISCARS-a. Možete ih promeniti za ovaj obračun. Kurs se automatski čita iz dnevne objave ECB-a.';
    } else document.getElementById('defaults-status').textContent = 'Podešavanja troškova trenutno nisu dostupna. Probne vrednosti: prevoz 500 €, izvoz 100 € i eko naknada 155 €. Proverite ih pre obračuna. Kurs se čita odvojeno iz dnevne objave ECB-a.';
    render();
  });
  SCFXReferenceClient.ready.then(applyRate);
})();
