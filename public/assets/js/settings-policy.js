(function (root) {
  'use strict';
  const DEFAULTS = Object.freeze({ kapital: 0, rezervaKap: 0, rate: 1.057, vat: 8.1,
    pdv: 20, prevoz: 500, provizija: 900, inspKmRate: 1.5, depositPct: 10 });
  const VISIBLE_KEYS = Object.freeze(Object.keys(DEFAULTS).filter(key => key !== "inspKmRate"));
  const RULES = Object.freeze({
    kapital: { max: 1000000000 }, rezervaKap: { max: 1000000000 }, rate: { max: 10, positive: true },
    vat: { max: 100 }, pdv: { max: 100 },
    prevoz: { max: 100000 }, provizija: { max: 100000 }, inspKmRate: { max: 100 }, depositPct: { max: 100 }
  });
  function record(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Neispravan unos: ' + name);
    return value;
  }
  function numeric(value, key, rule = {}) {
    if (value == null || typeof value === 'string' && value.trim() === '') throw new Error('Nedostaje vrednost: ' + key);
    if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Neispravna vrednost: ' + key);
    const n = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value;
    if (!Number.isFinite(n) || n < 0 || n > rule.max || rule.positive && n <= 0) throw new Error('Neispravna vrednost: ' + key);
    return n;
  }
  function saved(settings, key, fallback, rule = RULES[key]) {
    return numeric(settings[key] == null ? fallback : settings[key], key, rule);
  }
  function formValues(settings = {}) {
    record(settings, 'podešavanja');
    const values = Object.fromEntries(VISIBLE_KEYS.map(key => [key, saved(settings, key, DEFAULTS[key])]));
    const exportCost = saved(settings, 'izvoz', 100, RULES.prevoz);
    const ecoCost = saved(settings, 'eko', 155, RULES.prevoz);
    // Only the form combines these three amounts. Their stored components and
    // existing tax formulas remain separate, including when the form is saved.
    const total = Math.round((values.prevoz + exportCost + ecoCost + Number.EPSILON) * 100) / 100;
    values.prevoz = numeric(total, 'prevoz', RULES.prevoz);
    // The canonical visible commission wins even if a stale package alias exists.
    return values;
  }
  function saveBody(values, payInfo = '', existing) {
    record(values, 'forma podešavanja');
    record(existing, 'postojeća podešavanja');
    const body = Object.fromEntries(VISIBLE_KEYS.map(key => [key, numeric(values[key], key, RULES[key])]));
    // Tax rates are displayed for reference, not edited with business charges.
    // Preserve the existing rates and reject a modified readonly field.
    for (const key of ['vat', 'pdv']) {
      if (body[key] !== saved(existing, key, DEFAULTS[key])) throw new Error('Poreska stopa nije promenljivo podešavanje: ' + key);
    }
    // Validate the old components before transforming the one visible field.
    // Export and eco stay in their current stored fields and VAT bases.
    saved(existing, 'prevoz', DEFAULTS.prevoz, RULES.prevoz);
    const exportCost = saved(existing, 'izvoz', 100, RULES.prevoz);
    const ecoCost = saved(existing, 'eko', 155, RULES.prevoz);
    const rawTransport = body.prevoz - exportCost - ecoCost;
    if (rawTransport < -1e-9) throw new Error('Ukupan prevoz ne može biti manji od postojećeg izvoza i eko takse');
    const transport = Math.round((Math.max(0, rawTransport) + Number.EPSILON) * 100) / 100;
    body.prevoz = numeric(transport, 'prevoz', RULES.prevoz);
    if (payInfo == null) payInfo = '';
    if (typeof payInfo !== 'string' || payInfo.length > 20000) throw new Error('Neispravne instrukcije za uplatu');
    return { ...body, payInfo, swissPackageFee: body.provizija };
  }
  const api = { formValues, saveBody, VISIBLE_KEYS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SCSettingsPolicy = api;
})(typeof window === 'undefined' ? this : window);
