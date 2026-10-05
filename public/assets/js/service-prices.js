(function () {
  'use strict';
  const url = 'https://qghrrnqsvsrcwdhgufkv.supabase.co/rest/v1/rpc/sc_public_service_prices';
  const key = 'sb_publishable_ouwn1r_BvZS9nWyg3vJHAQ_ApUagfSP';
  let current = null;
  const api = {
    format(text, lang = document.documentElement.lang || 'sr') {
      const locale = { sr: 'sr-RS', de: 'de-CH', en: 'en-GB' }[lang] || 'sr-RS';
      const unavailable = { sr: 'potvrđujemo pre kupovine', de: 'vor dem Kauf bestätigt', en: 'confirmed before purchase' }[lang] || 'potvrđujemo pre kupovine';
      const fee = current?.swissPackageCHF;
      const value = Number.isFinite(fee) && fee >= 0 ? fee.toLocaleString(locale, { maximumFractionDigits: 2 }) + ' CHF' : unavailable;
      return String(text).replaceAll('{swissPackage}', value);
    }
  };
  api.ready = fetch(url, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000) })
    .then(r => { if (!r.ok) throw new Error('prices_unavailable'); return r.json(); })
    .then(data => { if (!data || !Number.isFinite(data.swissPackageCHF) || data.swissPackageCHF < 0) throw new Error('invalid_prices'); current = data; return data; })
    .catch(() => null)
    .then(data => { document.dispatchEvent(new CustomEvent('sc-service-prices-ready')); return data; });
  window.SCServicePrices = api;
})();
