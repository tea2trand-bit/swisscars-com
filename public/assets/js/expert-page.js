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
  const registrationWizards = new WeakMap();
  function registrationWizard(card) {
    const copy = () => ({sr:{titles:['Nalog','Vaši podaci','Područje rada i iskustvo'],next:'Dalje',back:'Nazad',cantons:'Izaberite kantone',selected:'izabrano',qualifications:'Kvalifikacije i sertifikati (nije obavezno)'},de:{titles:['Konto','Ihre Angaben','Einsatzgebiet und Erfahrung'],next:'Weiter',back:'Zurück',cantons:'Kantone auswählen',selected:'ausgewählt',qualifications:'Qualifikationen und Zertifikate (optional)'},en:{titles:['Account','Your details','Coverage and experience'],next:'Next',back:'Back',cantons:'Choose cantons',selected:'selected',qualifications:'Qualifications and certificates (optional)'}}[I.get()] || null);
    const groups = [...card.querySelectorAll('.xp-group')];
    if (groups.length !== 6) return;
    const progress = document.createElement('nav'); progress.className='xp-wizard-progress'; progress.setAttribute('aria-label','Koraci registracije');
    const panels = [0,1,2].map(n => { const div=document.createElement('section');div.dataset.expertStep=String(n);return div; });
    card.querySelector('h2').after(progress);
    progress.after(...panels);
    panels[0].append(groups[0]); panels[1].append(groups[1],groups[2]); panels[2].append(groups[3],groups[4],groups[5]);
    const detailsGrid=document.createElement('div');detailsGrid.className='xp-details-grid';
    ['full_name','phone','company_name','street_address','postal_code','city','address_canton','country_code'].forEach(field=>{const label=card.querySelector('[name="'+field+'"]').closest('label'),hint=label.querySelector(':scope > small'),caption=label.querySelector(':scope > span');if(hint&&caption){const captionLine=document.createElement('span');caption.before(captionLine);captionLine.append(caption,document.createTextNode(' · '),hint);}detailsGrid.append(label);});
    groups[1].remove();groups[2].remove();panels[1].append(detailsGrid);
    card.querySelector(':scope > p.xp-help')?.remove();
    panels[2].append(...card.querySelectorAll(':scope > p.xp-help'));
    const actions=card.querySelector('.xp-actions'),submit=actions.querySelector('[type="submit"]'),back=document.createElement('button'),next=document.createElement('button');
    const signIn=actions.querySelector('[data-action="show-sign-in"]'),title=card.querySelector('h2'),titleRow=document.createElement('div');titleRow.className='xp-form-title';title.before(titleRow);titleRow.append(title,signIn);
    back.type=next.type='button';back.className='btn btn-outline';next.className='btn btn-gold';actions.prepend(back);actions.append(next);
    const coverage=card.querySelector('[data-chips="coverage_cantons"]'),picker=document.createElement('details'),summary=document.createElement('summary');picker.className='xp-select-picker';coverage.before(picker);picker.append(summary);
    const coveragePopup=document.createElement('div');coveragePopup.className='xp-picker-popup';picker.append(coveragePopup);coveragePopup.append(coverage);
    const languages=card.querySelector('[data-chips="languages"]'),languagePicker=document.createElement('details'),languageSummary=document.createElement('summary'),languagePopup=document.createElement('div');languagePicker.className='xp-select-picker';languagePopup.className='xp-picker-popup';languages.before(languagePicker);languagePicker.append(languageSummary,languagePopup);languagePopup.append(languages);
    languages.querySelectorAll('input').forEach(input=>{if(!['de','fr','it','en','sr'].includes(input.value))input.closest('label').remove();});
    groups[3].querySelector('.xp-help')?.remove();
    const coverageRow=document.createElement('div');coverageRow.className='xp-coverage-row';groups[3].before(coverageRow);coverageRow.append(groups[3],groups[4]);
    const experience=card.querySelector('[name="experience_description"]');experience.rows=2;experience.closest('label').classList.add('xp-experience-label');const experienceHint=experience.closest('label').querySelector('small');if(experienceHint)experience.after(experienceHint);groups[5].querySelector('legend').hidden=true;
    const qualifications=card.querySelector('[name="qualifications_description"]').closest('label'),optional=document.createElement('details'),optionalTitle=document.createElement('summary');optional.className='xp-canton-picker';qualifications.before(optional);optional.append(optionalTitle,qualifications);
    let index=0;
    const refresh=()=>{const c=copy();progress.replaceChildren(...c.titles.map((title,n)=>{const item=document.createElement('span');item.textContent=(n+1)+'. '+title;item.className=n===index?'is-current':n<index?'is-done':'';if(n===index)item.setAttribute('aria-current','step');return item;}));back.textContent=c.back;next.textContent=c.next;const selectedCantons=[...coverage.querySelectorAll('input:checked')].map(input=>input.value),selectedLanguages=[...languages.querySelectorAll('input:checked')].map(input=>I.t(R.LANGUAGES.find(row=>row[0]===input.value)[1]));summary.textContent=selectedCantons.length?selectedCantons.join(', '):c.cantons;languageSummary.textContent=selectedLanguages.length?selectedLanguages.join(', '):({sr:'Izaberite jezike',de:'Sprachen auswählen',en:'Choose languages'}[I.get()]);optionalTitle.textContent=c.qualifications;};
    const show=(n,scroll=true)=>{index=n;panels.forEach((p,i)=>p.hidden=i!==n);back.hidden=n===0;next.hidden=n===2;submit.hidden=n!==2;refresh();if(scroll)progress.scrollIntoView({block:'start',behavior:'smooth'});};
    const nextStep=()=>{const data=readForm(card),errors=index===0?R.validateAccount(data).errors:R.validateProfile(data).errors,fields=index===0?['email','password','password2']:['full_name','phone','company_name','street_address','postal_code','city','address_canton','country_code'],current=Object.fromEntries(Object.entries(errors).filter(([key])=>fields.includes(key)));showFieldErrors(current);if(!Object.keys(current).length)show(Math.min(2,index+1));};
    next.addEventListener('click',nextStep);back.addEventListener('click',()=>show(Math.max(0,index-1)));coverage.addEventListener('change',refresh);languages.addEventListener('change',refresh);
    picker.addEventListener('toggle',()=>{if(picker.open)languagePicker.open=false;});languagePicker.addEventListener('toggle',()=>{if(languagePicker.open)picker.open=false;});
    const api={show,refresh,next:nextStep,get index(){return index;}};registrationWizards.set(card,api);show(0,false);
  }

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
      if (msg) { const s = document.createElement('small'); s.className = 'xp-error'; I.bind(s,msg); const host = target.closest('label'); if (host) host.append(s); else (target.closest('.xp-select-picker')||target).after(s); }
      if (!first) first = target;
    });
    if (first && typeof first.scrollIntoView === 'function') { const panel=first.closest('[data-expert-step]');if(panel)registrationWizards.get(root)?.show(Number(panel.dataset.expertStep),false);(first.closest('.xp-select-picker')||first).scrollIntoView({ block: 'center', behavior: 'smooth' }); }
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
    card.querySelectorAll('[data-password-toggle]').forEach(button=>{const input=card.querySelector('[name="password"]');button.addEventListener('click',()=>{const visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-pressed',String(visible));button.textContent=I.get()==='de'?(visible?'Verbergen':'Anzeigen'):I.get()==='en'?(visible?'Hide':'Show'):(visible?'Sakrij':'Prikaži');});});
    if (state.screen === 'enroll') { text(card, 'email', state.email); fillProfile(card, state.draft); }
    if (state.screen === 'profile_edit') fillProfile(card, state.me && state.me.profile);
    if (state.screen === 'sign_in' && state.email) card.querySelector('[name="email"]').value = state.email;
    if (state.screen === 'check_email') text(card, 'email', state.email);
    if (state.screen === 'status') renderStatus(card, state);
    if (state.screen === 'register') registrationWizard(card);
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
      const wizard=registrationWizards.get(card);if(kind==='register'&&wizard&&wizard.index<2){wizard.next();return;}
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
    registrationWizards.get(root)?.refresh();
    document.title = I.t(state.screen === 'status' ? 'Moja prijava' : 'Za eksperte') + ' | SWISCARS GmbH';
  }
  document.addEventListener('partner-language-changed',()=>render(flow.state));
  flow.onChange(render);
  flow.start(location.href);
  window.__expertFlow = flow; // samo za provere u pregledaču; ne sadrži lozinke ni tokene
  window.SCExpertRuntime = { flow, adapter }; // za odvojene module na istoj stranici (cenovnik: expert-pricing.js); isti adapter, bez novog klijenta
})();
