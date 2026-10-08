/* SWISCARS · pravi Auth adapter za registraciju eksperata (Supabase Auth + RPC iz ugovora).
   Jedini fajl koji razgovara sa serverom. Ne čuva lozinke ni tokene sam: Supabase SDK čuva sesiju pod
   sopstvenim ključem (storageKey 'swiscars-partner-auth', odvojeno od timske evidencije 'swiscars-auth',
   da odjava u timskom ekranu ne obori partnersku sesiju i obrnuto). Ništa se ne loguje.
   Zahteva učitan @supabase/supabase-js (window.supabase). */
(function (root) {
  'use strict';
  function normalize(error) {
    if (!error) return { code: 'request_failed', message: '' };
    const code = typeof error.code === 'string' && error.code ? error.code : '';
    const message = typeof error.message === 'string' ? error.message : '';
    const shared = {email_confirmation_required:'email_not_confirmed',not_authorized:'not_authenticated',role_already_set:'role_conflict',profile_unavailable:'profile_suspended',unsupported_field:'forbidden_field',profile_changed_reload:'profile_changed_reload'};
    if (shared[message]) return {code:shared[message],message:shared[message],status:error.status};
    // Naše RPC funkcije dižu grešku čija je poruka mašinski kod (npr. 'email_not_confirmed', 'invalid_profile:phone').
    if (/^[a-z_]+(:[a-z_]+)?$/.test(message)) return { code: message, message, status: error.status };
    if (code) return { code, message, status: error.status };
    if (error.status === 401) return { code: 'session_expired', message, status: 401 };
    if (error.name === 'TypeError' || /fetch|network/i.test(message)) return { code: 'request_failed', message, status: 0 };
    return { code: 'request_failed', message, status: error.status };
  }
  function create(config) {
    if (!root.supabase || typeof root.supabase.createClient !== 'function') throw new Error('Supabase SDK nije učitan.');
    const sb = root.supabase.createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: config.storageKey || 'swiscars-partner-auth', flowType: 'pkce', detectSessionInUrl: false }
    });
    const redirectTo = config.redirectTo;
    let currentVersion = null;
    async function rpc(name, args) {
      const { data, error } = await sb.rpc(name, args);
      if (error) throw normalize(error);
      return data;
    }
    return {
      kind: 'supabase',
      client: sb,
      async signUp({ email, password, draft }) {
        // Nacrt profila putuje u user_metadata samo da bi se forma popunila posle potvrde (i na drugom uređaju).
        // Server ga nikad ne koristi za prava: sc_partner_enroll validira ono što klijent eksplicitno pošalje.
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, data: { language:['sr','de','en'].includes(config.getLanguage?.())?config.getLanguage():'sr', partner_draft: draft, partner_role: draft && draft.role } } });
        if (error) throw normalize(error);
        const user = data && data.user;
        // Uključena potvrda emaila + postojeći nalog: Supabase vraća korisnika sa praznim identities i ne šalje email.
        if (user && Array.isArray(user.identities) && user.identities.length === 0) return { status: 'email_taken' };
        if (data && data.session) return { status: 'signed_in' };
        return { status: 'confirmation_sent' };
      },
      async signIn({ email, password }) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw normalize(error);
        return { user: data.user };
      },
      async signOut() { const { error } = await sb.auth.signOut({scope:'local'}); if (error) throw normalize(error); currentVersion=null; },
      async getSession() { const { data, error } = await sb.auth.getSession(); if (error) throw normalize(error); return data.session || null; },
      // Povratak sa linka za potvrdu: ?code=… (PKCE) ili greška (?error=…&error_code=…, nekad u #fragmentu).
      async completeFromUrl(href) {
        let u; try { u = new URL(href); } catch (e) { return { type: 'none' }; }
        const q = u.searchParams, h = new URLSearchParams(u.hash.replace(/^#/, ''));
        const get = k => q.get(k) || h.get(k);
        const cleanUrl = u.origin + u.pathname;
        if (get('error') || get('error_code')) return { type: 'link_error', cleanUrl, error: { code: get('error_code') || get('error'), message: get('error_description') || '' } };
        const code = q.get('code');
        if (!code) return { type: 'none' };
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) return { type: 'link_error', cleanUrl, error: normalize(error) };
        return { type: 'signed_in', cleanUrl };
      },
      async resendConfirmation(email) { const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo } }); if (error) throw normalize(error); },
      onAuthStateChange(fn) { const { data } = sb.auth.onAuthStateChange((event, session) => fn(event, !!session)); return () => data.subscription.unsubscribe(); },
      async me() {
        const {data,error}=await sb.auth.getUser();
        if(error) throw normalize(error);
        const user=data&&data.user;
        if(user?.user_metadata?.language)config.restoreLanguage?.(user.user_metadata.language);
        if(!user||user.is_anonymous) return {authenticated:false};
        if(!user.email_confirmed_at) return {authenticated:true,email:user.email,email_confirmed:false,profile:null};
        const profile=await rpc('sc_partner_me');currentVersion=profile&&profile.version;
        return {authenticated:true,email:user.email,email_confirmed:true,profile,draft:user.user_metadata&&user.user_metadata.partner_draft};
      },
      registrationStatus() { return rpc('sc_partner_registration_status'); },
      async enroll(profile) { const p=await rpc('sc_partner_enroll', { p_profile: profile }); currentVersion=p.version; return {created:true,profile:p}; },
      async updateProfile(profile) {
        const {role,...fields}=profile;
        const p=await rpc('sc_partner_update_profile', { p_profile: fields,p_expected_version:currentVersion });
        currentVersion=p.version;return {profile:p};
      }
    };
  }
  root.SCExpertAuth = { create, normalize };
})(typeof window !== 'undefined' ? window : globalThis);
