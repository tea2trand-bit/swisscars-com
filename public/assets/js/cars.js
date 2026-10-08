/* Cars on offer: reads the public list from the SWISCARS database (only safe fields:
   no purchase prices, costs or profit) and renders cards + a detail dialog. */
(function () {
  const SB_URL = "https://qghrrnqsvsrcwdhgufkv.supabase.co";
  const SB_KEY = "sb_publishable_ouwn1r_BvZS9nWyg3vJHAQ_ApUagfSP";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const photoUrl = p => /^https?:/.test(p) ? p : `${SB_URL}/storage/v1/object/public/sc-photos/${p.split("/").map(encodeURIComponent).join("/")}`;

  const L = {
    sr: { reserved: "Rezervisano", stage: { kupljen: "U Švajcarskoj", transport: "U transportu", carinjen: "Na carini", garaza: "U pripremi u Srbiji", prodaja: "U Srbiji" },
      track: ["Kupljen", "Transport", "Carina", "U Srbiji"], sale: ["U prodaji", "Rezervisano", "Prodato"], ask: "Cena na upit", photos: "fotografija", details: "Detalji →",
      spec: { year: "Godište", firstReg: "Prva registracija", km: "Kilometraža", engine: "Motor", power: "Snaga", fuel: "Gorivo", gear: "Menjač", body: "Karoserija", drive: "Pogon", doors: "Vrata", euro: "Emisiona klasa", color: "Boja", keys: "Ključeva", serviceBook: "Servisna knjiga" },
      close: "Zatvori", noEquip: "Oprema po dogovoru — pitajte nas.", illustration: "Ilustracija modela", creditsTitle: "O fotografijama", creditsNote: "Ilustracije nisu fotografije ponuđenih vozila. Autori:", cropNote: "Prikaz skraćen na 16:9.", locale: "sr-Latn-RS" },
    de: { reserved: "Reserviert", stage: { kupljen: "In der Schweiz", transport: "Im Transport", carinjen: "Beim Zoll", garaza: "In Vorbereitung in Serbien", prodaja: "In Serbien" },
      track: ["Gekauft", "Transport", "Zoll", "In Serbien"], sale: ["Im Verkauf", "Reserviert", "Verkauft"], ask: "Preis auf Anfrage", photos: "Fotos", details: "Details →",
      spec: { year: "Baujahr", firstReg: "Erstzulassung", km: "Kilometer", engine: "Motor", power: "Leistung", fuel: "Treibstoff", gear: "Getriebe", body: "Karosserie", drive: "Antrieb", doors: "Türen", euro: "Abgasnorm", color: "Farbe", keys: "Schlüssel", serviceBook: "Serviceheft" },
      close: "Schliessen", noEquip: "Ausstattung auf Anfrage.", illustration: "Modellillustration", creditsTitle: "Zu den Fotos", creditsNote: "Die Illustrationen zeigen nicht die angebotenen Fahrzeuge. Urheber:", cropNote: "Auf 16:9 zugeschnitten.", locale: "de-CH" },
    en: { reserved: "Reserved", stage: { kupljen: "In Switzerland", transport: "In transport", carinjen: "At customs", garaza: "In preparation in Serbia", prodaja: "In Serbia" },
      track: ["Bought", "Transport", "Customs", "In Serbia"], sale: ["For sale", "Reserved", "Sold"], ask: "Price on request", photos: "photos", details: "Details →",
      spec: { year: "Year", firstReg: "First registration", km: "Mileage", engine: "Engine", power: "Power", fuel: "Fuel", gear: "Gearbox", body: "Body", drive: "Drive", doors: "Doors", euro: "Emission class", color: "Colour", keys: "Keys", serviceBook: "Service book" },
      close: "Close", noEquip: "Equipment on request.", illustration: "Model illustration", creditsTitle: "About the photos", creditsNote: "Illustrations do not show the offered vehicles. Authors:", cropNote: "Cropped to 16:9.", locale: "en-GB" },
  };
  const VAL = {
    de: { "Dizel": "Diesel", "Benzin": "Benzin", "Hibrid": "Hybrid", "Električni": "Elektro", "Gas": "Gas", "Manuelni 5": "Manuell 5-Gang", "Manuelni 6": "Manuell 6-Gang", "Automatik": "Automatik", "DSG / S-tronic": "DSG / S-tronic", "Hečbek": "Schrägheck", "Karavan": "Kombi", "Limuzina": "Limousine", "SUV": "SUV", "Monovolumen": "Van", "Kupe": "Coupé", "Kabriolet": "Cabrio", "Prednji": "Front", "Zadnji": "Heck", "Kompletna": "Komplett", "Delimična": "Teilweise", "Nema": "Keines",
      "Navigacija": "Navigation", "Klima automatik": "Klimaautomatik", "Kamera": "Rückfahrkamera", "Parking senzori": "Parksensoren", "LED / Xenon farovi": "LED / Xenon", "Grejanje sedišta": "Sitzheizung", "Tempomat": "Tempomat", "Adaptivni tempomat": "Abstandstempomat", "Kožna sedišta": "Ledersitze", "Alu felne": "Alufelgen", "Kuka": "Anhängerkupplung", "Panorama krov": "Panoramadach", "Bluetooth": "Bluetooth", "Virtuelna tabla": "Digitales Cockpit", "Keyless": "Keyless", "Elektro sedišta": "Elektrische Sitze", "Head-up displej": "Head-up-Display" },
    en: { "Dizel": "Diesel", "Benzin": "Petrol", "Hibrid": "Hybrid", "Električni": "Electric", "Gas": "LPG", "Manuelni 5": "Manual 5-speed", "Manuelni 6": "Manual 6-speed", "Automatik": "Automatic", "Hečbek": "Hatchback", "Karavan": "Estate", "Limuzina": "Saloon", "Monovolumen": "MPV", "Kupe": "Coupé", "Kabriolet": "Convertible", "Prednji": "Front", "Zadnji": "Rear", "Kompletna": "Complete", "Delimična": "Partial", "Nema": "None",
      "Navigacija": "Navigation", "Klima automatik": "Climate control", "Kamera": "Reversing camera", "Parking senzori": "Parking sensors", "LED / Xenon farovi": "LED / Xenon lights", "Grejanje sedišta": "Heated seats", "Tempomat": "Cruise control", "Adaptivni tempomat": "Adaptive cruise control", "Kožna sedišta": "Leather seats", "Alu felne": "Alloy wheels", "Kuka": "Tow bar", "Panorama krov": "Panoramic roof", "Virtuelna tabla": "Virtual cockpit", "Elektro sedišta": "Electric seats", "Head-up displej": "Head-up display" },
  };
  const PH = '<svg viewBox="0 0 120 50" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true"><path d="M8 36v-8l10-4 14-12h40l18 12 18 4v8"/><path d="M8 36h12m20 0h40m20 0h12"/><circle cx="30" cy="38" r="8"/><circle cx="90" cy="38" r="8"/><path d="M36 24h56M62 12v12"/></svg>';

  let CARS = [], filter = "all";
  const lang = () => { try { return L[localStorage.getItem("swiscars-lang")] ? localStorage.getItem("swiscars-lang") : "sr"; } catch (e) { return "sr"; } };
  const T = () => L[lang()];
  const tv = v => (VAL[lang()] && VAL[lang()][v]) || v;
  const hp = () => ({ sr: "KS", de: "PS", en: "hp" })[lang()];
  const num = n => Math.round(+n).toLocaleString(T().locale);
  const price = c => c.price ? `${num(c.price)} €` : T().ask;
  const meta = c => [c.year, c.km != null && c.km !== "" ? num(c.km) + " km" : "", c.fuel ? tv(c.fuel) : "", c.gear ? tv(c.gear) : "", c.kw ? Math.round(c.kw * 1.36) + " " + hp() : ""].filter(Boolean).join(" · ");
  // Availability is independent of the vehicle's transport or preparation phase.
  const logisticsPhase = c => ({ kupljen: 0, transport: 1, carinjen: 2, garaza: 3, prodaja: 3 })[c.status] ?? -1;
  const salePhase = c => c.status === "prodat" ? 2 : c.reserved ? 1 : 0;
  const saleStatus = c => T().sale[salePhase(c)];
  const track = c => { const i = logisticsPhase(c); return i < 0 ? "" : T().track.map((t, k) => `<li class="${k < i ? "done" : k === i ? "now" : ""}">${esc(t)}</li>`).join(""); };

  function render() {
    const credits = document.querySelector('.cars-photo-credits');
    if (credits) {
      credits.querySelector('summary').textContent = T().creditsTitle;
      credits.querySelector('[data-credits-note]').textContent = T().creditsNote;
      credits.querySelector('[data-crop-note]').textContent = T().cropNote;
    }
    // where the car is: still in Switzerland (bought / on the way) or already in Serbia (customs, preparation, for sale)
    const loc = c => ["kupljen", "transport"].includes(c.status) ? "ch" : "rs";
    const list = CARS.filter(c => filter === "all" || loc(c) === filter);
    $("n-all").textContent = CARS.length; $("n-ch").textContent = CARS.filter(c => loc(c) === "ch").length; $("n-rs").textContent = CARS.filter(c => loc(c) === "rs").length;
    $("cars").innerHTML = list.map(c => {
      const ph = c.photos || [];
      return `<button type="button" class="car-card" data-car="${esc(c.id)}" aria-label="${esc(c.model)}">
        <div class="car-photo">${ph.length ? `<img src="${esc(photoUrl(ph[0]))}" alt="" loading="lazy">` : `<div class="ph">${PH}</div>`}
          <span class="car-badge ${c.reserved && c.status !== "prodat" ? "res" : c.status !== "prodat" ? "ready" : ""}">${esc(saleStatus(c))}</span>
          ${c.illustration ? `<span class="car-image-note">${esc(T().illustration)}</span>` : ""}
          ${ph.length > 1 ? `<span class="count">${ph.length} ${esc(T().photos)}</span>` : ""}</div>
        <div class="car-info"><h2>${esc(c.model)}</h2><p class="car-stage">${esc(T().stage[c.status] || "")}</p><p class="car-meta">${esc(meta(c))}</p>
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
    $("dlgGallery").innerHTML = ph.length ? ph.map((p, i) => `<img src="${esc(photoUrl(p))}" alt="${esc(c.model)} ${i + 1}" loading="${i < 2 ? "eager" : "lazy"}">`).join("") + (c.illustration ? `<span class="car-image-note">${esc(t.illustration)}</span>` : "") : `<div class="ph">${PH}</div>`;
    $("dlgStage").textContent = [saleStatus(c), t.stage[c.status]].filter(Boolean).join(" · ");
    $("dlgTitle").textContent = c.model;
    $("exampleInspection").hidden = c.id !== 'preview-skoda-octavia-combi-2018';
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
      // Illustrative placeholders for entries without uploaded photos; no vehicle records are changed.
      const illustrations = {
        'preview-skoda-octavia-combi-2018': ['https://upload.wikimedia.org/wikipedia/commons/1/1c/2018_Skoda_Octavia_%285E_MY18.5%29_110TSI_station_wagon_%282018-11-02%29.jpg', 'EurovisionNim', '2018_Skoda_Octavia_(5E_MY18.5)_110TSI_station_wagon_(2018-11-02).jpg'],
        'preview-vw-golf-variant-2017': ['https://upload.wikimedia.org/wikipedia/commons/3/36/Volkswagen_Golf_Variant_%282017%29.jpg', 'Charles01', 'Volkswagen_Golf_Variant_(2017).jpg'],
        'preview-toyota-c-hr-2019': ['https://upload.wikimedia.org/wikipedia/commons/4/41/Toyota_C-HR_01_China_2019-04-04.jpg', 'Navigator84', 'Toyota_C-HR_01_China_2019-04-04.jpg']
      };
      CARS.forEach(c => {
        const image = illustrations[c.id] || (c.model.startsWith('VW Golf') ? illustrations['preview-vw-golf-variant-2017'] : c.model.startsWith('Toyota C-HR') ? illustrations['preview-toyota-c-hr-2019'] : null);
        if (image && !(c.photos || []).length) { c.photos = [image[0]]; c.illustration = image; }
      });
      const usedIllustrations = [...new Set(CARS.map(c => c.illustration).filter(Boolean))];
      if (usedIllustrations.length) {
        const credits = document.createElement('details');
        credits.className = 'cars-photo-credits';
        credits.innerHTML = `<summary>${esc(T().creditsTitle)}</summary><p><span data-credits-note>${esc(T().creditsNote)}</span> ` + usedIllustrations.map(p => `<a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p[2])}" target="_blank" rel="noopener">${esc(p[1])}</a>`).join(', ') + ` · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · <span data-crop-note>${esc(T().cropNote)}</span></p>`;
        $('cars').parentElement.append(credits);
      }
      CARS.sort((a, b) => (a.stage === b.stage ? 0 : a.stage === "ready" ? -1 : 1));
      render();
      if (location.hash.startsWith("#auto-")) open(decodeURIComponent(location.hash.slice(6)));
    })
    .catch(e => { console.warn(e); $("carsErr").hidden = false; $("n-all").textContent = ""; });
})();
