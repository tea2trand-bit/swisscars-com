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

  const closedProposal = p => p.answer === 'ne' || p.avail === 'ne' || ['refund','continue','other'].includes(p.choice) || !!p.depositRefundAt;

  function clientDepositPaid(p){return !!p&&/^\d+(?:\.\d+)?$/.test(String(p.depositPaidAt??''))&&Number(p.depositPaidAt)>0&&(p.depositRefundAt==null||p.depositRefundAt==='');}
  let clientProposalFilter='proposals';
  const clientFavoriteBusy=new Set();
  function clientFavoriteWords(){return {sr:{proposals:'Predlozi',favorites:'Favoriti',add:'☆ Sačuvaj u favorite',remove:'★ Ukloni iz favorita',saved:'Favorit je sačuvan.',removed:'Favorit je uklonjen.',empty:'Još nema sačuvanih favorita. Sačuvajte vozila koja želite da razmotrite.',unavailable:'Oglas više nije dostupan.',filter:'Prikaz predloga',hint:'Možete sačuvati više favorita. Kada odlučite, izaberite jedno vozilo za pregled.'},de:{proposals:'Vorschläge',favorites:'Favoriten',add:'☆ Als Favorit speichern',remove:'★ Aus Favoriten entfernen',saved:'Favorit gespeichert.',removed:'Favorit entfernt.',empty:'Noch keine Favoriten. Speichern Sie Fahrzeuge, die Sie weiter überlegen möchten.',unavailable:'Das Fahrzeug ist nicht mehr verfügbar.',filter:'Vorschläge anzeigen',hint:'Sie können mehrere Favoriten speichern. Wenn Sie sich entschieden haben, wählen Sie ein Fahrzeug zur Prüfung.'},en:{proposals:'Proposals',favorites:'Favorites',add:'☆ Save to favorites',remove:'★ Remove from favorites',saved:'Favorite saved.',removed:'Favorite removed.',empty:'No saved favorites yet. Save vehicles you want to consider.',unavailable:'The vehicle is no longer available.',filter:'Proposal view',hint:'You can save several favorites. When you decide, choose one vehicle for inspection.'}}[lang];}
  function clientProposalUnavailable(p){return !!(p&&(p.avail==='ne'||p.available===false||p.carStatus==='prodat'||p.soldAt||p.unavailableAt||['sold','unavailable','prodat','odbijeno','arhiva'].includes(p.status)));}
  function clientProposalDeclined(p){return p.answer==='ne'||['refund','continue','other'].includes(p.choice)||!!p.depositRefundAt;}
  function clientFavoriteControl(p,d){
    const words=clientFavoriteWords(),selected=clientSelectedProposal(d);
    if(selected&&!p.favorite)return '';
    const disabled=clientFavoriteBusy.has(p.id)||!p.favorite&&(!!selected||clientProposalUnavailable(p));
    return '<div class="up-ans up-favorite-control"><button class="btn btn-outline up-out" type="button" data-client-favorite="'+esc(p.id)+'" aria-pressed="'+(p.favorite===true)+'"'+(disabled?' disabled':'')+'>'+esc(p.favorite===true?words.remove:words.add)+'</button><span class="car-meta" data-client-favorite-message="'+esc(p.id)+'" role="status" aria-live="polite"></span></div>';
  }
  function clientFavoriteFilters(view){
    if(view.selected)return '';
    const words=clientFavoriteWords();return '<nav class="up-ans up-favorite-filters" aria-label="'+esc(words.filter)+'"><button class="btn '+(clientProposalFilter==='proposals'?'btn-gold':'btn-outline')+'" type="button" data-client-filter="proposals" aria-pressed="'+(clientProposalFilter==='proposals')+'">'+esc(words.proposals)+'</button><button class="btn '+(clientProposalFilter==='favorites'?'btn-gold':'btn-outline')+'" type="button" data-client-filter="favorites" aria-pressed="'+(clientProposalFilter==='favorites')+'">'+esc(words.favorites)+' '+view.favoriteCount+'</button></nav><p class="car-meta">'+esc(words.hint)+'</p>';
  }
  async function clientSetFavorite(id,favorite){
    if(typeof favorite!=='boolean')throw Error('invalid_favorite');
    const p=DATA?.proposals?.find(p=>p.id===id);if(!p)throw Error('proposal_not_found');
    if(favorite&&(clientProposalUnavailable(p)||clientSelectedProposal(DATA)))throw Error('proposal_unavailable');
    if(clientFavoriteBusy.has(id))return null;
    clientFavoriteBusy.add(id);
    try{
      const response=await rpc('sc_order_favorite',{p_token:token,p_proposal:id,p_favorite:favorite}),result=await response.json();
      if(!response.ok||result?.ok!==true||typeof result.favorite!=='boolean')throw Error(result?.reason||'favorite_failed');
      const current=DATA?.proposals?.find(p=>p.id===id);if(current){current.favorite=result.favorite;current.favoriteAt=result.favoriteAt??null;}
      return result;
    }finally{clientFavoriteBusy.delete(id);}
  }
  const clientInspectionFirst = p => (Number(p.quoteCalculation?.version) === 1||p.serviceFlow==='inspection-first') && !clientDepositPaid(p);
  function clientInspectionHasReport(p){return !!p&&/^\d+(?:\.\d+)?$/.test(String(p.inspAt??''))&&Number(p.inspAt)>0;}
  function clientInspectionFailed(p){return clientInspectionHasReport(p)&&(p.insp==='ne'||p.inspChecklist?.overall==='ne');}
  function clientInspectionCompleted(p){
    if(!clientInspectionHasReport(p)||p.inspectionReviewed===false||clientInspectionFailed(p)||p.avail==='ne'||p.answer==='ne')return false;
    if(!['ok','da','oprez'].includes(p.insp)&&!['da','oprez'].includes(p.inspChecklist?.overall))return false;
    if((String(p.quoteCalculation?.version)==='1'||p.serviceFlow==='inspection-first')&&p.inspectionPaid!==true)return false;
    return true;
  }
  function clientSelectedProposal(d){
    const live=(d.proposals||[]).filter(p=>!clientProposalDeclined(p));
    return (d.car?.fromProposal?live.find(p=>p.id===d.car.fromProposal):null)||(d.car?.fromFind?live.find(p=>p.findId===d.car.fromFind):null)||live.find(p=>p.choice==='buy')||live.find(p=>p.inspectionPaid===true)||live.find(p=>p.depositPaidAt)||live.find(p=>p.answer==='zelim')||null;
  }
  function clientProposalView(d){
    const selected=clientSelectedProposal(d),all=(d.proposals||[]).slice().reverse(),suggestions=all.filter(p=>!clientProposalDeclined(p)).slice(0,5),favorites=all.filter(p=>p.favorite===true);
    const proposals=selected?[selected]:clientProposalFilter==='favorites'?favorites:suggestions;
    return {selected,proposals,count:suggestions.length,favoriteCount:favorites.length};
  }
  function clientDetailedPhase(d,st){
    if(st<0)return -1;
    if(d.listingCheck?.status==='available'&&!(d.proposals||[]).length)return 2;
    if(d.car&&d.car.status!=='pregledan')return [0,1,2,5,6,7,8,9][st];
    const p=clientSelectedProposal(d);
    if(clientInspectionCompleted(p))return p.choice==='buy'&&p.inspectionPaid===true&&clientDepositPaid(p)?5:4;
    if(d.car?.status==='pregledan'||p&&(p.plannedAt||p.inspectionPaid===true||p.inspectionScheduled===true||p.depositPaidAt||p.inspAt))return 3;
    if(p)return 2;
    return st>=1?1:0;
  }
  function clientInspectionWords(){return {
    sr:{fee:'Pregled: {fee}. Prvo plaćate pregled. Posle izveštaja odlučujete da li kupujete. Kod kupovine se pregled odbija od naše usluge.',amount:'Čeka uplatu pregleda: {fee}.',details:'Podatke za uplatu pregleda potvrđujemo u razgovoru ispod.',paid:'✓ Pregled uplaćen.',planning:'Dogovaramo termin sa prodavcem.',scheduled:'Pregled zakazan: {date}.',decision:'Bez kupovine plaćate dogovoreni pregled. Ako kupujete, pregled se odbija od naše usluge.',selected:'Izabrano vozilo. Ovde pratite njegov pregled i kupovinu.',count:'Predlozi za vaš upit: {n}. Izaberite jedno vozilo za pregled.',buy:'Odlučili ste da kupite ovo vozilo. Ugovor i uslove uplate potvrđujemo pre kupovine.'},
    de:{fee:'Prüfung: {fee}. Zuerst bezahlen Sie die Prüfung. Nach dem Bericht entscheiden Sie über den Kauf. Beim Kauf wird die Prüfung von unserer Leistung abgezogen.',amount:'Prüfungszahlung ausstehend: {fee}.',details:'Die Zahlungsangaben für die Prüfung bestätigen wir im Gespräch unten.',paid:'✓ Prüfung bezahlt.',planning:'Wir vereinbaren den Termin mit dem Verkäufer.',scheduled:'Prüfung vereinbart: {date}.',decision:'Ohne Kauf bezahlen Sie die vereinbarte Prüfung. Beim Kauf wird sie von unserer Leistung abgezogen.',selected:'Gewähltes Fahrzeug. Hier verfolgen Sie dessen Prüfung und Kauf.',count:'Vorschläge für Ihre Anfrage: {n}. Wählen Sie ein Fahrzeug zur Prüfung.',buy:'Sie haben sich für den Kauf entschieden. Vertrag und Zahlungsbedingungen bestätigen wir vor dem Kauf.'},
    en:{fee:'Inspection: {fee}. First you pay for inspection. After the report, you decide whether to buy. On purchase, inspection is credited against our service.',amount:'Awaiting inspection payment: {fee}.',details:'We confirm the inspection payment details in the conversation below.',paid:'✓ Inspection paid.',planning:'We are arranging the date with the seller.',scheduled:'Inspection scheduled: {date}.',decision:'Without purchase, you pay for the agreed inspection. On purchase, it is credited against our service.',selected:'Selected vehicle. Track its inspection and purchase here.',count:'Proposals for your request: {n}. Choose one vehicle to inspect.',buy:'You decided to buy this vehicle. We confirm the contract and payment terms before purchase.'}
  }[lang];}
  function clientInspectionFee(p){return p.inspFee!=null?num(p.inspFee)+' CHF':T().cInspDeal;}
  function clientInspectionStatus(p){
    if(!p||!clientInspectionFirst(p)||p.inspAt||p.choice||p.answer!=='zelim'||closedProposal(p))return null;
    const words=clientInspectionWords();
    if(p.avail!=='da')return followup[lang].waiting;
    if(p.inspectionPaid!==true)return words.amount.replace('{fee}',clientInspectionFee(p));
    if(p.inspectionScheduled===true&&p.plannedAt){const date=new Date(p.plannedAt);if(!Number.isNaN(date.getTime()))return words.paid+' '+words.scheduled.replace('{date}',date.toLocaleString(T().locale,{day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}));}
    return words.paid+' '+words.planning;
  }
  function clientNegativeWords(){return {sr:{negative:'Vozilo nije prošlo pregled.',stop:'Odustajem od ovog vozila',pending:'Izveštaj čeka potvrdu završnog ishoda pregleda.',unfinished:'Pregled još nije završen.'},de:{negative:'Das Fahrzeug hat die Prüfung nicht bestanden.',stop:'Dieses Fahrzeug nicht weiterverfolgen',pending:'Der Bericht wartet auf die Bestätigung des abschließenden Prüfergebnisses.',unfinished:'Die Prüfung ist noch nicht abgeschlossen.'},en:{negative:'The vehicle did not pass inspection.',stop:'Stop considering this vehicle',pending:'The report is awaiting confirmation of the final inspection result.',unfinished:'The inspection is not yet complete.'}}[lang];}
  function clientReadonlyReport(p){
    const report=window.SCInspectionReport,photos=report?.unassignedPhotos(p.inspChecklist,p.inspPhotos)||[];
    return '<p class="car-meta">'+esc(T().repT)+'</p>'+(p.inspNote?'<p style="white-space:pre-wrap">'+esc(p.inspNote)+'</p>':'')+(report?.render(p.inspChecklist,DATA?.lang||lang,{photoUrl})||'')+(photos.length?'<div class="up-photos">'+photos.map(id=>'<a href="'+esc(photoUrl(id))+'" target="_blank" rel="noopener"><img src="'+esc(photoUrl(id))+'" alt="" loading="lazy"></a>').join('')+'</div>':'');
  }

  const followup = {
    sr:{empty:'Trenutno nemamo odgovarajuću ponudu. Ponuda se menja — možemo nastaviti pretragu.',search:'Traži dalje',link:'Pošalji link auta',b2b:'Zatraži proveru B2B ponude',history:'Istorija predloga',note:'Šta želite drugačije? (nije obavezno)',url:'Link oglasa',send:'Pošalji',cancel:'Odustani',saved:'Zahtev je primljen. Pratite odgovor u razgovoru ispod.',how:['Pošaljemo predloge sa procenom ukupne cene.','Izaberete auto. Potvrdimo dostupnost i uslove uplate.','Posle pregleda odlučujete da li kupujete.'],included:'Auto, prevoz, PDV i naša usluga {com} CHF.',risk:'Bez kupovine plaćate pregled. Kod kupovine se odbija od paketa.',waiting:'Proveravamo dostupnost.'},
    de:{empty:'Aktuell gibt es kein passendes Angebot. Das Angebot ändert sich — wir können weitersuchen.',search:'Weitersuchen',link:'Inseratslink senden',b2b:'B2B-Angebot anfragen',history:'Vorschlagsverlauf',note:'Was möchten Sie ändern? (optional)',url:'Inseratslink',send:'Senden',cancel:'Abbrechen',saved:'Anfrage erhalten. Verfolgen Sie die Antwort im Gespräch unten.',how:['Sie erhalten Vorschläge mit geschätztem Gesamtpreis.','Sie wählen ein Auto. Wir bestätigen Verfügbarkeit und Zahlungsbedingungen.','Nach der Prüfung entscheiden Sie über den Kauf.'],included:'Auto, Transport, MwSt. und unsere Leistung {com} CHF.',risk:'Ohne Kauf zahlen Sie die Prüfung. Beim Kauf wird sie angerechnet.',waiting:'Wir prüfen die Verfügbarkeit.'},
    en:{empty:'There is currently no suitable offer. Offers change — we can keep searching.',search:'Keep searching',link:'Send a listing link',b2b:'Request a B2B offer check',history:'Proposal history',note:'What would you like to change? (optional)',url:'Listing link',send:'Send',cancel:'Cancel',saved:'Request received. Follow the reply in the conversation below.',how:['You receive proposals with an estimated total price.','Choose a car. We confirm availability and payment terms.','After inspection, you decide whether to buy.'],included:'Car, transport, VAT and our service {com} CHF.',risk:'Without purchase, you pay for inspection. On purchase, it is credited.',waiting:'Checking availability.'}
  };
  const L = {
    sr: { kicker: "Vaš upit", title: "Vaš upit za {model}", lead: "Ovde pratite status upita, svoje uslove i predloge vozila.",
      track: ["Primljeno", "Tražimo", "Kapara i pregled", "Kupljeno", "Transport", "Carina", "Priprema", "Predato"],
      now: ["Primili smo vaš upit. Javićemo vam se sa predlozima u roku od 24 sata.", "Tražimo auto u Švajcarskoj koje odgovara vašim željama. Predloge dobijate u roku od 24 sata.", "Imamo predlog za vas. Pogledajte ispod i javite nam da li vam odgovara.", "Auto je kupljeno za vas u Švajcarskoj.", "Auto je na putu za Srbiju.", "Auto je na carini u Srbiji.", "Auto se priprema: servis, provera i pranje.", "Auto je predato. Hvala na poverenju i srećna vožnja!"],
      ready: "Auto je spremno za preuzimanje.", aiYes: "Prva provera tržišta ({d}): u Švajcarskoj smo našli {n} vozila koja bi mogla da odgovaraju vašem budžetu. Predloge šaljemo ovde i na vaš email.", aiNo: "Prva provera tržišta ({d}): trenutno nema vozila koja odgovaraju budžetu. Pratimo tržište i javljamo vam se čim se pojavi nešto dobro.", closed: "Ovaj upit je zatvoren. Ako i dalje tražite auto, javite nam se.",
      req: { model: "Tražite", brand: "Marka", yearFrom: "Godište od", fuel: "Gorivo", body: "Karoserija", drive: "Pogon", color: "Boja", budget: "Budžet", mileage: "Kilometraža", gearbox: "Menjač", equip: "Oprema", when: "Kada vam treba auto", city: "Grad", note: "Vaše napomene", created: "Upit poslat" }, any: "Svejedno", notSpecified: "Nije navedeno",
      how: ["Navedete budžet i uslove. Naš tim traži odgovarajuća vozila i ovde prikazuje predloge, linkove na oglase i procenu ukupne cene u Srbiji, sa troškovima vozila, usluge, transporta, carine i poreza.","Kada izaberete predlog, prvo proveravamo kod prodavca da li je auto dostupan. Pre uplate potvrđujemo ponudu, obim usluge, cenu pregleda i uslove kapare ili avansa. Tačan iznos vidite uz konkretan predlog.","Posle dogovora i potvrđene uplate naš tim pregleda vozilo i dokumentaciju dostupnu kod prodavca. Na svom upitu dobijate pisani izveštaj i fotografije, uključujući uočene nedostatke.","Na osnovu izveštaja odlučujete da li kupujete. Ako odustanete posle pregleda, povrat uplaćenog iznosa umanjuje se za unapred dogovoreni trošak pregleda; iznos povrata prikazan je uz predlog.","Ako kupujete, organizujemo kupovinu, dokumentaciju, transport, carinjenje i završnu proveru pre predaje, prema dogovorenoj ponudi. Status i naredni korak pratite ovde. Registraciju na vaše ime možete posebno dogovoriti.","Za auto koji ste sami pronašli postoji zaseban paket rada u Švajcarskoj po ceni {swissPackage}, uz uračunat prethodno plaćeni pregled. Cena auta, međunarodni transport, carina, porezi i registracija obračunavaju se posebno. Potraga prema budžetu ima pojedinačnu ponudu.","Pitanja, dopune i dogovore pišite u razgovoru ispod. Klijent i tim vide istu istoriju poruka, sa pošiljaocem, datumom i vremenom."], howT: "Kako radimo",
      aZanima: "Zanima me – pošaljite slike", aNe: "Ne zanima me", aZelim: "Želim ovo auto", aNeHvala: "Ne, hvala", aRefund: "Vratite mi kaparu", aContinue: "Tražite drugo auto",
      sZanima: "✓ Šaljemo vam slike i opis ovog auta, obično istog dana.", sNe: "Rekli ste da vas ne zanima. Tražimo dalje.", adT: "Iz oglasa", zelimHint: "Kapara: {d} € ({p}% cene). Ostatak plaćate kad auto stigne.",
      sZelim: "Izabrali ste ovo auto. Molimo uplatite kaparu od {d} €.", payT: "Podaci za uplatu", payNone: "Podatke za uplatu naći ćete u ugovoru.", payNext: "Čim kapara legne, naš tim ide na pregled auta.",
      sPaid: "✓ Kapara od {d} € je primljena.", sInsp: "Auto nije prošlo pregled:", sInspQ: "Izaberite šta želite:",
      sRefund: "Kapara od {d} € vam se vraća.", sRefunded: "✓ Kapara od {d} € je vraćena.", sContinue: "Tražimo drugo auto za vas, kapara ostaje za sledeće.",
      nowZanima: "Pripremamo slike i opis auta koje vas zanima.", nowPhotos: "Slike i opis su spremni. Pogledajte ispod i javite da li želite auto.", nowDep: "Čekamo vašu kaparu, zatim naš tim pregleda auto.", nowInsp: "Pregled auta je zakazan. Čekamo izveštaj sa slikama.", nowFail: "Auto nije prošlo pregled. Izaberite ispod šta dalje.",
      cAd: "Pogledaj oglas ↗", cEst: "Ukupno sa uvozom u Srbiju", cEstSub: "auto {chf} CHF + prevoz, carina i PDV + naša provizija {com} CHF", cInsp: "Pregled na licu mesta: {fee}", cInspDist: "~{d} km od St. Gallena", cInspDeal: "po dogovoru",
      aPregled: "Želim pregled ovog auta", pregHint: "Kapara {d} € ({p}%). Ako posle pregleda ne kupite, vraćamo {r} €.", avansW: "Avans", avansHint: "Za ovo auto plaća se avans od 50% umesto kapare od 10%. Ako posle pregleda ne kupite, avans vam vraćamo umanjen samo za trošak pregleda.",
      sZelim2: "Auto je dostupno. Molimo uplatite kaparu od {d} €.", sCheck: "Hvala! Proveravamo kod prodavca da li je auto još dostupno. Čim potvrdi, šaljemo vam podatke za uplatu.", sUnavail: "Nažalost, ovo auto više nije dostupno. Tražimo drugo i šaljemo vam nove predloge.", nowCheck: "Proveravamo dostupnost, poreklo i povrat švajcarskog PDV-a.", payNext2: "Čim kapara legne, naš tim ide na pregled.", sPaid2: "✓ Kapara od {d} € je primljena. Pregled auta je u toku.",
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
      sZelim: "Sie haben dieses Auto gewählt. Bitte überweisen Sie die Anzahlung von {d} €.", payT: "Zahlungsangaben", payNone: "Die Zahlungsangaben finden Sie im Vertrag.", payNext: "Sobald die Anzahlung eingegangen ist, prüft unser Team das Auto.",
      sPaid: "✓ Anzahlung von {d} € erhalten. Unser Team prüft das Auto, Sie erhalten das Ergebnis per Nachricht.", sInsp: "Das Auto hat die Prüfung nicht bestanden:", sInspQ: "Bitte wählen Sie:",
      sRefund: "Die Anzahlung von {d} € wird zurückgezahlt.", sRefunded: "✓ Die Anzahlung von {d} € wurde zurückgezahlt.", sContinue: "Wir suchen ein anderes Auto für Sie, die Anzahlung bleibt bestehen.",
      nowZanima: "Wir bereiten Fotos und Beschreibung des Autos vor, das Sie interessiert.", nowPhotos: "Fotos und Beschreibung sind bereit. Sehen Sie unten nach und sagen Sie uns, ob Sie das Auto möchten.", nowDep: "Wir warten auf Ihren unterschriebenen Vertrag und Ihre Anzahlung, danach prüft unser Team das Auto.", nowInsp: "Anzahlung erhalten, die Prüfung des Autos läuft.", nowFail: "Das Auto hat die Prüfung nicht bestanden. Bitte wählen Sie unten, wie es weitergeht.",
      cAd: "Inserat ansehen ↗", cEst: "Gesamtpreis inklusive Import nach Serbien", cEstSub: "Auto {chf} CHF + Transport, Zoll und MwSt. + unsere Provision {com} CHF", cInsp: "Prüfung vor Ort: {fee}", cInspDist: "~{d} km ab St. Gallen", cInspDeal: "nach Absprache",
      aPregled: "Prüfung gewünscht", pregHint: "Anzahlung {d} € ({p} %). Kaufen Sie nach der Prüfung nicht, zahlen wir {r} € zurück.", avansW: "Vorauszahlung", avansHint: "Für dieses Auto gilt eine Vorauszahlung von 50 % statt 10 % Anzahlung. Kaufen Sie nach der Prüfung nicht, zahlen wir sie abzüglich der Prüfkosten zurück.",
      sZelim2: "Das Auto ist verfügbar. Bitte überweisen Sie die Anzahlung von {d} €.", sCheck: "Danke! Wir fragen beim Verkäufer nach, ob das Auto noch verfügbar ist. Sobald er bestätigt, senden wir Ihnen die Zahlungsangaben.", sUnavail: "Leider ist dieses Auto nicht mehr verfügbar. Wir suchen ein anderes und senden Ihnen neue Vorschläge.", nowCheck: "Wir prüfen Verfügbarkeit, Herkunft und die Rückerstattung der Schweizer MwSt.", payNext2: "Sobald die Anzahlung eingegangen ist, fährt unser Team zur Prüfung.", sPaid2: "✓ Anzahlung von {d} € erhalten. Die Prüfung läuft.",
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
      sZelim: "You chose this car. Please pay the deposit of {d} €.", payT: "Payment details", payNone: "You will find the payment details in the contract.", payNext: "As soon as the deposit arrives, our team inspects the car.",
      sPaid: "✓ Deposit of {d} € received. Our person is inspecting the car and you will be notified of the result.", sInsp: "The car did not pass inspection:", sInspQ: "Please choose:",
      sRefund: "Your deposit of {d} € is being refunded.", sRefunded: "✓ Your deposit of {d} € has been refunded.", sContinue: "We are looking for another car for you, the deposit stays for it.",
      nowZanima: "We are preparing photos and a description of the car you are interested in.", nowPhotos: "Photos and description are ready. Look below and tell us if you want the car.", nowDep: "We are waiting for your signed contract and deposit, then our team inspects the car.", nowInsp: "Deposit received, the car inspection is in progress.", nowFail: "The car did not pass inspection. Please choose below what happens next.",
      cAd: "View listing ↗", cEst: "Total including import to Serbia", cEstSub: "car {chf} CHF + transport, customs and VAT + our commission {com} CHF", cInsp: "On-site inspection: {fee}", cInspDist: "~{d} km from St. Gallen", cInspDeal: "by arrangement",
      aPregled: "I want an inspection", pregHint: "Deposit {d} € ({p}%). If you don't buy after the inspection, we refund {r} €.", avansW: "Advance", avansHint: "For this car a 50% advance applies instead of the 10% deposit. If you don't buy after the inspection, we refund it minus the inspection cost.",
      sZelim2: "The car is available. Please pay the deposit of {d} €.", sCheck: "Thank you! We are checking with the seller that the car is still available. As soon as he confirms, we send you the payment details.", sUnavail: "Unfortunately this car is no longer available. We are looking for another one and will send you new proposals.", nowCheck: "We are checking availability, origin and the Swiss VAT refund.", payNext2: "As soon as the deposit arrives, our team goes to inspect the car.", sPaid2: "✓ Deposit of {d} € received. The inspection is in progress.",
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
  const stage = d => SCOrderProgress.stage(d);
  let clientQuoteFx=null;
  const quoteWords=()=>({
    sr:{title:'Računica za ovaj auto',current:'Procena sa uvozom u Srbiju',saved:'Ranije sačuvana procena',agreed:'Dogovorena cena',difference:'Razlika prema sačuvanoj proceni',car:'Vozilo',transport:'Prevoz',export:'Izvozna dokumentacija',eco:'Ekološka naknada (procena)',testing:'AMSS i ispitivanje (procena)',duty:'Carina',vat:'PDV pri uvozu 20%',service:'Naša usluga',total:'Procena ukupno',refundYes:'Povrat CH PDV-a je potvrđen. CH PDV je odbijen iz cene vozila.',refundNo:'CH PDV se ne vraća. Računamo punu cenu oglasa.',refundUnknown:'Povrat CH PDV-a nije potvrđen. Računamo punu cenu oglasa.',originYes:'Dokaz o poreklu je potvrđen: carina 0%.',originNo:'Preferencijalno poreklo nije potvrđeno: u proceni je carina 12,5%.',originUnknown:'Dokaz o poreklu još nije proveren: u proceni je carina 12,5%.',rate:'Kurs ECB',note:'Procena prati potvrđene provere, troškove i kurs. Postojeći dogovor, ugovor i uplate ostaju u evidenciji.',unavailable:'Trenutna računica nije dostupna. Prikazana je sačuvana cena.',refresh:'Osveži računicu',updated:'Poslednja provera'},
    de:{title:'Berechnung für dieses Fahrzeug',current:'Schätzung inklusive Import nach Serbien',saved:'Früher gespeicherte Schätzung',agreed:'Vereinbarter Preis',difference:'Abweichung zur gespeicherten Schätzung',car:'Fahrzeug',transport:'Transport',export:'Ausfuhrdokumente',eco:'Umweltabgabe (Schätzung)',testing:'AMSS und Prüfung (Schätzung)',duty:'Zoll',vat:'Einfuhr-MwSt. 20%',service:'Unsere Leistung',total:'Geschätzter Gesamtpreis',refundYes:'Erstattung der CH-MwSt. bestätigt. Sie wurde vom Fahrzeugpreis abgezogen.',refundNo:'Keine Erstattung der CH-MwSt. Der volle Inseratspreis wird verwendet.',refundUnknown:'Erstattung der CH-MwSt. nicht bestätigt. Der volle Inseratspreis wird verwendet.',originYes:'Ursprungsnachweis bestätigt: 0% Zoll.',originNo:'Präferenzursprung nicht bestätigt: 12,5% Zoll in der Schätzung.',originUnknown:'Ursprungsnachweis noch nicht geprüft: 12,5% Zoll in der Schätzung.',rate:'EZB-Kurs',note:'Die Schätzung folgt bestätigten Prüfungen, Kosten und Wechselkurs. Bestehende Vereinbarungen, Verträge und Zahlungen bleiben dokumentiert.',unavailable:'Aktuelle Berechnung nicht verfügbar. Der gespeicherte Preis wird angezeigt.',refresh:'Berechnung aktualisieren',updated:'Letzte Prüfung'},
    en:{title:'Calculation for this vehicle',current:'Estimate including import to Serbia',saved:'Previously saved estimate',agreed:'Agreed price',difference:'Difference from saved estimate',car:'Vehicle',transport:'Transport',export:'Export documents',eco:'Environmental fee (estimate)',testing:'AMSS and testing (estimate)',duty:'Customs duty',vat:'Import VAT 20%',service:'Our service',total:'Estimated total',refundYes:'Swiss VAT refund is confirmed and deducted from the vehicle price.',refundNo:'Swiss VAT is not refundable. The full listing price is used.',refundUnknown:'Swiss VAT refund is not confirmed. The full listing price is used.',originYes:'Proof of origin confirmed: 0% customs duty.',originNo:'Preferential origin is not confirmed: the estimate includes 12.5% customs duty.',originUnknown:'Proof of origin has not been checked: the estimate includes 12.5% customs duty.',rate:'ECB exchange rate',note:'The estimate follows confirmed checks, costs and exchange rates. Existing agreements, contracts and payments remain recorded.',unavailable:'The current calculation is unavailable. The saved price is shown.',refresh:'Refresh calculation',updated:'Last check'}
  }[lang]);
  const quoteMoney=n=>Number(n).toLocaleString(T().locale,{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
  function clientCurrentQuote(p){try{return window.SCOrderQuote.calculate(p,DATA.quoteSettings,clientQuoteFx);}catch{return null;}}
  function clientQuoteMarkup(p,d){
    const w=quoteWords(),q=clientCurrentQuote(p),saved=Number(p.price),carPrice=d.car?.price;
    let html='<section class="up-current-quote"><h4>'+esc(w.title)+'</h4><p class="car-meta">'+esc(p.title)+(p.year?' · '+esc(p.year):'')+'</p>';
    if(!q)return html+'<p class="car-meta">'+esc(w.unavailable)+'</p><button class="btn btn-outline" type="button" data-refresh-quote>'+esc(w.refresh)+'</button><p role="status" data-quote-refresh-status></p></section>';
    const rows=[[w.car+' · '+num(p.adChf)+' CHF',q.quote.car],[w.transport,q.quote.costs.transport],[w.export,q.quote.costs.export],[w.eco,q.quote.costs.eco],[w.testing,q.quote.costs.testing],[w.duty+' '+q.scenario.dutyPct+'%',q.scenario.duty],[w.vat,q.scenario.vat],[w.service+' '+num(q.fee)+' CHF',q.service],[w.total,q.total]];
    html+='<p class="car-meta">'+esc(p.chVatRefundVerified===true?w.refundYes:p.chVatRefundVerified===false?w.refundNo:w.refundUnknown)+'</p><p class="car-meta">'+esc(p.originProofVerified===true?w.originYes:p.originProofVerified===false?w.originNo:w.originUnknown)+'</p><dl class="up-quote-lines">'+rows.map(([label,value],i)=>'<dt'+(i===rows.length-1?' class="up-quote-total"':'')+'>'+esc(label)+'</dt><dd'+(i===rows.length-1?' class="up-quote-total"':'')+'>'+esc(quoteMoney(value))+'</dd>').join('')+'</dl>';
    if(saved>0)html+='<p class="car-meta">'+esc(w.saved)+': '+esc(quoteMoney(saved))+' · '+esc(w.difference)+': '+(q.total-saved>0?'+':'')+esc(quoteMoney(q.total-saved))+'</p>';
    if(carPrice)html+='<p class="car-meta">'+esc(w.agreed)+': '+esc(quoteMoney(carPrice))+'</p>';
    html+='<p class="car-meta">'+esc(w.rate)+' '+esc(clientQuoteFx.asOf)+': 1 CHF = '+esc(String(q.base.rate))+' €.</p><p class="car-meta">'+esc(w.note)+'</p>';
    const changed=[p.changeDates?.chVatRefundVerified,p.changeDates?.originProofVerified,p.checksUpdatedAt].map(SCOrderProgress.dateValue).filter(Boolean).sort((a,b)=>b-a)[0];
    if(changed)html+='<p class="car-meta">'+esc(w.updated)+': '+esc(changed.toLocaleString(T().locale,{timeZone:'Europe/Belgrade'}))+'</p>';
    return html+'<button class="btn btn-outline" type="button" data-refresh-quote>'+esc(w.refresh)+'</button><p role="status" data-quote-refresh-status></p></section>';
  }

  function clientVerificationInfo(d){
    const v=d.listingVehicle||{},q=d.listingQuote?.result,origin=v.originProofVerified===true,vat=v.chVatRefundVerified===true;
    const w={sr:{heading:'Provereno za ovaj auto',origin:'EUR.1 / dokaz porekla',vat:'Švajcarski PDV',confirmed:'Potvrđeno',unknown:'Nije provereno',noProof:'Nema dokaza',noRefund:'Povrat nije moguć',duty0:'Carina 0% je uračunata.',dutyFull:'Uračunata je carina 12,5%.',refund:'Uračunat odbitak',noDeduction:'Obračun je bez odbitka CH PDV-a.'},de:{heading:'Prüfstatus dieses Fahrzeugs',origin:'EUR.1 / Ursprungsnachweis',vat:'Schweizer MwSt.',confirmed:'Bestätigt',unknown:'Noch nicht geprüft',noProof:'Kein Nachweis',noRefund:'Keine Erstattung möglich',duty0:'0% Zoll berücksichtigt.',dutyFull:'12,5% Zoll berücksichtigt.',refund:'Berücksichtigter Abzug',noDeduction:'Ohne Schweizer MwSt.-Abzug berechnet.'},en:{heading:'Checks for this car',origin:'EUR.1 / proof of origin',vat:'Swiss VAT',confirmed:'Confirmed',unknown:'Not yet checked',noProof:'No proof available',noRefund:'Refund not available',duty0:'0% duty included in calculation.',dutyFull:'12.5% duty included in calculation.',refund:'Deduction applied',noDeduction:'Calculated without a Swiss VAT deduction.'}}[lang];
    const deduction=q?Number(q.chVatDeductionChf).toLocaleString(T().locale,{minimumFractionDigits:2,maximumFractionDigits:2})+' CHF':'';
    return '<section class="client-verification-section"><h3>'+esc(w.heading)+'</h3><div class="client-verification-grid"><div class="'+(origin?'is-confirmed':'')+'"><span>'+esc(w.origin)+'</span><strong>'+esc(origin?w.confirmed:v.origin==='no'?w.noProof:w.unknown)+'</strong><small>'+esc(origin?w.duty0:w.dutyFull)+'</small></div><div class="'+(vat?'is-confirmed':'')+'"><span>'+esc(w.vat)+'</span><strong>'+esc(vat?w.confirmed:v.vat==='no'?w.noRefund:w.unknown)+'</strong><small>'+esc(vat?w.refund+' '+deduction:w.noDeduction)+'</small></div></div></section>';
  }
  function clientPackageInfo(d,isOpen){
    const r=d.listingQuote?.result;if(!r)return '';const q=r.quote,a=r.scenario;
    const words={sr:{summary:'Šta je uključeno u cenu i paket?',title:'SWISCARS paket',items:['Pregled auta i izveštaj sa fotografijama.','Provera dokumenata i dokaza porekla, npr. EUR.1.','Provera mogućnosti povraćaja CH PDV-a kod prodavca.','Organizacija kupovine i uvoza.'],benefit:'Prihvaćen dokaz porekla može omogućiti carinu 0% umesto 12,5%. Povrat CH PDV-a zavisi od prodavca i ispunjenih uslova izvoza.',credit:'Plaćeni pregled se uračunava u paket — ne plaća se dvaput.',costs:'Stavke ove procene',labels:['Vozilo','Transport','Izvozna dokumenta','Eko naknada','Špediter','AMSS i takse','Ostalo','Carina','Srpski PDV 20%','SWISCARS paket']},de:{summary:'Was enthalten Preis und Paket?',title:'SWISCARS Paket',items:['Fahrzeugprüfung mit Bericht und Fotos.','Prüfung der Unterlagen und des Ursprungsnachweises, z. B. EUR.1.','Abklärung einer möglichen Schweizer MwSt.-Erstattung mit dem Verkäufer.','Organisation von Kauf und Import.'],benefit:'Ein anerkannter Präferenznachweis kann 0% statt 12,5% Zoll ermöglichen. Die Schweizer MwSt.-Erstattung hängt vom Verkäufer und den erfüllten Ausfuhrbedingungen ab.',credit:'Die bezahlte Prüfung wird auf das Paket angerechnet, nicht doppelt berechnet.',costs:'Positionen dieser Schätzung',labels:['Fahrzeug','Transport','Ausfuhrdokumente','Umweltabgabe','Zollabwicklung','Prüfung und Gebühren','Sonstiges','Zoll','Serbische MwSt. 20%','SWISCARS Paket']},en:{summary:'What do the price and package include?',title:'SWISCARS package',items:['Vehicle inspection with a report and photos.','Checking documents and proof of origin, such as EUR.1.','Checking possible Swiss VAT refund eligibility with the seller.','Organising the purchase and import.'],benefit:'Accepted preferential proof of origin may allow 0% instead of 12.5% duty. Swiss VAT refunds depend on the seller and export requirements being met.',credit:'Paid inspection is credited to the package, not charged twice.',costs:'Items in this estimate',labels:['Vehicle','Transport','Export documents','Environmental fee','Customs broker','Inspection and fees','Other','Duty','Serbian VAT 20%','SWISCARS package']}}[lang];
    const values=[q.car,q.costs.transport,q.costs.export,q.costs.eco,q.costs.broker,q.costs.testing,q.costs.other,a.duty,a.vat,r.serviceEur],money=n=>Number(n).toLocaleString(T().locale,{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
    const headings={sr:{services:'Šta radimo za vas',benefits:'Moguće uštede'},de:{services:'Unsere Leistungen',benefits:'Mögliche Einsparungen'},en:{services:'What we do for you',benefits:'Potential savings'}}[lang];
    return '<details class="client-package-info" data-package-info'+(isOpen?' open':'')+'><summary>'+esc(words.summary)+'</summary><div><section class="package-info-part"><h3>'+esc(headings.services)+'</h3><ul>'+words.items.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul></section><section class="package-info-part"><h3>'+esc(r.chVatDeductionChf>0&&a.dutyPct===0?({sr:'Uračunate pogodnosti',de:'Berücksichtigte Vorteile',en:'Benefits applied'})[lang]:headings.benefits)+'</h3><p>'+esc(r.chVatDeductionChf>0&&a.dutyPct===0?({sr:'U ovu procenu već su uračunati carina 0% po potvrđenom dokazu porekla i odbitak CH PDV-a koji je prodavac potvrdio.',de:'Diese Schätzung berücksichtigt bereits 0% Zoll aufgrund des bestätigten Ursprungsnachweises sowie den vom Verkäufer bestätigten Schweizer MwSt.-Abzug.',en:'This estimate already applies 0% duty based on confirmed proof of origin and the Swiss VAT deduction confirmed by the seller.'})[lang]:words.benefit)+'</p><p class="package-credit-note">'+esc(words.credit)+'</p></section><section class="package-info-part"><h3>'+esc(words.costs)+'</h3><dl>'+values.map((value,i)=>'<dt>'+esc(words.labels[i]+(i===7?' '+String(a.dutyPct).replace('.',',')+'%':''))+'</dt><dd>'+esc(money(value))+'</dd>').join('')+'</dl></section></div></details>';

  }
  function render() {
    const openQuotes=new Set([...document.querySelectorAll("[data-client-quote][open]")].map(el=>el.dataset.clientQuote));
    const t = T(), d = DATA,packageInfoOpen=$('u_listing')?.querySelector('[data-package-info]')?.open===true;
    document.documentElement.lang = lang;
    $("u_kicker").textContent = t.kicker;
    if (!d) {
      $("u_title").textContent = t.kicker; $("u_lead").textContent = "";
      $("u_err").hidden = false; $("u_body").hidden = true;
      $("u_errT").textContent = t.e404T; $("u_errP").textContent = t.e404P; $("u_errB").textContent = t.eBtn;
      return;
    }
    $("u_err").hidden = true; $("u_body").hidden = false;document.body.classList.toggle("purchase-archived",d.status==='arhiva');
    let scenario=$('u_preview_scenario');
    if(d.previewScenario){if(!scenario){scenario=document.createElement('p');scenario.id='u_preview_scenario';scenario.style.cssText='padding:12px 16px;background:#edf4f8;color:#315d7d;border-radius:8px;margin-bottom:20px';$('u_body').prepend(scenario);}scenario.textContent=({sr:'Lokalni probni tok · nalaz i fotografije služe za demonstraciju. Nema stvarne kupovine ni nove uplate.',de:'Lokales Beispiel · Prüfung und Kaufentscheidung sind simuliert. Kein tatsächlicher Kauf oder neue Zahlung.',en:'Local example · inspection and purchase decision are simulated. No actual purchase or new payment.'})[lang];}
    $("u_title").textContent = d.model ? t.title.replace("{model}", d.model) : t.kicker;
    if (window.scSaveUpit) window.scSaveUpit(token, { model: d.model, created: d.created });
    const inspectionOffer=(d.proposals||[]).find(p=>p.serviceFlow==='inspection-first'&&!p.answer),proposalView=clientProposalView(d),entry=SCPurchaseFlow.request(d),flowWords=SCPurchaseFlow.text(lang),listingEntry=entry.kind==='listing';
    const inlineInspection=listingEntry?(inspectionOffer||(proposalView.selected?.serviceFlow==='inspection-first'&&!proposalView.selected.inspAt&&!proposalView.selected.choice?proposalView.selected:null)):null;
    $("u_kicker").textContent=flowWords.kicker;$("u_title").textContent=flowWords.title;
    $("u_lead").textContent = inspectionOffer?({sr:'Pregled auta iz vašeg oglasa.',de:'Prüfung des Fahrzeugs aus Ihrem Inserat.',en:'Inspection of the car in your listing.'})[lang]:proposalView.selected?clientInspectionWords().selected:proposalView.count?clientInspectionWords().count.replace('{n}',num(proposalView.count)):listingEntry?flowWords.listingLead:flowWords.searchLead;
    document.body.classList.toggle('up-selected-order',!!proposalView.selected||!!d.car);
    $("u_flow_label").textContent=flowWords.flow;
    let vehicleLabel=$('u_flow_vehicle');if(!vehicleLabel){vehicleLabel=document.createElement('span');vehicleLabel.id='u_flow_vehicle';$('u_flow_label').after(vehicleLabel);}vehicleLabel.textContent=proposalView.selected?.title||d.listingVehicle?.title||d.car?.model||'';
    const st = stage(d);
    $("u_track").classList.add("sc-order-progress");
    const detailedStep=clientDetailedPhase(d,st),stageDates=SCOrderProgress.dates(d,d.car,proposalView.selected),progress=SCClientProgress.state(d),progressTerms=lang==='de'?{done:'Abgeschlossen',now:'Aktuell',next:'Danach',later:'Noch offen'}:lang==='en'?{done:'Done',now:'Current',next:'Next',later:'Pending'}:undefined;
    const packageDecision=proposalView.selected?.choice==='buy'&&clientInspectionFirst(proposalView.selected)&&!d.car;
    if(packageDecision&&proposalView.selected.serviceMode!=='package')progress.current=2;
    $('u_track').innerHTML=SCOrderProgress.markup(progress.current,SCClientProgress.labels(lang,listingEntry),progressTerms);
    $('u_track').closest('.purchase-progress').hidden=progress.current<0;
    const PS = proposalView.proposals;
    const inspectedProposal=proposalView.selected;
    const inspectionStatus=!d.car&&(inspectedProposal?.inspAt&&!clientInspectionCompleted(inspectedProposal)&&!clientInspectionFailed(inspectedProposal)?clientNegativeWords().pending:inspectedProposal?.choice==='buy'&&!clientInspectionCompleted(inspectedProposal)?clientNegativeWords().unfinished:clientInspectionStatus(inspectedProposal));
    const act = !d.car && st >= 0 ? (PS.find(p => p.choice === "buy" && clientInspectionCompleted(p)) ? t.nowBuy : PS.find(p => clientInspectionCompleted(p) && !p.choice) ? t.nowRep : PS.find(p => clientInspectionFailed(p) && !p.choice) ? t.nowFail : PS.find(p => p.plannedAt && !p.inspAt) ? t.nowInsp : PS.find(p => p.answer === "zelim" && !p.availAt && p.avail !== "ne") ? t.nowCheck : PS.find(p => p.answer === "zelim" && !p.depositPaidAt && p.avail !== "ne") ? t.nowDep : PS.find(p => p.answer === "zanima" && p.photosAt) ? t.nowPhotos : PS.find(p => p.answer === "zanima") ? t.nowZanima : "") : "";
    const depositProposal=PS.find(p=>clientInspectionCompleted(p)&&!p.depositPaidAt&&p.avail!=='ne'&&(!clientInspectionFirst(p)||p.choice==='buy'&&p.serviceMode==='package'))||null;
    const depositStatus=depositProposal? (lang==='de'?'Wir warten auf Ihre Anzahlung'+(depositProposal.deposit?' von '+num(depositProposal.deposit)+' €':'')+'. Die Zahlungsangaben finden Sie im Vertrag.':lang==='en'?'We are waiting for your deposit'+(depositProposal.deposit?' of '+num(depositProposal.deposit)+' €':'')+'. You will find the payment details in the contract.':'Čekamo vaš potpisan ugovor i uplatu kapare'+(depositProposal.deposit?' od '+num(depositProposal.deposit)+' €':'')+'. Podatke za uplatu naći ćete u ugovoru.'):null;
    const paidPending=proposalView.selected&&clientDepositPaid(proposalView.selected)&&!clientInspectionCompleted(proposalView.selected)&&!clientInspectionFailed(proposalView.selected)&&!d.car?(lang==='de'?'Anzahlung eingegangen. Die Prüfung ist noch nicht abgeschlossen.':lang==='en'?'Deposit received. The inspection is not yet complete.':'Kapara je primljena. Pregled još nije završen.'):null;
    const inactiveWords={sr:{title:'Oglas nije dostupan',body:'Poslati oglas je uklonjen sa portala.',next:'Za drugi auto pošaljite novi upit sa novim linkom.'},de:{title:'Inserat nicht verfügbar',body:'Das gesendete Inserat wurde vom Portal entfernt.',next:'Senden Sie ein anderes Inserat oder vereinbaren Sie die weitere Suche im Gespräch unten.'},en:{title:'Listing unavailable',body:'Your submitted listing has been removed from the marketplace.',next:'Send another listing or agree the next search with the team in the conversation below.'}}[lang];
    const availableWords={sr:{title:'Auto je dostupan',body:'Tim je potvrdio dostupnost auta.',next:'Proveravamo poreklo i CH PDV, zatim šaljemo procenu troškova i ponudu pregleda.'},de:{title:'Fahrzeug verfügbar',body:'Das Team hat die Verfügbarkeit bestätigt.',next:'Wir bereiten die Gesamtkostenschätzung und das Prüfangebot vor.'},en:{title:'Car available',body:'The team has confirmed the car’s availability.',next:'We are preparing estimated total costs and an inspection quote.'}}[lang];
    const statusText=packageDecision?({sr:proposalView.selected.serviceMode==='package'?(clientDepositPaid(proposalView.selected)?'Kapara je primljena. Tim može da pokrene kupovinu.':'Auto i paket su izabrani. Čekamo kaparu; kupovina počinje tek kada tim potvrdi njen prijem.'):'Izabrali ste auto. Potvrdite odluku o kupovini uz SWISCARS paket.',de:proposalView.selected.serviceMode==='package'?(clientDepositPaid(proposalView.selected)?'Anzahlung eingegangen. Das Team kann den Kauf starten.':'Fahrzeug und Paket gewählt. Der Kauf beginnt erst nach bestätigtem Eingang der Anzahlung.'):'Fahrzeug gewählt. Sie können jetzt das SWISCARS Paket bestätigen.',en:proposalView.selected.serviceMode==='package'?(clientDepositPaid(proposalView.selected)?'Deposit received. The team can start the purchase.':'Car and package selected. Purchase starts only after the team confirms receipt of the deposit.'):'Car selected. You can now confirm the SWISCARS package.'})[lang]:inspectionOffer?({sr:'Možete zakazati pregled ovog auta.',de:'Sie können die Prüfung dieses Fahrzeugs anfragen.',en:'You can request an inspection for this car.'})[lang]:entry.available?availableWords.body:entry.inactive?inactiveWords.body:entry.pending?(listingEntry?(st===0?flowWords.listingReceived:flowWords.listingChecking):(st===0?flowWords.searchReceived:flowWords.searchChecking)):st < 0 ? ({sr:"Potražilac odustao. Upit je zatvoren.",de:"Anfrage zurückgezogen. Die Anfrage ist geschlossen.",en:"Request withdrawn. This request is closed."})[lang] : inspectionStatus || paidPending || depositStatus || ( (act===t.nowDep?(lang==="sr"?"Proveravamo vozilo i dogovaramo pregled. Posle pregleda dobijate izveštaj sa slikama.":t.nowCheck):act) || (d.car && d.car.status === "prodaja" && st === 6 ? t.ready : t.now[st]));
    const statusEvent=progress.latestAt||d.listingCheck?.at||stageDates[detailedStep] || (inspectionStatus?(proposalView.selected?.inspectionPaidAt||proposalView.selected?.availAt||proposalView.selected?.answeredAt):act===t.nowBuy?PS.find(p=>p.choice==='buy')?.choiceAt:act===t.nowRep||act===t.nowFail?PS.find(p=>p.inspAt)?.inspAt:act===t.nowInsp?PS.find(p=>p.depositPaidAt)?.depositPaidAt:act===t.nowDep?PS.find(p=>p.answer==='zelim'&&!p.depositPaidAt&&p.avail!=='ne')?.availAt:act===t.nowPhotos?PS.find(p=>p.answer==='zanima'&&p.photosAt)?.photosAt:d.statusChangedAt||d.car?.statusChangedAt);
    const eventDate=statusEvent?new Date(Number(statusEvent)||statusEvent):null;
    const statusLabel=entry.available?availableWords.title:entry.inactive?inactiveWords.title:entry.pending?(st===0?flowWords.received:listingEntry?flowWords.listingActive:flowWords.searchActive):lang==='de'?'Aktueller Status':lang==='en'?'Current status':'Trenutni status';
    const dateLabel=lang==='de'?'Geändert am':lang==='en'?'Changed on':'Status promenjen';
    const dateText=eventDate&&!Number.isNaN(eventDate.getTime())?eventDate.toLocaleDateString(lang==='de'?'de-CH':lang==='en'?'en-GB':'sr-Latn-RS',{timeZone:'Europe/Belgrade'}):lang==='de'?'Datum nicht erfasst':lang==='en'?'Date not recorded':'Datum promene nije zabeležen';
    $("u_now").innerHTML='<b>'+esc(statusLabel)+'</b><div>'+esc(statusText)+'</div><small>'+esc(dateLabel)+': '+esc(dateText)+'</small>';
    SCClientDeposit.render({host:$('u_now'),record:d,proposal:proposalView.selected,lang,token,rpc,onChange:load});
    $("u_next").hidden=!entry.pending&&!entry.inactive&&!entry.available;$("u_next").innerHTML=(entry.pending||entry.inactive||entry.available)?'<b>'+esc(flowWords.next)+'</b><p>'+esc(entry.available?availableWords.next:entry.inactive?inactiveWords.next:listingEntry?flowWords.waitListing:flowWords.waitSearch)+'</p>':'';
    if(entry.inactive){
      const replacementWords={sr:{label:'Link novog oglasa',send:'Pošalji novi upit',error:'Novi link nije sačuvan. Proverite link i pokušajte ponovo.'},de:{label:'Anderen Inseratslink senden',send:'Link senden',error:'Der Link wurde nicht gespeichert. Bitte prüfen und erneut versuchen.'},en:{label:'Send another listing link',send:'Send new link',error:'The new link was not saved. Check it and try again.'}}[lang];
      $('u_next').insertAdjacentHTML('beforeend','<form class="purchase-new-listing"><label>'+esc(replacementWords.label)+'<input type="url" required placeholder="https://…" aria-label="'+esc(replacementWords.label)+'"></label><button class="btn btn-gold" type="submit">'+esc(replacementWords.send)+'</button><p role="status"></p></form>');
      const form=$('u_next').querySelector('form'),requestId=crypto.randomUUID();form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;const button=form.querySelector('button'),input=form.querySelector('input'),message=form.querySelector('[role="status"]');button.disabled=true;try{const response=await rpc('sc_order_new_listing',{p_token:token,p_url:input.value.trim(),p_request_id:requestId}),result=await response.json();if(!response.ok||result.ok!==true||!/^[a-f0-9]{24}$/.test(result.token))throw Error('new_link_failed');location.hash=result.token;}catch{button.disabled=false;message.textContent=replacementWords.error;}};
    }
    $('u_listing').hidden=!entry.url;
    if(entry.url){
      const quote=d.listingQuote?.result,adPrice=d.listingVehicle?.adChf?num(d.listingVehicle.adChf)+' CHF':({sr:'Nije upisana',de:'Nicht erfasst',en:'Not recorded'})[lang],total=quote?Number(quote.total).toLocaleString(t.locale,{minimumFractionDigits:2,maximumFractionDigits:2})+' €':'—';
      const labels={sr:{ad:'Cena u oglasu',total:'Do Srbije · sa paketom',adNote:'Cena vozila u Švajcarskoj',totalNote:'Uvoz i usluge · bez registracije',package:'SWISCARS paket',included:'Uključen u ukupnu procenu. Pregled se uračunava u paket.',notIncluded:'Paket nije uključen.',inspection:'Pregled pre kupovine',book:'Zakaži pregled',after:'Posle izveštaja odlučujete o kupovini.'},de:{ad:'Inseratspreis',total:'Geschätzte Gesamtkosten bis Serbien',adNote:'Fahrzeugpreis in der Schweiz',totalNote:'Import und Leistungen · ohne Zulassung',package:'SWISCARS Paket',included:'In der Gesamtschätzung enthalten. Die Prüfung wird angerechnet.',notIncluded:'Paket nicht enthalten.',inspection:'Prüfung vor dem Kauf',book:'Prüfung anfragen',after:'Nach dem Bericht entscheiden Sie über den Kauf.'},en:{ad:'Listing price',total:'Estimated total to Serbia',adNote:'Vehicle price in Switzerland',totalNote:'Import and services · excluding registration',package:'SWISCARS package',included:'Included in the total estimate. Inspection is credited to the package.',notIncluded:'Package not included.',inspection:'Inspection before purchase',book:'Request inspection',after:'Decide whether to buy after the report.'}}[lang];
      const packageProposal=proposalView.selected||inlineInspection,packageTotal=Number(quote?.packageChf)||0;
      const receipt=Number(packageProposal?.inspectionPaymentAmount??packageProposal?.inspFee)||0;
      const packagePaid=packageProposal?.inspectionPaid===true&&(!packageProposal.inspectionPaymentCurrency||packageProposal.inspectionPaymentCurrency==='CHF')?Math.min(packageTotal,receipt):0;
      const packageRemaining=Math.round((packageTotal-packagePaid)*100)/100;
      const balanceWords=({sr:{paid:'Uplaćeno',remaining:'Ako izaberete paket',total:'Ukupno'},de:{paid:'Bezahlt',remaining:'Bei Paketwahl',total:'Gesamt'},en:{paid:'Paid',remaining:'If you choose the package',total:'Total'}})[lang];
      const packageChosen=packageProposal?.choice==='buy'&&packageProposal?.serviceMode==='package';
      const moneyWords=({sr:{paid:'Naplaćeno',remaining:'Doplata uz paket',total:'Paket ukupno',pending:'Doplata samo ako izaberete SWISCARS paket.',chosen:'SWISCARS paket je izabran.'},de:{paid:'Bezahlt',remaining:'Paketrestbetrag',total:'Paket gesamt',pending:'Restbetrag nur bei Paketwahl.',chosen:'SWISCARS Paket gewählt.'},en:{paid:'Paid',remaining:'Package balance',total:'Package total',pending:'Balance applies only if you choose the package.',chosen:'SWISCARS package selected.'}})[lang];
      const balanceHtml=quote?'<div class="client-price-part is-paid"><span>'+esc(moneyWords.paid)+'</span><strong>'+esc(num(packagePaid))+' CHF</strong></div><div class="client-price-part '+(packageChosen?'':'is-pending')+'"><span>'+esc(moneyWords.remaining)+'</span><strong>'+esc(num(packageRemaining))+' CHF</strong></div><div class="client-price-part '+(packageChosen?'':'is-pending')+'"><span>'+esc(moneyWords.total)+'</span><strong>'+esc(num(packageTotal))+' CHF</strong></div>':'';
      $('u_listing').innerHTML='<header class="client-vehicle-heading"><h2>'+esc(d.listingVehicle?.title||flowWords.listing)+'</h2><a class="purchase-listing-link" href="'+esc(entry.url)+'" target="_blank" rel="noopener">'+esc(flowWords.open)+'</a></header><div class="client-price-grid"><div class="client-price-part"><span>'+esc(labels.ad)+'</span><strong>'+esc(adPrice)+'</strong><small>'+esc(labels.adNote)+'</small></div>'+balanceHtml+(quote?'<div class="client-price-part client-total-part"><span>'+esc(labels.total)+'</span><strong>'+esc(total)+'</strong><small>'+esc(labels.totalNote)+'</small></div>':'')+'</div>'+(quote?'<p class="client-price-condition">'+esc(packageChosen?moneyWords.chosen:moneyWords.pending)+'</p>':'');
      if(quote)$('u_listing').insertAdjacentHTML('beforeend',clientVerificationInfo(d));
      if(quote)$('u_listing').insertAdjacentHTML('beforeend','<section class="client-package-section">'+clientPackageInfo(d,packageInfoOpen)+'</section>');
      if(inlineInspection){const p=inlineInspection,bookingStatus=p.inspectionPaid===true?((p.inspectionScheduled&&p.plannedAt?clientInspectionWords().scheduled.replace('{date}',new Date(p.plannedAt).toLocaleString(t.locale,{day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})):clientInspectionStatus(p))||({sr:'Uplata je primljena. Dogovaramo termin.',de:'Zahlung eingegangen. Wir vereinbaren den Termin.',en:'Payment received. We are arranging the date.'})[lang]):({sr:'Zahtev je primljen. Sledeća je uplata pregleda.',de:'Anfrage eingegangen. Als Nächstes folgt die Prüfungszahlung.',en:'Request received. Next is the inspection payment.'})[lang];$('u_listing').insertAdjacentHTML('beforeend','<section class="client-booking-section"><div class="client-booking-actions">'+(inspectionOffer?'<button class="btn btn-gold" type="button" data-ans="'+esc(p.id)+'|zelim">'+esc(labels.book)+'</button>':'<span class="client-booking-status">'+esc(bookingStatus)+'</span>')+'</div><p>'+esc(inspectionOffer?labels.after:p.inspectionPaid===true?({sr:'Sledeće: izveštaj posle pregleda, zatim vaša odluka o kupovini.',de:'Danach: Prüfbericht, anschließend Ihre Kaufentscheidung.',en:'Next: inspection report, then your decision whether to buy.'})[lang]:clientInspectionWords().details)+'</p></section>');}

    }else $('u_listing').replaceChildren();
    renderWithdrawal(d);
    if((proposalView.selected||d.car)&&!listingEntry){
      let extra=$('u_extra_options');
      if(!extra){extra=document.createElement('details');extra.id='u_extra_options';extra.className='up-extra-options';extra.appendChild(document.createElement('summary'));$('u_conversation').after(extra);}
      extra.querySelector('summary').textContent=lang==='de'?'Anfragedaten und weitere Optionen':lang==='en'?'Request details and other options':'Podaci upita i ostale opcije';
      for(const item of [document.querySelector('.up-request-details'),$('u_how'),$('u_withdraw'),document.querySelector('.up-contact'),d.car&&proposalView.selected?$('u_car'):null])if(item&&item.parentElement!==extra)extra.appendChild(item);
    }
    const pct = d.depositPct || 10;
    $("u_how").innerHTML = `<details class="up-how-collapse"><summary>${esc(t.howT)}</summary><ol>${(listingEntry?flowWords.listingHow:followup[lang].how).map(x => `<li>${esc((window.SCServicePrices?SCServicePrices.format(x,lang):x).replace("{p}", pct))}</li>`).join("")}</ol></details>`;
    $("u_how").hidden = listingEntry||!!inspectionOffer||!!d.car||entry.pending||entry.inactive||entry.available;
    $("u_ai").hidden = !(d.aiAt && st >= 0 && st <= 2 && !(d.proposals || []).length);
    if (d.aiAt) $("u_ai").textContent = (d.aiN > 0 ? t.aiYes : t.aiNo).replace("{d}", new Date(d.aiAt).toLocaleDateString(t.locale)).replace("{n}", d.aiN);
    if(entry.pending)$("u_ai").hidden=true;
    const choice = x => x === "Svejedno" ? t.any : (x || t.notSpecified);
    const rq = [["model", listingEntry?(d.listingVehicle?.title||flowWords.listing):d.model], ["brand", d.brand], ["yearFrom", choice(d.yearFrom)], ["fuel", choice(d.fuel)], ["gearbox", t.gear[d.gearbox] || choice(d.gearbox)], ["body", choice(d.body)], ["drive", choice(d.drive)], ["color", choice(d.color)], ["budget", d.budget ? num(d.budget) + " €" : t.notSpecified], ["mileage", choice(d.mileage)], ["when", d.when], ["city", d.city], ["equip", (d.equip || []).join(", ")], ["note", d.note], ["created", d.created ? new Date(d.created).toLocaleDateString(t.locale) : ""]];
    document.querySelector(".up-request-details").hidden=listingEntry;
    $("u_req_summary").textContent=listingEntry?({sr:"Podaci upita",de:"Anfragedaten",en:"Request details"})[lang]:[ [d.brand,d.model].filter(Boolean).join(" "), d.yearFrom ? (lang==="de"?"ab ":lang==="en"?"from ":"od ")+d.yearFrom+"." : "", d.budget ? (lang==="de"?"bis ":lang==="en"?"up to ":"do ")+num(d.budget)+" €" : "" ].filter(Boolean).join(" · ") || (lang==="de"?"Ihre Anfrage":lang==="en"?"Your request":"Vaš upit");
    $("u_req").innerHTML = rq.filter(r => r[1]&&!(listingEntry&&["budget","brand","yearFrom","fuel","gearbox","body","drive","color","mileage","equip"].includes(r[0]))).map(([k, v]) => `<div${k === "note" || k === "equip" ? ' class="up-req-wide"' : ""}><dt>${esc(t.req[k])}</dt><dd>${esc(v)}</dd></div>`).join("");
    const c = d.car;
    $("u_car").innerHTML = c ? `<div class="up-card"><h2>${esc(t.carT)}: ${esc(c.model)}${c.year ? " " + c.year : ""}</h2>
      <p>${[c.km ? num(c.km) + " km" : "", c.fuel, t.gear[c.gear] || c.gear, c.kw ? Math.round(c.kw * 1.36) + (lang === "en" ? " hp" : lang === "de" ? " PS" : " KS") : "", c.color].filter(Boolean).map(esc).join(" · ")}</p>
      ${c.price ? `<p class="up-price">${num(c.price)} €</p>` : ""}
      ${(c.photos || []).length ? `<div class="up-photos">${c.photos.map(p => `<a href="${esc(photoUrl(p))}" target="_blank" rel="noopener"><img src="${esc(photoUrl(p))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}</div>` : "";
    const props = proposalView.proposals;
    const dep = p => p.deposit ? num(p.deposit) : "";
    const btn = (p, ans, label, gold) => st<0?"":`<button class="btn ${gold ? "btn-gold" : "btn-outline up-out"}" type="button" data-ans="${esc(p.id)}|${ans}"${["zelim","zanima","kupujem"].includes(ans)&&clientProposalUnavailable(p)?" disabled":""}>${esc(label)}</button>`;
    const rf = p => num(p.refundEur != null ? p.refundEur : 0);
    const state = p => {
      if(clientProposalUnavailable(p))return '<p class="up-no">'+esc(clientFavoriteWords().unavailable)+'</p>'+(st<0?'':'<div class="up-ans"><button class="btn btn-gold" type="button" disabled>'+esc(t.aPregled)+'</button></div>');
      const inspection=clientInspectionStatus(p);
      if(inspection)return '<div class="up-box"><p class="'+(p.inspectionPaid===true?'up-ok':'up-wait')+'">'+esc(inspection)+'</p>'+(p.avail==='da'&&p.inspectionPaid!==true?'<p class="car-meta">'+esc(clientInspectionWords().details)+'</p>':'')+'</div>';
      if(clientInspectionFailed(p))return '<div class="up-box"><p class="up-no">'+esc(clientNegativeWords().negative)+'</p>'+clientReadonlyReport(p)+(p.choice?'':'<p class="car-meta">'+esc(p.depositPaidAt?T().decHint.replace('{r}',rf(p)):clientInspectionWords().decision)+'</p><div class="up-ans">'+btn(p,'continue',T().aContinue,true)+btn(p,'refund',p.depositPaidAt?T().aRefund:clientNegativeWords().stop)+'</div>')+'</div>';
      if(p.inspAt&&!clientInspectionCompleted(p))return '<div class="up-box"><p class="up-wait">'+esc(clientNegativeWords().pending)+'</p>'+clientReadonlyReport(p)+'</div>';
      if(p.choice==='buy'&&!clientInspectionCompleted(p)&&!d.car)return '<p class="up-wait">'+esc(clientNegativeWords().unfinished)+'</p>';
      if(p.choice==='buy'&&clientInspectionFirst(p))return '<p class="up-ok">'+esc(clientInspectionWords().buy)+'</p><section class="inspection-package-choice" data-order-package="'+esc(p.id)+'"></section>';
      if (p.commission || p.url) {
        if (p.depositRefundAt) return `<p class="up-ok">${esc(t.sRefunded2.replace("{r}", rf(p)))}</p>`;
        if (p.choice === "refund") return `<p class="up-wait">${esc(t.sRefund2.replace("{r}", rf(p)))}</p>`;
        if (p.choice === "buy") return `<p class="up-ok">${esc(t.sBuy)}</p>`;
        if (clientInspectionCompleted(p) && !p.choice) return `<div class="up-box"><p class="car-meta">${esc(t.repT)}</p>${p.inspNote ? `<p style="white-space:pre-wrap">${esc(p.inspNote)}</p>` : ""}${window.SCInspectionReport?.render(p.inspChecklist, DATA.lang || lang, {photoUrl}) || ""}${SCInspectionReport.unassignedPhotos(p.inspChecklist,p.inspPhotos).length ? `<div class="up-photos">${SCInspectionReport.unassignedPhotos(p.inspChecklist,p.inspPhotos).map(x => `<a href="${esc(photoUrl(x))}" target="_blank" rel="noopener"><img src="${esc(photoUrl(x))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}<p class="car-meta">${esc(clientInspectionFirst(p)?clientInspectionWords().decision:t.decHint.replace("{r}", rf(p)))}</p><div class="up-ans">${btn(p, "kupujem", t.aKupujem, true)}${btn(p, "nekupujem", t.aNeKupujem)}</div></div>`;
        if (p.depositPaidAt && !p.insp) return `<p class="up-ok">${esc(t.sPaid2.replace("{d}", dep(p)))}</p>`;
        if (p.avail === "ne") return `<p class="up-no">${esc(t.sUnavail)}</p>`;
        if (p.answer === "zelim" && !p.availAt) return `<p class="up-wait">${esc(followup[lang].waiting)}</p>`;
        if (p.answer === "zelim" && !p.depositPaidAt) return "";
        if (p.answer === "ne") return `<p class="up-no">${esc(t.sNe)}</p>`;
        if (!p.answer && clientInspectionFirst(p))return '<p class="car-meta">'+esc(clientInspectionWords().fee.replace('{fee}',clientInspectionFee(p)))+'</p><div class="up-ans">'+btn(p,'zelim',t.aPregled,true)+btn(p,'ne',t.aNe)+'</div>';
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
    const agreed=p=>clientDepositPaid(p)||!!d.car&&proposalView.selected?.id===p.id;
    const summaryPrice=p=>clientCurrentQuote(p)?.total??(d.car&&proposalView.selected?.id===p.id&&d.car.price?d.car.price:p.price);
    const priceDetailsLabel=lang==='de'?'Preis- und Prüfungsdetails':lang==='en'?'Price and inspection details':'Detalji cene i pregleda';
    const agreedLabel=lang==='de'?'Vereinbarter Gesamtpreis':lang==='en'?'Agreed total price':'Dogovorena ukupna cena';
    const order = p => p.answer === "ne" ? 2 : 0;
    const proposalMarkup = items => items.slice().sort((x, y) => order(x) - order(y)).map(p => p.serviceFlow==='inspection-first'?`<section class="up-card inspection-first-offer"><h2>${esc(p.choice==='buy'?({sr:'Vaša odluka',de:'Ihre Entscheidung',en:'Your decision'})[lang]:lang==='de'?'Fahrzeugprüfung':lang==='en'?'Vehicle inspection':'Pregled vozila')}</h2><h3>${esc(p.title)}</h3><p>${esc(p.place||'')}</p><p class="up-price">${esc(num(p.inspFee))} CHF</p>${!p.answer?'<p class="car-meta">'+esc(({sr:'Posle izveštaja odlučujete o kupovini.',de:'Nach dem Bericht entscheiden Sie über den Kauf.',en:'Decide whether to buy after the report.'})[lang])+'</p><div class="up-ans">'+btn(p,'zelim',({sr:'Zakaži pregled',de:'Prüfung anfragen',en:'Request inspection'})[lang],true)+'</div>':state(p)}</section>`:`<div class="up-card up-prop up-prop-compact${agreed(p)?" up-prop-agreed":""}${p.answer === "ne" ? " up-dim" : ""}"><div class="ph">${(p.photos || []).length ? `<img src="${esc(photoUrl(p.photos[0]))}" alt="">` : (p.inspPhotos || []).length ? `<img src="${esc(photoUrl(p.inspPhotos[0]))}" alt="">` : PH}</div>
      <div class="bd"><span class="car-stage">${esc(t.propT)}${p.at ? " · " + new Date(p.at).toLocaleDateString(t.locale) : ""}</span><h3>${esc(p.title)}${p.year ? " · " + p.year : ""}</h3>${clientFavoriteControl(p,d)}
        <p class="car-meta">${[p.km ? num(p.km) + " km" : "", p.fuel, t.gear[p.gear] || p.gear].filter(Boolean).map(esc).join(" · ")}</p>
        ${p.url ? `<p class="up-listing-link"><a class="btn btn-outline up-out" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(t.cAd)}</a></p>` : ""}
        <div class="up-proposal-total">${p.url?`<span class="up-summary-price"><span class="car-meta">${esc(lang==='de'?'Prüfung':lang==='en'?'Inspection':'Pregled')}</span><strong>${p.inspFee!=null?esc(num(p.inspFee))+" CHF":esc(t.cInspDeal)}</strong></span>`:""}<span class="up-summary-price"><span class="car-meta">${esc(clientCurrentQuote(p)?quoteWords().current:(p.url?quoteWords().saved:t.priceL))}</span><strong>${summaryPrice(p)?quoteMoney(summaryPrice(p)):esc(t.noPrice)}</strong></span></div>
        <details class="up-price-details" data-client-quote="${esc(p.id)}"><summary>${esc(priceDetailsLabel)}</summary><div class="up-price-detail-body">${clientQuoteMarkup(p,d)}
          ${agreed(p)?`<p class="car-meta">${[p.km?num(p.km)+" km":"",p.fuel,t.gear[p.gear]||p.gear].filter(Boolean).map(esc).join(" · ")}</p>`:""}
          ${p.url?`<p class="up-cost-row"><span>${esc(t.cInsp.replace(": {fee}",""))}</span><strong>${p.inspFee!=null?esc(num(p.inspFee))+" CHF":esc(t.cInspDeal)}</strong></p><p class="car-meta">${[p.dist!=null?t.cInspDist.replace("{d}",p.dist):"",p.place].filter(Boolean).map(esc).join(" · ")}</p>`:""}
          ${p.adChf?`<p class="car-meta">${esc(followup[lang].included.replace("{com}",num(p.commission||d.commission||700)))}</p>`:""}
          ${p.url?`<p class="car-meta">${esc(followup[lang].risk)}</p>`:""}
          ${p.adNote?`<div class="up-ad"><span class="car-meta">${esc(t.adT)}</span><p>${esc(p.adNote)}</p></div>`:""}
          ${agreed(p)&&(p.photos||[]).length?`<div class="up-photos">${p.photos.map(x=>`<a href="${esc(photoUrl(x))}" target="_blank" rel="noopener"><img src="${esc(photoUrl(x))}" alt="" loading="lazy"></a>`).join("")}</div>`:""}
        </div></details>
        ${agreed(p)&&!p.inspAt&&!p.choice?"":state(p)}
      </div>${!agreed(p)&&(p.photos || []).length > 1 ? `<div class="up-photos up-gal">${p.photos.map(x => `<a href="${esc(photoUrl(x))}" target="_blank" rel="noopener"><img src="${esc(photoUrl(x))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}</div>`).join("");
    const f = followup[lang];
    $("u_props").hidden=!!inlineInspection||entry.available||entry.inactive||entry.pending&&(listingEntry||!entry.searchComplete);
    $("u_props").innerHTML = (!listingEntry&&(proposalView.count||proposalView.favoriteCount)?clientFavoriteFilters(proposalView):'')+(clientProposalFilter==='favorites'&&!proposalView.selected&&!props.length?'<p class="car-meta">'+esc(clientFavoriteWords().empty)+'</p>':'')+proposalMarkup(props) + (!listingEntry&&!d.car && st >= 0 && !proposalView.selected ? '<section class="up-card up-followup">'+(!props.length?'<p>'+esc(f.empty)+'</p>':'')+'<div class="up-ans">'+['search','link','b2b'].map(k=>'<button class="btn btn-outline" type="button" data-followup="'+k+'">'+esc(f[k])+'</button>').join('')+'</div><div id="u_followup_form"></div></section>' : '');
    const decisionHost=$('u_decision'),decisionProposal=proposalView.selected,historyHost=$('u_history');
    decisionHost.hidden=true;decisionHost.replaceChildren();historyHost.hidden=true;historyHost.replaceChildren();$('u_now').hidden=false;
    const workflowWords={sr:{decision:'Vaša odluka',hint:'Kupovina uključuje SWISCARS paket.',buy:'Kupujem uz SWISCARS paket',no:'Ne kupujem',report:'Prikaži izveštaj',close:'Zatvori izveštaj',history:'Dosadašnji tok',check:'Provera auta',available:'Auto je dostupan',paid:'Pregled uplaćen',scheduled:'Pregled zakazan',sent:'Izveštaj sa pregleda',ready:'Izveštaj je spreman',chosen:'Vaš izbor: Kupujem',package:'Kupovina uz SWISCARS paket potvrđena',deposit:'Kapara primljena',waiting:'Kupovina počinje tek po prijemu kapare.'},de:{decision:'Ihre Entscheidung',hint:'Der Kauf umfasst das SWISCARS Paket.',buy:'Ich kaufe',no:'Ich kaufe nicht',report:'Bericht ansehen',close:'Bericht schließen',history:'Bisheriger Verlauf',check:'Fahrzeugprüfung',available:'Fahrzeug verfügbar',paid:'Prüfung bezahlt',scheduled:'Prüfung vereinbart',sent:'Prüfbericht',ready:'Bericht liegt vor',chosen:'Ihre Wahl: Ich kaufe',package:'Kauf mit SWISCARS Paket bestätigt',deposit:'Anzahlung eingegangen',waiting:'Der Kauf beginnt erst nach Eingang der Anzahlung.'},en:{decision:'Your decision',hint:'Purchase includes the SWISCARS package.',buy:'I am buying',no:'I am not buying',report:'View report',close:'Close report',history:'Previous steps',check:'Car check',available:'Car available',paid:'Inspection paid',scheduled:'Inspection scheduled',sent:'Inspection report',ready:'Report ready',chosen:'Your choice: I am buying',package:'Purchase with SWISCARS package confirmed',deposit:'Deposit received',waiting:'Purchase starts only after receipt of the deposit.'}}[lang];
    const openReport=()=>{
      const p=decisionProposal,dialog=document.createElement('dialog');dialog.className='client-report-dialog';dialog.setAttribute('aria-label',workflowWords.sent);
      const close=document.createElement('button');close.type='button';close.className='btn btn-outline';close.textContent=workflowWords.close;close.onclick=()=>dialog.close();
      const content=document.createElement('div');content.className='client-report-content';content.innerHTML=(DATA.previewScenario?'<small class="report-demo-label">'+esc(({sr:'Primer prikaza',de:'Ansichtsbeispiel',en:'Example view'})[lang])+'</small>':p.inspNote?'<p>'+esc(p.inspNote)+'</p>':'')+(window.SCInspectionReport?.render(p.inspChecklist,DATA.lang||lang,{photoUrl,vehicleTitle:p.title||DATA.listingVehicle?.title})||'');
      dialog.append(close,content);$('u_body').append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
    };
    if(st>=0&&!d.car&&decisionProposal&&clientInspectionCompleted(decisionProposal)&&(!decisionProposal.choice||decisionProposal.choice==='buy'&&decisionProposal.serviceMode!=='package')&&!clientProposalUnavailable(decisionProposal)){
      decisionHost.innerHTML='<div><h2>'+esc(workflowWords.decision)+'</h2><p>'+esc(workflowWords.hint)+'</p></div><div class="up-ans">'+btn(decisionProposal,'kupujem',workflowWords.buy,true)+btn(decisionProposal,'nekupujem',workflowWords.no)+'</div>';
      decisionHost.hidden=false;$('u_now').hidden=true;
    }
    if(decisionProposal){
      const p=decisionProposal,events=[],date=value=>{if(!value||typeof value==='boolean')return '';const dt=new Date(Number(value)||value);return Number.isNaN(dt.getTime())?'':dt.toLocaleString(t.locale,{day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});};
      if(d.listingCheck?.status==='available'||p.avail==='da')events.push({key:'check',title:workflowWords.check,body:workflowWords.available,at:d.listingCheck?.at||p.availAt});
      if(p.inspectionPaid===true)events.push({key:'payment',title:workflowWords.paid,at:p.inspectionPaidAt});
      if(p.inspectionScheduled===true&&p.plannedAt)events.push({key:'appointment',title:workflowWords.scheduled,body:date(p.plannedAt),at:p.planningUpdatedAt});
      if(p.inspAt&&p.inspectionReviewed!==false)events.push({key:'report',title:workflowWords.sent,body:workflowWords.ready,at:p.inspAt,report:true});
      if(p.choice==='buy')events.push({key:'decision',title:p.serviceMode==='package'?workflowWords.package:workflowWords.chosen,at:p.serviceSelectedAt||p.choiceAt});
      if(['continue','refund','other'].includes(p.choice))events.push({key:'decision',title:({sr:'Vaš izbor: Ne kupujem',de:'Ihre Wahl: Ich kaufe nicht',en:'Your choice: I am not buying'})[lang],at:p.choiceAt});
      if(clientDepositPaid(p))events.push({key:'deposit',title:workflowWords.deposit,at:p.depositPaidAt});
      historyHost.hidden=!events.length;
      historyHost.innerHTML='<h2>'+esc(workflowWords.history)+'</h2>'+events.reverse().map(event=>'<article class="client-history-card" data-history-step="'+event.key+'"><div><h3>'+esc(event.title)+'</h3>'+(event.body?'<p>'+esc(event.body)+'</p>':'')+'</div>'+(event.report?'<button class="btn btn-outline" type="button" data-history-report>'+esc(workflowWords.report)+'</button>':'')+(date(event.at)?'<time>'+esc(date(event.at))+'</time>':'')+'</article>').join('');
      historyHost.querySelector('[data-history-report]')?.addEventListener('click',openReport);
      if(p.inspAt&&p.inspectionReviewed!==false){const previousCard=[...$('u_props').querySelectorAll('.inspection-first-offer')].find(card=>card.querySelector('[data-order-package]')||card.textContent.includes(p.title));if(previousCard)previousCard.remove();}
    }
    document.querySelectorAll('[data-client-quote]').forEach(el=>{if(openQuotes.has(el.dataset.clientQuote))el.open=true;});
    document.querySelectorAll('[data-refresh-quote]').forEach(button=>button.onclick=async()=>{button.disabled=true;const message=button.parentElement.querySelector('[data-quote-refresh-status]');if(message)message.textContent=T().send;clientQuoteFx=await SCFXReferenceClient.load();await load();});
    document.querySelectorAll('[data-client-filter]').forEach(button=>button.onclick=()=>{if(proposalView.selected)return;clientProposalFilter=button.dataset.clientFilter==='favorites'?'favorites':'proposals';render();});
    document.querySelectorAll('[data-client-favorite]').forEach(button=>button.onclick=async()=>{
      const id=button.dataset.clientFavorite,p=DATA?.proposals?.find(p=>p.id===id);if(!p||button.disabled||clientFavoriteBusy.has(id))return;
      const message=button.parentElement.querySelector('[data-client-favorite-message]'),desired=p.favorite!==true;button.disabled=true;message.textContent=T().send;
      try{const result=await clientSetFavorite(id,desired);if(result){render();const saved=document.querySelector('[data-client-favorite-message="'+CSS.escape(id)+'"]');if(saved)saved.textContent=result.favorite?clientFavoriteWords().saved:clientFavoriteWords().removed;}}
      catch(e){console.warn(e);message.textContent=T().err;button.disabled=false;}
    });
    document.querySelectorAll('[data-followup]').forEach(button => button.onclick = () => {
      const kind=button.dataset.followup, host=$('u_followup_form'), requestId=crypto.randomUUID();
      host.innerHTML='<form class="up-followup-form"><label>'+esc(kind==='link'?f.url:f.note)+'<input type="'+(kind==='link'?'url':'text')+'" maxlength="1000" '+(kind==='link'?'required':'')+'></label><div class="up-ans"><button class="btn btn-gold" type="submit">'+esc(f.send)+'</button><button class="btn btn-outline" type="button" data-cancel>'+esc(f.cancel)+'</button></div><p role="status"></p></form>';
      if(kind==='search')host.querySelector('.up-ans').insertAdjacentHTML('beforebegin','<label>'+esc(({sr:'Najdalje od St. Gallena (km, jedan smer)',de:'Maximal ab St. Gallen (km, einfache Strecke)',en:'Maximum from St. Gallen (km, one way)'})[lang])+'<input data-distance type="number" min="1" max="500" step="1"></label>');
      host.querySelector('[data-cancel]').onclick=()=>host.replaceChildren();
      host.querySelector('input').focus();
      host.querySelector('form').onsubmit=async event=>{
        event.preventDefault();const buttons=host.querySelectorAll('button'),input=host.querySelector('input'),message=host.querySelector('[role="status"]');
        if(kind==='link' && !/^https:\/\/[^\s]+$/.test(input.value.trim())){message.textContent=T().err;return;}
        buttons.forEach(b=>b.disabled=true);input.disabled=true;message.textContent=T().send;
        try{const distance=host.querySelector('[data-distance]');const r=await rpc('sc_order_followup',{p_token:token,p_kind:kind,p_text:input.value.trim(),p_request_id:requestId,p_max_distance:distance?.value?Number(distance.value):null}),result=await r.json();if(!r.ok || result.ok!==true)throw Error('request_failed');message.textContent=f.saved;window.SCConversation.mount($('u_conversation'),{lang,key:{p_token:token},call:async(fn,body)=>{const r=await rpc(fn,body),data=await r.json();if(!r.ok)throw Error('request_failed');return data;}});}
        catch(e){message.textContent=T().err;buttons.forEach(b=>b.disabled=false);input.disabled=false;}
      };
    });
    document.querySelectorAll("[data-ans]").forEach(b => b.onclick = async () => {
      const [id, ans] = b.dataset.ans.split("|");
      const proposal=DATA?.proposals?.find(p=>p.id===id);if(["zelim","zanima","kupujem"].includes(ans)&&clientProposalUnavailable(proposal)){alertBox(b.parentElement,clientFavoriteWords().unavailable);return;}
      const note = (document.querySelector(`[data-note="${CSS.escape(id)}"]`) || {}).value || "";
      const btns = b.parentElement.querySelectorAll("button"); btns.forEach(x => x.disabled = true); b.textContent = T().send;
      try { const combined=ans==="kupujem"&&clientInspectionFirst(proposal); const r = await rpc(combined?"sc_order_choose_package":"sc_order_answer", combined?{p_token:token,p_id:id,p_expected_price:Number(DATA.listingQuote?.result?.packageChf??proposal.commission)}:{ p_token: token, p_id: id, p_answer: ans, p_note: note }); const result=await r.json();if (!r.ok||result?.ok!==true) throw new Error("answer_not_saved"); await load(); }
      catch (e) { console.warn(e); alertBox(b.parentElement, T().err); btns.forEach(x => x.disabled = false); }
    });
    $("u_qT").textContent = t.qT; $("u_qP").textContent = t.qP;
    setupConversationDialog();
    window.SCConversation.mount($("u_conversation"), { lang, compact:true, trackUnread:true, isReading:()=>$('u_chat_dialog')?.open===true, onUnreadChange:count=>{
      const button=$('u_chat_open'),label=({sr:'Razgovor',de:'Gespräch',en:'Conversation'})[lang];button.textContent=label;
      button.setAttribute('aria-label',label+(count?' · '+count+' '+({sr:'nepročitanih poruka',de:'ungelesene Nachrichten',en:'unread messages'})[lang]:''));
      if(count){const badge=document.createElement('span');badge.className='purchase-chat-count';badge.textContent=String(count);badge.setAttribute('aria-hidden','true');button.append(badge);}
    }, key: {p_token:token}, call: async (fn, body) => {
      const r=await rpc(fn,body), result=await r.json();
      if(!r.ok)throw new Error(result.message||"conversation_error"); return result;
    } });
  }
  function setupConversationDialog(){
    const words=({sr:{open:'Razgovor',close:'Zatvori razgovor'},de:{open:'Gespräch',close:'Gespräch schließen'},en:{open:'Conversation',close:'Close conversation'}})[lang];
    const button=$('u_chat_open');let dialog=$('u_chat_dialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='u_chat_dialog';dialog.className='up-chat-dialog';dialog.setAttribute('aria-label',words.open);
      const close=document.createElement('button');close.type='button';close.className='up-chat-close';close.textContent='×';close.setAttribute('data-chat-close','');
      close.onclick=()=>dialog.close();dialog.append(close,$('u_conversation'));document.body.append(dialog);
      dialog.addEventListener('close',()=>{document.body.style.overflow=dialog.scPreviousOverflow||'';button.focus({preventScroll:true});});
      button.onclick=()=>{if(dialog.open)return;dialog.scPreviousOverflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';$('u_conversation').scConversation?.refresh();};
    }
    button.textContent=words.open;dialog.setAttribute('aria-label',words.open);dialog.querySelector('[data-chat-close]').setAttribute('aria-label',words.close);
  }
  let withdrawalRequestId=null,withdrawalBusy=false;
  function renderWithdrawal(d){
    let host=$('u_withdraw');
    if(!host){host=document.createElement('div');host.id='u_withdraw';$('u_now').closest('.up-card').append(host);}
    const vehicleHeading=$('u_listing')?.querySelector('.client-vehicle-heading');
    if(vehicleHeading)vehicleHeading.append(host);
    if(withdrawalBusy)return;
    const words={sr:{action:'Odustajem od upita',confirm:'Potvrdi odustajanje',cancel:'Nazad',ask:'Želite da zatvorite ovaj upit?',note:'Postojeće uplate i dogovori ostaju u evidenciji. Završni obračun dogovarate sa timom.',done:'Potražilac odustao',saving:'Čuvam…'},de:{action:'Anfrage zurückziehen',confirm:'Rückzug bestätigen',cancel:'Zurück',ask:'Möchten Sie diese Anfrage schließen?',note:'Bestehende Zahlungen und Vereinbarungen bleiben gespeichert. Die Schlussabrechnung klären Sie mit dem Team.',done:'Anfrage zurückgezogen',saving:'Speichern…'},en:{action:'Withdraw my request',confirm:'Confirm withdrawal',cancel:'Back',ask:'Would you like to close this request?',note:'Existing payments and agreements remain recorded. Please agree any final settlement with the team.',done:'Request withdrawn',saving:'Saving…'}}[lang];
    if(d.status==='arhiva'){host.replaceChildren();return;}
    if(d.status==='odustao'){host.innerHTML='<span role="status">'+esc(words.done)+'</span>';return;}
    host.innerHTML='<button class="btn btn-outline" type="button" data-withdraw>'+esc(words.action)+'</button>';
    host.querySelector('[data-withdraw]').onclick=()=>{
      withdrawalRequestId ||= crypto.randomUUID();
      host.innerHTML='<div style="width:100%;padding:14px;border:1px solid var(--line,#ddd);border-radius:8px"><p>'+esc(words.ask)+'</p><p class="car-meta">'+esc(words.note)+'</p><div class="up-ans"><button class="btn btn-gold" type="button" data-withdraw-confirm>'+esc(words.confirm)+'</button><button class="btn btn-outline" type="button" data-withdraw-cancel>'+esc(words.cancel)+'</button></div><p role="status"></p></div>';
      host.querySelector('[data-withdraw-cancel]').onclick=()=>renderWithdrawal(DATA);
      host.querySelector('[data-withdraw-confirm]').onclick=async()=>{
        if(withdrawalBusy)return;withdrawalBusy=true;host.querySelectorAll('button').forEach(b=>b.disabled=true);host.querySelector('[role="status"]').textContent=words.saving;
        try{const r=await rpc('sc_order_withdraw',{p_token:token,p_request_id:withdrawalRequestId}),result=await r.json();if(!r.ok||!result.ok||result.status!=='odustao')throw Error('withdrawal_failed');DATA={...DATA,status:'odustao',withdrawal:result.withdrawal};withdrawalBusy=false;render();}
        catch(e){withdrawalBusy=false;host.querySelectorAll('button').forEach(b=>b.disabled=false);host.querySelector('[role="status"]').textContent=T().err;}
      };
    };
  }

  function routeSummary(p){
 if(!/(^|[^A-Z])(ZH|ZÜRICH|ZURICH|CIRIH)([^A-Z]|$)/i.test(p.place||''))return '';
 const s=DATA?.routeCounts;if(!s)return '';
 const text=lang==='de'?{area:'Zürich',requests:'Anfragen',booked:'Vereinbart',max:'Max. 5 Prüfungen pro Tag',tiers:'3 Prüfungen −10% · 4 −15% · 5 −20%',day:'Termin'}:lang==='en'?{area:'Zurich',requests:'Requests',booked:'Scheduled',max:'Max. 5 inspections per day',tiers:'3 inspections −10% · 4 −15% · 5 −20%',day:'Date'}:{area:'Cirih',requests:'Upiti',booked:'Dogovoreno',max:'Najviše 5 pregleda dnevno',tiers:'3 pregleda −10% · 4 −15% · 5 −20%',day:'Termin'};
 const days=Array.isArray(s.days)?s.days:[];
 return '<span class="up-route-counts"><b>'+esc(text.area)+'</b> · '+esc(text.requests)+': <b>'+num(s.requests)+'</b> · '+esc(text.booked)+': <b>'+num(s.scheduled)+'</b><br>'+esc(text.max)+'<br>'+esc(text.tiers)+(days.length?'<br>'+days.map(d=>esc(d.date)+' · '+num(d.count)+'/5'+(d.discount?' · −'+num(d.discount)+'%':'')).join('<br>'):'')+'</span>';
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
  SCFXReferenceClient.ready.then(value=>{clientQuoteFx=value;if(DATA)render();});
  window.addEventListener('focus',()=>{if(DATA&&!withdrawalBusy&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)&&!document.querySelector('[data-withdraw-confirm]'))load();});
  load();
  setInterval(() => { if (document.visibilityState === "visible" && DATA && !withdrawalBusy && !document.querySelector("[data-withdraw-confirm]") && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) load(); }, 60000);
})();
