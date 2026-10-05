(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fx-reference.js'));
  else if (typeof window !== 'undefined') {
    // Load fx-reference.js first. Missing validation support resolves to null.
    const api = factory(root.SCFXReference);
    root.SCFXReferenceClient = Object.freeze({ ...api,
      ready: api.load({ fetchFn: typeof root.fetch === 'function' ? root.fetch.bind(root) : undefined }) });
  }
})(typeof window === 'undefined' ? this : window, function (reference) {
  'use strict';
  const URL = '/api/fx-reference';
  const MAX_BYTES = 65536;
  const MAX_FETCH_AGE_MS = 86400000;
  const CLOCK_TOLERANCE_MS = 300000;
  function validate(data, { now = Date.now() } = {}) {
    try {
      if (!data || typeof data !== 'object' || Array.isArray(data) || typeof reference?.statusForDate !== 'function') return null;
      if (data.version !== 1 || data.pair !== 'CHF/EUR' || data.source !== 'ECB' || !['current', 'last-known'].includes(data.status)) return null;
      const { chfPerEUR, eurPerCHF } = data;
      if (typeof chfPerEUR !== 'number' || typeof eurPerCHF !== 'number' || !Number.isFinite(chfPerEUR) || !Number.isFinite(eurPerCHF)
        || chfPerEUR < .25 || chfPerEUR > 2 || eurPerCHF < .5 || eurPerCHF > 4 || Math.abs(chfPerEUR * eurPerCHF - 1) > .000001) return null;
      if (typeof data.fetchedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(data.fetchedAt)) return null;
      const fetched = Date.parse(data.fetchedAt), clock = new Date(now).getTime();
      if (!Number.isFinite(fetched) || !Number.isFinite(clock) || new Date(fetched).toISOString().slice(0, 19) !== data.fetchedAt.slice(0, 19)
        || fetched > clock + CLOCK_TOLERANCE_MS || clock - fetched > MAX_FETCH_AGE_MS) return null;
      const status = reference.statusForDate(data.asOf, now);
      // Only whitelisted values leave this boundary. Supplied URLs, settings,
      // private fields and a cached freshness label are never trusted.
      return Object.freeze({ version: 1, pair: 'CHF/EUR', eurPerCHF, chfPerEUR, source: 'ECB',
        asOf: data.asOf, fetchedAt: new Date(fetched).toISOString(), status });
    } catch (_) { return null; }
  }
  async function limitedJson(response) {
    if (response.status !== 200 || (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json' || !response.body) {
      await response.body?.cancel(); return null;
    }
    const length = response.headers.get('content-length');
    if (length && /^\d+$/.test(length) && Number(length) > MAX_BYTES) { await response.body.cancel(); return null; }
    const reader = response.body.getReader(), chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); return null; }
        chunks.push(value);
      }
    } catch (error) {
      try { await reader.cancel(); } catch (_) { /* no private failure details leave load() */ }
      throw error;
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  async function load({ fetchFn = typeof fetch === 'function' ? fetch : null, now = () => Date.now(), timeoutMs = 6000 } = {}) {
    try {
      if (typeof fetchFn !== 'function' || typeof reference?.statusForDate !== 'function') return null;
      const response = await fetchFn(URL, { method: 'GET', credentials: 'omit', redirect: 'error',
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
      return validate(await limitedJson(response), { now: now() });
    } catch (_) { return null; }
  }
  return Object.freeze({ validate, load });
});
