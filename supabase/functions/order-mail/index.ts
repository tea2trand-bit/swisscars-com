// SWISCARS: automatic emails to the person who sent a request on swiscars.com.
// The database queues a message (sc_mail_queue) when something happens: request received,
// first assistant check done, new proposals, photos, deposit requested/received, inspection failed, refund,
// car bought / on the way / at customs / ready / handed over. Kind "team" goes only to info@ (team notice).
// Any POST to this function sends what is queued; there is nothing else it can be told to send.
// Secrets (Supabase → Edge Functions → Secrets): SMTP_USER (info@swiscars.com), SMTP_PASS.
// Optional: SMTP_HOST (default asmtp.mail.hostpoint.ch), SMTP_PORT (default 465).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const num = (n: unknown) => Number(n).toLocaleString("de-CH").replace(/[’']/g, ".");

type Lang = "sr" | "de" | "en";
const COMMON = {
  sr: { hello: "Poštovani/a {name},", btn: "Pogledaj moj upit", sign: "Srdačan pozdrav,\nTim SWISCARS", foot: "Ovu poruku ste dobili jer ste poslali upit na swiscars.com. Na poruku možete direktno odgovoriti." },
  de: { hello: "Guten Tag {name}", btn: "Meine Anfrage ansehen", sign: "Freundliche Grüsse\nIhr SWISCARS-Team", foot: "Sie erhalten diese Nachricht, weil Sie auf swiscars.com eine Anfrage gesendet haben. Sie können direkt auf diese E-Mail antworten." },
  en: { hello: "Dear {name},", btn: "View my request", sign: "Kind regards,\nThe SWISCARS team", foot: "You are receiving this message because you sent a request on swiscars.com. You can reply directly to this email." },
};
// subject + body per kind; {n} {title} {price} {model} are filled in
const MSG: Record<string, Record<Lang, [string, string]>> = {
  welcome: {
    sr: ["SWISCARS | Potvrda upita za {model}", "Hvala na upitu za {model}. Primili smo vaše uslove i javićemo vam se u roku od 24 sata sa do 3 predloga vozila i procenom ukupne cene u Srbiji.\n\nStatus, svoje uslove i predloge pratite preko linka ispod. Ako želite nešto da dopunite, odgovorite na ovaj mejl."],
    de: ["SWISCARS | Bestätigung Ihrer Anfrage für {model}", "Vielen Dank für Ihre Anfrage zu {model}. Wir haben Ihre Wünsche erhalten und melden uns innerhalb von 24 Stunden mit bis zu 3 Fahrzeugvorschlägen und einer Schätzung des Gesamtpreises in Serbien.\n\nÜber den Link unten sehen Sie den Status, Ihre Wünsche und die Vorschläge. Für Ergänzungen antworten Sie auf diese E-Mail."],
    en: ["SWISCARS | Confirmation of your request for {model}", "Thank you for your request for {model}. We have received your requirements and will contact you within 24 hours with up to 3 vehicle proposals and an estimated total price in Serbia.\n\nUse the link below to view your status, requirements and proposals. Reply to this email if you would like to add anything."],
  },
  check_yes: {
    sr: ["Prva provera tržišta je gotova – SWISCARS", "naš asistent je završio prvu proveru tržišta za {model}: u Švajcarskoj smo pronašli {n} vozila koja bi mogla da odgovaraju vašem budžetu. Naš tim ih sada proverava i javlja vam se sa konkretnim predlogom."],
    de: ["Erste Marktprüfung abgeschlossen – SWISCARS", "unser Assistent hat die erste Marktprüfung für {model} abgeschlossen: Wir haben in der Schweiz {n} Fahrzeuge gefunden, die zu Ihrem Budget passen könnten. Unser Team prüft sie jetzt und meldet sich mit einem konkreten Vorschlag."],
    en: ["First market check done – SWISCARS", "our assistant has finished the first market check for {model}: we found {n} cars in Switzerland that could match your budget. Our team is now checking them and will come back with a concrete proposal."],
  },
  check_no: {
    sr: ["Prva provera tržišta – SWISCARS", "naš asistent je završio prvu proveru tržišta za {model}. Trenutno u Švajcarskoj nema vozila koja odgovaraju vašem budžetu i željama. Pratimo tržište svakodnevno i javljamo vam se čim se pojavi nešto dobro."],
    de: ["Erste Marktprüfung – SWISCARS", "unser Assistent hat die erste Marktprüfung für {model} abgeschlossen. Derzeit gibt es in der Schweiz keine passenden Fahrzeuge in Ihrem Budget. Wir beobachten den Markt täglich und melden uns, sobald etwas Gutes auftaucht."],
    en: ["First market check – SWISCARS", "our assistant has finished the first market check for {model}. Right now there are no cars in Switzerland that match your budget and wishes. We watch the market daily and will contact you as soon as something good appears."],
  },
  proposal: {
    sr: ["Imamo predlog za vas – SWISCARS", "imamo predlog za vas: {title}, cena u Srbiji {price}. Pogledajte detalje na svom linku i javite nam jednim klikom da li vam odgovara ili da tražimo dalje."],
    de: ["Wir haben einen Vorschlag für Sie – SWISCARS", "wir haben einen Vorschlag für Sie: {title}, Preis in Serbien {price}. Sehen Sie sich die Details über Ihren Link an und sagen Sie uns mit einem Klick, ob er passt oder ob wir weitersuchen sollen."],
    en: ["We have a proposal for you – SWISCARS", "we have a proposal for you: {title}, price in Serbia {price}. See the details via your link and tell us with one click whether it suits you or we should keep searching."],
  },
  proposals: {
    sr: ["Imamo {n} predloga za vas – SWISCARS", "pronašli smo {n} auta za vaš upit za {model}. Na svom linku za svako vidite oglas sa slikama, procenu ukupne cene u Srbiji i cenu pregleda. Za auto koje vas zanima kliknite „Želim pregled“, a za ostala „Ne zanima me“, pa tražimo dalje."],
    de: ["Wir haben {n} Vorschläge für Sie – SWISCARS", "wir haben {n} Autos für Ihre Anfrage zu {model} gefunden. Über Ihren Link sehen Sie zu jedem das Inserat mit Fotos, den geschätzten Gesamtpreis in Serbien und die Prüfkosten. Für ein Auto, das Sie interessiert, klicken Sie „Prüfung gewünscht“, für die anderen „Nicht interessiert“, dann suchen wir weiter."],
    en: ["We have {n} proposals for you – SWISCARS", "we found {n} cars for your request for {model}. Via your link you see for each the listing with photos, the estimated total price in Serbia and the inspection cost. For a car you like click “I want an inspection”, for the others “Not interested”, and we keep searching."],
  },
  photos: {
    sr: ["Slike i opis su stigli – SWISCARS", "poslali smo slike i opis za {title}, cena u Srbiji {price}. Pogledajte ih na svom linku. Ako vam auto odgovara, kliknite „Želim ovo auto“."],
    de: ["Fotos und Beschreibung sind da – SWISCARS", "wir haben Fotos und Beschreibung zu {title} hinzugefügt, Preis in Serbien {price}. Sehen Sie sie über Ihren Link an. Wenn das Auto passt, klicken Sie auf „Ich möchte dieses Auto“."],
    en: ["Photos and description are ready – SWISCARS", "we added photos and a description for {title}, price in Serbia {price}. See them via your link. If the car suits you, click “I want this car”."],
  },
  zelim_ok: {
    sr: ["Proveravamo dostupnost auta – SWISCARS", "hvala, zainteresovani ste za {title}. Prvo proveravamo kod prodavca da li je auto još dostupno. Čim potvrdi, šaljemo vam podatke za uplatu kapare."],
    de: ["Wir prüfen die Verfügbarkeit – SWISCARS", "danke für Ihr Interesse an {title}. Zuerst fragen wir beim Verkäufer nach, ob das Auto noch verfügbar ist. Sobald er bestätigt, senden wir Ihnen die Zahlungsangaben für die Anzahlung."],
    en: ["We are checking availability – SWISCARS", "thank you for your interest in {title}. First we check with the seller that the car is still available. As soon as he confirms, we send you the payment details for the deposit."],
  },
  unavail: {
    sr: ["Auto više nije dostupno – SWISCARS", "nažalost, {title} više nije dostupno. Tražimo drugo auto po vašim željama i šaljemo vam nove predloge na isti link."],
    de: ["Auto nicht mehr verfügbar – SWISCARS", "leider ist {title} nicht mehr verfügbar. Wir suchen ein anderes Auto nach Ihren Wünschen und senden Ihnen neue Vorschläge über denselben Link."],
    en: ["Car no longer available – SWISCARS", "unfortunately {title} is no longer available. We are looking for another car that fits your wishes and will send new proposals to the same link."],
  },
  deposit_req: {
    sr: ["Kapara za pregled auta – SWISCARS", "auto {title} je dostupno. Da bi naš čovek krenuo na pregled, molimo uplatite kaparu od {dep}.\n\n{pay}\n\nAko posle pregleda kupite auto, kapara je deo cene. Ako ne kupite, zadržavamo samo trošak pregleda, a ostatak vam vraćamo."],
    de: ["Anzahlung für die Prüfung – SWISCARS", "das Auto {title} ist verfügbar. Damit unser Mitarbeiter zur Prüfung losfährt, überweisen Sie bitte die Anzahlung von {dep}.\n\n{pay}\n\nKaufen Sie das Auto nach der Prüfung, ist die Anzahlung Teil des Preises. Wenn nicht, behalten wir nur die Prüfkosten und zahlen den Rest zurück."],
    en: ["Deposit for the inspection – SWISCARS", "the car {title} is available. For our person to go and inspect it, please pay the deposit of {dep}.\n\n{pay}\n\nIf you buy the car after the inspection, the deposit is part of the price. If not, we keep only the inspection cost and refund the rest."],
  },
  deposit_ok: {
    sr: ["Kapara je primljena – SWISCARS", "primili smo kaparu od {dep} za {title}. Naš čovek ide na pregled, a vi dobijate slike i njegovo mišljenje čim pogleda auto."],
    de: ["Anzahlung erhalten – SWISCARS", "wir haben die Anzahlung von {dep} für {title} erhalten. Unser Mitarbeiter fährt zur Prüfung; Sie erhalten Fotos und seine Einschätzung, sobald er das Auto gesehen hat."],
    en: ["Deposit received – SWISCARS", "we received the deposit of {dep} for {title}. Our person is going to inspect the car, and you will get photos and his opinion as soon as he has seen it."],
  },
  insp_report: {
    sr: ["Pregled je gotov – SWISCARS", "naš čovek je pregledao {title}: {note}\n\nSlike i detalje vidite na svom linku. Tamo kliknite „Kupujem“ ili „Ne kupujem“."],
    de: ["Die Prüfung ist abgeschlossen – SWISCARS", "unser Mitarbeiter hat {title} geprüft: {note}\n\nFotos und Details sehen Sie über Ihren Link. Dort klicken Sie „Ich kaufe“ oder „Ich kaufe nicht“."],
    en: ["The inspection is done – SWISCARS", "our person inspected {title}: {note}\n\nPhotos and details are on your link. There click “I'm buying” or “I'm not buying”."],
  },
  insp_no: {
    sr: ["Auto nije prošlo pregled – SWISCARS", "naš čovek je pregledao {title} i auto nije onakvo kakvo treba: {note}\n\nNa svom linku izaberite: da vam vratimo kaparu ili da tražimo drugo auto (kapara ostaje za sledeće)."],
    de: ["Das Auto hat die Prüfung nicht bestanden – SWISCARS", "unser Mitarbeiter hat {title} geprüft, das Auto ist nicht wie erwartet: {note}\n\nWählen Sie über Ihren Link: Anzahlung zurück oder wir suchen ein anderes Auto (die Anzahlung bleibt dafür bestehen)."],
    en: ["The car did not pass inspection – SWISCARS", "our person inspected {title} and the car is not as expected: {note}\n\nChoose via your link: deposit back, or we look for another car (the deposit stays for it)."],
  },
  refund_done: {
    sr: ["Kapara je vraćena – SWISCARS", "vratili smo vam {ref} od kapare (kapara umanjena za trošak pregleda). Hvala na poverenju. Ako želite, i dalje tražimo auto za vas."],
    de: ["Anzahlung zurückgezahlt – SWISCARS", "wir haben Ihnen {ref} der Anzahlung zurückgezahlt (Anzahlung abzüglich Prüfkosten). Danke für Ihr Vertrauen. Gerne suchen wir weiter für Sie."],
    en: ["Deposit refunded – SWISCARS", "we refunded {ref} of your deposit (deposit minus the inspection cost). Thank you for your trust. We are happy to keep searching for you."],
  },
  car_kupljen: {
    sr: ["Auto je kupljeno za vas – SWISCARS", "auto je kupljeno za vas u Švajcarskoj. Sledi transport do Srbije, carina i priprema. Na svom linku uvek vidite gde je auto."],
    de: ["Das Auto wurde für Sie gekauft – SWISCARS", "das Auto wurde für Sie in der Schweiz gekauft. Es folgen Transport nach Serbien, Zoll und Aufbereitung. Über Ihren Link sehen Sie jederzeit, wo sich das Auto befindet."],
    en: ["Your car has been bought – SWISCARS", "the car has been bought for you in Switzerland. Next come transport to Serbia, customs and preparation. Your link always shows where the car is."],
  },
  car_transport: {
    sr: ["Vaše auto je krenulo ka Srbiji – SWISCARS", "vaše auto je utovareno i krenulo je iz Švajcarske ka Srbiji."],
    de: ["Ihr Auto ist unterwegs nach Serbien – SWISCARS", "Ihr Auto wurde verladen und ist von der Schweiz nach Serbien unterwegs."],
    en: ["Your car is on its way to Serbia – SWISCARS", "your car has been loaded and is on its way from Switzerland to Serbia."],
  },
  car_carinjen: {
    sr: ["Auto je stiglo i ocarinjeno – SWISCARS", "vaše auto je stiglo u Srbiju i ocarinjeno je. Sledi priprema: servis, provera i pranje."],
    de: ["Das Auto ist angekommen und verzollt – SWISCARS", "Ihr Auto ist in Serbien angekommen und verzollt. Jetzt folgt die Aufbereitung: Service, Prüfung und Reinigung."],
    en: ["Your car has arrived and cleared customs – SWISCARS", "your car has arrived in Serbia and cleared customs. Next is preparation: service, inspection and cleaning."],
  },
  car_prodaja: {
    sr: ["Auto je spremno za preuzimanje – SWISCARS", "vaše auto je spremno za preuzimanje. Javljamo vam se da dogovorimo termin, a možete nam se javiti i sami."],
    de: ["Ihr Auto ist abholbereit – SWISCARS", "Ihr Auto ist abholbereit. Wir melden uns, um einen Termin zu vereinbaren – Sie können sich auch gerne direkt melden."],
    en: ["Your car is ready for pick-up – SWISCARS", "your car is ready for pick-up. We will contact you to arrange a time – feel free to get in touch as well."],
  },
  car_prodat: {
    sr: ["Hvala na poverenju – SWISCARS", "auto je predato. Hvala vam na poverenju i srećna vožnja! Ako vam zatreba još jedno auto ili preporuka, tu smo."],
    de: ["Danke für Ihr Vertrauen – SWISCARS", "das Auto wurde übergeben. Vielen Dank für Ihr Vertrauen und gute Fahrt! Wenn Sie wieder ein Auto suchen, sind wir für Sie da."],
    en: ["Thank you for your trust – SWISCARS", "the car has been handed over. Thank you for your trust and enjoy the drive! If you ever need another car, we are here."],
  },
};

// inspection on order (collection "inspections", page /pregled/#token)
const PG: Record<string, Record<Lang, [string, string]>> = {
  pg_new: {
    sr: ["Narudžbina pregleda je primljena – SWISCARS", "hvala na narudžbini pregleda za {car} ({place}). Cena pregleda: {fee}.\n\n{pay}\n\nČim uplata legne, dogovaramo termin sa prodavcem. Pregledamo da li je auto lupan, papirologiju i tehničko stanje, slikamo i šaljemo vam pisani izveštaj."],
    de: ["Prüfauftrag erhalten – SWISCARS", "vielen Dank für Ihren Prüfauftrag für {car} ({place}). Preis der Prüfung: {fee}.\n\n{pay}\n\nNach Zahlungseingang vereinbaren wir einen Termin mit dem Verkäufer. Wir prüfen Unfallschäden, Papiere und technischen Zustand, machen Fotos und senden Ihnen einen schriftlichen Bericht."],
    en: ["Inspection order received – SWISCARS", "thank you for ordering an inspection of {car} ({place}). Inspection price: {fee}.\n\n{pay}\n\nOnce the payment arrives, we arrange a time with the seller. We check accident damage, paperwork and technical condition, take photos and send you a written report."],
  },
  pg_paid: {
    sr: ["Uplata za pregled je primljena – SWISCARS", "primili smo uplatu za pregled {car}. Dogovaramo termin sa prodavcem i javljamo vam se."],
    de: ["Zahlung für die Prüfung erhalten – SWISCARS", "wir haben die Zahlung für die Prüfung von {car} erhalten. Wir vereinbaren einen Termin mit dem Verkäufer und melden uns."],
    en: ["Payment for the inspection received – SWISCARS", "we received the payment for the inspection of {car}. We are arranging a time with the seller and will get back to you."],
  },
  pg_report: {
    sr: ["Izveštaj sa pregleda je spreman – SWISCARS", "pregledali smo {car}. Izveštaj sa slikama vidite na svom linku."],
    de: ["Der Prüfbericht ist bereit – SWISCARS", "wir haben {car} geprüft. Den Bericht mit Fotos sehen Sie über Ihren Link."],
    en: ["Your inspection report is ready – SWISCARS", "we have inspected {car}. See the report with photos via your link."],
  },
};
const PG_BTN: Record<Lang, string> = { sr: "Pogledaj moj pregled", de: "Meine Prüfung ansehen", en: "View my inspection" };

function composePg(kind: string, x: Record<string, any>, pay = "") {
  const lang: Lang = (["sr", "de", "en"].includes(x.lang) ? x.lang : "sr") as Lang;
  const m = PG[kind]?.[lang]; if (!m) return null;
  const c = COMMON[lang];
  const fee = x.fee != null ? `${num(x.fee)} CHF` : (lang === "de" ? "nach Absprache (wir melden uns)" : lang === "en" ? "on request (we will contact you)" : "po dogovoru (javićemo vam se)");
  const payTxt = x.fee == null ? "" : (pay || (lang === "de" ? "Die Zahlungsangaben senden wir Ihnen persönlich." : lang === "en" ? "We will send you the payment details personally." : "Podatke za uplatu šaljemo vam lično."));
  const body = m[1].replace("{car}", x.car || x.url || "").replace("{place}", x.ort || x.place || "").replace("{fee}", fee).replace("{pay}", payTxt).replace(/\n\n\n\n/g, "\n\n");
  const first = String(x.name || "").split(" ")[0] || "";
  const link = `https://swiscars.com/pregled/#${x.token}`;
  const text = `${c.hello.replace("{name}", first)}\n\n${body}\n\n${PG_BTN[lang]}: ${link}\n\n${c.sign}\n\nSWISCARS GmbH · info@swiscars.com · +41 79 905 61 64 · swiscars.com`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#16191d;max-width:560px">
<p style="font-size:20px;font-weight:bold;color:#9a6f2f;letter-spacing:1px;margin:0 0 18px">SWISCARS</p>
<p>${esc(c.hello.replace("{name}", first))}</p><p style="white-space:pre-line">${esc(body)}</p>
<p><a href="${link}" style="display:inline-block;background:#b7863d;color:#1a1205;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${esc(PG_BTN[lang])}</a></p>
<p style="font-size:13px;color:#5d666e">${esc(link)}</p><p style="white-space:pre-line">${esc(c.sign)}</p></div>`;
  return { subject: m[0], text, html };
}

function compose(kind: string, l: Record<string, any>, payload: Record<string, any>, car: Record<string, any> | null, pay = "", rate = 1.057) {
  const lang: Lang = (["sr", "de", "en"].includes(l.lang) ? l.lang : "sr") as Lang;
  const key = kind === "check" ? ((payload?.n ?? 0) > 0 ? "check_yes" : "check_no") : kind;
  const m = MSG[key]?.[lang]; if (!m) return null;
  const c = COMMON[lang];
  const p = payload || {};
  const title = [p.title || car?.model, p.year || car?.year].filter(Boolean).join(" ");
  const price = p.price ? `${num(p.price)} €` : (lang === "de" ? "nach Absprache" : lang === "en" ? "on request" : "po dogovoru");
  const dep = p.deposit ? `${num(p.deposit)} €` : "";
  const ref = p.deposit ? `${num(Math.max(0, Number(p.deposit) - Math.round(Number(p.inspFee || 0) * rate)))} €` : "";
  const payTxt = pay || (lang === "de" ? "Die Zahlungsangaben senden wir Ihnen persönlich." : lang === "en" ? "We will send you the payment details personally." : "Podatke za uplatu šaljemo vam lično.");
  const body = m[1].replace("{model}", l.model || "").replace("{n}", String(p.n ?? "")).replace("{title}", title).replace("{price}", price)
    .replace("{dep}", dep).replace("{ref}", ref).replace("{pay}", payTxt).replace("{note}", p.inspNote || "");
  const first = String(l.name || "").split(" ")[0] || "";
  const link = `https://swiscars.com/upit/#${l.token}`;
  const greeting = key === "welcome" ? "" : c.hello.replace("{name}", first);
  const signature = key === "welcome" ? "SWISCARS" : "SWISCARS GmbH";
  const text = `${greeting ? greeting + "\n\n" : ""}${body}\n\n${c.btn}:\n${link}\n\n${c.sign}\n\n${signature} · info@swiscars.com · +41 79 905 61 64 · swiscars.com\n${c.foot}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#16191d;max-width:560px">
<p style="font-size:20px;font-weight:bold;color:#9a6f2f;letter-spacing:1px;margin:0 0 18px">SWISCARS</p>
${greeting ? `<p>${esc(greeting)}</p>` : ""}<p style="white-space:pre-line">${esc(body)}</p>
<p><a href="${link}" style="display:inline-block;background:#b7863d;color:#1a1205;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${esc(c.btn)}</a></p>
<p style="font-size:13px;color:#5d666e">${esc(link)}</p>
<p style="white-space:pre-line">${esc(c.sign)}</p>
<p style="font-size:12px;color:#5d666e;border-top:1px solid #e6e2da;padding-top:10px">${signature} · info@swiscars.com · +41 79 905 61 64 · swiscars.com<br>${esc(c.foot)}</p></div>`;
  return { subject: m[0].replace("{n}", String(p.n ?? "")).replace("{model}", String(l.model || "").replace(/[\r\n]/g, " ").slice(0, 160)), text, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return json({ ok: false, reason: "not_configured" });

  const { data: rows, error } = await sb.rpc("sc_claim_mail", { p_limit: 25 });
  if (error) return json({ ok: false, reason: "queue", detail: error.message }, 500);
  if (!rows?.length) return json({ ok: true, sent: 0 });

  const client = new SMTPClient({
    connection: { hostname: Deno.env.get("SMTP_HOST") || "asmtp.mail.hostpoint.ch", port: Number(Deno.env.get("SMTP_PORT") || 465), tls: true, auth: { username: user, password: pass } },
  });
  let sent = 0;
  for (const r of rows) {
    let err: string | null = null;
    try {
      if (String(r.kind).startsWith("pg_")) {
        const { data: ir } = await sb.from("sc_docs").select("data").eq("collection", "inspections").eq("id", r.lead_id).maybeSingle();
        const x = ir?.data as Record<string, any> | undefined;
        if (!x) err = "no_inspection";
        else if (r.kind === "pg_team") {
          const t = `Nova narudžbina pregleda\n\nAuto: ${x.car || "—"}\nOglas: ${x.url || "—"}\nMesto: ${x.ort || x.place || "—"}${x.dist != null ? ` (~${x.dist} km od St. Gallena)` : ""}\nCena: ${x.fee != null ? x.fee + " CHF" : "po dogovoru — upišite cenu u aplikaciji"}\nKupac: ${x.name || "—"} · ${x.phone || "—"} · ${x.email || "—"}\nNapomena: ${x.note || "—"}\n\nU aplikaciji: https://swiscars.com/intern/ (kartica Upiti → Pregled po narudžbini)`;
          await client.send({ from: `SWISCARS sajt <${user}>`, to: user, replyTo: x.email || user, subject: `Pregled: ${x.car || x.ort || ""} (${x.name || ""})`, content: t });
          sent++;
        } else if (!x.email) err = "no_email";
        else {
          const { data: sr } = await sb.from("sc_docs").select("data").eq("collection", "settings").eq("id", "main").maybeSingle();
          const msg = composePg(r.kind, x, String((sr?.data as any)?.payInfo || ""));
          if (!msg) err = "unknown_kind";
          else { await client.send({ from: `SWISCARS <${user}>`, to: x.email, replyTo: user, subject: msg.subject, content: msg.text, html: msg.html }); sent++; }
        }
        await sb.from("sc_mail_queue").update({ error: err }).eq("id", r.id);
        continue;
      }
      const { data: lr } = await sb.from("sc_docs").select("data").eq("collection", "leads").eq("id", r.lead_id).maybeSingle();
      const l = lr?.data as Record<string, any> | undefined;
      if (l && r.kind === "team") {
        const t = `${r.payload?.text || ""}\n\nPotražilac: ${l.name || "—"} · ${l.phone || "—"} · ${l.email || "—"}\nU aplikaciji: https://swiscars.com/intern/`;
        await client.send({ from: `SWISCARS asistent <${user}>`, to: user, replyTo: l.email || user, subject: `Upit ${l.name || ""}: ${String(r.payload?.text || "").slice(0, 70)}`, content: t });
        sent++; await sb.from("sc_mail_queue").update({ error: null }).eq("id", r.id); continue;
      }
      if (!l) err = "no_lead";
      else if (!l.email) err = "no_email";
      else if (!l.token) err = "no_token";
      else {
        let car = null;
        if (l.carId) { const { data: cr } = await sb.from("sc_docs").select("data").eq("collection", "cars").eq("id", l.carId).maybeSingle(); car = cr?.data ?? null; }
        const { data: sr } = await sb.from("sc_docs").select("data").eq("collection", "settings").eq("id", "main").maybeSingle();
        const msg = compose(r.kind, l, r.payload, car, String((sr?.data as any)?.payInfo || ""), Number((sr?.data as any)?.rate) || 1.057);
        if (!msg) err = "unknown_kind";
        else {
          await client.send({ from: `SWISCARS - Upiti za vozila <${user}>`, to: l.email, replyTo: user, subject: msg.subject, content: msg.text, html: msg.html });
          if (r.kind === "welcome") {
            const team = `Novi upit sa sajta\n\nIme: ${l.name}\nTelefon: ${l.phone || "—"}\nEmail: ${l.email || "—"}\nModel: ${l.model}\nBudžet: ${l.budget || "—"} €\nKilometraža: ${l.mileage || "—"}\nMenjač: ${l.gearbox || "—"}\nNapomena: ${l.note || "—"}\n\nU evidenciji: https://swiscars.com/intern/ (kartica Upiti)\nLink potražioca: https://swiscars.com/upit/#${l.token}`;
            await client.send({ from: `SWISCARS sajt <${user}>`, to: user, replyTo: l.email, subject: `Novi upit: ${l.model} (${l.name})`, content: team });
          }
          sent++;
        }
      }
    } catch (e) {
      err = "smtp: " + String(e).slice(0, 300);
      await sb.from("sc_mail_queue").update({ sent_at: null, error: err }).eq("id", r.id);
      continue;
    }
    await sb.from("sc_mail_queue").update({ error: err }).eq("id", r.id);
  }
  try { await client.close(); } catch (_) { /* ignore */ }
  return json({ ok: true, sent });
});
