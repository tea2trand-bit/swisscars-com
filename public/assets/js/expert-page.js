/* SWISCARS · /eksperti/ · vezivanje ekrana za tok (expert-registration.js) i adapter (expert-auth-supabase.js).
   Samo DOM: čita formu, prikazuje stanje, ne zna ništa o mreži. Lozinke se čitaju iz forme i prosleđuju adapteru;
   nigde se ne čuvaju ni ispisuju. */
(function () {
  'use strict';
  const I=window.SCPartnerLanguage;
  const R = window.SCExpertRegistration, app = document.getElementById('expert-app');
  if (!R || !app) return;
  const config = { url: app.dataset.supabaseUrl, key: app.dataset.supabaseKey, redirectTo: location.origin + location.pathname, getLanguage: I.get, restoreLanguage: I.restore };
  const tpl = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
  const text = (el, sel, value) => { const n = el.querySelector('[data-text="' + sel + '"]'); if (n) n.textContent = value == null ? '' : String(value); };
  const name = (pairs, code) => { const p = pairs.find(x => x[0] === code); return p ? I.t(p[1]) : code; };

  let adapter = null;
  try { adapter = window.SCExpertAuth.create(config); } catch (e) { adapter = null; }
  if (!adapter) {
    const card = tpl('tpl-intro');
    const err = card.querySelector('[data-role="error"]');
    err.hidden = false; I.bind(err,'Prijava trenutno nije dostupna: skripta za vezu sa serverom nije učitana. Osvežite stranicu ili pokušajte kasnije.');
    card.querySelectorAll('button').forEach(b => { b.disabled = true; });
    app.replaceChildren(card);
    return;
  }

  const flow = R.createFlow(adapter);
  let shown = null, root = null, urlCleaned = false;

  function fillOptions(container) {
    container.querySelectorAll('select[data-options="cantons"]').forEach(s => R.CANTONS.forEach(([c, n]) => { const o = document.createElement('option'); o.value = c; o.textContent = c + ' · ' + n; s.append(o); }));
    container.querySelectorAll('select[data-options="countries"]').forEach(s => R.COUNTRIES.forEach(([c, n]) => { const o = document.createElement('option'); o.value = c; I.bind(o,n); s.append(o); }));
    container.querySelectorAll('[data-chips]').forEach(box => {
      const field = box.dataset.chips, items = field === 'languages' ? R.LANGUAGES : R.CANTONS;
      if (field !== 'languages') box.lang = 'de'; // imena kantona su nemačka/francuska: nemačka hifenacija u uskim poljima
      items.forEach(([code, label]) => {
        const l = document.createElement('label'), i = document.createElement('input');
        i.type = 'checkbox'; i.name = field; i.value = code;
        if (field === 'languages') l.append(i, I.label(label));
        else { const b = document.createElement('b'); b.textContent = code; l.append(i, b, document.createTextNode(label)); }
        box.append(l);
      });
    });
  }
  function fillProfile(container, p) {
    if (!p) return;
    container.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
      if (el.type === 'checkbox') el.checked = Array.isArray(p[el.name]) && p[el.name].map(x => String(x).toLowerCase()).includes(el.value.toLowerCase());
      else if (el.type !== 'password' && p[el.name] != null) el.value = String(p[el.name]);
    });
  }
  function readForm(form) {
    const out = {};
    new FormData(form).forEach((v, k) => { if (k in out) { out[k] = [].concat(out[k], v); } else out[k] = v; });
    form.querySelectorAll('[data-chips]').forEach(box => { out[box.dataset.chips] = [...box.querySelectorAll('input:checked')].map(i => i.value); });
    return out;
  }
  function showFieldErrors(errors) {
    root.querySelectorAll('.xp-error').forEach(e => e.remove());
    root.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
    let first = null;
    Object.keys(errors || {}).forEach(field => {
      const target = root.querySelector('[data-chips="' + field + '"]') || root.querySelector('[name="' + field + '"]');
      if (!target) return;
      target.setAttribute('aria-invalid', 'true');
      const msg = errors[field].trim();
      // Poruka ide unutar label-a (ispod polja), da u dvokolonskim redovima ne postane novi član mreže.
      if (msg) { const s = document.createElement('small'); s.className = 'xp-error'; I.bind(s,msg); const host = target.closest('label'); if (host) host.append(s); else target.after(s); }
      if (!first) first = target;
    });
    if (first && typeof first.scrollIntoView === 'function') first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function renderStatus(card, state) {
    const p = state.me.profile, st = R.STATUS[p.status] || R.STATUS.pending;
    text(card, 'email', state.email); text(card, 'full_name', p.full_name); I.bind(card.querySelector('[data-text="status_text"]'),st.text);
    const badge = card.querySelector('[data-badge]'); I.bind(badge,st.label); badge.className = 'xp-badge xp-' + st.tone;
    const ul = card.querySelector('[data-list="next"]'); ul.replaceChildren(...st.next.map(t => { const li = document.createElement('li'); I.bind(li,t); return li; }));
    const dl = card.querySelector('[data-profile]');
    const rows = [
      ['Uloga', I.t('Ekspert za pregled vozila')],
      ['Telefon', p.phone],
      ['Firma', p.company_name || I.t('nije navedena')],
      ['Adresa', [p.street_address, [p.postal_code, p.city].filter(Boolean).join(' '), p.address_canton ? name(R.CANTONS, p.address_canton) : '', p.country_code !== 'CH' ? name(R.COUNTRIES, p.country_code) : ''].filter(Boolean).join(', ')],
      ['Kantoni pokrivanja', (p.coverage_cantons || []).map(c => name(R.CANTONS, c)).join(', ')],
      ['Jezici', (p.languages || []).map(l => name(R.LANGUAGES, l)).join(', ')],
      ['Iskustvo', p.experience_description],
      ['Kvalifikacije', p.qualifications_description || I.t('nisu navedene')],
      ['Prijava poslata', p.created_at ? new Date(p.created_at).toLocaleString(I.get()==='sr'?'sr-Latn-RS':I.get()==='de'?'de-CH':'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '']
    ];
    dl.replaceChildren(...rows.flatMap(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); I.bind(dt,k); dd.textContent = v || ''; return [dt, dd]; }));
    if (p.status === 'suspended') card.querySelector('[data-action="edit"]').hidden = true;
  }
  function build(state) {
    const map = { intro: 'tpl-intro', register: 'tpl-register', check_email: 'tpl-check-email', sign_in: 'tpl-sign-in', enroll: 'tpl-enroll', status: 'tpl-status', profile_edit: 'tpl-profile-edit',other_role:'tpl-other-role' };
    const card = tpl(map[state.screen] || 'tpl-intro');
    card.querySelectorAll('[data-slot="profile-fields"]').forEach(slot => slot.replaceWith(tpl('tpl-profile-fields')));
    fillOptions(card);
    if (state.screen === 'enroll') { text(card, 'email', state.email); fillProfile(card, state.draft); }
    if (state.screen === 'profile_edit') fillProfile(card, state.me && state.me.profile);
    if (state.screen === 'sign_in' && state.email) card.querySelector('[name="email"]').value = state.email;
    if (state.screen === 'check_email') text(card, 'email', state.email);
    if (state.screen === 'status') renderStatus(card, state);
    card.querySelectorAll('select[name="country_code"]').forEach(s => { if (!s.value) s.value = 'CH'; });
    card.addEventListener('click', e => {
      const b = e.target.closest('[data-action]'); if (!b || b.disabled) return;
      const a = b.dataset.action;
      if (a === 'show-register') flow.show('register'); else if (a === 'show-sign-in') flow.show('sign_in');
      else if (a === 'resend') flow.resend(); else if (a === 'sign-out') flow.signOut();
      else if (a === 'edit') flow.edit(); else if (a === 'cancel-edit') flow.cancelEdit();
    });
    if (card.matches('form')) card.addEventListener('submit', e => {
      e.preventDefault();
      const data = readForm(card), kind = card.dataset.form;
      if (kind === 'register') flow.register(data); else if (kind === 'sign-in') flow.signIn(data);
      else if (kind === 'enroll') flow.enroll(data); else if (kind === 'update') flow.updateProfile(data);
      card.querySelectorAll('input[type="password"]').forEach(i => { if (kind !== 'register' || flow.state.screen !== 'register') i.value = ''; });
    });
    return card;
  }
  function render(state) {
    if (state.cleanUrl && !urlCleaned && location.href !== state.cleanUrl) { urlCleaned = true; try { history.replaceState(null, '', state.cleanUrl); } catch (e) { /* ignore */ } }
    if (shown !== state.screen || !root) { root = build(state); app.replaceChildren(root); shown = state.screen; }
    else if (state.screen === 'status' && state.me && state.me.profile) renderStatus(root, state);
    const err = root.querySelector('[data-role="error"]'), note = root.querySelector('[data-role="notice"]');
    if (err) { err.hidden = !state.error; I.bind(err,state.error || ''); }
    if (note) { note.hidden = !state.notice; I.bind(note,state.notice || ''); }
    root.querySelectorAll('button').forEach(b => { b.disabled = state.busy; b.setAttribute('aria-busy', String(state.busy)); });
    root.setAttribute('aria-busy', String(state.busy));
    showFieldErrors(state.fieldErrors);
    I.apply(root);
    document.title = I.t(state.screen === 'status' ? 'Moja prijava' : 'Za eksperte') + ' | SWISCARS GmbH';
  }
  document.addEventListener('partner-language-changed',()=>render(flow.state));
  flow.onChange(render);
  flow.start(location.href);
  window.__expertFlow = flow; // samo za provere u pregledaču; ne sadrži lozinke ni tokene
  window.SCExpertRuntime = { flow, adapter }; // za odvojene module na istoj stranici (cenovnik: expert-pricing.js); isti adapter, bez novog klijenta
})();
