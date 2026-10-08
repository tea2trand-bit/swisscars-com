/* SWISCARS – car inspection on order (/pregled/).
   Without a token in the link: what we check, dynamic price by vehicle place (partner expert or SWISCARS team), order form.
   With /pregled/#<token>: status of the order, payment details and the report with photos.
   Texts live in pregled-texts.js (window.SCPregledTexts). The server (sc_insp_quote_place / sc_submit_inspection) is the
   only authority for price, origin and the proposed expert; this page only displays what it returns. */
(function () {
  const URL_ = typeof SC_URL !== "undefined" ? SC_URL : "https://qghrrnqsvsrcwdhgufkv.supabase.co";
  const KEY = typeof SC_KEY !== "undefined" ? SC_KEY : "";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LOCALE = { sr: "sr-Latn-RS", de: "de-CH", en: "en-GB" };
  const num = n => Number(n).toLocaleString(LOCALE[lang()], { maximumFractionDigits: 2 });
  const money = n => { const v = Number(n); return v.toLocaleString(LOCALE[lang()], { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }); };
  const fill = (s, m) => String(s).replace(/\{(\w+)\}/g, (_, k) => (k in m ? m[k] : "{" + k + "}"));
  const rpc = (fn, body) => fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(async r => { const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && j.message) || r.status); return j; });
  const photo = p => /^https?:/.test(p) ? p : `${URL_}/storage/v1/object/public/sc-photos/${String(p).split("/").map(encodeURIComponent).join("/")}`;
  // Shared SR/DE/EN selector is provided by the published main.js.
  let chosenLang = null;
  const lang = () => { let l = null; try { l = chosenLang || localStorage.getItem("swiscars-lang"); } catch (e) {} return ["sr", "de", "en"].includes(l) ? l : "sr"; };
  try { if (chosenLang && localStorage.getItem("swiscars-lang") !== chosenLang) localStorage.setItem("swiscars-lang", chosenLang); } catch (e) {}
  const L = window.SCPregledTexts || { sr: {}, de: {}, en: {} };
  const T = () => L[lang()] || L.sr;
  const tokenOf = () => { const h = location.hash.slice(1); return /^[a-f0-9]{24}$/.test(h) ? h : null; };
  const KEYLS = "sc_my_pregled";
  let view = null;
  // Cena: quote = poslednji odgovor servera; quotePlace = unos za koji važi; selected = izabrani predlog (plz+ort).
  let quote = null, quotePlace = "", quoteSeq = 0, selected = null, pendingConfirm = null;
  // Predlozi mesta.
  let sugItems = [], sugActive = -1, sugSeq = 0, sugTimer = null, blurTimer = null;

  function common() {
    const t = T();
    $("p_kicker").textContent = t.kicker; $("p_title").textContent = t.title; $("p_lead").textContent = t.lead;
    $("p_qT").textContent = t.qT; $("p_qP").textContent = t.qP;
    [["pg_cWa", "cWa", "cWaLabel"], ["pg_cViber", "cViber", "cViberLabel"], ["pg_cMail", "cMail", "cMailLabel"], ["pg_cCall", "cCall", "cCallLabel"]].forEach(([id, k, lab]) => {
      const a = $(id); if (!a) return; a.setAttribute("aria-label", t[lab]); a.querySelector(".pg-c-short").textContent = t[k];
    });
    if ($("pg_ctaK")) { $("pg_ctaK").textContent = t.ctaK; $("pg_ctaT").textContent = t.ctaT; $("pg_ctaP").textContent = t.ctaP; $("pg_ctaDealer").textContent = t.ctaDealer; $("pg_ctaBtn").textContent = t.ctaBtn; }
  }

  function renderOrder() {
    const t = T();
    $("p_whatT").textContent = t.whatT;
    $("p_what").innerHTML = t.what.map(([b, s]) => `<li><b>${esc(b)}</b><span>${esc(s)}</span></li>`).join("");
    $("p_priceT").textContent = t.priceT;
    $("p_prices").hidden = !t.prices.length;
    $("p_prices").innerHTML = t.prices.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    let last = null; try { last = JSON.parse(localStorage.getItem(KEYLS) || "null"); } catch (e) {}
    $("p_priceNote").innerHTML = esc(t.priceNote) + (last && last.t ? ` <a href="/pregled/#${esc(last.t)}">${esc(t.last)}</a>` : "");
    $("pg_placeLabel").textContent = t.place;
    $("pg_quoteLabel").textContent = t.qEstimate;
    $("pg_place").placeholder = t.placePh; $("pg_place").setAttribute("aria-label", t.place);
    $("pg_clear").setAttribute("aria-label", t.clear); $("pg_clear").title = t.clear;
    $("pg_sugg").setAttribute("aria-label", t.sugLabel);
    $("pg_infoT").textContent = t.infoT; $("pg_infoP").textContent = t.infoP;
    $("p_formT").textContent = t.formT;
    [["pg_url", "url"], ["pg_car", "car"], ["pg_name", "name"], ["pg_phone", "phone"], ["pg_email", "email"], ["pg_notes", "notes"]]
      .forEach(([id, k]) => { $(id).placeholder = t[k]; $(id).setAttribute("aria-label", t[k]); });
    $("pg_send").textContent = t.send;
    $("pg_book").textContent = t.book;
    renderSuggest();
    showQuote();
  }

  /* ---------- predlozi mesta (combobox) ---------- */
  const updateClear = () => { $("pg_clear").hidden = !$("pg_place").value; };
  function sugStatus(text, warn) { const s = $("pg_suggStatus"); s.hidden = !text; s.textContent = text || ""; s.classList.toggle("pg-warn", !!warn); }
  function closeSuggest() { sugItems = []; sugActive = -1; renderSuggest(); sugStatus(""); }
  function renderSuggest() {
    const ul = $("pg_sugg"), inp = $("pg_place");
    ul.hidden = !sugItems.length;
    inp.setAttribute("aria-expanded", String(!!sugItems.length));
    ul.innerHTML = sugItems.map((s, i) => `<li role="option" id="pg_opt_${i}" aria-selected="${i === sugActive}" data-i="${i}"><b>${esc(s.plz)}</b><span>${esc(s.ort)}</span><small>${esc(s.kanton || "")}</small></li>`).join("");
    if (sugActive >= 0) { inp.setAttribute("aria-activedescendant", "pg_opt_" + sugActive); const li = ul.children[sugActive]; if (li && li.scrollIntoView) li.scrollIntoView({ block: "nearest" }); }
    else inp.removeAttribute("aria-activedescendant");
  }
  async function loadSuggest(v) {
    const seq = ++sugSeq;
    if (!sugItems.length) sugStatus(T().sugLoading);
    try {
      const rows = await rpc("sc_place_suggest", { p_prefix: v, p_limit: 8 });
      if (seq !== sugSeq || v !== $("pg_place").value.trim()) return; // zastareo odgovor
      sugItems = Array.isArray(rows) ? rows.filter(r => r && r.plz && r.ort) : []; sugActive = -1; renderSuggest();
      sugStatus(sugItems.length ? "" : fill(T().sugEmpty, { q: v }), false);
    } catch (e) { if (seq === sugSeq) { sugItems = []; renderSuggest(); sugStatus(T().sugError, true); } }
  }
  function choose(item) {
    selected = { plz: String(item.plz), ort: String(item.ort), kanton: item.kanton ? String(item.kanton) : "" };
    $("pg_place").value = selected.plz + " " + selected.ort; updateClear();
    closeSuggest(); ++sugSeq; clearTimeout(sugTimer);
    calculateQuote();
  }
  $("pg_place").addEventListener("input", () => {
    const v = $("pg_place").value.trim();
    selected = null; invalidateQuote(); updateClear();
    clearTimeout(sugTimer); ++sugSeq;
    if (v.length < 2) { closeSuggest(); return; }
    sugTimer = setTimeout(() => loadSuggest(v), 250);
    // Čist poštanski broj: cena se računa i bez izbora iz liste (više mesta → izbor dolazi sa servera).
    if (/^\d{4}$/.test(v)) { clearTimeout(qTimer); qTimer = setTimeout(calculateQuote, 450); }
  });
  $("pg_place").addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!sugItems.length) { const v = $("pg_place").value.trim(); if (v.length >= 2) loadSuggest(v); return; }
      e.preventDefault();
      sugActive = e.key === "ArrowDown" ? Math.min(sugItems.length - 1, sugActive + 1) : Math.max(0, sugActive - 1);
      renderSuggest();
    } else if (e.key === "Enter") {
      e.preventDefault(); // Enter u polju mesta nikad ne šalje formu
      if (sugItems.length && sugActive >= 0) return choose(sugItems[sugActive]);
      if (sugItems.length === 1) return choose(sugItems[0]);
      closeSuggest(); ++sugSeq; clearTimeout(sugTimer); calculateQuote();
    } else if (e.key === "Escape") {
      if (sugItems.length) { e.preventDefault(); closeSuggest(); }
    } else if (e.key === "Tab") closeSuggest();
  });
  $("pg_place").addEventListener("blur", () => {
    // Stanje se čita u trenutku napuštanja polja; ako se polje u međuvremenu ponovo koristi, ništa se ne dira.
    const v = $("pg_place").value.trim(), need = v.length >= 3 && !selected && !quote;
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => { if (document.activeElement === $("pg_place")) return; closeSuggest(); if (need && !quote && v === $("pg_place").value.trim()) calculateQuote(); }, 150);
  });
  $("pg_place").addEventListener("focus", () => { const v = $("pg_place").value.trim(); if (v.length >= 2 && !selected && !sugItems.length) loadSuggest(v); });
  $("pg_sugg").addEventListener("mousedown", e => e.preventDefault()); // fokus ostaje u polju; klik bira
  $("pg_sugg").addEventListener("click", e => { const li = e.target.closest("li[data-i]"); if (li) choose(sugItems[Number(li.dataset.i)]); });
  $("pg_clear").addEventListener("click", () => {
    $("pg_place").value = ""; selected = null; updateClear(); closeSuggest(); ++sugSeq; clearTimeout(sugTimer);
    invalidateQuote(); $("pg_place").focus();
  });

  /* ---------- cena ---------- */
  let qTimer = null;
  const currentQuoteValid = () => !!(quote && quote.found && quote.fee != null && quotePlace === $("pg_place").value.trim());
  function closeOrder() { $("pgForm").hidden = true; $("pg_book").setAttribute("aria-expanded", "false"); }
  function openOrder() { $("pgForm").hidden = false; $("pg_book").setAttribute("aria-expanded", "true"); }
  function invalidateQuote() { ++quoteSeq; clearTimeout(qTimer); quote = null; quotePlace = ""; pendingConfirm = null; closeOrder(); showQuote(); }
  function originText(q) {
    const t = T(), o = q.origin || {};
    return fill(o.kind === "expert" ? t.originExpert : t.originTeam, { ort: o.ort || "St. Gallen" });
  }
  // The initial zero is a visual placeholder; a server quote is required for scheduling.
  function box(prefix, amount) {
    $("pg_quote").innerHTML = `<span class="pg-q-from">${esc(prefix)}</span><strong class="pg-q-num">${esc(amount)}</strong><span class="pg-q-cur">CHF</span>`;
  }
  function showQuote() {
    const t = T(), q = quote, el = $("pg_quote"), meta = $("pg_quoteMeta"), extra = $("pg_quoteExtra"), br = $("pg_break");
    $("pg_book").disabled = !currentQuoteValid();
    el.removeAttribute("aria-busy"); br.hidden = true; extra.hidden = true; extra.innerHTML = ""; meta.classList.remove("pg-warn");
    el.classList.toggle("is-placeholder", !q);
    if (!q) { meta.textContent = t.qStartNote; box("", Number(0).toLocaleString(LOCALE[lang()], { minimumFractionDigits: 2, maximumFractionDigits: 2 })); el.setAttribute("aria-label", t.qStartNote); return; }
    if (q.loading) { el.setAttribute("aria-busy", "true"); meta.textContent = t.qLoading; box("", "…"); el.setAttribute("aria-label", t.qLoading); return; }
    if (q.error) { meta.textContent = t.qError; meta.classList.add("pg-warn"); box("", "—"); el.setAttribute("aria-label", t.qError); extra.hidden = false; extra.innerHTML = `<button type="button" class="pg-retry" id="pg_retry">${esc(t.retry)}</button>`; $("pg_retry").onclick = () => calculateQuote(); return; }
    if (q.ambiguous) {
      meta.textContent = t.qAmbiguous; box("", "—"); el.setAttribute("aria-label", t.qAmbiguous);
      extra.hidden = false;
      extra.innerHTML = `<div class="pg-choices" role="group" aria-label="${esc(t.qAmbiguous)}">` +
        (q.choices || []).map((c, i) => `<button type="button" data-c="${i}"><b>${esc(c.plz)}</b> ${esc(c.ort)}${c.kanton ? ` <small>${esc(c.kanton)}</small>` : ""}</button>`).join("") + `</div>`;
      extra.querySelectorAll("button[data-c]").forEach(b => b.addEventListener("click", () => choose(q.choices[Number(b.dataset.c)])));
      return;
    }
    if (!q.found) { meta.textContent = t.qNo; meta.classList.add("pg-warn"); box("", "—"); el.setAttribute("aria-label", t.qNo); return; }
    if (q.fee == null) { meta.textContent = fill(t.qAgree, { ort: q.ort, plz: q.plz || "" }); box("", "—"); el.setAttribute("aria-label", meta.textContent); return; }
    const p = q.pricing || {}, o = q.origin || {};
    meta.textContent = `${q.ort}${q.plz ? " (" + q.plz + ")" : ""} · ${originText(q)}`;
    box("", money(q.fee));
    el.setAttribute("aria-label", fill(t.qFee, { ort: q.ort, plz: q.plz || "", f: money(q.fee), o: o.ort || "St. Gallen" }));
    const note = o.kind === "expert" || p.version === "team-local-v1"
      ? (Number(p.extraKm) > 0 ? fill(t.extraNote, { km: num(p.extraKm), rate: num(p.kmRate), travel: money(p.travel) }) : t.localNote)
      : fill(t.teamNote, { d: num(q.dist) });
    extra.hidden = false; extra.innerHTML = `<p class="pg-q-sub2">${esc(note)}</p>`;
    // Razloženo (van kutije): osnovna cena, put, (zaokruživanje), ukupno.
    const rows = [[t.bBase, money(p.base) + " CHF"]];
    if (Number(p.travelKm) > 0 || o.kind !== "expert") rows.push([fill(t.bTravel, { km: num(p.travelKm || 0), rate: num(p.kmRate) }), money(p.travel || 0) + " CHF"]);
    if (p.roundTo) rows.push([fill(t.bRound, { min: num(p.minimum) }), ""]);
    br.hidden = false;
    br.innerHTML = `<summary>${esc(t.breakT)}</summary><dl>` + rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("") +
      `<dt class="pg-total">${esc(t.bTotal)}</dt><dd class="pg-total">${esc(money(q.fee))} CHF</dd></dl><p class="pg-q-sub2">${esc(fill(t.bDist, { d: num(q.dist) }))}</p>`;
  }
  $("pg_book").addEventListener("click", () => {
    if (!currentQuoteValid() || tokenOf()) return;
    openOrder();
    $("pgForm").scrollIntoView({ behavior: "smooth", block: "start" });
    $("pg_url").focus({ preventScroll: true });
  });
  async function calculateQuote() {
    clearTimeout(qTimer);
    const value = $("pg_place").value.trim(), sequence = ++quoteSeq, sel = selected;
    quote = null; quotePlace = ""; pendingConfirm = null; closeOrder();
    if (value.length < 3 && !(sel && sel.plz)) { showQuote(); return null; }
    quote = { loading: true }; showQuote();
    try {
      const q = await rpc("sc_insp_quote_place", sel ? { p_place: value, p_plz: sel.plz, p_ort: sel.ort } : { p_place: value });
      if (sequence !== quoteSeq || value !== $("pg_place").value.trim()) return null; // zastareo odgovor
      quote = q && typeof q === "object" ? q : { found: false }; quotePlace = value;
      closeSuggest(); ++sugSeq; clearTimeout(sugTimer); // obračun je stigao: lista predloga više nije potrebna (izbor više mesta dolazi iz obračuna)
      showQuote(); return quote;
    } catch (e) { if (sequence === quoteSeq) { quote = { error: true }; quotePlace = value; showQuote(); } return null; }
  }

  /* ---------- slanje ---------- */
  ["pg_name", "pg_phone", "pg_email"].forEach(id => $(id).addEventListener("input", () => $(id).setCustomValidity("")));
  function status(cls, html) { const st = $("pg_status"); st.hidden = false; st.className = "form-status " + cls; st.innerHTML = html; }
  function showConfirm() {
    // Server je odbio zastarelu ponudu; nova je već izračunata (quote). Ništa nije poslato dok korisnik ne potvrdi.
    const t = T(), q = quote;
    pendingConfirm = q.offer || null;
    status("pg-confirm", `<strong>${esc(t.confirmT)}</strong><span>${esc(fill(t.confirmP, { f: money(q.fee), ort: (q.origin && q.origin.ort) || "St. Gallen" }))}</span><button type="button" class="btn btn-gold" id="pg_confirm">${esc(t.confirmBtn)}</button>`);
    $("pg_send").disabled = true;
    $("pg_confirm").onclick = () => { $("pg_send").disabled = false; $("pgForm").requestSubmit ? $("pgForm").requestSubmit() : $("pg_send").click(); };
  }
  $("pgForm").addEventListener("submit", async e => {
    e.preventDefault();
    if ($("pgForm").hidden) return;
    const t = T(), btn = $("pg_send");
    const v = id => $(id).value.trim();
    const contact = window.SCContactValidation;
    const reject = (id, message) => { status("err", esc(message)); $(id).setCustomValidity(message); $(id).focus(); $(id).reportValidity(); };
    ["pg_name", "pg_phone", "pg_email"].forEach(id => $(id).setCustomValidity(""));
    if (!contact) { status("err", esc(t.err)); return; }
    if (!contact.validFullName(v("pg_name"))) { reject("pg_name", t.fullNameNeeded); return; }
    if (!contact.validPhone(v("pg_phone"))) { reject("pg_phone", t.phoneNeeded); return; }
    if (!$("pg_email").checkValidity()) { $("pg_email").focus(); $("pg_email").reportValidity(); return; }
    if (!(v("pg_url") || v("pg_car")) || !v("pg_place") || !v("pg_email")) { status("err", esc(t.need)); return; }
    if (btn.disabled) return;
    if (!currentQuoteValid()) { await calculateQuote(); if (!currentQuoteValid()) { status("err", esc(quote && quote.ambiguous ? t.ambiguousSubmit : quote && quote.found === false ? t.qNo : t.qError)); } return; }
    if (pendingConfirm && pendingConfirm !== quote.offer) { showConfirm(); return; }
    const q = quote;
    btn.disabled = true; btn.textContent = t.sending;
    try {
      const r = await rpc("sc_submit_inspection", { p: { url: v("pg_url"), car: v("pg_car"), place: v("pg_place"), plz: q.plz, ort: q.ort, name: v("pg_name"), phone: v("pg_phone"), email: v("pg_email"), notes: v("pg_notes"), website: $("pgForm").website.value, expectedFee: q.fee, expectedOffer: q.offer, lang: lang() } });
      if (!r || !r.token) throw new Error("no token");
      const link = `https://swiscars.com/pregled/#${r.token}`;
      try { localStorage.setItem(KEYLS, JSON.stringify({ t: r.token, at: Date.now() })); } catch (e2) {}
      fetch(`${URL_}/functions/v1/order-mail`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
      status("ok", `${esc(t.ok)} <a href="/pregled/#${esc(r.token)}" style="text-decoration:underline">${esc(t.okLink)}</a>
        <span style="display:block;margin-top:10px">${esc(t.saveHint)}</span>
        <span style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px"><a class="btn btn-outline" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(t.waText + " " + link)}">${esc(t.wa)}</a><button type="button" class="btn btn-outline" id="pg_copy">${esc(t.copy)}</button></span>`);
      $("pg_copy").onclick = () => (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => { $("pg_copy").textContent = t.copied; }).catch(() => window.prompt("", link));
      $("pgForm").reset(); $("pg_place").value = ""; selected = null; updateClear(); quote = null; quotePlace = ""; pendingConfirm = null; ++quoteSeq; clearTimeout(qTimer); showQuote();
      btn.disabled = false; btn.textContent = t.send;
      return;
    } catch (err) {
      console.warn(err);
      btn.disabled = false; btn.textContent = t.send;
      const m = err.message;
      if (m === "price_changed") {
        // Ponuda je zastarela: nova cena se računa i korisnik je potvrđuje; nema tihog ponovnog slanja.
        const nq = await calculateQuote(); // zatvara formu dok računa; unos korisnika ostaje u poljima
        if (nq && currentQuoteValid()) { openOrder(); pendingConfirm = "stale"; showConfirm(); $("pg_status").scrollIntoView({ behavior: "smooth", block: "center" }); }
        else { openOrder(); status("err", esc(t.priceChanged)); }
        return;
      }
      if (m === "place_ambiguous") { status("err", esc(t.ambiguousSubmit)); selected = null; await calculateQuote(); return; }
      if (m === "place_not_found") { status("err", esc(t.qNo)); return; }
      status("err", esc(m === "full_name" ? t.fullNameNeeded : m === "phone" ? t.phoneNeeded : t.err));
    }
  });

  /* ---------- pregled narudžbine (token) ---------- */
  function renderView() {
    const t = T(), d = view; if (!d) return;
    const step = d.status === "gotovo" || d.reportAt ? 3 : d.plannedAt ? 2 : d.paidAt ? 1 : 0;
    $("v_track").innerHTML = t.track.map((x, k) => `<li class="${k < step ? "done" : k === step ? "now" : ""}"${k === step ? ' aria-current="step"' : ''}>${esc(x)}</li>`).join("");
    $("v_now").textContent = d.status === "otkazano" ? t.cancelled : step === 0 && d.fee == null ? t.nowAgree : t.now[step].replace("{p}", d.plannedAt || "");
    const rows = [[t.rCar, d.car], [t.rPlace, d.ort || d.place], [t.rOrigin, d.origin && d.origin.ort ? d.origin.ort : null], [t.rFee, d.fee != null ? money(d.fee) + " CHF" : t.agree]];
    $("v_req").innerHTML = rows.filter(r => r[1]).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")
      + (d.url ? `<div><dt>${esc(t.rAd)}</dt><dd><a href="${esc(d.url)}" target="_blank" rel="noopener nofollow">${esc(t.open)}</a></dd></div>` : "");
    const pay = $("v_pay");
    pay.hidden = !!(d.paidAt || d.status === "otkazano" || d.fee == null);
    if (!pay.hidden) pay.innerHTML = `<h2>${esc(t.payT)}</h2><p>${esc(t.payP.replace("{f}", money(d.fee)).replace("{n}", d.name || ""))}</p><p class="up-pay" style="white-space:pre-line">${esc(d.pay || t.payNone)}</p>`;
    const rep = $("v_report"), r = d.report || {};
    rep.hidden = !d.reportAt;
    if (!rep.hidden) rep.innerHTML = `<h2>${esc(t.repT)}</h2>${r.ocena && t.verdict[r.ocena] ? `<p class="pg-verdict">${esc(t.verdict[r.ocena])}</p>` : ""}
      <div class="pg-rep">${["udes", "papiri", "tehnika", "zakljucak"].filter(k => r[k]).map(k => `<div><h3>${esc(t.rep[k])}</h3><p>${esc(r[k])}</p></div>`).join("")}</div>
      ${window.SCInspectionReport?.render(r.checklist, d.lang || lang(), {photoUrl:photo}) || ""}
      ${window.SCInspectionReport && SCInspectionReport.unassignedPhotos(r.checklist,d.photos).length ? `<div class="pg-photos">${SCInspectionReport.unassignedPhotos(r.checklist,d.photos).map(p => `<a href="${esc(photo(p))}" target="_blank" rel="noopener"><img src="${esc(photo(p))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}`;
  }

  function showErr() {
    const t = T(); $("p_order").hidden = true; $("p_view").hidden = true; $("p_err").hidden = false;
    $("p_errT").textContent = t.errT; $("p_errP").textContent = t.errP; $("p_errB").textContent = t.errB;
  }

  function render() {
    document.querySelectorAll("[data-lang]").forEach(x => x.classList.toggle("active", x.dataset.lang === lang()));
    if (lang() === "en") document.documentElement.lang = "en";
    common(); if (tokenOf()) renderView(); else renderOrder();
  }

  async function boot() {
    const tok = tokenOf();
    $("p_err").hidden = true;
    if (!tok) { $("p_order").hidden = false; $("p_view").hidden = true; render(); return; }
    $("p_order").hidden = true;
    try {
      view = await rpc("sc_inspection_view", { p_token: tok });
      if (!view) { common(); showErr(); return; }
      try { localStorage.setItem(KEYLS, JSON.stringify({ t: tok, at: Date.now() })); } catch (e) {}
      $("p_view").hidden = false; render();
    } catch (e) { console.warn(e); common(); showErr(); }
  }

  // Jezik: dugmad u zaglavlju (main.js čuva izbor pod 'swiscars-lang'); ova stranica poštuje i EN i prikazuje svoj sadržaj
  // u izabranom jeziku čak i ako zajednički main.js poznaje samo SR/DE. Promena jezika ne briše unos ni obračun.
  document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => setTimeout(() => {
    chosenLang = ["sr", "de", "en"].includes(b.dataset.lang) ? b.dataset.lang : null;
    try { if (chosenLang) localStorage.setItem("swiscars-lang", chosenLang); } catch (e) {}
    document.querySelectorAll("[data-lang]").forEach(x => x.classList.toggle("active", x.dataset.lang === lang()));
    render();
  }, 0)));
  window.addEventListener("hashchange", boot);
  updateClear();
  boot();
})();
