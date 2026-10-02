/* Cars on offer: reads the public list from the SWISCARS database (only safe fields:
   no purchase prices, costs or profit) and renders cards + a detail dialog. */
(function () {
  const SB_URL = "https://qghrrnqsvsrcwdhgufkv.supabase.co";
  const SB_KEY = "sb_publishable_ouwn1r_BvZS9nWyg3vJHAQ_ApUagfSP";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const photoUrl = p => /^https?:/.test(p) ? p : `${SB_URL}/storage/v1/object/public/sc-photos/${p.split("/").map(encodeURIComponent).join("/")}`;

  const L = {
    sr: { reserved: "Rezervisano", stage: { kupljen: "Kupljen u Švajcarskoj", transport: "Na putu ka Srbiji", carinjen: "Na carini", garaza: "Priprema u Srbiji", prodaja: "Spremno za prodaju" },
      track: ["Kupljen", "Transport", "Carina", "Priprema", "Spremno"], ask: "Cena na upit", soon: "Cena uskoro", photos: "fotografija", details: "Detalji →",
      spec: { year: "Godište", firstReg: "Prva registracija", km: "Kilometraža", engine: "Motor", power: "Snaga", fuel: "Gorivo", gear: "Menjač", body: "Karoserija", drive: "Pogon", doors: "Vrata", euro: "Emisiona klasa", color: "Boja", keys: "Ključeva", serviceBook: "Servisna knjiga" },
      close: "Zatvori", noEquip: "Oprema po dogovoru — pitajte nas." , locale: "sr-Latn-RS" },
    de: { reserved: "Reserviert", stage: { kupljen: "In der Schweiz gekauft", transport: "Unterwegs nach Serbien", carinjen: "Beim Zoll", garaza: "Aufbereitung in Serbien", prodaja: "Verkaufsbereit" },
      track: ["Gekauft", "Transport", "Zoll", "Aufbereitung", "Bereit"], ask: "Preis auf Anfrage", soon: "Preis folgt", photos: "Fotos", details: "Details →",
      spec: { year: "Baujahr", firstReg: "Erstzulassung", km: "Kilometer", engine: "Motor", power: "Leistung", fuel: "Treibstoff", gear: "Getriebe", body: "Karosserie", drive: "Antrieb", doors: "Türen", euro: "Abgasnorm", color: "Farbe", keys: "Schlüssel", serviceBook: "Serviceheft" },
      close: "Schliessen", noEquip: "Ausstattung auf Anfrage.", locale: "de-CH" },
    en: { reserved: "Reserved", stage: { kupljen: "Bought in Switzerland", transport: "On the way to Serbia", carinjen: "At customs", garaza: "Being prepared in Serbia", prodaja: "Ready for sale" },
      track: ["Bought", "Transport", "Customs", "Preparation", "Ready"], ask: "Price on request", soon: "Price coming soon", photos: "photos", details: "Details →",
      spec: { year: "Year", firstReg: "First registration", km: "Mileage", engine: "Engine", power: "Power", fuel: "Fuel", gear: "Gearbox", body: "Body", drive: "Drive", doors: "Doors", euro: "Emission class", color: "Colour", keys: "Keys", serviceBook: "Service book" },
      close: "Close", noEquip: "Equipment on request.", locale: "en-GB" },
  };
  const VAL = {
    de: { "Dizel": "Diesel", "Benzin": "Benzin", "Hibrid": "Hybrid", "Električni": "Elektro", "Gas": "Gas", "Manuelni 5": "Manuell 5-Gang", "Manuelni 6": "Manuell 6-Gang", "Automatik": "Automatik", "DSG / S-tronic": "DSG / S-tronic", "Hečbek": "Schrägheck", "Karavan": "Kombi", "Limuzina": "Limousine", "SUV": "SUV", "Monovolumen": "Van", "Kupe": "Coupé", "Kabriolet": "Cabrio", "Prednji": "Front", "Zadnji": "Heck", "Kompletna": "Komplett", "Delimična": "Teilweise", "Nema": "Keines",
      "Navigacija": "Navigation", "Klima automatik": "Klimaautomatik", "Kamera": "Rückfahrkamera", "Parking senzori": "Parksensoren", "LED / Xenon farovi": "LED / Xenon", "Grejanje sedišta": "Sitzheizung", "Tempomat": "Tempomat", "Adaptivni tempomat": "Abstandstempomat", "Kožna sedišta": "Ledersitze", "Alu felne": "Alufelgen", "Kuka": "Anhängerkupplung", "Panorama krov": "Panoramadach", "Bluetooth": "Bluetooth", "Virtuelna tabla": "Digitales Cockpit", "Keyless": "Keyless", "Elektro sedišta": "Elektrische Sitze", "Head-up displej": "Head-up-Display" },
    en: { "Dizel": "Diesel", "Benzin": "Petrol", "Hibrid": "Hybrid", "Električni": "Electric", "Gas": "LPG", "Manuelni 5": "Manual 5-speed", "Manuelni 6": "Manual 6-speed", "Automatik": "Automatic", "Hečbek": "Hatchback", "Karavan": "Estate", "Limuzina": "Saloon", "Monovolumen": "MPV", "Kupe": "Coupé", "Kabriolet": "Convertible", "Prednji": "Front", "Zadnji": "Rear", "Kompletna": "Complete", "Delimična": "Partial", "Nema": "None",
      "Navigacija": "Navigation", "Klima automatik": "Climate control", "Kamera": "Reversing camera", "Parking senzori": "Parking sensors", "LED / Xenon farovi": "LED / Xenon lights", "Grejanje sedišta": "Heated seats", "Tempomat": "Cruise control", "Adaptivni tempomat": "Adaptive cruise control", "Kožna sedišta": "Leather seats", "Alu felne": "Alloy wheels", "Kuka": "Tow bar", "Panorama krov": "Panoramic roof", "Virtuelna tabla": "Virtual cockpit", "Elektro sedišta": "Electric seats", "Head-up displej": "Head-up display" },
  };
  const ORDER = ["kupljen", "transport", "carinjen", "garaza", "prodaja"];
  const PH = '<svg viewBox="0 0 120 50" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true"><path d="M8 36v-8l10-4 14-12h40l18 12 18 4v8"/><path d="M8 36h12m20 0h40m20 0h12"/><circle cx="30" cy="38" r="8"/><circle cx="90" cy="38" r="8"/><path d="M36 24h56M62 12v12"/></svg>';

  let CARS = [], filter = "all";
  const lang = () => { try { return L[localStorage.getItem("swiscars-lang")] ? localStorage.getItem("swiscars-lang") : "sr"; } catch (e) { return "sr"; } };
  const T = () => L[lang()];
  const tv = v => (VAL[lang()] && VAL[lang()][v]) || v;
  const hp = () => ({ sr: "KS", de: "PS", en: "hp" })[lang()];
  const num = n => Math.round(+n).toLocaleString(T().locale);
  const price = c => c.price ? `${num(c.price)} €` : (c.stage === "ready" ? T().ask : T().soon);
  const meta = c => [c.year, c.km != null && c.km !== "" ? num(c.km) + " km" : "", c.fuel ? tv(c.fuel) : "", c.gear ? tv(c.gear) : "", c.kw ? Math.round(c.kw * 1.36) + " " + hp() : ""].filter(Boolean).join(" · ");
  const track = c => { const i = ORDER.indexOf(c.status); return T().track.map((t, k) => `<li class="${k < i ? "done" : k === i ? "now" : ""}">${esc(t)}</li>`).join(""); };

  function render() {
    // where the car is: still in Switzerland (bought / on the way) or already in Serbia (customs, preparation, for sale)
    const loc = c => ["kupljen", "transport"].includes(c.status) ? "ch" : "rs";
    const list = CARS.filter(c => filter === "all" || loc(c) === filter);
    $("n-all").textContent = CARS.length; $("n-ch").textContent = CARS.filter(c => loc(c) === "ch").length; $("n-rs").textContent = CARS.filter(c => loc(c) === "rs").length;
    $("cars").innerHTML = list.map(c => {
      const ph = c.photos || [];
      return `<button type="button" class="car-card" data-car="${esc(c.id)}" aria-label="${esc(c.model)}">
        <div class="car-photo">${ph.length ? `<img src="${esc(photoUrl(ph[0]))}" alt="" loading="lazy">` : `<div class="ph">${PH}</div>`}
          <span class="car-badge ${c.stage === "ready" ? "ready" : ""}">${esc(T().stage[c.status] || "")}</span>
          ${c.reserved ? `<span class="car-badge res">${esc(T().reserved)}</span>` : ""}
          ${ph.length > 1 ? `<span class="count">${ph.length} ${esc(T().photos)}</span>` : ""}</div>
        <div class="car-info"><h2>${esc(c.model)}</h2><p class="car-meta">${esc(meta(c))}</p>
          <ol class="car-track" aria-hidden="true">${track(c)}</ol>
          <div class="car-row"><p class="car-price ${c.price ? "" : "ask"}">${esc(price(c))}</p><span class="car-more">${esc(T().details)}</span></div></div></button>`;
    }).join("");
    $("carsEmpty").hidden = list.length > 0;
    $("cars").querySelectorAll("[data-car]").forEach(b => b.onclick = () => open(b.dataset.car));
    document.querySelectorAll(".cars-filter button").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === filter));
  }

  function open(id) {
    const c = CARS.find(x => x.id === id); if (!c) return;
    const t = T(), ph = c.photos || [];
    $("dlgGallery").innerHTML = ph.length ? ph.map((p, i) => `<img src="${esc(photoUrl(p))}" alt="${esc(c.model)} ${i + 1}" loading="${i < 2 ? "eager" : "lazy"}">`).join("") : `<div class="ph">${PH}</div>`;
    $("dlgStage").textContent = (t.stage[c.status] || "") + (c.reserved ? " · " + t.reserved : "");
    $("dlgTitle").textContent = c.model;
    $("dlgPrice").textContent = price(c); $("dlgPrice").className = "car-price" + (c.price ? "" : " ask");
    $("dlgTrack").innerHTML = track(c);
    const rows = [["year", c.year], ["firstReg", c.firstReg ? String(c.firstReg).split("-").reverse().join("/") : ""], ["km", c.km != null && c.km !== "" ? num(c.km) + " km" : ""], ["engine", c.engine], ["power", c.kw ? `${c.kw} kW / ${Math.round(c.kw * 1.36)} ${hp()}` : ""],
      ["fuel", tv(c.fuel)], ["gear", tv(c.gear)], ["body", tv(c.body)], ["drive", tv(c.drive)], ["doors", c.doors], ["euro", c.euro], ["color", c.color], ["keys", c.keys], ["serviceBook", tv(c.serviceBook)]];
    $("dlgSpecs").innerHTML = rows.filter(r => r[1]).map(([k, v]) => `<div><dt>${esc(t.spec[k])}</dt><dd>${esc(v)}</dd></div>`).join("");
    const eq = [...(c.equip || []).map(tv), ...String(c.equipOther || "").split(",").map(s => s.trim()).filter(Boolean)];
    $("dlgEquip").innerHTML = eq.length ? eq.map(e => `<li>${esc(e)}</li>`).join("") : `<li>${esc(t.noEquip)}</li>`;
    $("dlgAsk").href = `/?auto=${encodeURIComponent([c.model, c.year].filter(Boolean).join(" "))}&ref=${encodeURIComponent(c.id)}#contact`;
    $("dlgClose").setAttribute("aria-label", t.close);
    const d = $("carDlg"); if (!d.open) d.showModal(); d.scrollTop = 0;
    if (location.hash !== "#auto-" + id) history.replaceState(null, "", "#auto-" + id);
  }
  function closeDlg() { const d = $("carDlg"); if (d.open) d.close(); }
  $("dlgClose").onclick = closeDlg;
  $("carDlg").addEventListener("click", e => { if (e.target === $("carDlg")) closeDlg(); });
  $("carDlg").addEventListener("close", () => { if (location.hash.startsWith("#auto-")) history.replaceState(null, "", location.pathname); });
  document.querySelectorAll(".cars-filter button").forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
  document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => setTimeout(() => { render(); if ($("carDlg").open) open(location.hash.slice(6)); }, 0)));

  fetch(`${SB_URL}/rest/v1/rpc/sc_public_cars`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: "{}" })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      CARS = Array.isArray(data) ? data : [];
      CARS.sort((a, b) => (a.stage === b.stage ? 0 : a.stage === "ready" ? -1 : 1));
      render();
      if (location.hash.startsWith("#auto-")) open(decodeURIComponent(location.hash.slice(6)));
    })
    .catch(e => { console.warn(e); $("carsErr").hidden = false; $("n-all").textContent = ""; });
})();
