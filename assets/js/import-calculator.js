(function (root) {
  'use strict';
  const OPTIONAL = ['broker', 'testing', 'other'];
  function numeric(value, name, { min = 0, max = 100000, optional = false } = {}) {
    if (value == null || String(value).trim() === '') {
      if (optional) return null;
      throw new Error(name);
    }
    const n = Number(String(value).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(name);
    return n;
  }
  const cents = n => Math.round((n + Number.EPSILON) * 100) / 100;
  function calculate(input) {
    const price = numeric(input.price, 'price', { min: 1, max: 1000000 });
    if (!['CHF', 'EUR'].includes(input.currency)) throw new Error('currency');
    if (!['unknown', 'preferential', 'standard'].includes(input.origin)) throw new Error('origin');
    const rate = numeric(input.rate, 'rate', { min: .01, max: 10 });
    const car = cents(input.currency === 'CHF' ? price * rate : price);
    const costs = {};
    for (const key of ['transport', 'export', 'eco', ...OPTIONAL]) costs[key] = numeric(input[key], key, { optional: OPTIONAL.includes(key) });
    const domestic = numeric(input.domestic, 'domestic');
    if (domestic > costs.transport) throw new Error('domestic');
    const override = numeric(input.customs, 'customs', { min: 1, max: 2000000, optional: true });
    const customsValue = override ?? cents(car + costs.export + costs.transport - domestic);
    const baseCosts = cents(car + Object.values(costs).reduce((sum, n) => sum + (n ?? 0), 0));
    function scenario(dutyPct) {
      const duty = cents(customsValue * dutyPct / 100);
      const vatBase = cents(customsValue + duty + costs.eco + domestic);
      const vat = cents(vatBase * .20);
      return { dutyPct, duty, vatBase, vat, total: cents(baseCosts + duty + vat) };
    }
    const scenarios = input.origin === 'unknown' ? [scenario(0), scenario(12.5)] : [scenario(input.origin === 'preferential' ? 0 : 12.5)];
    return { car, costs, customsValue, scenarios, missing: OPTIONAL.filter(k => costs[k] === null) };
  }
  const api = { calculate };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SCImportCalculator = api;
})(typeof window === 'undefined' ? this : window);
