/* SWISCARS · pravila obračuna pregleda (čista logika, bez DOM-a i mreže). Ogledalo SQL predloga (predlog/sql/003):
   P2/P3 ekspert: ukupno = osnovna + 2 × max(0, d − lokalnoKm) × cenaPoKm (km u oba smera, bez zaokruživanja na 10 i bez minimuma 90);
   P5 SWISCARS tim: ukupno = max(90, round((osnovna + 2 × d × cenaPoKm) / 10) × 10) — postojeće pravilo, nepromenjeno.
   Server (SQL) je autoritet za cenu; ovaj modul služi za prikaz primera u panelu eksperta i za testove. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.SCInspectionPricingRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const r2 = n => Math.round(n * 100) / 100;
  const num = v => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN);
  function expertTotal(p) {
    const base = num(p.base), kmRate = num(p.kmRate), localKm = num(p.localKm), dist = Math.max(0, Math.round(num(p.dist)));
    if (![base, kmRate, localKm].every(Number.isFinite) || !Number.isFinite(dist)) return null;
    const extraKm = Math.max(0, dist - localKm), travelKm = 2 * extraKm, travel = r2(travelKm * kmRate);
    return { dist, extraKm, travelKm, travel, total: r2(base + travel), version: 'expert-v1' };
  }
  function teamTotal(p) {
    const base = num(p.baseFee), kmRate = num(p.kmRate), dist = Math.max(0, Math.round(num(p.dist)));
    if (![base, kmRate].every(Number.isFinite) || !Number.isFinite(dist)) return null;
    const travel = r2(2 * dist * kmRate);
    return { dist, extraKm: dist, travelKm: 2 * dist, travel, total: Math.max(90, Math.round((base + travel) / 10) * 10), roundTo: 10, minimum: 90, version: 'per-km-v1' };
  }
  // Ogledalo sc_partner_private.validate_pricing: ista polja, iste granice, iste poruke po polju (srpski izvor, prevodi u katalogu).
  const LIMITS = { base_fee: [1, 5000], km_rate: [0, 20], local_km: [0, 50] };
  function validatePricing(input) {
    input = input || {};
    const errors = {};
    const p = { origin_plz: String(input.origin_plz || '').trim(), origin_ort: String(input.origin_ort || '').replace(/\s+/g, ' ').trim(),
      base_fee: r2(num(input.base_fee)), km_rate: r2(num(input.km_rate)), local_km: input.local_km === '' || input.local_km == null ? 10 : num(input.local_km),
      offer_active: input.offer_active === undefined ? true : !!(input.offer_active === true || input.offer_active === 'on' || input.offer_active === 'true') };
    if (!/^[1-9][0-9]{3}$/.test(p.origin_plz) || !p.origin_ort || p.origin_ort.length > 80) errors.origin = 'Izaberite polazište sa liste predloga.';
    if (!Number.isFinite(p.base_fee) || p.base_fee < LIMITS.base_fee[0] || p.base_fee > LIMITS.base_fee[1]) errors.base_fee = 'Unesite osnovnu cenu pregleda od 1 do 5000 CHF.';
    if (!Number.isFinite(p.km_rate) || p.km_rate < LIMITS.km_rate[0] || p.km_rate > LIMITS.km_rate[1]) errors.km_rate = 'Unesite cenu po kilometru od 0 do 20 CHF.';
    if (!Number.isInteger(p.local_km) || p.local_km < LIMITS.local_km[0] || p.local_km > LIMITS.local_km[1]) errors.local_km = 'Lokalno područje je ceo broj od 0 do 50 km.';
    return { ok: !Object.keys(errors).length, errors, pricing: p };
  }
  return { expertTotal, teamTotal, validatePricing, LIMITS };
});
