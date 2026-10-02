// SWISCARS: start the KI assistant right away when a team member clicks
// "KI predlog modela", "Traži ove modele" or "Zatraži proveru tržišta" in the app.
// It only fires the existing scheduled task (routine); what the assistant does is decided
// by the requests it finds in the database (runs/analysis, runs/target, runs/lock).
// Secrets (Supabase → Edge Functions → Secrets): ROUTINE_TOKEN (API trigger token of the routine).
// Optional: ROUTINE_ID (default: the SWISCARS routine).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const KINDS: Record<string, string> = { analysis: "KI predlog modela", target: "Traži ove modele", lock: "provera tržišta" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false }, 405);
  const token = Deno.env.get("ROUTINE_TOKEN");
  if (!token) return json({ ok: false, reason: "not_configured" });
  const routine = Deno.env.get("ROUTINE_ID") || "trig_01CEdDQF6stYnBEfRWx42nBo";

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return json({ ok: false, reason: "auth" }, 401);
  const { data: m } = await sb.from("sc_members").select("name,active").eq("user_id", u.user.id).maybeSingle();
  if (!m || m.active === false) return json({ ok: false, reason: "auth" }, 403);

  let kind = "";
  try { kind = String((await req.json())?.kind || ""); } catch (_) { /* no body */ }
  if (!KINDS[kind]) return json({ ok: false, reason: "kind" }, 400);

  // only start when that request is really waiting, and not twice within 20 s (double click)
  const { data: d } = await sb.from("sc_docs").select("data").eq("collection", "runs").eq("id", kind).maybeSingle();
  const r = (d?.data || {}) as Record<string, any>;
  if (!r.requested) return json({ ok: false, reason: "no_request" });
  const now = Date.now();
  if (r.kickedAt && now - Number(r.kickedAt) < 20000) return json({ ok: true, skipped: "recent" });

  const res = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${routine}/fire`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ text: `Pokrenuto iz aplikacije: ${KINDS[kind]} (${m.name || "tim"}). Uradi ono što je zatraženo u bazi, kao i inače.` }),
  });
  if (!res.ok) return json({ ok: false, reason: "fire", status: res.status, detail: (await res.text()).slice(0, 300) }, 502);
  await sb.from("sc_docs").update({ data: { ...r, kickedAt: now } }).eq("collection", "runs").eq("id", kind);
  return json({ ok: true });
});
