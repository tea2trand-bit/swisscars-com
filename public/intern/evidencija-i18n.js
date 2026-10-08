/* SWISCARS evidencija · sloj jezika (SR/DE/EN) za /intern/.
   Princip: aplikacija i dalje radi i renderuje na srpskom (nijedna poslovna, SQL ili API funkcija nije dirana);
   ovaj sloj prevodi PRIKAZ: tekstualne čvorove i atribute (placeholder, aria-label, title, alt) čim se pojave u DOM-u
   (MutationObserver), preko rečnika srpski → [de, en] (evidencija-i18n-dict.js) i obrazaca sa {x} za sastavljene
   tekstove. Za svaki čvor pamti srpski original, pa promena jezika ne briše unos, izabranu karticu, filtere ni sesiju.
   Ne prevodi: sadržaj polja (input/textarea), poruke klijenata (.sc-chat-body), [translate=no], sačuvane vrednosti
   (<option> bez value dobija value = srpski tekst, pa se u bazu i dalje upisuje srpska vrednost).
   Jezik: localStorage['swiscars-lang'] (sr/de/en, isti ključ kao javni sajt), podrazumevano srpski. */
(function () {
  'use strict';
  const KEY = 'swiscars-lang', LANGS = ['sr', 'de', 'en'];
  const LOCALES = { sr: 'sr-Latn-RS', de: 'de-CH', en: 'en-GB' };
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'data-label']; // data-label: zaglavlje kolone na telefonu (CSS attr), JS ga ne čita
  const SKIP_SEL = 'script,style,template,[contenteditable=""],[contenteditable="true"],[translate="no"],.sc-chat-body,.ev-no-translate'; // textarea: sadržaj se ne dira (doText), placeholder se prevodi
  const normalize = v => LANGS.includes(v) ? v : 'sr';
  let lang = 'sr';
  try { lang = normalize(localStorage.getItem(KEY)); } catch (e) { lang = 'sr'; }
  const col = () => lang === 'de' ? 0 : 1;
  const dict = () => window.EV_DICT || {};
  let patterns = null;
  function compilePatterns() {
    patterns = { byWord: new Map(), open: [] };
    // određeniji obrazac (više doslovnog teksta) ima prednost nad opštim razdvajačima; isti rang: redosled definisanja
    const lit = row => String(row[0]).replace(/\{\w+\}/g, '').length;
    for (const row of (window.EV_PATTERNS || []).slice().sort((a, b) => lit(b) - lit(a))) {
      const [sr] = row; const names = [];
      // {n}, {n1}, {n2}… = broj (cifre, razmak, tačka, zarez, apostrof, znak); ostala imena = bilo koji tekst (najkraći)
      const re = new RegExp('^' + sr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\w+)\\\}/g, (_, n) => { names.push(n); return /^n\d*$/.test(n) ? '([−+-]?\\d[\\d.,’\' ]*)' : '([\\s\\S]+?)'; }) + '$');
      const item = { re, names, de: row[1], en: row[2] };
      const first = sr.match(/^([^\s{]+)(?:\s|$)/); // prva reč bez {…}; inače opšti obrazac
      if (first) { const k = first[1]; if (!patterns.byWord.has(k)) patterns.byWord.set(k, []); patterns.byWord.get(k).push(item); } else patterns.open.push(item);
    }
  }
  function translate(sr) {
    if (lang === 'sr' || !sr) return sr;
    const row = dict()[sr];
    if (row) return row[col()] || sr;
    if (!patterns) compilePatterns();
    const first = sr.match(/^([^\s]+)/), cands = [...(first ? patterns.byWord.get(first[1]) || [] : []), ...patterns.open];
    for (const p of cands) {
      const m = sr.match(p.re); if (!m) continue;
      let out = lang === 'de' ? p.de : p.en;
      p.names.forEach((n, i) => { out = out.split('{' + n + '}').join(translate(m[i + 1].trim())); });
      return out;
    }
    return sr;
  }
  // Prevod čuva okolne razmake teksta (" Auto " → " Auto ").
  const wrap = (raw, core, out) => core === out ? raw : raw.replace(core, () => out);

  const textOrig = new WeakMap(), textLast = new WeakMap(), attrOrig = new WeakMap(), attrLast = new WeakMap();
  const skip = el => !!(el && el.closest && el.closest(SKIP_SEL));
  function doText(node) {
    const parent = node.parentElement; if (!parent || parent.tagName === 'TEXTAREA' || skip(parent)) return;
    const raw = node.data, core = raw.trim(); if (!core) return;
    let orig = textOrig.get(node);
    if (orig === undefined || textLast.get(node) !== raw) { orig = core.replace(/\s+/g, ' '); textOrig.set(node, orig); } // novi ili promenjen (od aplikacije) tekst
    if (parent.tagName === 'OPTION' && !parent.hasAttribute('value')) parent.setAttribute('value', orig); // sačuvana vrednost ostaje srpska
    const out = wrap(raw, core, translate(orig));
    if (out !== raw) node.data = out;
    textLast.set(node, out);
  }
  function doAttrs(el) {
    if (skip(el)) return;
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const raw = el.getAttribute(a), core = raw.trim(); if (!core) continue;
      let map = attrOrig.get(el); if (!map) { map = {}; attrOrig.set(el, map); }
      let last = attrLast.get(el); if (!last) { last = {}; attrLast.set(el, last); }
      if (map[a] === undefined || last[a] !== raw) map[a] = core.replace(/\s+/g, ' ');
      const out = wrap(raw, core, translate(map[a]));
      if (out !== raw) el.setAttribute(a, out);
      last[a] = out;
    }
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/.test(el.type) && el.value) {
      let map = attrOrig.get(el) || {}; attrOrig.set(el, map); let last = attrLast.get(el) || {}; attrLast.set(el, last);
      if (map.value === undefined || last.value !== el.value) map.value = el.value;
      const out = translate(map.value); if (out !== el.value) el.value = out; last.value = out;
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skip(root)) return; doAttrs(root); }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  let observing = false, observer = null;
  function observe() {
    if (observing) return; observing = true;
    observer = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function applyAll() {
    document.documentElement.lang = lang === 'sr' ? 'sr-Latn' : lang;
    walk(document.body);
    const title = document.querySelector('title'); if (title && title.firstChild) doText(title.firstChild);
    document.querySelectorAll('[data-ev-lang]').forEach(b => { const on = b.dataset.evLang === lang; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); });
  }
  // Promena jezika: prevod svih čvorova iz originala; aplikacija se osvežava (render) samo ako nijedno polje nije u toku unosa,
  // da se ne izgubi sadržaj formulara. Brojevi i datumi u tom slučaju dobijaju novi format pri sledećem redovnom osvežavanju.
  function dirtyForms() {
    for (const el of document.querySelectorAll('#app input, #app textarea, #app select')) {
      if (el.closest('[hidden]')) continue;
      if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked !== el.defaultChecked) return true; }
      else if (el.tagName === 'SELECT') { if ([...el.options].some(o => o.selected !== o.defaultSelected)) return true; }
      else if (el.type !== 'hidden' && el.value !== el.defaultValue && el.value !== '') return true;
    }
    return false;
  }
  function set(value, opts) {
    const next = normalize(value), changed = next !== lang; lang = next;
    try { localStorage.setItem(KEY, lang); } catch (e) { /* bez memorije */ }
    applyAll();
    if (changed) {
      document.dispatchEvent(new CustomEvent('evidencija-language-changed', { detail: { language: lang } }));
      if (!(opts && opts.noRender) && typeof window.render === 'function' && document.getElementById('app') && !document.getElementById('app').hidden && !dirtyForms()) { try { window.render(); } catch (e) { console.warn(e); } }
    }
  }
  function switcher(label) {
    const box = document.createElement('div'); box.className = 'ev-lang'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', label || 'Jezik / Sprache / Language');
    for (const l of LANGS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'b small'; b.dataset.evLang = l; b.lang = l === 'sr' ? 'sr-Latn' : l; b.textContent = l.toUpperCase(); b.setAttribute('aria-pressed', String(l === lang)); b.addEventListener('click', () => set(l)); box.append(b); }
    return box;
  }
  function mountSwitchers() {
    if (!document.querySelector('header.top .user > .ev-lang')) { const user = document.querySelector('header.top .user'); if (user) user.prepend(switcher()); }
    // vrlo uzak telefon (≤360px): prekidač u zaglavlju ne staje pored naziva, pa isti prekidač stoji u meniju naloga („Ivan T. ▾“)
    if (!document.querySelector('#teamAccountActions .ev-lang')) { const acc = document.getElementById('teamAccountActions'); if (acc) { const row = document.createElement('div'); row.className = 'ev-lang-row'; row.append(switcher()); acc.append(row); } }
    if (!document.querySelector('#login .ev-lang')) { const form = document.getElementById('loginForm'); if (form) form.querySelector('.brand')?.after(switcher()); }
  }
  const api = {
    get lang() { return lang; }, locale: () => LOCALES[lang], t: translate, set, apply: applyAll, normalize, LANGS,
    sourceText(el) { const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); let n,parts=[]; while((n=walker.nextNode()))parts.push(textOrig.get(n)??n.data); return parts.join(' '); },
    number(n, o) { return Number(n).toLocaleString(LOCALES[lang], o); },
    date(d, o) { return new Date(d).toLocaleDateString(LOCALES[lang], o); }
  };
  window.EV = api;
  const css = document.createElement('style');
  css.textContent = '.ev-lang{display:inline-flex;gap:4px;align-items:center}.ev-lang .b{min-height:34px;padding:4px 9px;font-size:12px;letter-spacing:.04em}.ev-lang .b.on{background:var(--ink,#17344d);border-color:var(--ink,#17344d);color:#fff}#loginForm .ev-lang{justify-content:flex-end;margin:-6px 0 6px}@media(max-width:760px){header.top .user .ev-lang{gap:0;border:1px solid var(--line,#d9d2c3);border-radius:10px;overflow:hidden;background:#fff}header.top .user .ev-lang .b{min-height:36px;padding:0 6px;font-size:11px;border:0;border-radius:0;box-shadow:none}header.top .user .ev-lang .b+.b{border-left:1px solid var(--line,#d9d2c3)}}.ev-lang-row{display:none}@media(max-width:480px){.team-field-workline,.team-service-choice{flex-wrap:wrap}}@media(max-width:360px){header.top .user>.ev-lang{display:none}.team-account-actions[data-open="true"] .ev-lang-row{display:flex;justify-content:center;padding:4px 0 2px}.team-account-actions .ev-lang{gap:6px}.team-account-actions .ev-lang .b{width:auto;min-height:40px;padding:6px 14px;text-align:center;justify-content:center;font-size:12px}}';
  document.head.append(css);
  function start() { mountSwitchers(); observe(); applyAll(); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
