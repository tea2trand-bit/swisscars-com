/* SWISCARS: Supabase connection for the team app (/intern).
   Exposes window.SC with a small document-store API (collections of JSON documents,
   live updates), the signed-in member, and photo storage. */
(function () {
  const SB_URL = "https://qghrrnqsvsrcwdhgufkv.supabase.co";
  const SB_KEY = "sb_publishable_ouwn1r_BvZS9nWyg3vJHAQ_ApUagfSP";
  const BUCKET = "sc-photos";
  const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "swiscars-auth" } });

  const rid = () => { const a = new Uint8Array(15); crypto.getRandomValues(a); return Array.from(a, b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join(""); };
  const err = (e, code) => { const x = new Error((e && e.message) || String(e)); x.code = code || (e && e.code) || "upstream_error"; return x; };

  /* ---------- live collections ---------- */
  const subs = {};          // collection -> Set<fn(rows)>
  const cache = {};         // collection -> rows [{id,data}]
  const timers = {};
  let channel = null;

  async function fetchCol(col) {
    const out = []; const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await sb.from("sc_docs").select("id,data").eq("collection", col).range(from, from + page - 1);
      if (error) throw err(error);
      out.push(...data);
      if (data.length < page) break;
    }
    return out;
  }
  function refresh(col, delay) {
    if (!subs[col] || !subs[col].size) return;
    clearTimeout(timers[col]);
    timers[col] = setTimeout(async () => {
      try { cache[col] = await fetchCol(col); subs[col].forEach(fn => fn(cache[col])); }
      catch (e) { subs[col].forEach(fn => fn(null, e)); }
    }, delay ?? 120);
  }
  function ensureChannel() {
    if (channel) return;
    channel = sb.channel("sc-docs")
      .on("postgres_changes", { event: "*", schema: "public", table: "sc_docs" }, p => {
        const col = (p.new && p.new.collection) || (p.old && p.old.collection);
        if (col) refresh(col); else Object.keys(subs).forEach(c => refresh(c));
      })
      .subscribe(status => { if (status === "SUBSCRIBED") Object.keys(subs).forEach(c => refresh(c, 0)); });
  }
  function listen(col, fn) {
    (subs[col] = subs[col] || new Set()).add(fn);
    ensureChannel();
    if (cache[col]) fn(cache[col]); else refresh(col, 0);
    return () => subs[col].delete(fn);
  }
  // also refresh every 60 s in case a live event was missed (sleeping phone, flaky network)
  setInterval(() => { if (document.visibilityState === "visible") Object.keys(subs).forEach(c => refresh(c, 0)); }, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") Object.keys(subs).forEach(c => refresh(c, 0)); });

  const toSnap = rows => ({ docs: rows.map(r => ({ id: r.id, data: () => r.data })) });

  const db = {
    collection(col) {
      return {
        onSnapshot(cb, onErr) { return listen(col, (rows, e) => e ? onErr && onErr(e) : cb(toSnap(rows))); },
        async add(data) {
          const id = rid();
          const { error } = await sb.from("sc_docs").insert({ collection: col, id, data });
          if (error) throw err(error, error.code === "42501" ? "not_granted" : undefined);
          refresh(col, 0); return { id };
        },
      };
    },
    doc(path) {
      const i = path.indexOf("/"); const col = path.slice(0, i), id = path.slice(i + 1);
      return {
        async get() {
          const { data, error } = await sb.from("sc_docs").select("data").eq("collection", col).eq("id", id).maybeSingle();
          if (error) throw err(error);
          return { id, exists: !!data, data: () => data ? data.data : undefined };
        },
        async set(data) {
          const { error } = await sb.from("sc_docs").upsert({ collection: col, id, data }, { onConflict: "collection,id" });
          if (error) throw err(error); refresh(col, 0);
        },
        async update(patch) {
          const { error } = await sb.rpc("sc_doc_merge", { p_collection: col, p_id: id, p_patch: patch });
          if (error) throw err(error); refresh(col, 0);
        },
        async delete() {
          const { error } = await sb.from("sc_docs").delete().eq("collection", col).eq("id", id);
          if (error) throw err(error); refresh(col, 0);
        },
        onSnapshot(cb, onErr) {
          return listen(col, (rows, e) => {
            if (e) return onErr && onErr(e);
            const r = rows.find(x => x.id === id);
            cb({ id, exists: !!r, data: () => r ? r.data : undefined });
          });
        },
      };
    },
  };

  /* ---------- photos ---------- */
  const photoUrl = id => /^https?:/.test(id) ? id : sb.storage.from(BUCKET).getPublicUrl(id).data.publicUrl;
  const assets = {
    async upload(blob) {
      const ext = (blob.type || "image/jpeg").split("/")[1].replace("jpeg", "jpg");
      const path = `cars/${new Date().toISOString().slice(0, 7)}/${Date.now()}-${rid().slice(0, 8)}.${ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg", cacheControl: "31536000" });
      if (error) throw err(error, /size/i.test(error.message) ? "too_large" : /mime|type/i.test(error.message) ? "unsupported_type" : undefined);
      return { id: path, url: photoUrl(path) };
    },
    async delete(id) {
      if (/^https?:/.test(id)) return { deleted: false };
      const { error } = await sb.storage.from(BUCKET).remove([id]);
      if (error) throw err(error); return { deleted: true };
    },
  };

  /* ---------- people ---------- */
  let member = null;
  async function loadMember() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { member = null; return null; }
    const { data, error } = await sb.from("sc_members").select("*").eq("user_id", session.user.id).maybeSingle();
    if (error) throw err(error);
    member = data ? { ...data, id: data.user_id } : { id: session.user.id, email: session.user.email, name: session.user.email, role: "none", active: false };
    return member;
  }
  async function members() {
    const { data, error } = await sb.from("sc_members").select("*").order("created_at");
    if (error) throw err(error); return data;
  }
  const user = {
    async me() { return member; },
    async can(what) { return what === "data.write" ? !!(member && member.active) : false; },
  };

  window.SC = {
    sb, db, assets, user, photoUrl, members, loadMember,
    get member() { return member; },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw err(error, error.status === 400 ? "bad_login" : undefined);
      return loadMember();
    },
    async signOut() { await sb.auth.signOut(); location.reload(); },
    async changePassword(pw) { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw err(error); },
    async createMember(email, password, name, location, role) {
      const { data, error } = await sb.rpc("sc_admin_create_user", { p_email: email, p_password: password, p_name: name, p_location: location || "", p_role: role || "member" });
      if (error) throw err(error); return data;
    },
    async updateMember(id, name, location, role, active, password) {
      const { error } = await sb.rpc("sc_admin_update_member", { p_user: id, p_name: name, p_location: location || "", p_role: role, p_active: active, p_password: password || null });
      if (error) throw err(error);
    },
  };
})();
