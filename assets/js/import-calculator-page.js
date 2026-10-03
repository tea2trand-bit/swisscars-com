(function () {
  'use strict';
  const $ = id => document.getElementById('import-' + id);
  const money = n => n.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0€';
  const names = { price: 'cenu vozila', rate: 'kurs', transport: 'prevoz', export: 'izvoznu dokumentaciju', eco: 'ekološku naknadu', broker: 'špeditera', testing: 'ispitivanje i dokumenta', other: 'ostale troškove', domestic: 'deo prevoza nakon granice', customs: 'carinsku vrednost' };
  const labels = { broker: 'špediter i carinski postupak', testing: 'ispitivanje i dokumenta u Srbiji', other: 'ostali troškovi' };
  const fields = ['price', 'currency', 'origin', 'rate', 'transport', 'export', 'eco', 'broker', 'testing', 'other', 'domestic', 'customs'];
  const fallback = { rate: 1.057, transport: 500, export: 100, eco: 155 };
  const touched = new Set();
  let activated = false;
  for (const [key, value] of Object.entries(fallback)) $(key).value = value;
  function render() {
    for (const key of fields) $(key).removeAttribute('aria-invalid');
    $('status').className = 'import-status';
    if (!activated && !$('price').value) return;
    try {
      for (const key of fields) if ($(key).validity.badInput) throw new Error(key);
      const input = Object.fromEntries(fields.map(key => [key, $(key).value]));
      const result = SCImportCalculator.calculate(input), a = result.scenarios[0], b = result.scenarios.at(-1);
      $('empty').hidden = true; $('result').hidden = false;
      $('total').textContent = result.scenarios.length > 1 ? `${money(a.total)} – ${money(b.total)}` : money(a.total);
      $('result-hint').textContent = result.scenarios.length > 1 ? 'Dve mogućnosti, u zavisnosti od prihvaćenog dokaza o poreklu.' : `Procena sa carinom od ${a.dutyPct.toLocaleString('sr-RS')}%.`;
      const scenarios = $('scenarios'); scenarios.replaceChildren(); scenarios.hidden = result.scenarios.length === 1;
      for (const s of result.scenarios) {
        const block = document.createElement('div'); block.className = 'import-scenario';
        const title = document.createElement('span'); title.textContent = `Carina ${s.dutyPct.toLocaleString('sr-RS')}%`;
        const total = document.createElement('strong'); total.textContent = money(s.total);
        const detail = document.createElement('small'); detail.textContent = `Carina ${money(s.duty)} · PDV ${money(s.vat)}`;
        block.append(title, total, detail); scenarios.append(block);
      }
      const rows = [['Vozilo', money(result.car)], ['Prevoz', money(result.costs.transport)], ['Izvozna dokumentacija', money(result.costs.export)], ['Ekološka naknada — procena', money(result.costs.eco)]];
      for (const key of ['broker', 'testing', 'other']) if (result.costs[key] !== null) rows.push([labels[key][0].toUpperCase() + labels[key].slice(1), money(result.costs[key])]);
      rows.push(['Carina', result.scenarios.length > 1 ? `${money(a.duty)} – ${money(b.duty)}` : money(a.duty)], ['PDV pri uvozu (20%)', result.scenarios.length > 1 ? `${money(a.vat)} – ${money(b.vat)}` : money(a.vat)]);
      const breakdown = $('breakdown'); breakdown.replaceChildren();
      for (const [label, value] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; breakdown.append(dt, dd); }
      $('missing').hidden = !result.missing.length;
      $('missing').textContent = 'Još nisu uključeni: ' + result.missing.map(k => labels[k]).join(', ') + '. Unesite ih u „Prilagodite kurs i troškove“ za potpuniji budžet.';
      $('status').textContent = 'Obračun je ažuriran.';
    } catch (error) {
      $('empty').hidden = false; $('result').hidden = true;
      const key = error.message;
      $(key)?.setAttribute('aria-invalid', 'true');
      $('status').className = 'import-status error';
      $('status').textContent = key === 'domestic' ? 'Deo prevoza nakon granice ne može biti veći od ukupnog prevoza.' : `Unesite ispravan iznos za ${names[key] || 'obračun'}.`;
    }
  }
  for (const key of fields) $(key).addEventListener('input', () => { touched.add(key); activated = true; render(); });
  $('form').addEventListener('submit', e => { e.preventDefault(); activated = true; render(); if (!$('result').hidden && matchMedia('(max-width:760px)').matches) $('result').scrollIntoView({ behavior: 'smooth', block: 'start' }); else if ($('result').hidden) { $('assumptions').open = true; document.querySelector('[aria-invalid="true"]')?.focus(); } });
  $('example').addEventListener('click', () => { $('price').value = '10000'; $('currency').value = 'CHF'; touched.add('price'); touched.add('currency'); activated = true; render(); });
  SCServicePrices.ready.then(data => {
    const defaults = data?.importDefaults;
    if (defaults) {
      for (const [key, value] of Object.entries(defaults)) if (key in fallback && !touched.has(key) && Number.isFinite(value)) $(key).value = value;
      document.getElementById('defaults-status').textContent = 'Početne procene iz podešavanja SWISCARS-a. Možete ih promeniti za ovaj obračun. Kurs nije ažuriran u realnom vremenu.';
    } else document.getElementById('defaults-status').textContent = 'Podešavanja trenutno nisu dostupna. Koristimo probne vrednosti: kurs 1,057, prevoz 500 €, izvoz 100 € i eko naknada 155 €. Proverite ih pre obračuna.';
    render();
  });
})();
