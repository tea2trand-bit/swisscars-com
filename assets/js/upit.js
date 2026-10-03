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
    sr: { kicker: "Vaš upit", title: "Vaš upit za {model}", lead: "Ovde pratite status upita, svoje uslove i predloge vozila.",
      track: ["Primljeno", "Tražimo", "Kapara i pregled", "Kupljeno", "Transport", "Carina", "Priprema", "Predato"],
      now: ["Primili smo vaš upit. Javićemo vam se sa predlozima u roku od 24 sata.", "Tražimo auto u Švajcarskoj koje odgovara vašim željama. Predloge dobijate u roku od 24 sata.", "Imamo predlog za vas. Pogledajte ispod i javite nam da li vam odgovara.", "Auto je kupljeno za vas u Švajcarskoj.", "Auto je na putu za Srbiju.", "Auto je na carini u Srbiji.", "Auto se priprema: servis, provera i pranje.", "Auto je predato. Hvala na poverenju i srećna vožnja!"],
      ready: "Auto je spremno za preuzimanje.", aiYes: "Prva provera tržišta ({d}): u Švajcarskoj smo našli {n} vozila koja bi mogla da odgovaraju vašem budžetu. Predloge šaljemo ovde i na vaš email.", aiNo: "Prva provera tržišta ({d}): trenutno nema vozila koja odgovaraju budžetu. Pratimo tržište i javljamo vam se čim se pojavi nešto dobro.", closed: "Ovaj upit je zatvoren. Ako i dalje tražite auto, javite nam se.",
      req: { model: "Tražite", brand: "Marka", yearFrom: "Godište od", fuel: "Gorivo", body: "Karoserija", drive: "Pogon", color: "Boja", budget: "Budžet", mileage: "Kilometraža", gearbox: "Menjač", equip: "Oprema", when: "Kada vam treba auto", city: "Grad", note: "Vaše napomene", created: "Upit poslat" }, any: "Svejedno", notSpecified: "Nije navedeno",
      how: ["Navedete budžet i uslove. Naš tim traži odgovarajuća vozila i ovde prikazuje predloge, linkove na oglase i procenu ukupne cene u Srbiji, sa troškovima vozila, usluge, transporta, carine i poreza.","Kada izaberete predlog, prvo proveravamo kod prodavca da li je auto dostupan. Pre uplate potvrđujemo ponudu, obim usluge, cenu pregleda i uslove kapare ili avansa. Tačan iznos vidite uz konkretan predlog.","Posle dogovora i potvrđene uplate naš tim pregleda vozilo i dokumentaciju dostupnu kod prodavca. Na svom upitu dobijate pisani izveštaj i fotografije, uključujući uočene nedostatke.","Na osnovu izveštaja odlučujete da li kupujete. Ako odustanete posle pregleda, povrat uplaćenog iznosa umanjuje se za unapred dogovoreni trošak pregleda; iznos povrata prikazan je uz predlog.","Ako kupujete, organizujemo kupovinu, dokumentaciju, transport, carinjenje i završnu proveru pre predaje, prema dogovorenoj ponudi. Status i naredni korak pratite ovde. Registraciju na vaše ime možete posebno dogovoriti.","Za auto koji ste sami pronašli postoji zaseban paket rada u Švajcarskoj po ceni {swissPackage}, uz uračunat prethodno plaćeni pregled. Cena auta, međunarodni transport, carina, porezi i registracija obračunavaju se posebno. Potraga prema budžetu ima pojedinačnu ponudu.","Pitanja, dopune i dogovore pišite u razgovoru ispod. Klijent i tim vide istu istoriju poruka, sa pošiljaocem, datumom i vremenom."], howT: "Kako radimo",
      aZanima: "Zanima me – pošaljite slike", aNe: "Ne zanima me", aZelim: "Želim ovo auto", aNeHvala: "Ne, hvala", aRefund: "Vratite mi kaparu", aContinue: "Tražite drugo auto",
      sZanima: "✓ Šaljemo vam slike i opis ovog auta, obično istog dana.", sNe: "Rekli ste da vas ne zanima. Tražimo dalje.", adT: "Iz oglasa", zelimHint: "Kapara: {d} € ({p}% cene). Ostatak plaćate kad auto stigne.",
      sZelim: "Izabrali ste ovo auto. Molimo uplatite kaparu od {d} €.", payT: "Podaci za uplatu", payNone: "Podatke za uplatu šaljemo vam lično (telefonom ili emailom).", payNext: "Čim kapara legne, naš tim ide na pregled auta.",
      sPaid: "✓ Kapara od {d} € je primljena. Naš čovek pregleda auto, a vi dobijate obaveštenje o rezultatu.", sInsp: "Auto nije prošlo pregled:", sInspQ: "Izaberite šta želite:",
      sRefund: "Kapara od {d} € vam se vraća.", sRefunded: "✓ Kapara od {d} € je vraćena.", sContinue: "Tražimo drugo auto za vas, kapara ostaje za sledeće.",
      nowZanima: "Pripremamo slike i opis auta koje vas zanima.", nowPhotos: "Slike i opis su spremni. Pogledajte ispod i javite da li želite auto.", nowDep: "Čekamo vašu kaparu, zatim naš tim pregleda auto.", nowInsp: "Kapara je primljena, pregled auta je u toku.", nowFail: "Auto nije prošlo pregled. Izaberite ispod šta dalje.",
      cAd: "Pogledaj oglas (slike i opis) ↗", cEst: "Procena ukupne cene u Srbiji", cEstSub: "auto {chf} CHF + prevoz, carina i PDV + naša provizija {com} CHF", cInsp: "Pregled na licu mesta: {fee}", cInspDist: "~{d} km od St. Gallena", cInspDeal: "po dogovoru",
      aPregled: "Želim pregled ovog auta", pregHint: "Kapara {d} € ({p}%). Ako posle pregleda ne kupite, vraćamo {r} €.", avansW: "Avans", avansHint: "Za ovo auto plaća se avans od 50% umesto kapare od 10%. Ako posle pregleda ne kupite, avans vam vraćamo umanjen samo za trošak pregleda.",
      sZelim2: "Auto je dostupno. Molimo uplatite kaparu od {d} €.", sCheck: "Hvala! Proveravamo kod prodavca da li je auto još dostupno. Čim potvrdi, šaljemo vam podatke za uplatu.", sUnavail: "Nažalost, ovo auto više nije dostupno. Tražimo drugo i šaljemo vam nove predloge.", nowCheck: "Proveravamo da li je auto koje ste izabrali još dostupno.", payNext2: "Čim kapara legne, naš tim ide na pregled.", sPaid2: "✓ Kapara od {d} € je primljena. Pregled auta je u toku.",
      repT: "Izveštaj sa pregleda", aKupujem: "Kupujem", aNeKupujem: "Ne kupujem", decHint: "Ako ne kupite, vraćamo {r} € (kapara umanjena za pregled).",
      sBuy: "✓ Kupujete ovo auto. Kupujemo ga za vas; ostatak cene plaćate kad auto stigne u Srbiju.", sRefund2: "Ne kupujete. Vraćamo vam {r} €.", sRefunded2: "✓ Vraćeno vam je {r} €.",
      nowRep: "Pregled je gotov. Pogledajte izveštaj i odlučite: kupujem ili ne kupujem.", nowBuy: "Kupujemo auto za vas.",
      propT: "Predlog za vas", priceL: "Cena u Srbiji", noPrice: "Cena po dogovoru", yes: "Odgovara mi", no: "Tražite dalje", noteP: "Poruka za nas (nije obavezno)",
      saidYes: "✓ Rekli ste da vam odgovara. Javljamo vam se oko sledećih koraka.", saidNo: "Rekli ste da tražimo dalje. Nastavljamo potragu.", send: "Šaljem…", err: "Slanje nije uspelo. Pokušajte ponovo.",
      carT: "Vaše auto", qT: "Dodatni kontakt", qP: "Za pitanja i dogovore o ovom upitu koristite razgovor iznad, kako bi sve ostalo na jednom mestu. Ako imate poteškoću sa pristupom platformi, možete nam se javiti mejlom ili telefonom.",
      e404T: "Upit nije pronađen", e404P: "Proverite da li ste otvorili ceo link iz emaila. Ako problem ostane, javite nam se.", eBtn: "Pošaljite novi upit",
      km: "km", gear: { "Automatik": "Automatik", "Manuelni": "Manuelni" }, locale: "sr-Latn-RS" },
    de: { kicker: "Ihre Anfrage", title: "Ihre Anfrage für {model}", lead: "Hier sehen Sie den Status, Ihre Wünsche und unsere Fahrzeugvorschläge.",
      track: ["Erhalten", "Suche", "Anzahlung & Prüfung", "Gekauft", "Transport", "Zoll", "Aufbereitung", "Übergeben"],
      now: ["Wir haben Ihre Anfrage erhalten. Wir melden uns innerhalb von 24 Stunden mit Vorschlägen.", "Wir suchen in der Schweiz ein Auto, das zu Ihren Wünschen passt. Vorschläge erhalten Sie innerhalb von 24 Stunden.", "Wir haben einen Vorschlag für Sie. Bitte sehen Sie unten nach und sagen Sie uns, ob er passt.", "Das Auto wurde für Sie in der Schweiz gekauft.", "Das Auto ist unterwegs nach Serbien.", "Das Auto ist beim Zoll in Serbien.", "Das Auto wird vorbereitet: Service, Prüfung und Reinigung.", "Das Auto wurde übergeben. Danke für Ihr Vertrauen und gute Fahrt!"],
      ready: "Das Auto ist abholbereit.", aiYes: "Erste Marktprüfung ({d}): Wir haben in der Schweiz {n} Fahrzeuge gefunden, die zu Ihrem Budget passen könnten. Die Vorschläge erscheinen hier und per E-Mail.", aiNo: "Erste Marktprüfung ({d}): Derzeit gibt es keine passenden Fahrzeuge in Ihrem Budget. Wir beobachten den Markt und melden uns, sobald etwas Gutes auftaucht.", closed: "Diese Anfrage ist abgeschlossen. Wenn Sie weiterhin ein Auto suchen, melden Sie sich.",
      req: { model: "Gesucht", brand: "Marke", yearFrom: "Baujahr ab", fuel: "Treibstoff", body: "Karosserie", drive: "Antrieb", color: "Farbe", budget: "Budget", mileage: "Kilometerstand", gearbox: "Getriebe", equip: "Ausstattung", when: "Gewünschter Zeitpunkt", city: "Ort", note: "Ihre Anmerkungen", created: "Anfrage gesendet" }, any: "Egal", notSpecified: "Nicht angegeben",
      how: ["Sie nennen Budget und Wünsche. Unser Team sucht passende Fahrzeuge und zeigt hier Vorschläge, Inseratlinks und den geschätzten Gesamtpreis in Serbien mit Fahrzeug, Dienstleistung, Transport, Zoll und Steuern.","Wenn Sie einen Vorschlag wählen, prüfen wir zuerst die Verfügbarkeit beim Verkäufer. Vor der Zahlung bestätigen wir Angebot, Leistungsumfang, Prüfkosten und Bedingungen der An- oder Vorauszahlung. Den genauen Betrag sehen Sie beim jeweiligen Vorschlag.","Nach Absprache und bestätigter Zahlung prüft unser Team das Fahrzeug und die beim Verkäufer verfügbaren Unterlagen. Sie erhalten hier einen schriftlichen Bericht und Fotos, einschließlich festgestellter Mängel.","Anhand des Berichts entscheiden Sie über den Kauf. Verzichten Sie nach der Prüfung, wird die Zahlung abzüglich der vorher vereinbarten Prüfkosten erstattet. Der Erstattungsbetrag steht beim Vorschlag.","Beim Kauf organisieren wir Kauf, Unterlagen, Transport, Verzollung und Abschlussprüfung vor Übergabe gemäß Angebot. Status und nächsten Schritt verfolgen Sie hier. Die Zulassung auf Ihren Namen können Sie separat vereinbaren.","Für ein selbst gefundenes Auto gibt es ein separates Schweizer Leistungspaket zum Preis {swissPackage}, unter Anrechnung einer bereits bezahlten Prüfung. Fahrzeugpreis, internationaler Transport, Zoll, Steuern und Zulassung sind separat. Für die Suche nach Budget erstellen wir ein individuelles Angebot.","Fragen, Ergänzungen und Absprachen schreiben Sie im Gespräch unten. Kunde und Team sehen denselben Verlauf mit Absender, Datum und Uhrzeit."], howT: "So arbeiten wir",
      aZanima: "Interessiert mich – Fotos senden", aNe: "Nicht interessiert", aZelim: "Ich möchte dieses Auto", aNeHvala: "Nein, danke", aRefund: "Anzahlung zurück", aContinue: "Anderes Auto suchen",
      sZanima: "✓ Wir senden Ihnen Fotos und Beschreibung dieses Autos, meist am selben Tag.", sNe: "Sie sind nicht interessiert. Wir suchen weiter.", adT: "Aus dem Inserat", zelimHint: "Anzahlung: {d} € ({p} % des Preises). Den Rest zahlen Sie bei Ankunft des Autos.",
      sZelim: "Sie haben dieses Auto gewählt. Bitte überweisen Sie die Anzahlung von {d} €.", payT: "Zahlungsangaben", payNone: "Die Zahlungsangaben senden wir Ihnen persönlich (Telefon oder E-Mail).", payNext: "Sobald die Anzahlung eingegangen ist, prüft unser Team das Auto.",
      sPaid: "✓ Anzahlung von {d} € erhalten. Unser Team prüft das Auto, Sie erhalten das Ergebnis per Nachricht.", sInsp: "Das Auto hat die Prüfung nicht bestanden:", sInspQ: "Bitte wählen Sie:",
      sRefund: "Die Anzahlung von {d} € wird zurückgezahlt.", sRefunded: "✓ Die Anzahlung von {d} € wurde zurückgezahlt.", sContinue: "Wir suchen ein anderes Auto für Sie, die Anzahlung bleibt bestehen.",
      nowZanima: "Wir bereiten Fotos und Beschreibung des Autos vor, das Sie interessiert.", nowPhotos: "Fotos und Beschreibung sind bereit. Sehen Sie unten nach und sagen Sie uns, ob Sie das Auto möchten.", nowDep: "Wir warten auf Ihre Anzahlung, danach prüft unser Team das Auto.", nowInsp: "Anzahlung erhalten, die Prüfung des Autos läuft.", nowFail: "Das Auto hat die Prüfung nicht bestanden. Bitte wählen Sie unten, wie es weitergeht.",
      cAd: "Inserat ansehen (Fotos und Beschreibung) ↗", cEst: "Geschätzter Gesamtpreis in Serbien", cEstSub: "Auto {chf} CHF + Transport, Zoll und MwSt. + unsere Provision {com} CHF", cInsp: "Prüfung vor Ort: {fee}", cInspDist: "~{d} km ab St. Gallen", cInspDeal: "nach Absprache",
      aPregled: "Prüfung gewünscht", pregHint: "Anzahlung {d} € ({p} %). Kaufen Sie nach der Prüfung nicht, zahlen wir {r} € zurück.", avansW: "Vorauszahlung", avansHint: "Für dieses Auto gilt eine Vorauszahlung von 50 % statt 10 % Anzahlung. Kaufen Sie nach der Prüfung nicht, zahlen wir sie abzüglich der Prüfkosten zurück.",
      sZelim2: "Das Auto ist verfügbar. Bitte überweisen Sie die Anzahlung von {d} €.", sCheck: "Danke! Wir fragen beim Verkäufer nach, ob das Auto noch verfügbar ist. Sobald er bestätigt, senden wir Ihnen die Zahlungsangaben.", sUnavail: "Leider ist dieses Auto nicht mehr verfügbar. Wir suchen ein anderes und senden Ihnen neue Vorschläge.", nowCheck: "Wir prüfen, ob das gewählte Auto noch verfügbar ist.", payNext2: "Sobald die Anzahlung eingegangen ist, fährt unser Team zur Prüfung.", sPaid2: "✓ Anzahlung von {d} € erhalten. Die Prüfung läuft.",
      repT: "Prüfbericht", aKupujem: "Ich kaufe", aNeKupujem: "Ich kaufe nicht", decHint: "Wenn Sie nicht kaufen, zahlen wir {r} € zurück (Anzahlung abzüglich Prüfung).",
      sBuy: "✓ Sie kaufen dieses Auto. Wir kaufen es für Sie; den Rest zahlen Sie bei Ankunft in Serbien.", sRefund2: "Sie kaufen nicht. Wir zahlen Ihnen {r} € zurück.", sRefunded2: "✓ {r} € wurden zurückgezahlt.",
      nowRep: "Die Prüfung ist abgeschlossen. Sehen Sie den Bericht an und entscheiden Sie.", nowBuy: "Wir kaufen das Auto für Sie.",
      propT: "Vorschlag für Sie", priceL: "Preis in Serbien", noPrice: "Preis nach Absprache", yes: "Passt mir", no: "Bitte weitersuchen", noteP: "Nachricht an uns (optional)",
      saidYes: "✓ Sie haben zugesagt. Wir melden uns zu den nächsten Schritten.", saidNo: "Sie möchten, dass wir weitersuchen. Wir suchen weiter.", send: "Senden…", err: "Senden fehlgeschlagen. Bitte erneut versuchen.",
      carT: "Ihr Auto", qT: "Weiterer Kontakt", qP: "Nutzen Sie für Fragen und Absprachen zu dieser Anfrage das Gespräch oben, damit alles an einem Ort bleibt. Bei Schwierigkeiten mit dem Zugang erreichen Sie uns auch per E-Mail oder Telefon.",
      e404T: "Anfrage nicht gefunden", e404P: "Bitte prüfen Sie, ob Sie den ganzen Link aus der E-Mail geöffnet haben. Sonst melden Sie sich bei uns.", eBtn: "Neue Anfrage senden",
      km: "km", gear: { "Automatik": "Automatik", "Manuelni": "Manuell" }, locale: "de-CH" },
    en: { kicker: "Your request", title: "Your request for {model}", lead: "Track your request, requirements and our vehicle proposals here.",
      track: ["Received", "Searching", "Deposit & inspection", "Bought", "Transport", "Customs", "Preparation", "Handed over"],
      now: ["We received your request. We will get back to you with proposals within 24 hours.", "We are searching Switzerland for a car that matches your wishes. You will get proposals within 24 hours.", "We have a proposal for you. Please look below and tell us if it suits you.", "The car has been bought for you in Switzerland.", "The car is on its way to Serbia.", "The car is at customs in Serbia.", "The car is being prepared: service, inspection and cleaning.", "The car has been handed over. Thank you for your trust and enjoy the drive!"],
      ready: "The car is ready for pick-up.", aiYes: "First market check ({d}): we found {n} cars in Switzerland that could match your budget. Proposals appear here and by email.", aiNo: "First market check ({d}): there are no matching cars in your budget right now. We keep watching the market and will contact you as soon as something good appears.", closed: "This request is closed. If you are still looking for a car, get in touch.",
      req: { model: "Looking for", brand: "Brand", yearFrom: "Year from", fuel: "Fuel", body: "Body type", drive: "Drive", color: "Colour", budget: "Budget", mileage: "Mileage", gearbox: "Gearbox", equip: "Equipment", when: "When you need the car", city: "City", note: "Your notes", created: "Request sent" }, any: "Any", notSpecified: "Not specified",
      how: ["You provide your budget and requirements. Our team searches for suitable vehicles and shows proposals, listing links and an estimated total price in Serbia including the vehicle, service, transport, customs and taxes.","When you choose a proposal, we first check availability with the seller. Before payment, we confirm the quote, service scope, inspection price and deposit or advance terms. The exact amount appears with each proposal.","After agreement and confirmed payment, our team inspects the vehicle and the documents available from the seller. You receive a written report and photos here, including any defects found.","You decide whether to buy based on the report. If you decline after inspection, your payment is refunded minus the inspection cost agreed in advance. The refund amount appears with the proposal.","If you buy, we arrange purchase, documents, transport, customs clearance and a final check before handover according to the agreed quote. Track the status and next step here. Registration in your name can be arranged separately.","For a vehicle you found yourself, there is a separate Swiss service package at {swissPackage}, with any previously paid inspection credited. The vehicle, international transport, customs, taxes and registration are separate. A budget-based search has an individual quote.","Write questions, additions and agreements in the conversation below. You and the team see the same history with sender, date and time."], howT: "How we work",
      aZanima: "I'm interested – send photos", aNe: "Not interested", aZelim: "I want this car", aNeHvala: "No, thanks", aRefund: "Refund my deposit", aContinue: "Find another car",
      sZanima: "✓ We are sending you photos and a description of this car, usually the same day.", sNe: "You are not interested. We keep searching.", adT: "From the listing", zelimHint: "Deposit: {d} € ({p}% of the price). You pay the rest when the car arrives.",
      sZelim: "You chose this car. Please pay the deposit of {d} €.", payT: "Payment details", payNone: "We will send you the payment details personally (phone or email).", payNext: "As soon as the deposit arrives, our team inspects the car.",
      sPaid: "✓ Deposit of {d} € received. Our person is inspecting the car and you will be notified of the result.", sInsp: "The car did not pass inspection:", sInspQ: "Please choose:",
      sRefund: "Your deposit of {d} € is being refunded.", sRefunded: "✓ Your deposit of {d} € has been refunded.", sContinue: "We are looking for another car for you, the deposit stays for it.",
      nowZanima: "We are preparing photos and a description of the car you are interested in.", nowPhotos: "Photos and description are ready. Look below and tell us if you want the car.", nowDep: "We are waiting for your deposit, then our team inspects the car.", nowInsp: "Deposit received, the car inspection is in progress.", nowFail: "The car did not pass inspection. Please choose below what happens next.",
      cAd: "View listing (photos and description) ↗", cEst: "Estimated total price in Serbia", cEstSub: "car {chf} CHF + transport, customs and VAT + our commission {com} CHF", cInsp: "On-site inspection: {fee}", cInspDist: "~{d} km from St. Gallen", cInspDeal: "by arrangement",
      aPregled: "I want an inspection", pregHint: "Deposit {d} € ({p}%). If you don't buy after the inspection, we refund {r} €.", avansW: "Advance", avansHint: "For this car a 50% advance applies instead of the 10% deposit. If you don't buy after the inspection, we refund it minus the inspection cost.",
      sZelim2: "The car is available. Please pay the deposit of {d} €.", sCheck: "Thank you! We are checking with the seller that the car is still available. As soon as he confirms, we send you the payment details.", sUnavail: "Unfortunately this car is no longer available. We are looking for another one and will send you new proposals.", nowCheck: "We are checking that the car you chose is still available.", payNext2: "As soon as the deposit arrives, our team goes to inspect the car.", sPaid2: "✓ Deposit of {d} € received. The inspection is in progress.",
      repT: "Inspection report", aKupujem: "I'm buying", aNeKupujem: "I'm not buying", decHint: "If you don't buy, we refund {r} € (deposit minus the inspection).",
      sBuy: "✓ You are buying this car. We buy it for you; you pay the rest when it arrives in Serbia.", sRefund2: "You are not buying. We refund you {r} €.", sRefunded2: "✓ {r} € has been refunded.",
      nowRep: "The inspection is done. Read the report and decide.", nowBuy: "We are buying the car for you.",
      propT: "Proposal for you", priceL: "Price in Serbia", noPrice: "Price on request", yes: "This suits me", no: "Keep searching", noteP: "Message to us (optional)",
      saidYes: "✓ You said it suits you. We will contact you about the next steps.", saidNo: "You asked us to keep searching. We are on it.", send: "Sending…", err: "Sending failed. Please try again.",
      carT: "Your car", qT: "Additional contact", qP: "Use the conversation above for questions and agreements about this request, so everything stays in one place. If you have trouble accessing the platform, you can also contact us by email or phone.",
      e404T: "Request not found", e404P: "Please check that you opened the full link from the email. If it still does not work, contact us.", eBtn: "Send a new request",
      km: "km", gear: { "Automatik": "Automatic", "Manuelni": "Manual" }, locale: "en-GB" },
  };
  let DATA = null, lang = "sr", initialLanguageApplied = false, languageSelected = false;
  const T = () => L[lang];
  const num = n => Math.round(+n).toLocaleString(T().locale);
  const CAR_STAGE = { pregledan: 3, kupljen: 3, transport: 4, carinjen: 5, garaza: 6, prodaja: 6, prodat: 7 };
  function stage(d) {
    if (d.status === "odustao") return -1;
    if (d.status === "predato" || d.status === "kupio") return 7;
    if (d.car && CAR_STAGE[d.car.status] != null) return CAR_STAGE[d.car.status];
    if (d.status === "kupljeno") return 3;
    if ((d.proposals || []).some(p => p.choice === "buy")) return 3;
    if (d.status === "ponudjeno" || (d.proposals || []).some(p => !p.answer || p.answer === "zanima" || p.answer === "zelim")) return 2;
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
    $("u_title").textContent = d.model ? t.title.replace("{model}", d.model) : t.kicker;
    if (window.scSaveUpit) window.scSaveUpit(token, { model: d.model, created: d.created });
    $("u_lead").textContent = t.lead;
    const st = stage(d);
    $("u_track").innerHTML = t.track.map((x, i) => `<li class="${st < 0 ? "" : i < st ? "done" : i === st ? "now" : ""}"${i === st ? ' aria-current="step"' : ''}>${esc(x)}</li>`).join("");
    const PS = d.proposals || [];
    const act = !d.car && st >= 0 ? (PS.find(p => p.choice === "buy") ? t.nowBuy : PS.find(p => p.inspAt && !p.choice && p.insp !== "ne") ? t.nowRep : PS.find(p => p.insp === "ne" && !p.choice) ? t.nowFail : PS.find(p => p.depositPaidAt && !p.insp && !p.inspAt) ? t.nowInsp : PS.find(p => p.answer === "zelim" && !p.availAt && p.avail !== "ne") ? t.nowCheck : PS.find(p => p.answer === "zelim" && !p.depositPaidAt && p.avail !== "ne") ? t.nowDep : PS.find(p => p.answer === "zanima" && p.photosAt) ? t.nowPhotos : PS.find(p => p.answer === "zanima") ? t.nowZanima : "") : "";
    $("u_now").textContent = st < 0 ? t.closed : act || (d.car && d.car.status === "prodaja" && st === 6 ? t.ready : t.now[st]);
    const pct = d.depositPct || 10;
    $("u_how").innerHTML = `<summary>${esc(t.howT)}</summary><ol>${t.how.map(x => `<li>${esc((window.SCServicePrices?SCServicePrices.format(x,lang):x).replace("{p}", pct))}</li>`).join("")}</ol>`;
    $("u_how").hidden = !!d.car;
    $("u_ai").hidden = !(d.aiAt && st >= 0 && st <= 2 && !(d.proposals || []).length);
    if (d.aiAt) $("u_ai").textContent = (d.aiN > 0 ? t.aiYes : t.aiNo).replace("{d}", new Date(d.aiAt).toLocaleDateString(t.locale)).replace("{n}", d.aiN);
    const choice = x => x === "Svejedno" ? t.any : (x || t.notSpecified);
    const rq = [["model", d.model], ["brand", d.brand], ["yearFrom", choice(d.yearFrom)], ["fuel", choice(d.fuel)], ["gearbox", t.gear[d.gearbox] || choice(d.gearbox)], ["body", choice(d.body)], ["drive", choice(d.drive)], ["color", choice(d.color)], ["budget", d.budget ? num(d.budget) + " €" : t.notSpecified], ["mileage", choice(d.mileage)], ["when", d.when], ["city", d.city], ["equip", (d.equip || []).join(", ")], ["note", d.note], ["created", d.created ? new Date(d.created).toLocaleDateString(t.locale) : ""]];
    $("u_req").innerHTML = rq.filter(r => r[1]).map(([k, v]) => `<div${k === "note" || k === "equip" ? ' class="up-req-wide"' : ""}><dt>${esc(t.req[k])}</dt><dd>${esc(v)}</dd></div>`).join("");
    const c = d.car;
    $("u_car").innerHTML = c ? `<div class="up-card"><h2>${esc(t.carT)}: ${esc(c.model)}${c.year ? " " + c.year : ""}</h2>
      <p>${[c.km ? num(c.km) + " km" : "", c.fuel, t.gear[c.gear] || c.gear, c.kw ? Math.round(c.kw * 1.36) + (lang === "en" ? " hp" : lang === "de" ? " PS" : " KS") : "", c.color].filter(Boolean).map(esc).join(" · ")}</p>
      ${c.price ? `<p class="up-price">${num(c.price)} €</p>` : ""}
      ${(c.photos || []).length ? `<div class="up-photos">${c.photos.map(p => `<a href="${esc(photoUrl(p))}" target="_blank" rel="noopener"><img src="${esc(photoUrl(p))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}</div>` : "";
    const props = (d.proposals || []).slice().reverse();
    const dep = p => p.deposit ? num(p.deposit) : "";
    const btn = (p, ans, label, gold) => `<button class="btn ${gold ? "btn-gold" : "btn-outline up-out"}" type="button" data-ans="${esc(p.id)}|${ans}">${esc(label)}</button>`;
    const rf = p => num(p.refundEur != null ? p.refundEur : 0);
    const state = p => {
      if (p.commission || p.url) {
        if (p.depositRefundAt) return `<p class="up-ok">${esc(t.sRefunded2.replace("{r}", rf(p)))}</p>`;
        if (p.choice === "refund") return `<p class="up-wait">${esc(t.sRefund2.replace("{r}", rf(p)))}</p>`;
        if (p.choice === "buy") return `<p class="up-ok">${esc(t.sBuy)}</p>`;
        if (p.inspAt && p.insp !== "ne" && !p.choice) return `<div class="up-box"><p class="car-meta">${esc(t.repT)}</p>${p.inspNote ? `<p style="white-space:pre-wrap">${esc(p.inspNote)}</p>` : ""}${window.SCInspectionReport?.render(p.inspChecklist, DATA.lang || lang) || ""}${(p.inspPhotos || []).length ? `<div class="up-photos">${p.inspPhotos.map(x => `<a href="${esc(photoUrl(x))}" target="_blank" rel="noopener"><img src="${esc(photoUrl(x))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}<p class="car-meta">${esc(t.decHint.replace("{r}", rf(p)))}</p><div class="up-ans">${btn(p, "kupujem", t.aKupujem, true)}${btn(p, "nekupujem", t.aNeKupujem)}</div></div>`;
        if (p.depositPaidAt && !p.insp) return `<p class="up-ok">${esc(t.sPaid2.replace("{d}", dep(p)))}</p>`;
        if (p.avail === "ne") return `<p class="up-no">${esc(t.sUnavail)}</p>`;
        if (p.answer === "zelim" && !p.availAt) return `<p class="up-wait">${esc(t.sCheck)}</p>`;
        if (p.answer === "zelim" && !p.depositPaidAt) return `<div class="up-box"><p><b>${esc(t.sZelim2.replace("{d}", dep(p)))}</b></p><p class="car-meta">${esc(t.payT)}</p><p class="up-pay">${esc(d.pay || t.payNone)}</p><p class="car-meta">${esc(t.payNext2)}</p></div>`;
        if (p.answer === "ne") return `<p class="up-no">${esc(t.sNe)}</p>`;
        if (!p.answer) { const pp = +p.depositPct || pct, dd = p.price ? Math.ceil(p.price * pp / 1000) * 10 : 0, rr = Math.max(0, dd - Math.round((p.inspFee || 0) * 1.057));
          return `${pp >= 50 ? `<p class="car-meta"><b>${esc(t.avansHint)}</b></p>` : ""}<p class="car-meta">${esc((pp >= 50 ? t.pregHint.replace(/^\S+/, t.avansW) : t.pregHint).replace("{d}", num(dd)).replace("{r}", num(rr)).replace("{p}", pp))}</p><div class="up-ans">${btn(p, "zelim", t.aPregled, true)}${btn(p, "ne", t.aNe)}</div>`; }
      }
      if (p.depositRefundAt) return `<p class="up-ok">${esc(t.sRefunded.replace("{d}", dep(p)))}</p>`;
      if (p.choice === "refund") return `<p class="up-wait">${esc(t.sRefund.replace("{d}", dep(p)))}</p>`;
      if (p.choice === "continue") return `<p class="up-wait">${esc(t.sContinue)}</p>`;
      if (p.insp === "ne") return `<div class="up-box"><p class="up-no">${esc(t.sInsp)}</p>${p.inspNote ? `<p>${esc(p.inspNote)}</p>` : ""}<p>${esc(t.sInspQ)}</p><div class="up-ans">${btn(p, "refund", t.aRefund)}${btn(p, "continue", t.aContinue, true)}</div></div>`;
      if (p.depositPaidAt) return `<p class="up-ok">${esc(t.sPaid.replace("{d}", dep(p)))}</p>`;
      if (p.answer === "zelim") return `<div class="up-box"><p><b>${esc(t.sZelim.replace("{d}", dep(p)))}</b></p><p class="car-meta">${esc(t.payT)}</p><p class="up-pay">${esc(d.pay || t.payNone)}</p><p class="car-meta">${esc(t.payNext)}</p></div>`;
      if (p.answer === "ne") return `<p class="up-no">${esc(t.sNe)}</p>`;
      if (p.answer === "zanima" && p.photosAt) { const dd = p.price ? num(Math.ceil(p.price * pct / 1000) * 10) : "—";
        return `<p class="car-meta">${esc(t.zelimHint.replace("{d}", dd).replace("{p}", pct))}</p><div class="up-ans"><textarea data-note="${esc(p.id)}" placeholder="${esc(t.noteP)}"></textarea>${btn(p, "zelim", t.aZelim, true)}${btn(p, "ne", t.aNeHvala)}</div>`; }
      if (p.answer === "zanima") return `<p class="up-ok">${esc(t.sZanima)}</p>`;
      return `<div class="up-ans">${btn(p, "zanima", t.aZanima, true)}${btn(p, "ne", t.aNe)}</div>`;
    };
    const order = p => p.answer === "ne" ? 2 : 0;
    $("u_props").innerHTML = props.slice().sort((x, y) => order(x) - order(y)).map(p => `<div class="up-card up-prop${p.answer === "ne" ? " up-dim" : ""}"><div class="ph">${(p.photos || []).length ? `<img src="${esc(photoUrl(p.photos[0]))}" alt="">` : (p.inspPhotos || []).length ? `<img src="${esc(photoUrl(p.inspPhotos[0]))}" alt="">` : PH}</div>
      <div class="bd"><span class="car-stage">${esc(t.propT)}${p.at ? " · " + new Date(p.at).toLocaleDateString(t.locale) : ""}</span><h3>${esc(p.title)}${p.year ? " · " + p.year : ""}</h3>
        <p class="car-meta">${[p.km ? num(p.km) + " km" : "", p.fuel, t.gear[p.gear] || p.gear].filter(Boolean).map(esc).join(" · ")}</p>
        ${p.url ? `<p><a class="btn btn-outline up-out" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(t.cAd)}</a></p>` : ""}
        <p><span class="car-meta">${esc(p.url ? t.cEst : t.priceL)}</span><br><span class="up-price">${p.price ? num(p.price) + " €" : esc(t.noPrice)}</span>${p.adChf ? `<br><span class="car-meta">${esc(t.cEstSub.replace("{chf}", num(p.adChf)).replace("{com}", num(p.commission || d.commission || 1000)))}</span>` : ""}</p>
        ${p.url ? `<p class="car-meta">${esc(t.cInsp.replace("{fee}", p.inspFee != null ? num(p.inspFee) + " CHF" : t.cInspDeal))}${p.dist != null ? " · " + esc(t.cInspDist.replace("{d}", p.dist)) : ""}${p.place ? " · " + esc(p.place) : ""}</p>` : ""}
        ${p.note ? `<p>${esc(p.note)}</p>` : ""}
        ${p.adNote ? `<div class="up-ad"><span class="car-meta">${esc(t.adT)}</span><p>${esc(p.adNote)}</p></div>` : ""}
        ${state(p)}
      </div>${(p.photos || []).length > 1 ? `<div class="up-photos up-gal">${p.photos.map(x => `<a href="${esc(photoUrl(x))}" target="_blank" rel="noopener"><img src="${esc(photoUrl(x))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}</div>`).join("");
    document.querySelectorAll("[data-ans]").forEach(b => b.onclick = async () => {
      const [id, ans] = b.dataset.ans.split("|");
      const note = (document.querySelector(`[data-note="${CSS.escape(id)}"]`) || {}).value || "";
      const btns = b.parentElement.querySelectorAll("button"); btns.forEach(x => x.disabled = true); b.textContent = T().send;
      try { const r = await rpc("sc_order_answer", { p_token: token, p_id: id, p_answer: ans, p_note: note }); if (!r.ok) throw new Error(r.status); await load(); }
      catch (e) { console.warn(e); alertBox(b.parentElement, T().err); btns.forEach(x => x.disabled = false); }
    });
    $("u_qT").textContent = t.qT; $("u_qP").textContent = t.qP;
    window.SCConversation.mount($("u_conversation"), { lang, key: {p_token:token}, call: async (fn, body) => {
      const r=await rpc(fn,body), result=await r.json();
      if(!r.ok)throw new Error(result.message||"conversation_error"); return result;
    } });
  }
  function alertBox(el, msg) { const p = document.createElement("p"); p.className = "up-no"; p.textContent = msg; el.appendChild(p); }
  async function load() {
    if (!/^[a-f0-9]{24}$/.test(token)) { DATA = null; render(); return; }
    try { const r = await rpc("sc_order_view", { p_token: token }); DATA = r.ok ? await r.json() : null; }
    catch (e) { console.warn(e); DATA = null; }
    if (DATA && !initialLanguageApplied) {
      initialLanguageApplied = true;
      if (!languageSelected) { lang = L[DATA.lang] ? DATA.lang : "sr"; document.querySelector(`[data-lang="${lang}"]`)?.click(); }
    }
    render();
  }
  try { const s = localStorage.getItem("swiscars-lang"); if (L[s]) lang = s; } catch (e) { }
  document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => { languageSelected = true; setTimeout(() => { lang = L[b.dataset.lang] ? b.dataset.lang : "sr"; render(); }, 0); }));
  window.addEventListener("hashchange", () => location.reload());
  document.addEventListener("sc-service-prices-ready",render);
  load();
  setInterval(() => { if (document.visibilityState === "visible" && DATA && document.activeElement?.tagName !== "TEXTAREA") load(); }, 60000);
})();
