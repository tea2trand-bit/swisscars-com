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
    sr: ["Primili smo vaš upit – SWISCARS", "hvala na upitu za {model}. Naš asistent pretražuje švajcarsko tržište i u roku od sat vremena (7–21 h) šalje vam do 3 predloga sa linkom na oglas i procenom ukupne cene u Srbiji.\n\nKako radimo: za auto koje vas zanima uplaćujete kaparu od 10%, i tek tada naš čovek pregleda auto na licu mesta. Posle pregleda dobijate slike i mišljenje i odlučujete. Ako kupujete, kapara je deo cene, a ostatak plaćate kad auto stigne u Srbiju. Ako ne kupujete, zadržavamo samo trošak pregleda (100 CHF do 50 km, 200 CHF do 100 km od St. Gallena), a ostatak kapare vam vraćamo. Naša provizija je 1.000 CHF i uračunata je u procenu cene."],
    de: ["Wir haben Ihre Anfrage erhalten – SWISCARS", "vielen Dank für Ihre Anfrage zu {model}. Unser Assistent durchsucht den Schweizer Markt und sendet Ihnen innerhalb einer Stunde (7–21 Uhr) bis zu 3 Vorschläge mit Link zum Inserat und geschätztem Gesamtpreis in Serbien.\n\nSo arbeiten wir: Für ein Auto, das Sie interessiert, leisten Sie eine Anzahlung von 10 %, erst dann prüft unser Mitarbeiter das Auto vor Ort. Danach erhalten Sie Fotos und seine Einschätzung und entscheiden. Wenn Sie kaufen, ist die Anzahlung Teil des Preises, den Rest zahlen Sie bei Ankunft in Serbien. Wenn nicht, behalten wir nur die Prüfkosten (100 CHF bis 50 km, 200 CHF bis 100 km ab St. Gallen) und zahlen den Rest zurück. Unsere Provision beträgt 1'000 CHF und ist im geschätzten Preis enthalten."],
    en: ["We received your request – SWISCARS", "thank you for your request for {model}. Our assistant searches the Swiss market and within an hour (7am–9pm) sends you up to 3 proposals with a link to the listing and an estimated total price in Serbia.\n\nHow we work: for a car you like, you pay a 10% deposit, and only then does our person inspect it on site. After the inspection you get photos and his opinion and decide. If you buy, the deposit is part of the price and you pay the rest when the car arrives in Serbia. If not, we keep only the inspection cost (100 CHF up to 50 km, 200 CHF up to 100 km from St. Gallen) and refund the rest. Our commission is 1,000 CHF and is included in the estimate."],
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
  deposit_req: {
    sr: ["Kapara za pregled auta – SWISCARS", "hvala, želite pregled za {title}. Da bi naš čovek krenuo, molimo uplatite kaparu od {dep}.\n\n{pay}\n\nAko posle pregleda kupite auto, kapara je deo cene. Ako ne kupite, zadržavamo samo trošak pregleda, a ostatak vam vraćamo."],
    de: ["Anzahlung für die Prüfung – SWISCARS", "danke, Sie möchten eine Prüfung für {title}. Damit unser Mitarbeiter losfährt, überweisen Sie bitte die Anzahlung von {dep}.\n\n{pay}\n\nKaufen Sie das Auto nach der Prüfung, ist die Anzahlung Teil des Preises. Wenn nicht, behalten wir nur die Prüfkosten und zahlen den Rest zurück."],
    en: ["Deposit for the inspection – SWISCARS", "thank you, you want an inspection of {title}. For our person to go, please pay the deposit of {dep}.\n\n{pay}\n\nIf you buy the car after the inspection, the deposit is part of the price. If not, we keep only the inspection cost and refund the rest."],
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
  const text = `${c.hello.replace("{name}", first)}\n\n${body}\n\n${c.btn}: ${link}\n\n${c.sign}\n\nSWISCARS GmbH · info@swiscars.com · +41 79 905 61 64 · swiscars.com\n${c.foot}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#16191d;max-width:560px">
<p style="font-size:20px;font-weight:bold;color:#9a6f2f;letter-spacing:1px;margin:0 0 18px">SWISCARS</p>
<p>${esc(c.hello.replace("{name}", first))}</p><p style="white-space:pre-line">${esc(body)}</p>
<p><a href="${link}" style="display:inline-block;background:#b7863d;color:#1a1205;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${esc(c.btn)}</a></p>
<p style="font-size:13px;color:#5d666e">${esc(link)}</p>
<p style="white-space:pre-line">${esc(c.sign)}</p>
<p style="font-size:12px;color:#5d666e;border-top:1px solid #e6e2da;padding-top:10px">SWISCARS GmbH · info@swiscars.com · +41 79 905 61 64 · swiscars.com<br>${esc(c.foot)}</p></div>`;
  return { subject: m[0].replace("{n}", String(p.n ?? "")), text, html };
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
          await client.send({ from: `SWISCARS <${user}>`, to: l.email, replyTo: user, subject: msg.subject, content: msg.text, html: msg.html });
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
