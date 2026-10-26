// Rodin Hub reminders: web push to drivers after each session and at the end of the day.
// Called every 5 minutes by pg_cron (header x-cron), or by a signed-in user with {test:true}.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TZ = "Europe/Madrid";
const SITE = "https://rikichristo.github.io/rodin-hub/";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

let cfg: Record<string, string> | null = null;
async function config() {
  if (cfg) return cfg;
  const { data, error } = await sb.from("rh_config").select("key,value");
  if (error || !data?.length) throw new Error("config unavailable: " + (error?.message || "empty"));
  const c = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
  webpush.setVapidDetails("mailto:riki@rikichristo.com", c.vapid_public, c.vapid_private);
  return (cfg = c);
}

async function pushUser(userId: string, msg: { title: string; body: string; url: string; tag?: string }) {
  const { data: subs } = await sb.from("rh_push_subs").select("id,sub").eq("user_id", userId);
  let sent = 0;
  for (const s of subs || []) {
    try { await webpush.sendNotification(s.sub, JSON.stringify(msg), { TTL: 3600, urgency: "high" }); sent++; }
    catch (e: any) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await sb.from("rh_push_subs").delete().eq("id", s.id); else console.warn("push failed", e?.statusCode, e?.body); }
  }
  return sent;
}

// once-only guard per reminder
async function once(tag: string) {
  const { error } = await sb.from("rh_push_log").insert({ tag });
  return !error;
}

function localNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
function endMin(time: string) {
  const m = String(time || "").match(/(\d{1,2})[:.](\d{2})\D+(\d{1,2})[:.](\d{2})/);
  return m ? +m[3] * 60 + +m[4] : null;
}
function sentSessions(brief: any): Set<string> {
  const out = new Set<string>(); const d = brief?.data || {};
  (d.list || []).forEach((x: any) => { if (x.sent && x.sk) out.add(x.sk); });
  if (brief?.status === "sent" && !(d.list || []).length) Object.keys(d.s || {}).forEach((k) => out.add(k));
  return out;
}

async function runReminders(dry: boolean, at?: { date?: string; min?: number }) {
  const ln = localNow(); const date = (dry && at?.date) || ln.date, min = dry && at?.min != null ? at.min : ln.min;
  const log: string[] = [];
  const { data: events } = await sb.from("rh_events").select("*").lte("date_from", date).gte("date_to", date);
  if (!events?.length) return { date, min, log: ["no event today"] };
  const { data: profs } = await sb.from("rh_profiles").select("id,full_name,driver_id").eq("role", "driver").not("driver_id", "is", null);
  const { data: drivers } = await sb.from("rh_drivers").select("id,series_id,full_name,active").eq("active", true);
  for (const e of events) {
    const today = (e.sessions || []).filter((s: any) => s.date === date && endMin(s.time) != null);
    if (!today.length) continue;
    const lastEnd = Math.max(...today.map((s: any) => endMin(s.time)!));
    const isLastDay = e.date_to === date;
    const eds = (drivers || []).filter((d: any) => !e.series_id || d.series_id === e.series_id);
    for (const d of eds) {
      const users = (profs || []).filter((p: any) => p.driver_id === d.id);
      if (!users.length) continue;
      const first = (d.full_name || "").split(" ")[0];
      const { data: briefs } = await sb.from("rh_briefs").select("kind,status,data").eq("event_id", e.id).eq("driver_id", d.id);
      const ev = (briefs || []).find((b: any) => b.kind === "event"), post = (briefs || []).find((b: any) => b.kind === "post");
      const done = sentSessions(ev);
      const evUrl = `${SITE}#/b/${e.id}/${d.id}/event`;
      // after each session: 10 min after the end, then a nudge after 60 min
      for (const s of today) {
        const since = min - endMin(s.time)!;
        if (done.has(s.key)) continue;
        let msg = null, tag = "";
        if (since >= 10 && since < 55) { tag = `s1|${e.id}|${s.key}|${d.id}`; msg = { title: `${s.label} · session report`, body: `${first}, while it's fresh: 2 minutes on how ${s.label} went. Lap time is already filled in.`, url: evUrl }; }
        else if (since >= 60 && since < 105) { tag = `s2|${e.id}|${s.key}|${d.id}`; msg = { title: `Reminder · ${s.label}`, body: `Your ${s.label} report isn't sent yet. Quick one before the next run.`, url: evUrl }; }
        if (msg && (dry || await once(tag))) { log.push(`${dry ? "would send" : "sent"} ${tag}`); if (!dry) for (const u of users) await pushUser(u.id, { ...msg, tag: `rh-${s.key}` }); }
      }
      // end of the day: 90 min after the last session
      const since = min - lastEnd;
      if (since >= 90 && since < 135) {
        const missing = today.filter((s: any) => !done.has(s.key));
        const postDone = post?.status === "sent";
        let msg = null;
        if (isLastDay && !postDone) msg = { title: "End of test · Post-Event Report", body: `${first}, last one: your Post-Event Report.${missing.length ? ` Also ${missing.length} session report${missing.length > 1 ? "s" : ""} still to send.` : ""} 5 minutes, in your own words.`, url: missing.length ? evUrl : `${SITE}#/b/${e.id}/${d.id}/post` };
        else if (missing.length) msg = { title: "End of day", body: `${first}, ${missing.length} session report${missing.length > 1 ? "s" : ""} still to send today: ${missing.map((s: any) => s.label).join(", ")}.`, url: evUrl };
        const tag = `d|${e.id}|${date}|${d.id}`;
        if (msg && (dry || await once(tag))) { log.push(`${dry ? "would send" : "sent"} ${tag}`); if (!dry) for (const u of users) await pushUser(u.id, { ...msg, tag: "rh-day" }); }
      }
    }
  }
  return { date, min, log };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const c = await config();
  const body = await req.json().catch(() => ({}));
  if (req.headers.get("x-cron") === c.cron_secret) return json(await runReminders(!!body.dry, body.at));
  // signed-in user: send themselves a test notification
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return json({ error: "not signed in" }, 401);
  if (body.test) {
    const n = await pushUser(u.user.id, { title: "Rodin Hub reminders are on ✓", body: "You'll get a nudge after each session and at the end of the day.", url: SITE, tag: "rh-test" });
    return json({ sent: n });
  }
  if (body.key) return json({ key: c.vapid_public });
  return json({ ok: true });
});
