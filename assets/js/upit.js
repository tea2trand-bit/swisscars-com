/* Request tracking for the person who asked us to find a car (/upit/#<token>).
   Reads only what the database lets this link see: the request, our proposals and,
   once bought, where the car is. No costs, no margins. */
(function () {
  const SB_URL = "https://qghrrnqsvsrcwdhgufkv.supabase.co";
  const SB_KEY = "sb_publishable_ouwn1r_BvZS9nWyg3vJHAQ_ApUagfSP";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const photoUrl = p => /^https?:/.test(p) ? p : `${SB_URL}/storage/v1/object/public/sc-photos/${p.split("/").map(encodeURIComponent).join("/")}`;
  const rpc = (fn, body) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const token = (location.hash || "").replace(/^#/, "").trim().toLowerCase();
  const PH = '<svg viewBox="0 0 120 50" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true"><path d="M8 36v-8l10-4 14-12h40l18 12 18 4v8"/><path d="M8 36h12m20 0h40m20 0h12"/><circle cx="30" cy="38" r="8"/><circle cx="90" cy="38" r="8"/><path d="M36 24h56M62 12v12"/></svg>';

  const L = {
    sr: { kicker: "Vaš upit", title: "Zdravo{n}, evo gde je vaš upit", lead: "Ovde vidite šta se dešava sa vašim upitom: dok tražimo, kad imamo predlog i, ako kupite, gde je auto u svakom trenutku.",
      track: ["Primljeno", "Tražimo", "Predlog", "Kupljeno", "Transport", "Carina", "Priprema", "Predato"],
      now: ["Primili smo vaš upit i uskoro krećemo u potragu.", "Tražimo auto u Švajcarskoj koje odgovara vašim željama.", "Imamo predlog za vas. Pogledajte ispod i javite nam da li vam odgovara.", "Auto je kupljeno za vas u Švajcarskoj.", "Auto je na putu za Srbiju.", "Auto je na carini u Srbiji.", "Auto se priprema: servis, provera i pranje.", "Auto je predato. Hvala na poverenju i srećna vožnja!"],
      ready: "Auto je spremno za preuzimanje.", aiYes: "Prva provera tržišta ({d}): u Švajcarskoj smo našli {n} vozila koja bi mogla da odgovaraju vašem budžetu. Naš tim ih sada proverava i javlja vam se sa predlogom.", aiNo: "Prva provera tržišta ({d}): trenutno nema vozila koja odgovaraju budžetu. Pratimo tržište i javljamo vam se čim se pojavi nešto dobro.", closed: "Ovaj upit je zatvoren. Ako i dalje tražite auto, javite nam se.",
      req: { model: "Tražite", budget: "Budžet", mileage: "Kilometraža", gearbox: "Menjač", created: "Upit poslat" },
      propT: "Predlog za vas", priceL: "Cena u Srbiji", noPrice: "Cena po dogovoru", yes: "Odgovara mi", no: "Tražite dalje", noteP: "Poruka za nas (nije obavezno)",
      saidYes: "✓ Rekli ste da vam odgovara. Javljamo vam se oko sledećih koraka.", saidNo: "Rekli ste da tražimo dalje. Nastavljamo potragu.", send: "Šaljem…", err: "Slanje nije uspelo. Pokušajte ponovo.",
      carT: "Vaše auto", qT: "Pitanja?", qP: "Javite nam se kad god želite, najbrže preko WhatsApp-a.",
      e404T: "Upit nije pronađen", e404P: "Proverite da li ste otvorili ceo link iz emaila. Ako problem ostane, javite nam se.", eBtn: "Pošaljite novi upit",
      km: "km", gear: { "Automatik": "Automatik", "Manuelni": "Manuelni" }, locale: "sr-Latn-RS" },
    de: { kicker: "Ihre Anfrage", title: "Hallo{n}, hier steht Ihre Anfrage", lead: "Hier sehen Sie, was mit Ihrer Anfrage passiert: während wir suchen, wenn wir einen Vorschlag haben und – falls Sie kaufen – wo sich das Auto gerade befindet.",
      track: ["Erhalten", "Suche", "Vorschlag", "Gekauft", "Transport", "Zoll", "Aufbereitung", "Übergeben"],
      now: ["Wir haben Ihre Anfrage erhalten und beginnen bald mit der Suche.", "Wir suchen in der Schweiz ein Auto, das zu Ihren Wünschen passt.", "Wir haben einen Vorschlag für Sie. Bitte sehen Sie unten nach und sagen Sie uns, ob er passt.", "Das Auto wurde für Sie in der Schweiz gekauft.", "Das Auto ist unterwegs nach Serbien.", "Das Auto ist beim Zoll in Serbien.", "Das Auto wird vorbereitet: Service, Prüfung und Reinigung.", "Das Auto wurde übergeben. Danke für Ihr Vertrauen und gute Fahrt!"],
      ready: "Das Auto ist abholbereit.", aiYes: "Erste Marktprüfung ({d}): Wir haben in der Schweiz {n} Fahrzeuge gefunden, die zu Ihrem Budget passen könnten. Unser Team prüft sie jetzt und meldet sich mit einem Vorschlag.", aiNo: "Erste Marktprüfung ({d}): Derzeit gibt es keine passenden Fahrzeuge in Ihrem Budget. Wir beobachten den Markt und melden uns, sobald etwas Gutes auftaucht.", closed: "Diese Anfrage ist abgeschlossen. Wenn Sie weiterhin ein Auto suchen, melden Sie sich.",
      req: { model: "Gesucht", budget: "Budget", mileage: "Kilometerstand", gearbox: "Getriebe", created: "Anfrage gesendet" },
      propT: "Vorschlag für Sie", priceL: "Preis in Serbien", noPrice: "Preis nach Absprache", yes: "Passt mir", no: "Bitte weitersuchen", noteP: "Nachricht an uns (optional)",
      saidYes: "✓ Sie haben zugesagt. Wir melden uns zu den nächsten Schritten.", saidNo: "Sie möchten, dass wir weitersuchen. Wir suchen weiter.", send: "Senden…", err: "Senden fehlgeschlagen. Bitte erneut versuchen.",
      carT: "Ihr Auto", qT: "Fragen?", qP: "Melden Sie sich jederzeit, am schnellsten per WhatsApp.",
      e404T: "Anfrage nicht gefunden", e404P: "Bitte prüfen Sie, ob Sie den ganzen Link aus der E-Mail geöffnet haben. Sonst melden Sie sich bei uns.", eBtn: "Neue Anfrage senden",
      km: "km", gear: { "Automatik": "Automatik", "Manuelni": "Manuell" }, locale: "de-CH" },
    en: { kicker: "Your request", title: "Hello{n}, here is your request", lead: "Here you can see what is happening with your request: while we search, when we have a proposal and – if you buy – where the car is at any moment.",
      track: ["Received", "Searching", "Proposal", "Bought", "Transport", "Customs", "Preparation", "Handed over"],
      now: ["We received your request and will start searching shortly.", "We are searching Switzerland for a car that matches your wishes.", "We have a proposal for you. Please look below and tell us if it suits you.", "The car has been bought for you in Switzerland.", "The car is on its way to Serbia.", "The car is at customs in Serbia.", "The car is being prepared: service, inspection and cleaning.", "The car has been handed over. Thank you for your trust and enjoy the drive!"],
      ready: "The car is ready for pick-up.", aiYes: "First market check ({d}): we found {n} cars in Switzerland that could match your budget. Our team is checking them now and will come back with a proposal.", aiNo: "First market check ({d}): there are no matching cars in your budget right now. We keep watching the market and will contact you as soon as something good appears.", closed: "This request is closed. If you are still looking for a car, get in touch.",
      req: { model: "Looking for", budget: "Budget", mileage: "Mileage", gearbox: "Gearbox", created: "Request sent" },
      propT: "Proposal for you", priceL: "Price in Serbia", noPrice: "Price on request", yes: "This suits me", no: "Keep searching", noteP: "Message to us (optional)",
      saidYes: "✓ You said it suits you. We will contact you about the next steps.", saidNo: "You asked us to keep searching. We are on it.", send: "Sending…", err: "Sending failed. Please try again.",
      carT: "Your car", qT: "Questions?", qP: "Contact us any time, fastest via WhatsApp.",
      e404T: "Request not found", e404P: "Please check that you opened the full link from the email. If it still does not work, contact us.", eBtn: "Send a new request",
      km: "km", gear: { "Automatik": "Automatic", "Manuelni": "Manual" }, locale: "en-GB" },
  };
  let DATA = null, lang = "sr";
  const T = () => L[lang];
  const num = n => Math.round(+n).toLocaleString(T().locale);
  const CAR_STAGE = { pregledan: 3, kupljen: 3, transport: 4, carinjen: 5, garaza: 6, prodaja: 6, prodat: 7 };
  function stage(d) {
    if (d.status === "odustao") return -1;
    if (d.status === "predato" || d.status === "kupio") return 7;
    if (d.car && CAR_STAGE[d.car.status] != null) return CAR_STAGE[d.car.status];
    if (d.status === "kupljeno") return 3;
    if (d.status === "ponudjeno" || (d.proposals || []).some(p => !p.answer)) return 2;
    if (d.status === "trazimo" || d.aiAt) return 1;
    return 0;
  }
  function render() {
    const t = T(), d = DATA;
    document.documentElement.lang = lang;
    $("u_kicker").textContent = t.kicker;
    if (!d) {
      $("u_title").textContent = t.kicker; $("u_lead").textContent = "";
      $("u_err").hidden = false; $("u_body").hidden = true;
      $("u_errT").textContent = t.e404T; $("u_errP").textContent = t.e404P; $("u_errB").textContent = t.eBtn;
      return;
    }
    $("u_err").hidden = true; $("u_body").hidden = false;
    $("u_title").textContent = t.title.replace("{n}", d.name ? " " + d.name : "");
    $("u_lead").textContent = t.lead;
    const st = stage(d);
    $("u_track").innerHTML = t.track.map((x, i) => `<li class="${st < 0 ? "" : i < st ? "done" : i === st ? "now" : ""}">${esc(x)}</li>`).join("");
    $("u_now").textContent = st < 0 ? t.closed : (d.car && d.car.status === "prodaja" && st === 6 ? t.ready : t.now[st]);
    $("u_ai").hidden = !(d.aiAt && st >= 0 && st <= 2 && !(d.proposals || []).length);
    if (d.aiAt) $("u_ai").textContent = (d.aiN > 0 ? t.aiYes : t.aiNo).replace("{d}", new Date(d.aiAt).toLocaleDateString(t.locale)).replace("{n}", d.aiN);
    const rq = [["model", d.model], ["budget", d.budget ? num(d.budget) + " €" : ""], ["mileage", d.mileage], ["gearbox", t.gear[d.gearbox] || d.gearbox], ["created", d.created ? new Date(d.created).toLocaleDateString(t.locale) : ""]];
    $("u_req").innerHTML = rq.filter(r => r[1]).map(([k, v]) => `<div><dt>${esc(t.req[k])}</dt><dd>${esc(v)}</dd></div>`).join("");
    const c = d.car;
    $("u_car").innerHTML = c ? `<div class="up-card"><h2>${esc(t.carT)}: ${esc(c.model)}${c.year ? " " + c.year : ""}</h2>
      <p>${[c.km ? num(c.km) + " km" : "", c.fuel, t.gear[c.gear] || c.gear, c.kw ? Math.round(c.kw * 1.36) + (lang === "en" ? " hp" : lang === "de" ? " PS" : " KS") : "", c.color].filter(Boolean).map(esc).join(" · ")}</p>
      ${c.price ? `<p class="up-price">${num(c.price)} €</p>` : ""}
      ${(c.photos || []).length ? `<div class="up-photos">${c.photos.map(p => `<a href="${esc(photoUrl(p))}" target="_blank" rel="noopener"><img src="${esc(photoUrl(p))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}</div>` : "";
    const props = (d.proposals || []).slice().reverse();
    $("u_props").innerHTML = props.map(p => `<div class="up-card up-prop"><div class="ph">${(p.photos || []).length ? `<img src="${esc(photoUrl(p.photos[0]))}" alt="">` : PH}</div>
      <div class="bd"><span class="car-stage">${esc(t.propT)}${p.at ? " · " + new Date(p.at).toLocaleDateString(t.locale) : ""}</span><h3>${esc(p.title)}${p.year ? " · " + p.year : ""}</h3>
        <p class="car-meta">${[p.km ? num(p.km) + " km" : "", p.fuel, t.gear[p.gear] || p.gear].filter(Boolean).map(esc).join(" · ")}</p>
        <p><span class="car-meta">${esc(t.priceL)}</span><br><span class="up-price">${p.price ? num(p.price) + " €" : esc(t.noPrice)}</span></p>
        ${p.note ? `<p>${esc(p.note)}</p>` : ""}
        ${p.answer === "da" ? `<p class="up-ok">${esc(t.saidYes)}</p>` : p.answer === "ne" ? `<p class="up-no">${esc(t.saidNo)}</p>` :
          `<div class="up-ans"><textarea data-note="${esc(p.id)}" placeholder="${esc(t.noteP)}"></textarea><button class="btn btn-gold" type="button" data-ans="${esc(p.id)}|da">${esc(t.yes)}</button><button class="btn btn-outline up-out" type="button" data-ans="${esc(p.id)}|ne">${esc(t.no)}</button></div>`}
      </div></div>`).join("");
    document.querySelectorAll("[data-ans]").forEach(b => b.onclick = async () => {
      const [id, ans] = b.dataset.ans.split("|");
      const note = (document.querySelector(`[data-note="${CSS.escape(id)}"]`) || {}).value || "";
      const btns = b.parentElement.querySelectorAll("button"); btns.forEach(x => x.disabled = true); b.textContent = T().send;
      try { const r = await rpc("sc_order_answer", { p_token: token, p_id: id, p_answer: ans, p_note: note }); if (!r.ok) throw new Error(r.status); await load(); }
      catch (e) { console.warn(e); alertBox(b.parentElement, T().err); btns.forEach(x => x.disabled = false); }
    });
    $("u_qT").textContent = t.qT; $("u_qP").textContent = t.qP;
  }
  function alertBox(el, msg) { const p = document.createElement("p"); p.className = "up-no"; p.textContent = msg; el.appendChild(p); }
  async function load() {
    if (!/^[a-f0-9]{24}$/.test(token)) { DATA = null; render(); return; }
    try { const r = await rpc("sc_order_view", { p_token: token }); DATA = r.ok ? await r.json() : null; }
    catch (e) { console.warn(e); DATA = null; }
    if (DATA && !localStorage.getItem("swiscars-lang") && L[DATA.lang]) { lang = DATA.lang; document.querySelector(`[data-lang="${lang}"]`)?.click(); }
    render();
  }
  try { const s = localStorage.getItem("swiscars-lang"); if (L[s]) lang = s; } catch (e) { }
  document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => setTimeout(() => { lang = L[b.dataset.lang] ? b.dataset.lang : "sr"; render(); }, 0)));
  window.addEventListener("hashchange", () => location.reload());
  load();
  setInterval(() => { if (document.visibilityState === "visible" && DATA && document.activeElement?.tagName !== "TEXTAREA") load(); }, 60000);
})();
