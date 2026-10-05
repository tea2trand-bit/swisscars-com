(function (root) {
  'use strict';
  const SOURCE_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
  const MAX_BYTES = 65536;
  const MAX_AGE_DAYS = 8;
  const DAY_MS = 86400000;
  const ECB_NAMESPACE = 'http://www.ecb.int/vocabulary/2002-08-01/eurofxref';
  function invalid(code) { const error = new Error(code); error.code = code; throw error; }
  function instant(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) invalid('invalid_clock');
    return date;
  }
  function calendarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('invalid_source_date');
    const date = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid('invalid_source_date');
    return date;
  }
  function europeanClock(now) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hourCycle: 'h23'
    }).formatToParts(instant(now)).map(part => [part.type, part.value]));
    return { date: calendarDate(parts.year + '-' + parts.month + '-' + parts.day), hour: Number(parts.hour) };
  }
  function statusForDate(asOf, now = Date.now()) {
    const sourceDate = calendarDate(asOf), current = europeanClock(now), today = current.date;
    if (sourceDate > today) invalid('future_source_date');
    if ((today - sourceDate) / DAY_MS > MAX_AGE_DAYS) invalid('source_stale');
    if ([0, 6].includes(sourceDate.getUTCDay())) invalid('invalid_source_date');
    const expected = new Date(today);
    // A conservative publication window. TARGET holidays are not invented here:
    // an older weekday stays explicitly "last-known" rather than becoming today's rate.
    if (current.hour < 18 && ![0, 6].includes(expected.getUTCDay())) expected.setUTCDate(expected.getUTCDate() - 1);
    while ([0, 6].includes(expected.getUTCDay())) expected.setUTCDate(expected.getUTCDate() - 1);
    return sourceDate >= expected ? 'current' : 'last-known';
  }
  function attributes(source) {
    const result = {};
    const rest = source.replace(/\s+([A-Za-z_][\w:.-]*)\s*=\s*(["'])([^<>]*?)\2/g, (_, name, quote, value) => {
      if (Object.hasOwn(result, name)) invalid('invalid_xml');
      result[name] = value;
      return '';
    });
    if (rest.trim()) invalid('invalid_xml');
    return result;
  }
  function parse(xml, { now = Date.now() } = {}) {
    if (typeof xml !== 'string' || !xml.trim()) invalid('empty_source');
    if (new TextEncoder().encode(xml).byteLength > MAX_BYTES) invalid('source_too_large');
    // This intentionally recognizes the ECB envelope, not arbitrary XML. No DTD,
    // external entities, processing instructions or CDATA can supply a fake Cube.
    let body = xml.replace(/^\uFEFF/, '').replace(/<!--[^]*?-->/g, '').replace(/^\s*<\?xml\s[^]*?\?>/, '');
    if (/<[!?]/.test(body)) invalid('invalid_xml');
    const tokens = /<([^>]+)>/g, stack = [], dates = [], francs = [];
    let match, cursor = 0, roots = 0;
    while ((match = tokens.exec(body))) {
      const text = body.slice(cursor, match.index);
      if (/[<>]/.test(text) || !stack.length && text.trim()) invalid('invalid_xml');
      cursor = tokens.lastIndex;
      const token = match[1];
      if (token.startsWith('/')) {
        const close = /^\/([A-Za-z_][\w:.-]*)\s*$/.exec(token);
        if (!close || stack.pop()?.name !== close[1]) invalid('invalid_xml');
        continue;
      }
      const open = /^([A-Za-z_][\w:.-]*)([^]*?)(\/)?\s*$/.exec(token);
      if (!open) invalid('invalid_xml');
      const name = open[1], local = name.split(':').at(-1), attrs = attributes(open[2]), selfClosing = !!open[3];
      const parent = stack.at(-1), node = { name, local };
      if (!stack.length) {
        if (++roots !== 1 || local !== 'Envelope' || attrs.xmlns !== ECB_NAMESPACE || selfClosing) invalid('invalid_xml');
      }
      if (local === 'Cube') {
        if (Object.hasOwn(attrs, 'time')) {
          if (stack.length !== 2 || parent.local !== 'Cube' || Object.hasOwn(attrs, 'currency')) invalid('invalid_xml');
          calendarDate(attrs.time);
          node.asOf = attrs.time; dates.push(attrs.time);
        }
        if (Object.hasOwn(attrs, 'currency')) {
          if (!parent?.asOf || stack.length !== 3 || !selfClosing) invalid('invalid_xml');
          if (attrs.currency === 'CHF') francs.push(attrs.rate);
        }
      }
      if (!selfClosing) stack.push(node);
    }
    if (stack.length || roots !== 1 || body.slice(cursor).trim()) invalid('invalid_xml');
    if (dates.length !== 1) invalid('invalid_source_date');
    if (francs.length !== 1) invalid('invalid_chf_count');
    const raw = francs[0];
    if (typeof raw !== 'string' || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) invalid('invalid_source_rate');
    const chfPerEUR = Number(raw);
    // Broad explicit bounds reject corrupt/outlier payloads, not normal daily moves.
    if (!Number.isFinite(chfPerEUR) || chfPerEUR < .25 || chfPerEUR > 2) invalid('invalid_source_rate');
    const status = statusForDate(dates[0], now);
    return { version: 1, pair: 'CHF/EUR', eurPerCHF: 1 / chfPerEUR, chfPerEUR,
      source: 'ECB', asOf: dates[0], fetchedAt: instant(now).toISOString(), status };
  }
  const api = Object.freeze({ parse, statusForDate, SOURCE_URL, MAX_BYTES, MAX_AGE_DAYS });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SCFXReference = api;
})(typeof window === 'undefined' ? this : window);
