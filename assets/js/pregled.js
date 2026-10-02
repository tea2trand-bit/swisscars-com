/* SWISCARS – car inspection on order (/pregled/).
   Without a token in the link: what we check, prices from St. Gallen, order form with a live price.
   With /pregled/#<token>: status of the order, payment details and the report with photos. */
(function () {
  const URL_ = typeof SC_URL !== "undefined" ? SC_URL : "https://qghrrnqsvsrcwdhgufkv.supabase.co";
  const KEY = typeof SC_KEY !== "undefined" ? SC_KEY : "";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = n => Number(n).toLocaleString(lang()==="sr"?"sr-Latn-RS":lang()==="de"?"de-CH":"en-GB",{maximumFractionDigits:2});
  const rpc = (fn, body) => fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(async r => { const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && j.message) || r.status); return j; });
  const photo = p => /^https?:/.test(p) ? p : `${URL_}/storage/v1/object/public/sc-photos/${String(p).split("/").map(encodeURIComponent).join("/")}`;
  const lang = () => { const l = localStorage.getItem("swiscars-lang"); return ["sr", "de", "en"].includes(l) ? l : "sr"; };

  const L = {
    sr: {
      kicker: "Pregled auta", title: "Pregled auta u Švajcarskoj",
      lead: "Našli ste auto u Švajcarskoj? Pre nego što platite, naš tim ga pregleda na licu mesta i pošalje vam slike i pisani izveštaj.",
      whatT: "Šta proveravamo",
      what: [["Da li je auto lupan", "Karoserija, debljina laka, zazori, tragovi popravke"], ["Papirologija", "Saobraćajna, servisna knjiga, MFK, broj vlasnika, poreklo"], ["Tehničko stanje", "Motor, menjač, kočnice, gume, test vožnja"], ["Slike i izveštaj", "Detaljne slike i pisano mišljenje: preporučujemo ili ne"]],
      priceT: "Cena pregleda", prices: [["Do 100 km od St. Gallena", "200 CHF"], ["Do 200 km od St. Gallena", "300 CHF"], ["Dalje od 200 km", "po dogovoru"]],
      priceNote: "Polazimo iz St. Gallena. Pregled se plaća unapred; kad uplata legne, dogovaramo termin sa prodavcem.",
      formT: "Naručite pregled", url: "Link oglasa (comparis, autoscout24, …)", car: "Auto (npr. VW Golf 7 2.0 TDI, 2017)", place: "Grad ili poštanski broj gde je auto",
      name: "Ime i prezime", phone: "Telefon / WhatsApp", email: "E-mail (za link i izveštaj)", notes: "Napomena (npr. kada je prodavac dostupan, šta vas posebno zanima)",
      send: "Naruči pregled", sending: "Šaljem…",
      qFee: "{ort} ({k}) · ~{d} km od St. Gallena · pregled {f} CHF", qAgree: "{ort} ({k}) · ~{d} km od St. Gallena · cena po dogovoru, javićemo vam se", qNo: "Mesto nije pronađeno. Upišite poštanski broj (npr. 8000).",
      need: "Upišite link oglasa, mesto, ime i email.",
      ok: "Hvala! Narudžbina je primljena. Javićemo vam se u roku od 24 sata. Link za praćenje šaljemo i na vaš mejl. Status i izveštaj možete otvoriti i odmah:", okLink: "Moj pregled →",
      saveHint: "Sačuvajte link i za drugi uređaj:", wa: "Pošalji sebi na WhatsApp", copy: "Kopiraj link", copied: "Kopirano ✓", waText: "Moj SWISCARS pregled:",
      err: "Slanje nije uspelo. Pokušajte ponovo ili nam pišite na WhatsApp.",
      last: "Vaša poslednja narudžbina pregleda →",
      errT: "Narudžbina nije pronađena", errP: "Proverite link iz emaila ili nam se javite.", errB: "Naruči pregled",
      track: ["Primljeno", "Uplata", "Pregled", "Izveštaj"],
      now: ["Narudžbina je primljena. Uplatite cenu pregleda; kad uplata legne, dogovaramo termin.", "Uplata je primljena. Dogovaramo termin sa prodavcem.", "Pregled je zakazan: {p}.", "Pregled je gotov. Izveštaj je ispod."],
      nowAgree: "Narudžbina je primljena. Mesto je dalje od 200 km, javićemo vam se sa cenom.",
      cancelled: "Ova narudžbina je otkazana. Ako i dalje želite pregled, javite nam se.",
      rCar: "Auto", rAd: "Oglas", rPlace: "Mesto", rFee: "Cena pregleda", agree: "po dogovoru", open: "Otvori oglas ↗",
      payT: "Uplata", payP: "Molimo uplatite {f} CHF. Napomena uz uplatu: „Pregled {n}“.", payNone: "Podatke za uplatu šaljemo vam lično (WhatsApp ili email).",
      repT: "Izveštaj sa pregleda", rep: { udes: "Da li je auto lupan", papiri: "Papirologija", tehnika: "Tehničko stanje", zakljucak: "Zaključak" },
      verdict: { da: "✓ Preporučujemo kupovinu", oprez: "⚠ Kupovina uz oprez (vidi zaključak)", ne: "✗ Ne preporučujemo kupovinu" },
      qT: "Pitanja?", qP: "Pišite nam ili nas pozovite, odgovaramo brzo."
    },
    de: {
      kicker: "Fahrzeugprüfung", title: "Fahrzeugprüfung in der Schweiz",
      lead: "Sie haben ein Auto in der Schweiz gefunden? Bevor Sie zahlen, prüft unser Team es vor Ort und sendet Ihnen Fotos und einen schriftlichen Bericht.",
      whatT: "Was wir prüfen",
      what: [["Unfallschäden", "Karosserie, Lackschichtdicke, Spaltmasse, Reparaturspuren"], ["Papiere", "Fahrzeugausweis, Serviceheft, MFK, Anzahl Halter, Herkunft"], ["Technischer Zustand", "Motor, Getriebe, Bremsen, Reifen, Probefahrt"], ["Fotos und Bericht", "Detailfotos und schriftliche Einschätzung: empfehlenswert oder nicht"]],
      priceT: "Preis der Prüfung", prices: [["Bis 100 km ab St. Gallen", "200 CHF"], ["Bis 200 km ab St. Gallen", "300 CHF"], ["Weiter als 200 km", "nach Absprache"]],
      priceNote: "Abfahrt ab St. Gallen. Die Prüfung wird im Voraus bezahlt; nach Zahlungseingang vereinbaren wir einen Termin mit dem Verkäufer.",
      formT: "Prüfung bestellen", url: "Link zum Inserat (comparis, autoscout24, …)", car: "Auto (z. B. VW Golf 7 2.0 TDI, 2017)", place: "Ort oder Postleitzahl des Autos",
      name: "Vor- und Nachname", phone: "Telefon / WhatsApp", email: "E-Mail (für Link und Bericht)", notes: "Bemerkung (z. B. wann der Verkäufer erreichbar ist, was Sie besonders interessiert)",
      send: "Prüfung bestellen", sending: "Wird gesendet…",
      qFee: "{ort} ({k}) · ~{d} km ab St. Gallen · Prüfung {f} CHF", qAgree: "{ort} ({k}) · ~{d} km ab St. Gallen · Preis nach Absprache, wir melden uns", qNo: "Ort nicht gefunden. Bitte Postleitzahl eingeben (z. B. 8000).",
      need: "Bitte Inserat-Link, Ort, Name und E-Mail angeben.",
      ok: "Danke! Die Bestellung ist eingegangen. Wir melden uns innerhalb von 24 Stunden. Den Link zum Status senden wir Ihnen auch per E-Mail. Status und Bericht sehen Sie auch gleich hier:", okLink: "Meine Prüfung →",
      saveHint: "Speichern Sie den Link auch für ein anderes Gerät:", wa: "Per WhatsApp an mich senden", copy: "Link kopieren", copied: "Kopiert ✓", waText: "Meine SWISCARS-Prüfung:",
      err: "Senden fehlgeschlagen. Bitte erneut versuchen oder per WhatsApp schreiben.",
      last: "Ihre letzte Prüfungsbestellung →",
      errT: "Bestellung nicht gefunden", errP: "Bitte prüfen Sie den Link aus der E-Mail oder melden Sie sich.", errB: "Prüfung bestellen",
      track: ["Eingegangen", "Zahlung", "Prüfung", "Bericht"],
      now: ["Die Bestellung ist eingegangen. Bitte zahlen Sie den Prüfpreis; nach Zahlungseingang vereinbaren wir einen Termin.", "Zahlung erhalten. Wir vereinbaren einen Termin mit dem Verkäufer.", "Prüfung geplant: {p}.", "Die Prüfung ist abgeschlossen. Der Bericht steht unten."],
      nowAgree: "Die Bestellung ist eingegangen. Der Ort ist weiter als 200 km, wir melden uns mit dem Preis.",
      cancelled: "Diese Bestellung wurde storniert. Wenn Sie weiterhin eine Prüfung wünschen, melden Sie sich.",
      rCar: "Auto", rAd: "Inserat", rPlace: "Ort", rFee: "Preis der Prüfung", agree: "nach Absprache", open: "Inserat öffnen ↗",
      payT: "Zahlung", payP: "Bitte überweisen Sie {f} CHF. Vermerk: „Prüfung {n}“.", payNone: "Die Zahlungsangaben senden wir Ihnen persönlich (WhatsApp oder E-Mail).",
      repT: "Prüfbericht", rep: { udes: "Unfallschäden", papiri: "Papiere", tehnika: "Technischer Zustand", zakljucak: "Fazit" },
      verdict: { da: "✓ Kauf empfohlen", oprez: "⚠ Kauf mit Vorsicht (siehe Fazit)", ne: "✗ Kauf nicht empfohlen" },
      qT: "Fragen?", qP: "Schreiben Sie uns oder rufen Sie an, wir antworten schnell."
    },
    en: {
      kicker: "Car inspection", title: "Car inspection in Switzerland",
      lead: "Found a car in Switzerland? Before you pay, our team inspects it on site and sends you photos and a written report.",
      whatT: "What we check",
      what: [["Accident damage", "Body, paint thickness, panel gaps, signs of repair"], ["Paperwork", "Registration, service book, MFK, number of owners, origin"], ["Technical condition", "Engine, gearbox, brakes, tyres, test drive"], ["Photos and report", "Detailed photos and a written opinion: recommended or not"]],
      priceT: "Inspection price", prices: [["Up to 100 km from St. Gallen", "200 CHF"], ["Up to 200 km from St. Gallen", "300 CHF"], ["Further than 200 km", "on request"]],
      priceNote: "We start from St. Gallen. The inspection is paid in advance; once the payment arrives we arrange a time with the seller.",
      formT: "Order an inspection", url: "Link to the listing (comparis, autoscout24, …)", car: "Car (e.g. VW Golf 7 2.0 TDI, 2017)", place: "Town or postal code where the car is",
      name: "Full name", phone: "Phone / WhatsApp", email: "E-mail (for the link and report)", notes: "Note (e.g. when the seller is available, what you care about most)",
      send: "Order inspection", sending: "Sending…",
      qFee: "{ort} ({k}) · ~{d} km from St. Gallen · inspection {f} CHF", qAgree: "{ort} ({k}) · ~{d} km from St. Gallen · price on request, we will contact you", qNo: "Place not found. Please enter the postal code (e.g. 8000).",
      need: "Please enter the listing link, place, name and e-mail.",
      ok: "Thank you! Your order has been received. We will get back to you within 24 hours. We also email you the tracking link. You can open the status and report right away:", okLink: "My inspection →",
      saveHint: "Save the link for another device too:", wa: "Send to myself on WhatsApp", copy: "Copy link", copied: "Copied ✓", waText: "My SWISCARS inspection:",
      err: "Sending failed. Please try again or write to us on WhatsApp.",
      last: "Your last inspection order →",
      errT: "Order not found", errP: "Please check the link from the e-mail or contact us.", errB: "Order an inspection",
      track: ["Received", "Payment", "Inspection", "Report"],
      now: ["Your order has been received. Please pay the inspection price; once it arrives we arrange a time.", "Payment received. We are arranging a time with the seller.", "Inspection scheduled: {p}.", "The inspection is done. The report is below."],
      nowAgree: "Your order has been received. The place is further than 200 km, we will contact you with the price.",
      cancelled: "This order was cancelled. If you still want an inspection, please contact us.",
      rCar: "Car", rAd: "Listing", rPlace: "Place", rFee: "Inspection price", agree: "on request", open: "Open listing ↗",
      payT: "Payment", payP: "Please pay {f} CHF. Reference: “Inspection {n}”.", payNone: "We will send you the payment details personally (WhatsApp or e-mail).",
      repT: "Inspection report", rep: { udes: "Accident damage", papiri: "Paperwork", tehnika: "Technical condition", zakljucak: "Conclusion" },
      verdict: { da: "✓ We recommend buying", oprez: "⚠ Buy with caution (see conclusion)", ne: "✗ We do not recommend buying" },
      qT: "Questions?", qP: "Write or call us, we answer quickly."
    }
  };
  Object.assign(L.sr, {"prices":[],"priceNote":"Unesite grad ili poštanski broj vozila u obrazac ispod i videćete okvirnu ukupnu cenu pregleda. Polazimo iz centra St. Gallena. Cenu potvrđujemo pre uplate; nakon uplate dogovaramo termin sa prodavcem.","place":"Poštanski broj ili grad gde se vozilo nalazi","qFee":"{ort} ({plz}) · Okvirna cena pregleda: {f} CHF","qAgree":"{ort} ({plz}) · Cena se potvrđuje po dogovoru","qNo":"Mesto nije pronađeno. Proverite naziv grada ili unesite poštanski broj (npr. 8000).","qLoading":"Računamo okvirnu cenu pregleda…","qError":"Cena trenutno nije dostupna. Pokušajte ponovo.","priceChanged":"Cena pregleda je promenjena. Proverite novu cenu iznad, pa ponovo pošaljite zahtev.","nowAgree":"Narudžbina je primljena. Javićemo vam se da potvrdimo cenu pregleda."});
  Object.assign(L.de, {"prices":[],"priceNote":"Geben Sie Ort oder Postleitzahl des Fahrzeugs unten ein, um den ungefähren Gesamtpreis zu sehen. Abfahrt ab dem Zentrum von St. Gallen. Wir bestätigen den Preis vor Zahlung; danach vereinbaren wir einen Termin.","place":"Postleitzahl oder Ort des Fahrzeugs","qFee":"{ort} ({plz}) · Geschätzter Prüfpreis: {f} CHF","qAgree":"{ort} ({plz}) · Preis nach Absprache","qNo":"Ort nicht gefunden. Prüfen Sie den Ortsnamen oder geben Sie die Postleitzahl ein (z. B. 8000).","qLoading":"Prüfpreis wird berechnet…","qError":"Preis momentan nicht verfügbar. Bitte erneut versuchen.","priceChanged":"Der Prüfpreis hat sich geändert. Bitte prüfen Sie den neuen Preis oben und senden Sie die Anfrage erneut.","nowAgree":"Bestellung erhalten. Wir melden uns zur Preisbestätigung."});
  Object.assign(L.en, {"prices":[],"priceNote":"Enter the vehicle’s town or postal code below to see an estimated total inspection price. We start from central St. Gallen. We confirm the price before payment, then arrange a time with the seller.","place":"Postal code or town where the vehicle is located","qFee":"{ort} ({plz}) · Estimated inspection price: {f} CHF","qAgree":"{ort} ({plz}) · Price to be confirmed","qNo":"Place not found. Check the town name or enter the postal code (e.g. 8000).","qLoading":"Calculating the estimated inspection price…","qError":"Price temporarily unavailable. Please try again.","priceChanged":"The inspection price has changed. Check the new price above and submit your request again.","nowAgree":"Order received. We will contact you to confirm the inspection price."});
  const T = () => L[lang()];
  const tokenOf = () => { const h = location.hash.slice(1); return /^[a-f0-9]{24}$/.test(h) ? h : null; };
  const KEYLS = "sc_my_pregled";
  let view = null, quote = null, qTimer = null, quotePlace = "", quoteSeq = 0;

  function common() {
    const t = T();
    $("p_kicker").textContent = t.kicker; $("p_title").textContent = t.title; $("p_lead").textContent = t.lead;
    $("p_qT").textContent = t.qT; $("p_qP").textContent = t.qP;
  }

  function renderOrder() {
    const t = T();
    $("p_whatT").textContent = t.whatT;
    $("p_what").innerHTML = t.what.map(([b, s]) => `<li><b>${esc(b)}</b><span>${esc(s)}</span></li>`).join("");
    $("p_priceT").textContent = t.priceT;
    $("p_prices").innerHTML = t.prices.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    let last = null; try { last = JSON.parse(localStorage.getItem(KEYLS) || "null"); } catch (e) {}
    $("p_priceNote").innerHTML = esc(t.priceNote) + (last && last.t ? ` <a href="/pregled/#${esc(last.t)}">${esc(t.last)}</a>` : "");
    $("p_formT").textContent = t.formT;
    [["pg_url", "url"], ["pg_car", "car"], ["pg_place", "place"], ["pg_name", "name"], ["pg_phone", "phone"], ["pg_email", "email"], ["pg_notes", "notes"]]
      .forEach(([id, k]) => { $(id).placeholder = t[k]; $(id).setAttribute("aria-label", t[k]); });
    $("pg_send").textContent = t.send;
    showQuote();
  }

  function showQuote() {
    const t = T(), q = quote, el = $("pg_quote");
    if (!q) { el.textContent = ""; return; }
    el.textContent = !q.found ? t.qNo : (q.fee != null ? t.qFee : t.qAgree).replace("{ort}", q.ort).replace("{plz}", q.plz || "").replace("{f}", num(q.fee || 0));
  }

  async function calculateQuote() {
    clearTimeout(qTimer);const value=$("pg_place").value.trim(),sequence=++quoteSeq;
    quote=null;quotePlace="";showQuote();
    if(value.length<3)return null;
    $("pg_quote").textContent=T().qLoading;
    try { const q=await rpc("sc_insp_quote",{p_place:value});
      if(sequence!==quoteSeq||value!==$("pg_place").value.trim())return null;
      quote=q;quotePlace=value;showQuote();return q;
    } catch {if(sequence===quoteSeq)$("pg_quote").textContent=T().qError;return null;}
  }
  $("pg_place").addEventListener("input",()=>{
    ++quoteSeq;clearTimeout(qTimer);quote=null;quotePlace="";showQuote();
    if($("pg_place").value.trim().length>=3)qTimer=setTimeout(calculateQuote,350);
  });

  $("pgForm").addEventListener("submit", async e => {
    e.preventDefault(); const t = T(), st = $("pg_status"), btn = $("pg_send");
    const v = id => $(id).value.trim();
    if (!(v("pg_url") || v("pg_car")) || !v("pg_place") || !v("pg_name") || !v("pg_email")) { st.hidden = false; st.className = "form-status err"; st.textContent = t.need; return; }
    if(btn.disabled)return;
    if(!quote||quotePlace!==v("pg_place")){await calculateQuote();return;}
    if(!quote.found||quote.fee==null){st.hidden=false;st.className="form-status err";st.textContent=quote.found?t.qError:t.qNo;return;}
    btn.disabled = true; btn.textContent = t.sending;
    try {
      const r = await rpc("sc_submit_inspection", { p: { url: v("pg_url"), car: v("pg_car"), place: v("pg_place"), name: v("pg_name"), phone: v("pg_phone"), email: v("pg_email"), notes: v("pg_notes"), website: $("pgForm").website.value, expectedFee: quote.fee, lang: lang() } });
      if (!r || !r.token) throw new Error("no token");
      const link = `https://swiscars.com/pregled/#${r.token}`;
      try { localStorage.setItem(KEYLS, JSON.stringify({ t: r.token, at: Date.now() })); } catch (e2) {}
      fetch(`${URL_}/functions/v1/order-mail`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
      st.hidden = false; st.className = "form-status ok";
      st.innerHTML = `${esc(t.ok)} <a href="/pregled/#${esc(r.token)}" style="text-decoration:underline">${esc(t.okLink)}</a>
        <span style="display:block;margin-top:10px">${esc(t.saveHint)}</span>
        <span style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px"><a class="btn btn-outline" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(t.waText + " " + link)}">${esc(t.wa)}</a><button type="button" class="btn btn-outline" id="pg_copy">${esc(t.copy)}</button></span>`;
      $("pg_copy").onclick = () => (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => { $("pg_copy").textContent = t.copied; }).catch(() => window.prompt("", link));
      $("pgForm").reset(); quote = null; $("pg_quote").textContent = "";
    } catch (err) { console.warn(err); st.hidden = false; st.className = "form-status err"; st.textContent = err.message==="price_changed"?t.priceChanged:t.err; if(err.message==="price_changed")await calculateQuote(); }
    btn.disabled = false; btn.textContent = t.send;
  });

  function renderView() {
    const t = T(), d = view; if (!d) return;
    const step = d.status === "gotovo" || d.reportAt ? 3 : d.plannedAt ? 2 : d.paidAt ? 1 : 0;
    $("v_track").innerHTML = t.track.map((x, k) => `<li class="${k < step ? "done" : k === step ? "now" : ""}">${esc(x)}</li>`).join("");
    $("v_now").textContent = d.status === "otkazano" ? t.cancelled : step === 0 && d.fee == null ? t.nowAgree : t.now[step].replace("{p}", d.plannedAt || "");
    const rows = [[t.rCar, d.car], [t.rPlace, d.ort || d.place], [t.rFee, d.fee != null ? num(d.fee) + " CHF" : t.agree]];
    $("v_req").innerHTML = rows.filter(r => r[1]).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")
      + (d.url ? `<div><dt>${esc(t.rAd)}</dt><dd><a href="${esc(d.url)}" target="_blank" rel="noopener nofollow">${esc(t.open)}</a></dd></div>` : "");
    const pay = $("v_pay");
    pay.hidden = !!(d.paidAt || d.status === "otkazano" || d.fee == null);
    if (!pay.hidden) pay.innerHTML = `<h2>${esc(t.payT)}</h2><p>${esc(t.payP.replace("{f}", num(d.fee)).replace("{n}", d.name || ""))}</p><p class="up-pay" style="white-space:pre-line">${esc(d.pay || t.payNone)}</p>`;
    const rep = $("v_report"), r = d.report || {};
    rep.hidden = !d.reportAt;
    if (!rep.hidden) rep.innerHTML = `<h2>${esc(t.repT)}</h2>${r.ocena && t.verdict[r.ocena] ? `<p class="pg-verdict">${esc(t.verdict[r.ocena])}</p>` : ""}
      <div class="pg-rep">${["udes", "papiri", "tehnika", "zakljucak"].filter(k => r[k]).map(k => `<div><h3>${esc(t.rep[k])}</h3><p>${esc(r[k])}</p></div>`).join("")}</div>
      ${(d.photos || []).length ? `<div class="pg-photos">${d.photos.map(p => `<a href="${esc(photo(p))}" target="_blank" rel="noopener"><img src="${esc(photo(p))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}`;
  }

  function showErr() {
    const t = T(); $("p_order").hidden = true; $("p_view").hidden = true; $("p_err").hidden = false;
    $("p_errT").textContent = t.errT; $("p_errP").textContent = t.errP; $("p_errB").textContent = t.errB;
  }

  function render() { common(); if (tokenOf()) renderView(); else renderOrder(); }

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

  document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => setTimeout(render, 0)));
  window.addEventListener("hashchange", boot);
  boot();
})();
