/* SWISCARS · /eksperti/ · panel cenovnika eksperta (odvojen modul). Prikazuje se samo kad je ekspert prijavljen i vidi status
   prijave (ekran 'status'). Koristi isti jezički ugovor (SCPartnerLanguage + katalog dodatak partner-language-pricing.js),
   isti Auth adapter (window.SCExpertRuntime iz expert-page.js) i serverske RPC funkcije iz predlog/sql/002:
   sc_partner_pricing_me, sc_partner_update_pricing(p_pricing, p_expected_version); predlozi mesta: sc_place_suggest.
   Server validira i odlučuje; ovde je samo prikaz, lokalna provera i poruke. Lozinke i tokeni se ne dodiruju. */
(function () {
  'use strict';
  const I = window.SCPartnerLanguage, R = window.SCExpertRegistration, Rules = window.SCInspectionPricingRules, rt = window.SCExpertRuntime;
  const host = document.getElementById('expert-pricing');
  if (!I || !R || !Rules || !host || !rt || !rt.flow || !rt.adapter || !rt.adapter.client || typeof rt.adapter.client.rpc !== 'function') return;
  const { flow, adapter } = rt;
  const normalize = (window.SCExpertAuth && window.SCExpertAuth.normalize) || (e => e);
  async function rpc(name, args) { const { data, error } = await adapter.client.rpc(name, args); if (error) throw normalize(error); return data; }
  const tpl = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
  const fill = (s, m) => String(s).replace(/\{(\w+)\}/g, (_, k) => (k in m ? m[k] : '{' + k + '}'));
  const locale = () => (I.get() === 'sr' ? 'sr-Latn-RS' : I.get() === 'de' ? 'de-CH' : 'en-GB');
  const fmt = n => Number(n).toLocaleString(locale(), { maximumFractionDigits: 2 });
  const MSG = {
    pricing_changed_reload: 'Cenovnik je u međuvremenu promenjen. Osvežite stranicu i proverite podatke pre ponovnog čuvanja.',
    origin_not_found: 'Polazište nije prepoznato. Izaberite mesto sa liste predloga.',
    pricing_not_allowed: 'Cenovnik mogu da podese samo eksperti.',
    profile_unavailable: 'Profil nije dostupan: još nije napravljen ili je isključen.',
    profile_suspended: 'Nalog je privremeno isključen; cenovnik se ne može menjati.'
  };
  const FIELD = { origin_plz: 'Izaberite polazište sa liste predloga.', origin_ort: 'Izaberite polazište sa liste predloga.', base_fee: 'Unesite osnovnu cenu pregleda od 1 do 5000 CHF.', km_rate: 'Unesite cenu po kilometru od 0 do 20 CHF.', local_km: 'Lokalno područje je ceo broj od 0 do 50 km.' };
  function messageFor(e) {
    const code = (e && e.code) || '';
    if (MSG[code]) return MSG[code];
    if (code.indexOf('invalid_pricing:') === 0) { const f = code.slice('invalid_pricing:'.length); return FIELD[f] || fill('Server nije prihvatio polje cenovnika: {f}', { f }); }
    return R.messageFor(e);
  }
  const EXAMPLE_KM = 30;
  const st = { mode: 'view', pricing: null, loaded: false, loading: false, busy: false, error: '', notice: '', origin: null };
  let lastMe = null, form = null, loadVersion = 0;

  const okFor = s => s.screen === 'status' && s.me && s.me.profile && s.me.profile.role === 'expert';
  async function load() {
    if (st.loading) return;
    const version = ++loadVersion, owner = flow.state.me;
    const current = () => version === loadVersion && flow.state.me === owner && okFor(flow.state);
    st.loading = true; st.error = ''; paintView();
    try { const pricing = await rpc('sc_partner_pricing_me') || null; if (!current()) return; st.pricing = pricing; st.loaded = true; }
    catch (e) { if (!current()) return; st.error = R.isSessionError(e) ? R.messageFor(e) : (I.t('Cenovnik trenutno nije moguće učitati.') + ' ' + I.t(messageFor(e))); }
    st.loading = false; paintView();
  }
  function onFlow(s) {
    if (!okFor(s)) { host.hidden = true; ++loadVersion; st.loading = false; if (['intro', 'sign_in', 'register', 'check_email'].includes(s.screen)) { st.pricing = null; st.loaded = false; st.busy = false; st.mode = 'view'; st.notice = ''; st.error = ''; lastMe = null; form = null; host.replaceChildren(); } return; }
    host.hidden = false;
    if (s.me !== lastMe) { ++loadVersion; st.loading = false; lastMe = s.me; st.loaded = false; st.mode = 'view'; st.notice = ''; st.error = ''; form = null; }
    if (!st.loaded && !st.loading) load(); else if (!host.firstElementChild) paint();
  }
  function paint() { if (st.mode === 'edit') paintEdit(); else paintView(); }

  function paintView() {
    const s = flow.state; if (!okFor(s)) return;
    const status = s.me.profile.status, p = st.pricing, card = tpl('tpl-pricing-view');
    const dl = card.querySelector('[data-pricing]'), empty = card.querySelector('[data-role="empty"]'), note = card.querySelector('[data-role="status-note"]');
    const btn = card.querySelector('[data-action="pricing-edit"]');
    if (p) {
      const ex = Rules.expertTotal({ base: p.base_fee, kmRate: p.km_rate, localKm: p.local_km, dist: EXAMPLE_KM });
      const rows = [
        ['Polazište', `${p.origin_plz} ${p.origin_ort}` + (p.origin_kanton ? ` (${p.origin_kanton})` : '')],
        ['Osnovna cena', fmt(p.base_fee) + ' CHF'],
        ['Lokalno područje', fmt(p.local_km) + ' km'],
        ['Cena po km', fmt(p.km_rate) + ' CHF · ' + I.t('u oba smera')],
        ['Automatski predlozi', I.t(p.offer_active ? 'uključeni' : 'pauzirani')],
        ['Poslednja izmena', p.updated_at ? new Date(p.updated_at).toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '']
      ];
      dl.replaceChildren(...rows.flatMap(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); I.bind(dt, k); dd.textContent = v; return [dt, dd]; }));
      const pv = card.querySelector('[data-role="example"]');
      if (ex) { pv.hidden = false; pv.textContent = fill(I.t(ex.extraKm > 0 ? 'Primer: vozilo {d} km od polazišta → {base} + 2 × {extra} km × {rate} CHF = {total} CHF' : 'Primer: vozilo {d} km od polazišta → osnovna cena {total} CHF (u lokalnom području)'), { d: ex.dist, base: fmt(p.base_fee), extra: ex.extraKm, rate: fmt(p.km_rate), total: fmt(ex.total) }); }
      empty.hidden = true; I.bind(btn.querySelector('span'), 'Izmeni cenovnik');
    } else { dl.hidden = true; empty.hidden = st.loading || !!st.error; I.bind(btn.querySelector('span'), 'Podesi cenovnik'); }
    if (status === 'suspended') { note.hidden = false; I.bind(note, 'Nalog je privremeno isključen; cenovnik se ne može menjati.'); btn.hidden = true; }
    else if (status === 'pending') { note.hidden = false; I.bind(note, 'Cenovnik važi za automatske predloge tek kad SWISCARS aktivira nalog.'); }
    else note.hidden = true;
    const err = card.querySelector('[data-role="error"]'), ntc = card.querySelector('[data-role="notice"]');
    err.hidden = !st.error; I.bind(err, st.error || ''); ntc.hidden = !st.notice; I.bind(ntc, st.notice || '');
    card.querySelector('[data-role="loading"]').hidden = !st.loading;
    btn.disabled = st.loading || !!st.error && !st.loaded;
    btn.addEventListener('click', () => { st.mode = 'edit'; st.error = ''; st.notice = ''; st.origin = p ? { plz: p.origin_plz, ort: p.origin_ort, kanton: p.origin_kanton || '' } : null; paintEdit(); });
    host.replaceChildren(card); I.apply(host);
  }

  function paintEdit() {
    const p = st.pricing; form = tpl('tpl-pricing-edit');
    const q = sel => form.querySelector(sel);
    const inp = q('[name="origin"]'), ul = q('[data-role="origin-list"]'), ostat = q('[data-role="origin-status"]'), okan = q('[data-role="origin-kanton"]');
    const setOrigin = o => { st.origin = o; inp.value = o ? `${o.plz} ${o.ort}` : inp.value; okan.textContent = o && o.kanton ? o.kanton : ''; };
    if (st.origin) setOrigin(st.origin);
    q('[name="base_fee"]').value = p ? p.base_fee : ''; q('[name="local_km"]').value = p ? p.local_km : 10; q('[name="km_rate"]').value = p ? p.km_rate : '';
    q('[name="offer_active"]').checked = p ? !!p.offer_active : true;
    // Predlozi mesta (isti server kao /pregled/: sc_place_suggest, samo javni podaci mesta).
    let items = [], active = -1, seq = 0, timer = null;
    const render = () => { ul.hidden = !items.length; inp.setAttribute('aria-expanded', String(!!items.length)); ul.replaceChildren(...items.map((it, i) => { const li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = 'xp_origin_opt_' + i; li.setAttribute('aria-selected', String(i === active)); li.dataset.i = String(i); const b = document.createElement('b'); b.textContent = it.plz; const sp = document.createElement('span'); sp.textContent = it.ort; const sm = document.createElement('small'); sm.textContent = it.kanton || ''; li.append(b, sp, sm); return li; })); if (active >= 0) inp.setAttribute('aria-activedescendant', 'xp_origin_opt_' + active); else inp.removeAttribute('aria-activedescendant'); };
    const close = () => { items = []; active = -1; render(); ostat.hidden = true; ostat.textContent = ''; };
    const choose = it => { setOrigin({ plz: String(it.plz), ort: String(it.ort), kanton: it.kanton ? String(it.kanton) : '' }); close(); clearFieldError('origin'); };
    async function suggest(v) { const my = ++seq; if (!items.length) { ostat.hidden = false; I.bind(ostat, 'Tražim mesta…'); }
      try { const rows = await rpc('sc_place_suggest', { p_prefix: v, p_limit: 8 }); if (my !== seq || v !== inp.value.trim()) return; items = Array.isArray(rows) ? rows : []; active = -1; render(); if (items.length) { ostat.hidden = true; } else { ostat.hidden = false; I.bind(ostat, 'Nema mesta za ovaj unos.'); } }
      catch (e) { if (my === seq) { items = []; render(); ostat.hidden = false; I.bind(ostat, 'Predlozi trenutno nisu dostupni.'); } } }
    inp.addEventListener('input', () => { st.origin = null; okan.textContent = ''; const v = inp.value.trim(); clearTimeout(timer); ++seq; if (v.length < 2) { close(); return; } timer = setTimeout(() => suggest(v), 250); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!items.length) { const v = inp.value.trim(); if (v.length >= 2) suggest(v); return; } e.preventDefault(); active = e.key === 'ArrowDown' ? Math.min(items.length - 1, active + 1) : Math.max(0, active - 1); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items.length && active >= 0) choose(items[active]); else if (items.length === 1) choose(items[0]); }
      else if (e.key === 'Escape') { if (items.length) { e.preventDefault(); close(); } }
      else if (e.key === 'Tab') close();
    });
    inp.addEventListener('blur', () => setTimeout(close, 150));
    ul.addEventListener('mousedown', e => e.preventDefault());
    ul.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) choose(items[Number(li.dataset.i)]); });
    // Primer obračuna uživo.
    const preview = q('[data-role="preview"]');
    const updatePreview = () => { const ex = Rules.expertTotal({ base: q('[name="base_fee"]').value, kmRate: q('[name="km_rate"]').value, localKm: q('[name="local_km"]').value, dist: EXAMPLE_KM }); if (!ex) { preview.hidden = true; return; } preview.hidden = false; const key = ex.extraKm > 0 ? 'Primer: vozilo {d} km od polazišta → {base} + 2 × {extra} km × {rate} CHF = {total} CHF' : 'Primer: vozilo {d} km od polazišta → osnovna cena {total} CHF (u lokalnom području)'; preview.textContent = fill(I.t(key), { d: ex.dist, base: fmt(Rules.validatePricing({ base_fee: q('[name="base_fee"]').value }).pricing.base_fee), extra: ex.extraKm, rate: fmt(Rules.validatePricing({ km_rate: q('[name="km_rate"]').value }).pricing.km_rate), total: fmt(ex.total) }); };
    ['base_fee', 'local_km', 'km_rate'].forEach(n => q('[name="' + n + '"]').addEventListener('input', () => { clearFieldError(n); updatePreview(); }));
    updatePreview();
    function clearFieldError(name) { const t = form.querySelector('[name="' + name + '"]'); if (!t) return; t.removeAttribute('aria-invalid'); const l = t.closest('label'); if (l) l.querySelectorAll('.xp-error').forEach(x => x.remove()); }
    function showFieldErrors(errors) {
      form.querySelectorAll('.xp-error').forEach(x => x.remove()); form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
      let first = null;
      Object.keys(errors).forEach(f => { const t = form.querySelector('[name="' + f + '"]'); if (!t) return; t.setAttribute('aria-invalid', 'true'); const s = document.createElement('small'); s.className = 'xp-error'; I.bind(s, errors[f]); const l = t.closest('label'); if (l) l.append(s); else t.after(s); if (!first) first = t; });
      if (first && first.focus) first.focus({ preventScroll: false });
    }
    const err = q('[data-role="error"]'), editForm = form, owner = flow.state.me;
    const current = () => flow.state.me === owner && okFor(flow.state) && form === editForm;
    const setBusy = b => { st.busy = b; editForm.querySelectorAll('button').forEach(x => { x.disabled = b; x.setAttribute('aria-busy', String(b)); }); editForm.setAttribute('aria-busy', String(b)); };
    form.addEventListener('click', e => { const b = e.target.closest('[data-action="pricing-cancel"]'); if (b && !b.disabled) { st.mode = 'view'; st.error = ''; paintView(); } });
    form.addEventListener('submit', async e => {
      e.preventDefault(); if (st.busy) return;
      err.hidden = true;
      const v = Rules.validatePricing({ origin_plz: st.origin && st.origin.plz, origin_ort: st.origin && st.origin.ort, base_fee: q('[name="base_fee"]').value, km_rate: q('[name="km_rate"]').value, local_km: q('[name="local_km"]').value, offer_active: q('[name="offer_active"]').checked });
      if (!v.ok) { showFieldErrors(v.errors); err.hidden = false; I.bind(err, 'Proverite označena polja.'); return; }
      setBusy(true);
      try {
        const saved = await rpc('sc_partner_update_pricing', { p_pricing: v.pricing, p_expected_version: st.pricing ? st.pricing.version : null }); // st.pricing: posle sukoba verzija je osvežen sa servera
        if (!current()) return;
        st.pricing = saved; st.mode = 'view'; st.notice = 'Cenovnik je sačuvan.'; st.error = ''; setBusy(false); paintView();
      } catch (ex) {
        if (!current()) return;
        setBusy(false);
        if (R.isSessionError(ex)) { st.mode = 'view'; flow.sessionLost(); return; }
        err.hidden = false; I.bind(err, messageFor(ex));
        if (ex && ex.code === 'pricing_changed_reload') { try { st.pricing = await rpc('sc_partner_pricing_me') || null; } catch (e2) { /* ostaje stara verzija */ } }
        const code = (ex && ex.code) || ''; if (code.indexOf('invalid_pricing:') === 0) { const f = code.slice('invalid_pricing:'.length); const o = {}; o[f === 'origin_plz' || f === 'origin_ort' ? 'origin' : f] = FIELD[f] || messageFor(ex); showFieldErrors(o); }
      }
    });
    host.replaceChildren(form); I.apply(host); inp.focus({ preventScroll: true });
  }

  flow.onChange(onFlow);
  document.addEventListener('partner-language-changed', () => { if (host.hidden) return; if (st.mode === 'edit' && form) { I.apply(host); form.querySelector('[name="base_fee"]').dispatchEvent(new Event('input')); } else paintView(); });
})();
