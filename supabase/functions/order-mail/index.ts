// SWISCARS: automatic emails to the person who sent a request on swiscars.com.
// The database queues a message (sc_mail_queue) when something happens: request received,
// first assistant check done, new proposal, car bought / on the way / at customs / ready / handed over.
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
const num = (n: unknown) => Number(n).toLocaleString("de-CH").replace(/’/g, ".");

type Lang = "sr" | "de" | "en";
const COMMON = {
  sr: { hello: "Poštovani/a {name},", btn: "Pogledaj moj upit", sign: "Srdačan pozdrav,\nTim SWISCARS", foot: "Ovu poruku ste dobili jer ste poslali upit na swiscars.com. Na poruku možete direktno odgovoriti." },
  de: { hello: "Guten Tag {name}", btn: "Meine Anfrage ansehen", sign: "Freundliche Grüsse\nIhr SWISCARS-Team", foot: "Sie erhalten diese Nachricht, weil Sie auf swiscars.com eine Anfrage gesendet haben. Sie können direkt auf diese E-Mail antworten." },
  en: { hello: "Dear {name},", btn: "View my request", sign: "Kind regards,\nThe SWISCARS team", foot: "You are receiving this message because you sent a request on swiscars.com. You can reply directly to this email." },
};
// subject + body per kind; {n} {title} {price} {model} are filled in
const MSG: Record<string, Record<Lang, [string, string]>> = {
  welcome: {
    sr: ["Primili smo vaš upit – SWISCARS", "hvala na upitu za {model}. Primili smo ga i krećemo u potragu za vozilom u Švajcarskoj. Kada pronađemo auto koje odgovara vašim željama i budžetu, javljamo vam se sa predlogom. Status upita uvek vidite na svom linku."],
    de: ["Wir haben Ihre Anfrage erhalten – SWISCARS", "vielen Dank für Ihre Anfrage zu {model}. Wir beginnen mit der Suche in der Schweiz. Sobald wir ein passendes Auto in Ihrem Budget finden, melden wir uns mit einem Vorschlag. Den Stand sehen Sie jederzeit über Ihren Link."],
    en: ["We received your request – SWISCARS", "thank you for your request for {model}. We are starting the search in Switzerland. As soon as we find a car that matches your wishes and budget, we will come back with a proposal. You can always see the status via your link."],
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

function compose(kind: string, l: Record<string, any>, payload: Record<string, any>, car: Record<string, any> | null) {
  const lang: Lang = (["sr", "de", "en"].includes(l.lang) ? l.lang : "sr") as Lang;
  const key = kind === "check" ? ((payload?.n ?? 0) > 0 ? "check_yes" : "check_no") : kind;
  const m = MSG[key]?.[lang]; if (!m) return null;
  const c = COMMON[lang];
  const p = payload || {};
  const title = [p.title || car?.model, p.year || car?.year].filter(Boolean).join(" ");
  const price = p.price ? `${num(p.price)} €` : (lang === "de" ? "nach Absprache" : lang === "en" ? "on request" : "po dogovoru");
  const body = m[1].replace("{model}", l.model || "").replace("{n}", String(p.n ?? "")).replace("{title}", title).replace("{price}", price);
  const first = String(l.name || "").split(" ")[0] || "";
  const link = `https://swiscars.com/upit/#${l.token}`;
  const text = `${c.hello.replace("{name}", first)}\n\n${body}\n\n${c.btn}: ${link}\n\n${c.sign}\n\nSWISCARS GmbH · info@swiscars.com · +41 79 905 61 64 · swiscars.com\n${c.foot}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#16191d;max-width:560px">
<p style="font-size:20px;font-weight:bold;color:#9a6f2f;letter-spacing:1px;margin:0 0 18px">SWISCARS</p>
<p>${esc(c.hello.replace("{name}", first))}</p><p>${esc(body)}</p>
<p><a href="${link}" style="display:inline-block;background:#b7863d;color:#1a1205;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${esc(c.btn)}</a></p>
<p style="font-size:13px;color:#5d666e">${esc(link)}</p>
<p style="white-space:pre-line">${esc(c.sign)}</p>
<p style="font-size:12px;color:#5d666e;border-top:1px solid #e6e2da;padding-top:10px">SWISCARS GmbH · info@swiscars.com · +41 79 905 61 64 · swiscars.com<br>${esc(c.foot)}</p></div>`;
  return { subject: m[0], text, html };
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
      if (!l) err = "no_lead";
      else if (!l.email) err = "no_email";
      else if (!l.token) err = "no_token";
      else {
        let car = null;
        if (l.carId) { const { data: cr } = await sb.from("sc_docs").select("data").eq("collection", "cars").eq("id", l.carId).maybeSingle(); car = cr?.data ?? null; }
        const msg = compose(r.kind, l, r.payload, car);
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
