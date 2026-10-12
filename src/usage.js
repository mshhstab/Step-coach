// تكلفة Claude: كل طلب ينحفظ في جدول api_usage قبل ما يبدأ ويتحدّث لما يخلص،
// عشان تشوف تكلفة كل درس وكل حلقة، وعشان الحد اليومي يوقف أي هدر.

// السعر بالدولار لكل مليون توكن [داخل، خارج]
const PRICES = [
  ["claude-haiku-5-5", 0.1, 0.5],
  ["claude-sonnet-5-5", 2, 10],
  ["claude-sonnet-5", 2, 10],
  ["claude-opus-5-5", 4, 20],
  ["claude-opus-5", 5, 25],
  ["claude-fable", 10, 50],
  ["claude-haiku-4-5", 1, 5],
  ["claude-sonnet-4", 3, 15]
];
const priceOf = (m) => {
  const hit = PRICES.filter(([k]) => String(m).startsWith(k)).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? [hit[1], hit[2]] : [2, 10];
};

// طلب انقطع قبل ما يرجع رده ما نعرف تكلفته بالضبط، فنحسبه بهذا التقدير
const LOST_COST = 0.1;
const STALE_MS = 15 * 60 * 1000;

const riyadhDate = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);

async function safe(fn, def) {
  try { return await fn(); } catch (e) { console.log("usage", e && e.message); return def; }
}

async function spentToday(env) {
  const r = await safe(() => env.DB.prepare(
    `SELECT COALESCE(SUM(cost),0) c,
            SUM(CASE WHEN status='pending' AND started<? THEN 1 ELSE 0 END) lost
       FROM api_usage WHERE date=?`
  ).bind(Date.now() - STALE_MS, riyadhDate()).first(), null);
  return r ? r.c + (r.lost || 0) * LOST_COST : 0;
}

// يمنع الهدر: حد يومي للصرف، وحد لعدد محاولات كتابة الحلقة في اليوم
async function guard(env, kind) {
  const cap = Number(env.DAILY_CAP_USD || 1);
  const spent = await spentToday(env);
  if (spent >= cap) throw new Error(`وصلت حد الصرف اليومي (${cap}$، صرفت ${spent.toFixed(2)}$). يرجع يشتغل بكرة، أو ارفع DAILY_CAP_USD من إعدادات Cloudflare.`);
  if (kind.startsWith("podcast")) {
    const r = await safe(() => env.DB.prepare(
      "SELECT COUNT(*) n FROM api_usage WHERE date=? AND kind=?"
    ).bind(riyadhDate(), kind).first(), { n: 0 });
    const max = Number(env.POD_MAX_TRIES || 3);
    if (r.n >= max) throw new Error(`حلقة اليوم انكتبت ${r.n} مرات، وهذا الحد اليومي. تنبني من جديد بكرة.`);
  }
}

// طلب واحد لـ Claude مع تسجيل تكلفته. يرجع { r, raw, d }
export async function anthropic(env, kind, body) {
  await guard(env, kind);
  const started = Date.now();
  const ins = await safe(() => env.DB.prepare(
    "INSERT INTO api_usage(date,started,kind,model,status) VALUES(?,?,?,?,'pending')"
  ).bind(riyadhDate(), started, kind, body.model).run(), null);
  const id = ins && ins.meta && ins.meta.last_row_id;
  const finish = (status, d) => {
    if (!id) return;
    const u = (d && d.usage) || {};
    const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    const outTok = u.output_tokens || 0;
    const [pi, po] = priceOf(body.model);
    const cost = (u.input_tokens || 0) * pi / 1e6 + (u.cache_creation_input_tokens || 0) * pi * 1.25 / 1e6 +
      (u.cache_read_input_tokens || 0) * pi * 0.1 / 1e6 + outTok * po / 1e6;
    return safe(() => env.DB.prepare(
      "UPDATE api_usage SET status=?, input=?, output=?, cost=?, ms=? WHERE id=?"
    ).bind(String(status).slice(0, 60), inTok, outTok, cost, Date.now() - started, id).run());
  };
  let r, raw;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    raw = await r.text();
  } catch (e) {
    await finish("network: " + (e && e.message), null);
    throw e;
  }
  let d = null;
  try { d = JSON.parse(raw); } catch (e) {}
  await finish(r.ok ? (d && d.stop_reason) || "ok" : "http " + r.status, d);
  return { r, raw, d };
}

// صفحة التكلفة في التطبيق
export async function usageReport(env) {
  const t = riyadhDate();
  const month = t.slice(0, 7);
  const stale = Date.now() - STALE_MS;
  const row = (sql, ...b) => env.DB.prepare(sql).bind(...b).first();
  const sumSql = `SELECT COALESCE(SUM(cost),0) + ${LOST_COST} * SUM(CASE WHEN status='pending' AND started<? THEN 1 ELSE 0 END) c, COUNT(*) n FROM api_usage WHERE `;
  const today = await row(sumSql + "date=?", stale, t);
  const mon = await row(sumSql + "substr(date,1,7)=?", stale, month);
  const all = await row(sumSql + "1=1", stale);
  const { results: byDay } = await env.DB.prepare(
    `SELECT date, kind, COUNT(*) n, COALESCE(SUM(cost),0) c,
            SUM(CASE WHEN status='pending' AND started<? THEN 1 ELSE 0 END) lost
       FROM api_usage WHERE date>=? GROUP BY date, kind ORDER BY date DESC`
  ).bind(stale, new Date(Date.parse(t + "T00:00:00Z") - 13 * 864e5).toISOString().slice(0, 10)).all();
  const { results: recent } = await env.DB.prepare(
    "SELECT date, started, kind, model, status, input, output, cost, ms FROM api_usage ORDER BY id DESC LIMIT 25"
  ).all();
  return {
    today: t,
    cap: Number(env.DAILY_CAP_USD || 1),
    spent: { today: today.c, month: mon.c, all: all.c, calls: all.n },
    byDay: byDay.map((r) => ({ ...r, c: r.c + (r.lost || 0) * LOST_COST })),
    recent: recent.map((r) => ({ ...r, status: r.status === "pending" && r.started < stale ? "انقطع" : r.status }))
  };
}
