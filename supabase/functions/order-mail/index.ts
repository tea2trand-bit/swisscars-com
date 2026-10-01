// SWISCARS: confirmation email to the person who sent a request on swiscars.com,
// plus a copy to the team inbox. Sends through the company mailbox at Hostpoint.
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

const T: Record<string, Record<string, string>> = {
  sr: {
    subject: "Primili smo vaš upit – SWISCARS",
    hello: "Poštovani/a {name},",
    body: "hvala na upitu. Primili smo ga i krećemo u potragu za vozilom u Švajcarskoj. Kada pronađemo auto koje odgovara vašim željama i budžetu, javljamo vam se sa predlogom.",
    track: "Status vašeg upita možete pratiti ovde:",
    btn: "Prati moj upit",
    summary: "Vaš upit",
    model: "Model", budget: "Budžet", km: "Kilometraža", gear: "Menjač", notes: "Napomena",
    sign: "Srdačan pozdrav,\nTim SWISCARS",
    foot: "Ako niste poslali ovaj upit, slobodno zanemarite ovu poruku.",
  },
  de: {
    subject: "Wir haben Ihre Anfrage erhalten – SWISCARS",
    hello: "Guten Tag {name}",
    body: "vielen Dank für Ihre Anfrage. Wir haben sie erhalten und beginnen mit der Suche nach einem passenden Fahrzeug in der Schweiz. Sobald wir ein Auto finden, das zu Ihren Wünschen und Ihrem Budget passt, melden wir uns mit einem Vorschlag.",
    track: "Den Stand Ihrer Anfrage sehen Sie jederzeit hier:",
    btn: "Meine Anfrage verfolgen",
    summary: "Ihre Anfrage",
    model: "Modell", budget: "Budget", km: "Kilometerstand", gear: "Getriebe", notes: "Bemerkung",
    sign: "Freundliche Grüsse\nIhr SWISCARS-Team",
    foot: "Falls Sie diese Anfrage nicht gesendet haben, können Sie diese Nachricht ignorieren.",
  },
  en: {
    subject: "We received your request – SWISCARS",
    hello: "Dear {name},",
    body: "thank you for your request. We have received it and are starting the search for a car in Switzerland. As soon as we find a car that matches your wishes and budget, we will get back to you with a proposal.",
    track: "You can follow the status of your request here:",
    btn: "Track my request",
    summary: "Your request",
    model: "Model", budget: "Budget", km: "Mileage", gear: "Gearbox", notes: "Notes",
    sign: "Kind regards,\nThe SWISCARS team",
    foot: "If you did not send this request, you can ignore this message.",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false }, 405);
  const { token } = await req.json().catch(() => ({ token: "" }));
  if (typeof token !== "string" || !/^[a-f0-9]{24}$/.test(token)) return json({ ok: false, reason: "bad_token" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row, error } = await sb.from("sc_docs").select("id,data").eq("collection", "leads").eq("data->>token", token).maybeSingle();
  if (error || !row) return json({ ok: false, reason: "not_found" }, 404);
  const l = row.data as Record<string, any>;
  if (l.mailSentAt) return json({ ok: true, already: true });

  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return json({ ok: false, reason: "not_configured" });

  const lang = T[l.lang] ? l.lang : "sr", t = T[lang];
  const link = `https://swiscars.com/upit/#${token}`;
  const first = String(l.name || "").split(" ")[0] || "";
  const rows: [string, unknown][] = [[t.model, l.model], [t.budget, l.budget ? `${Number(l.budget).toLocaleString("de-CH")} €` : ""], [t.km, l.mileage], [t.gear, l.gearbox], [t.notes, l.note]];
  const filled = rows.filter(([, v]) => v);
  const text = `${t.hello.replace("{name}", first)}\n\n${t.body}\n\n${t.track}\n${link}\n\n${t.summary}:\n${filled.map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\n${t.sign}\n\nSWISCARS GmbH · info@swiscars.com · +41 79 905 61 64 · swiscars.com\n\n${t.foot}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#16191d;max-width:560px">
<p style="font-size:20px;font-weight:bold;color:#9a6f2f;letter-spacing:1px;margin:0 0 18px">SWISCARS</p>
<p>${esc(t.hello.replace("{name}", first))}</p><p>${esc(t.body)}</p>
<p>${esc(t.track)}</p>
<p><a href="${link}" style="display:inline-block;background:#b7863d;color:#1a1205;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${esc(t.btn)}</a></p>
<p style="font-size:13px;color:#5d666e">${esc(link)}</p>
<table style="border-collapse:collapse;margin:18px 0;font-size:14px"><tr><td colspan="2" style="font-weight:bold;padding:4px 0">${esc(t.summary)}</td></tr>${filled.map(([k, v]) => `<tr><td style="color:#5d666e;padding:3px 14px 3px 0;vertical-align:top">${esc(k)}</td><td style="padding:3px 0">${esc(v)}</td></tr>`).join("")}</table>
<p style="white-space:pre-line">${esc(t.sign)}</p>
<p style="font-size:12px;color:#5d666e;border-top:1px solid #e6e2da;padding-top:10px">SWISCARS GmbH · info@swiscars.com · +41 79 905 61 64 · swiscars.com<br>${esc(t.foot)}</p></div>`;

  const team = `Novi upit sa sajta\n\nIme: ${l.name}\nTelefon: ${l.phone || "—"}\nEmail: ${l.email || "—"}\nModel: ${l.model}\nBudžet: ${l.budget || "—"} €\nKilometraža: ${l.mileage || "—"}\nMenjač: ${l.gearbox || "—"}\nNapomena: ${l.note || "—"}\n\nU evidenciji: https://swiscars.com/intern/ (kartica Upiti)\nLink potražioca: ${link}`;

  const client = new SMTPClient({
    connection: { hostname: Deno.env.get("SMTP_HOST") || "asmtp.mail.hostpoint.ch", port: Number(Deno.env.get("SMTP_PORT") || 465), tls: true, auth: { username: user, password: pass } },
  });
  const sent: string[] = [];
  try {
    if (l.email) { await client.send({ from: `SWISCARS <${user}>`, to: l.email, replyTo: user, subject: t.subject, content: text, html }); sent.push("requester"); }
    await client.send({ from: `SWISCARS sajt <${user}>`, to: user, replyTo: l.email || user, subject: `Novi upit: ${l.model} (${l.name})`, content: team }); sent.push("team");
  } catch (e) {
    console.error("smtp", String(e));
    try { await client.close(); } catch (_) { /* ignore */ }
    return json({ ok: false, reason: "smtp_failed", sent });
  }
  try { await client.close(); } catch (_) { /* ignore */ }
  await sb.from("sc_docs").update({ data: { ...l, mailSentAt: Date.now() } }).eq("collection", "leads").eq("id", row.id);
  return json({ ok: true, sent });
});
