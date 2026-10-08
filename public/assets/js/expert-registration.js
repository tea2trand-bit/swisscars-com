/* SWISCARS · registracija eksperta · čista logika (bez DOM-a, bez mreže).
   Validacija, poruke, i tok ekrana. Isti kod radi u pregledaču (window.SCExpertRegistration)
   i u Node testovima (module.exports). Mrežu radi adapter koji se prosleđuje u createFlow:
   pravi adapter je expert-auth-supabase.js, test adapter je test/expert-auth-fixture.js. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.SCExpertRegistration = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ROLE = 'expert';
  const CANTONS = [['AG', 'Aargau'], ['AI', 'Appenzell Innerrhoden'], ['AR', 'Appenzell Ausserrhoden'], ['BE', 'Bern'], ['BL', 'Basel-Landschaft'], ['BS', 'Basel-Stadt'], ['FR', 'Fribourg'], ['GE', 'Genève'], ['GL', 'Glarus'], ['GR', 'Graubünden'], ['JU', 'Jura'], ['LU', 'Luzern'], ['NE', 'Neuchâtel'], ['NW', 'Nidwalden'], ['OW', 'Obwalden'], ['SG', 'St. Gallen'], ['SH', 'Schaffhausen'], ['SO', 'Solothurn'], ['SZ', 'Schwyz'], ['TG', 'Thurgau'], ['TI', 'Ticino'], ['UR', 'Uri'], ['VD', 'Vaud'], ['VS', 'Valais'], ['ZG', 'Zug'], ['ZH', 'Zürich']];
  const LANGUAGES = [['de', 'nemački'], ['fr', 'francuski'], ['it', 'italijanski'], ['en', 'engleski'], ['sr', 'srpski'], ['hr', 'hrvatski'], ['bs', 'bosanski'], ['sq', 'albanski'], ['tr', 'turski'], ['pt', 'portugalski'], ['es', 'španski']];
  const COUNTRIES = [['CH', 'Švajcarska'], ['DE', 'Nemačka'], ['AT', 'Austrija'], ['FR', 'Francuska'], ['IT', 'Italija'], ['LI', 'Lihtenštajn']];
  const LIMITS = { name: [2, 120], phoneDigits: [7, 15], company: [0, 120], street: [0, 160], city: [1, 80], experience: [20, 2000], qualifications: [0, 2000], password: 8 };

  const CANTON_CODES = new Set(CANTONS.map(c => c[0]));
  const LANGUAGE_CODES = new Set(LANGUAGES.map(l => l[0]));
  const COUNTRY_CODES = new Set(COUNTRIES.map(c => c[0]));

  const text = v => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
  const list = v => Array.isArray(v) ? v.map(x => text(x).toLowerCase()) : typeof v === 'string' ? v.split(',').map(x => text(x).toLowerCase()).filter(Boolean) : [];
  const upper = arr => arr.map(x => x.toUpperCase());

  // Isti kriterijumi kao javni formular (SCContactValidation u main.js): ime i prezime, telefon sa 7 do 15 cifara.
  function validFullName(v) { const w = text(v).split(' '); return w.length >= 2 && w.every(x => /\p{L}/u.test(x)) && text(v).length <= LIMITS.name[1]; }
  function validPhone(v) { const p = text(v); if (!/^\+?[0-9][0-9\s().\/-]*$/.test(p)) return false; const d = p.replace(/\D/g, '').replace(/^00/, ''); return d.length >= LIMITS.phoneDigits[0] && d.length <= LIMITS.phoneDigits[1]; }
  function validEmail(v) { const e = text(v).toLowerCase(); return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }

  function validateAccount(input) {
    const errors = {};
    const email = text(input && input.email).toLowerCase();
    const password = typeof (input && input.password) === 'string' ? input.password : '';
    const password2 = typeof (input && input.password2) === 'string' ? input.password2 : undefined;
    if (!validEmail(email)) errors.email = 'Unesite ispravnu email adresu.';
    if (password.length < LIMITS.password) errors.password = 'Lozinka mora imati najmanje ' + LIMITS.password + ' znakova.';
    else if (password2 !== undefined && password2 !== password) errors.password2 = 'Lozinke se ne poklapaju.';
    return { ok: !Object.keys(errors).length, errors, account: { email } };
  }

  // Profil eksperta: adresa (gde živi) i kantoni pokrivanja (gde radi) su različiti podaci.
  function validateProfile(input) {
    input = input || {};
    const errors = {};
    const p = {
      role: ROLE,
      full_name: text(input.full_name),
      phone: text(input.phone),
      company_name: text(input.company_name),
      street_address: text(input.street_address),
      postal_code: text(input.postal_code),
      city: text(input.city),
      address_canton: text(input.address_canton).toUpperCase(),
      country_code: (text(input.country_code).toUpperCase() || 'CH'),
      coverage_cantons: upper([...new Set(list(input.coverage_cantons))]),
      languages: [...new Set(list(input.languages))],
      experience_description: text(input.experience_description),
      qualifications_description: text(input.qualifications_description)
    };
    if (!validFullName(p.full_name)) errors.full_name = 'Unesite ime i prezime.';
    if (!validPhone(p.phone)) errors.phone = 'Unesite broj telefona sa 7 do 15 cifara, npr. +41 79 123 45 67.';
    if (p.company_name.length > LIMITS.company[1]) errors.company_name = 'Naziv firme je predugačak.';
    if (p.street_address.length > LIMITS.street[1]) errors.street_address = 'Adresa je predugačka.';
    if (!COUNTRY_CODES.has(p.country_code)) errors.country_code = 'Izaberite državu.';
    if (p.country_code === 'CH' ? !/^[1-9]\d{3}$/.test(p.postal_code) : !/^[A-Za-z0-9 -]{3,10}$/.test(p.postal_code)) errors.postal_code = p.country_code === 'CH' ? 'Švajcarski poštanski broj ima 4 cifre.' : 'Unesite poštanski broj.';
    if (p.city.length < LIMITS.city[0] || p.city.length > LIMITS.city[1]) errors.city = 'Unesite grad.';
    if (p.country_code === 'CH' && !CANTON_CODES.has(p.address_canton)) errors.address_canton = 'Izaberite kanton u kom živite.';
    if (p.country_code !== 'CH') p.address_canton = '';
    if (!p.coverage_cantons.length) errors.coverage_cantons = 'Izaberite bar jedan kanton koji pokrivate.';
    else if (!p.coverage_cantons.every(c => CANTON_CODES.has(c))) errors.coverage_cantons = 'Nepoznat kanton u području pokrivanja.';
    if (!p.languages.length) errors.languages = 'Izaberite bar jedan jezik.';
    else if (!p.languages.every(l => LANGUAGE_CODES.has(l))) errors.languages = 'Nepoznat jezik.';
    if (p.experience_description.length < LIMITS.experience[0]) errors.experience_description = 'Opišite iskustvo u bar ' + LIMITS.experience[0] + ' znakova.';
    else if (p.experience_description.length > LIMITS.experience[1]) errors.experience_description = 'Opis iskustva je predugačak (najviše ' + LIMITS.experience[1] + ' znakova).';
    if (p.qualifications_description.length > LIMITS.qualifications[1]) errors.qualifications_description = 'Opis kvalifikacija je predugačak.';
    return { ok: !Object.keys(errors).length, errors, profile: p };
  }

  // Poruke za greške Supabase Auth-a (kodovi iz dokumentacije) i našeg servera (RPC).
  const MESSAGES = {
    email_taken: 'Nalog sa ovim emailom već postoji. Prijavite se postojećom lozinkom.',
    user_already_exists: 'Nalog sa ovim emailom već postoji. Prijavite se postojećom lozinkom.',
    email_exists: 'Nalog sa ovim emailom već postoji. Prijavite se postojećom lozinkom.',
    email_not_confirmed: 'Email još nije potvrđen. Otvorite link iz poruke koju smo poslali ili zatražite novi.',
    invalid_credentials: 'Pogrešan email ili lozinka.',
    weak_password: 'Lozinka je preslaba. Upotrebite najmanje 8 znakova, sa slovima i brojevima.',
    email_address_invalid: 'Ova email adresa nije prihvaćena. Upotrebite drugu adresu.',
    validation_failed: 'Podaci nisu u očekivanom obliku. Proverite email i lozinku.',
    signup_disabled: 'Registracija je trenutno isključena. Javite se SWISCARS-u.',
    email_provider_disabled: 'Registracija je trenutno isključena. Javite se SWISCARS-u.',
    over_email_send_rate_limit: 'Poslali smo već nekoliko poruka na ovu adresu. Sačekajte nekoliko minuta pa pokušajte ponovo.',
    over_request_rate_limit: 'Previše pokušaja. Sačekajte nekoliko minuta pa pokušajte ponovo.',
    otp_expired: 'Link za potvrdu je istekao ili je već iskorišćen. Prijavite se; ako email još nije potvrđen, poslaćemo novi link.',
    access_denied: 'Link za potvrdu nije prihvaćen. Prijavite se; ako email još nije potvrđen, poslaćemo novi link.',
    flow_state_not_found: 'Link je otvoren u drugom pregledaču ili je već iskorišćen. Prijavite se emailom i lozinkom.',
    flow_state_expired: 'Link je otvoren u drugom pregledaču ili je već iskorišćen. Prijavite se emailom i lozinkom.',
    bad_code_verifier: 'Link je otvoren u drugom pregledaču ili je već iskorišćen. Prijavite se emailom i lozinkom.',
    session_expired: 'Sesija je istekla. Prijavite se ponovo.',
    session_not_found: 'Sesija je istekla. Prijavite se ponovo.',
    refresh_token_not_found: 'Sesija je istekla. Prijavite se ponovo.',
    refresh_token_already_used: 'Sesija je istekla. Prijavite se ponovo.',
    not_authenticated: 'Sesija je istekla. Prijavite se ponovo.',
    user_banned: 'Nalog je blokiran. Javite se SWISCARS-u.',
    role_not_allowed: 'Ova uloga se ne može sama registrovati. Javite se SWISCARS-u.',
    role_conflict: 'Ovaj nalog je već registrovan sa drugom ulogom. Javite se SWISCARS-u; uloga se ne menja sama.',
    forbidden_field: 'Zahtev je sadržao polje koje korisnik ne sme da menja (uloga, status ili identitet). Osvežite stranicu.',
    profile_not_found: 'Profil još nije napravljen. Dovršite registraciju.',
    profile_suspended: 'Nalog je privremeno isključen; izmene profila nisu moguće. Javite se SWISCARS-u.',
    request_failed: 'Zahtev nije uspeo. Proverite internet vezu i pokušajte ponovo.',
    request_timeout: 'Zahtev je trajao predugo. Pokušajte ponovo.',
    profile_changed_reload: 'Profil je u međuvremenu promenjen. Osvežite stranicu i proverite podatke pre ponovnog čuvanja.',
    unexpected_failure: 'Server je privremeno nedostupan. Pokušajte ponovo za koji minut.'
  };
  const SERVER_FIELD_MESSAGES = {
    full_name: 'Server nije prihvatio ime i prezime.', phone: 'Server nije prihvatio broj telefona.', postal_code: 'Server nije prihvatio poštanski broj.',
    city: 'Server nije prihvatio grad.', country_code: 'Server nije prihvatio državu.', address_canton: 'Server nije prihvatio kanton adrese.',
    coverage_cantons: 'Server nije prihvatio kantone pokrivanja.', languages: 'Server nije prihvatio jezike.',
    experience_description: 'Server nije prihvatio opis iskustva.', qualifications_description: 'Server nije prihvatio opis kvalifikacija.',
    company_name: 'Server nije prihvatio naziv firme.', street_address: 'Server nije prihvatio adresu.', role: 'Server nije prihvatio ulogu.'
  };
  function messageFor(error) {
    if (!error) return MESSAGES.request_failed;
    const code = typeof error === 'string' ? error : error.code || '';
    if (code.indexOf('invalid_profile:') === 0) { const f = code.slice('invalid_profile:'.length); return SERVER_FIELD_MESSAGES[f] || 'Server nije prihvatio podatke profila (' + f + ').'; }
    if (MESSAGES[code]) return MESSAGES[code];
    if (error.status === 401 || error.status === 403) return MESSAGES.session_expired;
    if (error.status === 429) return MESSAGES.over_request_rate_limit;
    if (error.status >= 500) return MESSAGES.unexpected_failure;
    return MESSAGES.request_failed;
  }
  const SESSION_CODES = new Set(['session_expired', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'not_authenticated']);
  const isSessionError = e => !!e && (SESSION_CODES.has(e.code) || e.status === 401);

  // Šta status znači za eksperta i šta može sledeće. Bez izmišljenih poslova.
  const STATUS = {
    pending: { label: 'Prijava čeka proveru', tone: 'wait',
      text: 'SWISCARS proverava podatke. Dok traje provera, ne dodeljujemo zadatke pregleda.',
      next: ['Proverite da su telefon i kantoni pokrivanja tačni; možete ih izmeniti ispod.', 'Ovde možete proveriti status prijave. Za dodatne informacije kontaktirajte SWISCARS.'] },
    active: { label: 'Nalog je aktivan', tone: 'ok',
      text: 'Prijava je prihvaćena. Zadatke pregleda SWISCARS dogovara sa vama lično (telefon ili email); prikaz zadataka u ovom portalu još nije uključen.',
      next: ['Držite telefon i kantone pokrivanja ažurnim.', 'Zadatak nije dodeljen dok vas SWISCARS ne kontaktira i vi ga ne prihvatite.'] },
    suspended: { label: 'Nalog je privremeno isključen', tone: 'stop',
      text: 'Pristup zadacima je isključen. Profil možete videti, ali ne i menjati.',
      next: ['Za pojašnjenje javite se SWISCARS-u.'] }
  };

  // Tok ekrana. Adapter: signUp, signIn, signOut, getSession, completeFromUrl, resendConfirmation, onAuthStateChange, me, enroll, updateProfile.
  function createFlow(adapter, options) {
    options = options || {};
    const listeners = new Set();
    const state = { screen: 'intro', busy: false, error: '', fieldErrors: {}, notice: '', email: '', me: null, draft: null, cleanUrl: null, pendingProfile: null };
    const emit = () => listeners.forEach(fn => fn(state));
    const set = patch => { Object.assign(state, patch); emit(); };
    const fail = (error) => set({ busy: false, error: messageFor(error) });

    async function loadMe() {
      let me;
      try { me = await adapter.me(); } catch (e) {
        if (isSessionError(e)) { await safeSignOut(); return set({ busy: false, screen: 'sign_in', me: null, notice: MESSAGES.session_expired, error: '' }); }
        return fail(e);
      }
      if (!me || !me.authenticated) return set({ busy: false, screen: 'sign_in', me: null, notice: MESSAGES.session_expired, error: '' });
      if (!me.email_confirmed) return set({ busy: false, screen: 'check_email', email: me.email || state.email, me, error: '' });
      if (!me.profile) return set({ busy: false, screen: 'enroll', email: me.email, me, draft: me.draft || state.pendingProfile || null, error: '' });
      if (me.profile.role !== ROLE) return set({busy:false,screen:'other_role',email:me.email,me,error:''});
      set({ busy: false, screen: 'status', email: me.email, me, error: '' });
    }
    async function safeSignOut() { try { await adapter.signOut(); } catch (e) { /* sesija je ionako nevažeća */ } }
    async function guarded(fn) { if (state.busy) return false; set({ busy: true, error: '', fieldErrors: {} }); try { await fn(); } catch (e) { fail(e); } return true; }

    const flow = {
      state,
      onChange(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
      async start(href) {
        await guarded(async () => {
          const result = await adapter.completeFromUrl(href || '');
          if (result && result.cleanUrl) state.cleanUrl = result.cleanUrl;
          if (result && result.type === 'link_error') { set({ screen: 'sign_in', notice: messageFor(result.error) }); }
          const session = await adapter.getSession();
          if (!session) { if (state.screen !== 'sign_in') set({ screen: 'intro' }); return set({ busy: false }); }
          await loadMe();
        });
      },
      show(screen) { if (['intro', 'register', 'sign_in'].includes(screen)) set({ screen, error: '', fieldErrors: {}, notice: '' }); },
      async register(form) {
        await guarded(async () => {
          const a = validateAccount(form), p = validateProfile(form);
          const fieldErrors = Object.assign({}, a.errors, p.errors);
          if (Object.keys(fieldErrors).length) return set({ busy: false, screen: 'register', fieldErrors, error: 'Proverite označena polja.' });
          const r = await adapter.signUp({ email: a.account.email, password: form.password, draft: p.profile });
          if (r.status === 'email_taken') return set({ busy: false, screen: 'register', email: a.account.email, error: MESSAGES.email_taken, fieldErrors: { email: ' ' } });
          state.pendingProfile = p.profile;
          if (r.status === 'signed_in') { await flow._enrollNow(p.profile); return; }
          set({ busy: false, screen: 'check_email', email: a.account.email, notice: '' });
        });
      },
      async _enrollNow(profile) {
        try { const r = await adapter.enroll(profile); set({ busy: false, screen: 'status', me: Object.assign({}, state.me, { authenticated: true, email_confirmed: true, profile: r.profile }), notice: r.created ? 'Registracija je završena.' : '' }); }
        catch (e) { if (e && e.code === 'email_not_confirmed') return set({ busy: false, screen: 'check_email' }); if (isSessionError(e)) { await safeSignOut(); return set({ busy: false, screen: 'sign_in', me: null, notice: MESSAGES.session_expired }); } fail(e); }
      },
      async signIn(form) {
        await guarded(async () => {
          const email = text(form && form.email).toLowerCase(), password = typeof (form && form.password) === 'string' ? form.password : '';
          const fieldErrors = {};
          if (!validEmail(email)) fieldErrors.email = 'Unesite ispravnu email adresu.';
          if (!password) fieldErrors.password = 'Unesite lozinku.';
          if (Object.keys(fieldErrors).length) return set({ busy: false, fieldErrors, error: 'Proverite označena polja.' });
          try { await adapter.signIn({ email, password }); }
          catch (e) { if (e && e.code === 'email_not_confirmed') return set({ busy: false, screen: 'check_email', email, notice: MESSAGES.email_not_confirmed }); throw e; }
          state.email = email; state.notice = '';
          await loadMe();
        });
      },
      async resend() {
        await guarded(async () => {
          if (!validEmail(state.email)) return set({ busy: false, screen: 'register', error: 'Unesite email ponovo.' });
          await adapter.resendConfirmation(state.email);
          set({ busy: false, notice: 'Poslali smo novi link za potvrdu na ' + state.email + '. Proverite i neželjenu poštu.' });
        });
      },
      async enroll(form) {
        await guarded(async () => {
          const p = validateProfile(form);
          if (!p.ok) return set({ busy: false, fieldErrors: p.errors, error: 'Proverite označena polja.' });
          await flow._enrollNow(p.profile);
        });
      },
      async updateProfile(form) {
        await guarded(async () => {
          const p = validateProfile(form);
          if (!p.ok) return set({ busy: false, fieldErrors: p.errors, error: 'Proverite označena polja.' });
          try { const r = await adapter.updateProfile(p.profile); set({ busy: false, screen: 'status', me: Object.assign({}, state.me, { profile: r.profile }), notice: 'Profil je sačuvan.' }); }
          catch (e) { if (isSessionError(e)) { await safeSignOut(); return set({ busy: false, screen: 'sign_in', me: null, notice: MESSAGES.session_expired }); } throw e; }
        });
      },
      edit() { if (state.screen === 'status' && state.me && state.me.profile && state.me.profile.status !== 'suspended') set({ screen: 'profile_edit', error: '', fieldErrors: {}, notice: '' }); },
      cancelEdit() { if (state.screen === 'profile_edit') set({ screen: 'status', error: '', fieldErrors: {} }); },
      async signOut() {
        await guarded(async () => { await adapter.signOut(); set({ busy: false, screen: 'intro', me: null, draft: null, pendingProfile: null, email: '', notice: 'Odjavljeni ste.' }); });
      },
      sessionLost() {
        // Poziva se iz onAuthStateChange(SIGNED_OUT) kad je nalog bio prikazan: prikaz se briše odmah.
        if (state.me) set({ busy: false, screen: 'sign_in', me: null, draft: null, notice: MESSAGES.session_expired, error: '' });
      }
    };
    if (adapter.onAuthStateChange) adapter.onAuthStateChange((event, hasSession) => { if (event === 'SIGNED_OUT' && !hasSession) flow.sessionLost(); });
    return flow;
  }

  return { ROLE, CANTONS, LANGUAGES, COUNTRIES, LIMITS, STATUS, MESSAGES, validateAccount, validateProfile, validFullName, validPhone, validEmail, messageFor, isSessionError, createFlow };
});
