// Preview-only calculator. The existing stable RPC reads geographic data only.
(() => {
  const endpoint = 'https://qghrrnqsvsrcwdhgufkv.supabase.co/rest/v1/rpc/sc_insp_price_preview';
  const publicKey = 'sb_publishable_ouwn1r_BvZS9nWyg3vJHAQ_ApUagfSP';
  const byId = id => document.getElementById(id);
  const postcode = byId('trial-postcode');
  const status = byId('trial-status'), result = byId('trial-result');
  const amount = x => new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x) + ' CHF';
  let quote = null, timer, controller, sequence = 0;
  const validPlace = value => /^\d{4}$/.test(value) || (value.length >= 3 && value.length <= 80 && /\p{L}/u.test(value));

  function render() {
    if (!quote) { result.hidden = true; return; }
    byId('trial-destination').textContent = quote.ort + ' (' + quote.plz + ')';
    byId('trial-total').textContent = amount(Number(quote.price));
    result.hidden = false;
    status.textContent = 'Probni obračun je prikazan ispod.';
  }

  async function calculate() {
    clearTimeout(timer);
    if (controller) controller.abort();
    const request = ++sequence, value = postcode.value.trim();
    quote = null; result.hidden = true;
    if (!validPlace(value)) {
      status.textContent = 'Unesite poštanski broj od četiri cifre ili naziv grada (najmanje tri slova).';
      return;
    }
    controller = new AbortController();
    const currentController = controller;
    const timeout = setTimeout(() => currentController.abort(), 10000);
    status.textContent = 'Računamo udaljenost i probnu cenu…';
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { apikey: publicKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_place: value }), signal: currentController.signal
      });
      if (!response.ok) throw new Error('quote_unavailable');
      const data = await response.json();
      if (request !== sequence || value !== postcode.value.trim()) return;
      if (!data || !data.found) { status.textContent = 'Mesto nije pronađeno. Proverite naziv ili unesite poštanski broj.'; return; }
      if (!data.available || data.price == null || !Number.isFinite(Number(data.price)) || Number(data.price) < 0) throw new Error('invalid_price');
      quote = data; render();
    } catch (error) {
      if (request === sequence) status.textContent = 'Udaljenost trenutno nije dostupna. Pokušajte ponovo.';
    } finally { clearTimeout(timeout); }
  }

  byId('trial-form').addEventListener('submit', event => { event.preventDefault(); calculate(); });
  postcode.addEventListener('input', () => {
    ++sequence; clearTimeout(timer); if (controller) controller.abort();
    quote = null; result.hidden = true; status.textContent = '';
    if (validPlace(postcode.value.trim())) timer = setTimeout(calculate, 500);
  });
})();
