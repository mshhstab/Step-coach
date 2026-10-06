import { CURRICULUM } from './curriculum.js';

const TOTAL = CURRICULUM.length;
const INTERVALS = [1, 3, 7, 14, 30, 60];           // التكرار المتباعد بالأيام
const XP = { lesson: 5, quiz: 10, tomorrow: 12, review: 15, mock: 10 };
const BONUS = { quiz: 30, mock: 30, tomorrow: 20 };
const WEIGHT = { g: .30, r: .40, l: .20, c: .10 };
const SEC_EN = { g: 'Grammar/Structure', r: 'Reading comprehension', l: 'Listening comprehension', c: 'Compositional analysis' };
const PKEY = { g: 'grammar', r: 'reading', l: 'listening', c: 'compositional' };

const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // توقيت السعودية
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const now = () => new Date().toISOString();

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (!env.APP_KEY || req.headers.get('x-app-key') !== env.APP_KEY) return json({ error: 'unauthorized' }, 401);
    try {
      const p = url.pathname, m = req.method;
      if (p === '/api/state' && m === 'GET') return json(await state(env));
      const dm = p.match(/^\/api\/day\/(\d+)$/);
      if (dm && m === 'GET') return await getDay(env, +dm[1]);
      if (p === '/api/attempt' && m === 'POST') return json(await attempt(env, await req.json()));
      if (p === '/api/review' && m === 'GET') return json(await reviewGet(env));
      if (p === '/api/review' && m === 'POST') return json(await reviewPost(env, await req.json()));
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  }
};

/* ---------- meta ---------- */
async function getMeta(env, k, def) {
  const r = await env.DB.prepare('SELECT value FROM meta WHERE key=?').bind(k).first();
  return r ? JSON.parse(r.value) : def;
}
async function setMeta(env, k, v) {
  await env.DB.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .bind(k, JSON.stringify(v)).run();
}
async function addXP(env, n) {
  if (n <= 0) return;
  await setMeta(env, 'xp', (await getMeta(env, 'xp', 0)) + n);
  await env.DB.prepare('INSERT INTO activity(date,xp) VALUES(?,?) ON CONFLICT(date) DO UPDATE SET xp=xp+excluded.xp')
    .bind(today(), n).run();
}

/* ---------- progress ---------- */
async function progress(env) {
  const last = await env.DB.prepare(
    'SELECT day,has_tomorrow,tomorrow_done,done_date FROM days WHERE quiz_done=1 ORDER BY day DESC LIMIT 1').first();
  const t = today();
  if (!last) return { next: 1, locked: false, pendingTomorrow: null, done: 0 };
  const pendingTomorrow = last.has_tomorrow && !last.tomorrow_done && last.done_date < t ? last.day : null;
  const locked = last.done_date >= t; // يوم واحد فقط في اليوم
  return { next: last.day + 1, locked, pendingTomorrow, done: last.day };
}

async function weakTags(env, placement) {
  const { results } = await env.DB.prepare(
    `SELECT tag, COUNT(*) n, SUM(1-correct) w FROM
       (SELECT tag, correct FROM answers WHERE tag<>'' ORDER BY id DESC LIMIT 400)
     GROUP BY tag HAVING n>=3 ORDER BY (w*1.0/n) DESC, n DESC LIMIT 6`).all();
  const list = results.filter(r => r.w > 0).map(r => r.tag);
  return list.length ? list : ((placement && placement.weak_topics) || []).slice(0, 6);
}

/* ---------- state ---------- */
function streaks(dates, t) {
  const set = new Set(dates);
  let cur = 0, d = set.has(t) ? t : (set.has(addDays(t, -1)) ? addDays(t, -1) : null);
  while (d && set.has(d)) { cur++; d = addDays(d, -1); }
  const asc = [...set].sort(); let best = 0, run = 0, prev = null;
  for (const x of asc) { run = prev && addDays(prev, 1) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; }
  return { cur, best };
}

async function state(env) {
  const t = today();
  const xp = await getMeta(env, 'xp', 0);
  const placement = await getMeta(env, 'placement', null);
  const pr = await progress(env);
  const due = (await env.DB.prepare('SELECT COUNT(*) n FROM cards WHERE due<=?').bind(t).first()).n;
  const { results: acts } = await env.DB.prepare('SELECT date,xp FROM activity ORDER BY date DESC LIMIT 400').all();
  const st = streaks(acts.map(a => a.date), t);

  const sections = {};
  for (const s of ['g', 'r', 'l', 'c']) {
    const base = (placement && placement.sections && placement.sections[PKEY[s]]) ?? 50;
    // نعتمد على الاسترجاع المتأخر فقط (اختبار الغد والمراجعة والتجريبي) لأنه أصدق من تمرين نفس اليوم
    const { results } = await env.DB.prepare(
      "SELECT correct FROM answers WHERE sec=? AND part IN ('tomorrow','review','mock') ORDER BY id DESC LIMIT 60").bind(s).all();
    sections[s] = results.length < 15 ? base
      : Math.round(.3 * base + .7 * (results.reduce((a, r) => a + r.correct, 0) / results.length * 100));
  }
  const estimate = Math.round(Object.entries(WEIGHT).reduce((a, [k, w]) => a + sections[k] * w, 0));
  const weak = await weakTags(env, placement);
  const mastered = (await env.DB.prepare('SELECT COUNT(*) n FROM cards WHERE ivl>=14').first()).n;
  const mocks = (await env.DB.prepare("SELECT COUNT(*) n FROM days WHERE kind='mock' AND quiz_done=1").first()).n;

  const badges = [
    { n: 'أول خطوة', d: 'أنهيت أول يوم', ok: pr.done >= 1 },
    { n: 'أسبوع كامل', d: '٧ أيام متتالية', ok: st.best >= 7 },
    { n: 'شهر حديد', d: '٣٠ يوم متتالي', ok: st.best >= 30 },
    { n: 'أساس القواعد', d: 'أنهيت المرحلة الأولى', ok: pr.done >= 56 },
    { n: 'صياد الأخطاء', d: 'أنهيت التحليل الكتابي', ok: pr.done >= 70 },
    { n: 'قارئ محترف', d: 'أنهيت مرحلة القراءة', ok: pr.done >= 98 },
    { n: 'أذن ذهبية', d: 'أنهيت أسبوع الاستماع', ok: pr.done >= 105 },
    { n: 'أول تجريبي', d: 'أنهيت أول اختبار تجريبي', ok: mocks >= 1 },
    { n: '٥٠ معلومة ثابتة', d: '٥٠ غلطة صارت معلومة ثابتة', ok: mastered >= 50 },
    { n: 'المستوى ١٠', d: 'جمعت ٤٥٠٠ نقطة', ok: xp >= 4500 },
  ];

  const xpByDate = Object.fromEntries(acts.map(a => [a.date, a.xp]));
  const last14 = Array.from({ length: 14 }, (_, i) => { const d = addDays(t, i - 13); return { date: d, xp: xpByDate[d] || 0 }; });

  return {
    today: t, xp, level: Math.floor(xp / 500) + 1, levelXp: xp % 500,
    streak: st.cur, best: st.best, due, estimate, sections, weak, badges, last14, mastered,
    progress: { ...pr, total: TOTAL, item: pr.next <= TOTAL ? CURRICULUM[pr.next - 1] : null },
  };
}

/* ---------- day content ---------- */
async function getDay(env, n) {
  if (n < 1 || n > TOTAL) return json({ error: 'رقم اليوم غير صحيح' }, 400);
  let row = await env.DB.prepare('SELECT * FROM days WHERE day=?').bind(n).first();
  if (!row) {
    const pr = await progress(env);
    if (n !== pr.next || pr.locked || pr.pendingTomorrow) return json({ error: 'هذا اليوم ما انفتح لك بعد' }, 403);
    await generate(env, n);
    row = await env.DB.prepare('SELECT * FROM days WHERE day=?').bind(n).first();
  }
  return json({ ...row, content: JSON.parse(row.content) });
}

const SYS = `You are an expert tutor for the STEP exam (Standardized Test of English Proficiency, by Qiyas / ETEC, Saudi Arabia).
STEP sections: Reading comprehension (40%), Structure / grammar (30%), Listening comprehension (20%), Compositional analysis: error identification and choosing the correct sentence (10%). Every item is 4-option multiple choice.
Your learner is an adult Saudi Arabic speaker at intermediate level, studying one hour a day, aiming for 96+.
Rules:
- Every field ending in _ar is written in clear, simple Arabic: Modern Standard but close to everyday Saudi speech. Short, concrete, friendly. Use English only for examples and grammar terms.
- Questions mirror real STEP style and difficulty. Exactly 4 options, exactly one correct answer, plausible distractors that target typical Arab-learner mistakes.
- Spread the correct answer index evenly across 0,1,2,3.
- Never repeat the same sentence across items.
- Output ONLY one valid JSON object. No markdown fences, no commentary.`;

const QSPEC = `QUESTION = {
 "sec": "g" | "r" | "l" | "c",
 "tag": short Arabic topic name, 2-4 words, reuse the same tag for the same topic,
 "q": the question in English (use ___ for a blank),
 "options": [4 strings],
 "answer": index 0-3,
 "why_ar": 1-3 Arabic sentences: why it is right and what trap the wrong options set,
 "segs": [4 strings]  ONLY for error-identification items: the sentence split into 4 consecutive parts; then "options" must equal "segs" and "q" must be "Which part contains an error?",
 "passage": passage id  ONLY for reading items,
 "audio": spoken English script  ONLY for listening items (40-120 words, natural speech; repeat the identical script string for 2-3 questions on the same clip)
}
PASSAGE = {"id": "p1", "text": English academic passage}`;

function secRules(sec) {
  if (sec === 'r') return 'Reading lesson: steps teach the strategy using short excerpts. All quiz and tomorrow items are reading items (sec "r") tied to passages: quiz uses passages p1 and p2 (180-280 words each, 6 questions each), tomorrow uses a new passage p3 (8 questions). Put all three in "passages".';
  if (sec === 'l') return 'Listening lesson: all quiz and tomorrow items are listening items (sec "l") with an "audio" script. Use 4 clips in quiz (3 questions each) and 3 new clips in tomorrow.';
  if (sec === 'c') return 'Compositional analysis lesson: most items are error-identification (with "segs"); the rest are "Choose the correct sentence:" with 4 full sentences as options.';
  return 'Grammar lesson: items are STEP sentence completion (sec "g"); you may add 1-2 error-identification items (sec "c").';
}

function lessonPrompt(n, item, topic, sec, ctx, prev) {
  return `Day ${n} of ${TOTAL}, week ${item.week}.
TOPIC: ${topic}
SECTION: ${sec}
${ctx}
Recently studied: ${prev || 'nothing yet'}.
${secRules(item.kind === 'targeted' ? 'g' : item.sec)}

Return JSON:
{
 "title_ar": lesson title in Arabic,
 "intro_ar": 1-2 sentences: why this matters in STEP,
 "steps": [6 items, small to big, each {"explain_ar": 2-5 short sentences (use \\n for line breaks; you may show a formula like: If + had + V3), "examples": [2-3 English sentences], "check": QUESTION testing exactly this step}],
 "passages": [PASSAGE] (reading lessons only, otherwise []),
 "quiz": [12 QUESTION: 9 on today's topic with rising difficulty, then 3 that interleave recently studied topics],
 "tomorrow": [8 new QUESTION on today's topic at real STEP difficulty, for a delayed test tomorrow]
}
${QSPEC}`;
}

function reviewPrompt(item, titles, ctx, weak) {
  const scope = titles.length
    ? `Topics this week: ${titles.join('; ')}.`
    : `This week had mock tests. Build a mixed review across all four sections, weighted toward: ${weak.join(', ') || 'core grammar'}.`;
  return `Weekly review, week ${item.week}. ${scope}
${ctx}
${item.sec === 'r' ? 'Include 2 passages (200-260 words) and make 12 of the items reading items on them.' : ''}
${item.sec === 'l' ? 'Make all items listening items with "audio" scripts.' : ''}
Return JSON:
{"title_ar": Arabic title, "intro_ar": one Arabic sentence, "passages": [PASSAGE] or [], "quiz": [20 QUESTION interleaved across the topics, STEP difficulty]}
${QSPEC}`;
}

function mockPrompt(item, ctx) {
  const body = {
    g: 'Grammar/structure section: 25 STEP sentence-completion items (sec "g"), mixed topics, real exam difficulty, ordered easy to hard.',
    r: 'Reading section: 3 academic passages (280-340 words, ids p1-p3) with 7 items each (21 items, sec "r"): main idea, detail, vocabulary in context, reference, inference, author purpose.',
    lc: 'Listening + compositional analysis: 12 listening items (sec "l", 4 clips x 3 questions: a conversation, an announcement, two short lectures) followed by 10 compositional items (sec "c", 7 error-identification with "segs", 3 choose-the-correct-sentence).'
  }[item.sec];
  return `Mock STEP test day, week ${item.week}. ${body}
${ctx}
Do not favor the learner's weak topics; mirror the real exam.
Return JSON: {"title_ar": Arabic title, "intro_ar": one Arabic sentence with the time limit to aim for, "passages": [PASSAGE] or [], "quiz": [QUESTION...]}
${QSPEC}`;
}

async function claude(env, prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.MODEL || 'claude-sonnet-5-5', max_tokens: 14000, system: SYS,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Claude API: ' + ((d.error && d.error.message) || r.status));
  const text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

function cq(q) {
  if (!q || typeof q.q !== 'string' || !Array.isArray(q.options) || q.options.length !== 4) return null;
  const a = Number(q.answer); if (!(a >= 0 && a <= 3)) return null;
  const o = { sec: ['g', 'r', 'l', 'c'].includes(q.sec) ? q.sec : 'g', tag: String(q.tag || 'عام').slice(0, 40),
    q: q.q, options: q.options.map(String), answer: a, why_ar: String(q.why_ar || '') };
  if (Array.isArray(q.segs) && q.segs.length === 4) { o.segs = q.segs.map(String); o.options = o.segs; }
  if (q.passage) o.passage = String(q.passage);
  if (q.audio) o.audio = String(q.audio);
  return o;
}

function clean(d, hasTom) {
  const out = {
    title_ar: String(d.title_ar || ''), intro_ar: String(d.intro_ar || ''),
    passages: Array.isArray(d.passages) ? d.passages.filter(p => p && p.id && p.text).map(p => ({ id: String(p.id), text: String(p.text) })) : [],
    steps: (Array.isArray(d.steps) ? d.steps : []).map(s => ({
      explain_ar: String((s && s.explain_ar) || ''), examples: Array.isArray(s && s.examples) ? s.examples.map(String) : [], check: cq(s && s.check)
    })).filter(s => s.explain_ar),
    quiz: (Array.isArray(d.quiz) ? d.quiz : []).map(cq).filter(Boolean),
  };
  out.tomorrow = hasTom ? (Array.isArray(d.tomorrow) ? d.tomorrow : []).map(cq).filter(Boolean) : [];
  if (out.quiz.length < 5) throw new Error('الدرس طلع ناقص من Claude، جرّب مرة ثانية');
  return out;
}

async function generate(env, n) {
  const item = CURRICULUM[n - 1];
  const placement = await getMeta(env, 'placement', null);
  const weak = await weakTags(env, placement);
  const ps = (placement && placement.sections) || {};
  const ctx = `Learner placement (percent): grammar ${ps.grammar ?? '?'}, reading ${ps.reading ?? '?'}, listening ${ps.listening ?? '?'}, compositional ${ps.compositional ?? '?'}. Current weak topics: ${weak.join(', ') || 'none yet'}.`;
  const prev = CURRICULUM.slice(Math.max(0, n - 13), n - 1).filter(x => x.kind === 'lesson').slice(-6).map(x => x.focus).join('; ');

  let prompt, hasTom = 0;
  if (item.kind === 'lesson') {
    prompt = lessonPrompt(n, item, `${item.title} | ${item.focus}`, SEC_EN[item.sec], ctx, prev); hasTom = 1;
  } else if (item.kind === 'targeted') {
    const topic = `Remedial lesson on the learner's weakest topics: ${weak.slice(0, 3).join(', ') || 'subject-verb agreement'}. Teach the single most important one deeply in the steps; the quiz may cover all of them.`;
    prompt = lessonPrompt(n, item, topic, 'whichever section matches the weak topic', ctx, prev); hasTom = 1;
  } else if (item.kind === 'review') {
    const titles = CURRICULUM.filter(x => x.week === item.week && x.kind === 'lesson').map(x => x.focus);
    prompt = reviewPrompt(item, titles, ctx, weak);
  } else {
    prompt = mockPrompt(item, ctx);
  }

  let data;
  try { data = clean(await claude(env, prompt), hasTom); }
  catch (e) { if (e instanceof SyntaxError) data = clean(await claude(env, prompt), hasTom); else throw e; }

  await env.DB.prepare('INSERT OR IGNORE INTO days(day,kind,sec,title,content,has_tomorrow,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(n, item.kind, item.sec, data.title_ar || item.title, JSON.stringify(data), hasTom && data.tomorrow.length ? 1 : 0, now()).run();
}

/* ---------- attempts ---------- */
async function attempt(env, b) {
  const { day, part } = b, results = Array.isArray(b.results) ? b.results : [];
  if (!['lesson', 'quiz', 'tomorrow', 'mock'].includes(part)) throw new Error('bad part');
  const row = await env.DB.prepare('SELECT lesson_done,quiz_done,tomorrow_done FROM days WHERE day=?').bind(day).first();
  if (!row) throw new Error('اليوم غير موجود');
  const already = { lesson: row.lesson_done, quiz: row.quiz_done, mock: row.quiz_done, tomorrow: row.tomorrow_done }[part];
  if (already) return { gained: 0, already: true };

  const t = today(), ts = now(), st = [];
  let gained = 0;
  for (const r of results) {
    st.push(env.DB.prepare('INSERT INTO answers(day,part,sec,tag,correct,created_at) VALUES(?,?,?,?,?,?)')
      .bind(day, part, r.sec || 'g', r.tag || '', r.correct ? 1 : 0, ts));
    if (r.correct) gained += XP[part];
    else if (r.q) st.push(env.DB.prepare('INSERT INTO cards(q,sec,tag,ivl,reps,due,created_at) VALUES(?,?,?,1,0,?,?)')
      .bind(JSON.stringify(r.q), r.sec || 'g', r.tag || '', addDays(t, 1), ts));
  }
  if (part === 'lesson') st.push(env.DB.prepare('UPDATE days SET lesson_done=1 WHERE day=?').bind(day));
  if (part === 'quiz' || part === 'mock') st.push(env.DB.prepare('UPDATE days SET lesson_done=1, quiz_done=1, done_date=? WHERE day=?').bind(t, day));
  if (part === 'tomorrow') st.push(env.DB.prepare('UPDATE days SET tomorrow_done=1 WHERE day=?').bind(day));
  gained += BONUS[part] || 0;
  if (st.length) await env.DB.batch(st);
  await addXP(env, gained);
  return { gained };
}

async function reviewGet(env) {
  const { results } = await env.DB.prepare('SELECT id,q FROM cards WHERE due<=? ORDER BY due, id LIMIT 20').bind(today()).all();
  return { cards: results.map(r => ({ id: r.id, q: JSON.parse(r.q) })) };
}

async function reviewPost(env, b) {
  const res = (Array.isArray(b.results) ? b.results : []).filter(r => Number.isInteger(r.id));
  if (!res.length) return { gained: 0 };
  const ids = res.map(r => r.id);
  const { results: cards } = await env.DB.prepare(
    `SELECT id,sec,tag,reps FROM cards WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const byId = Object.fromEntries(cards.map(c => [c.id, c]));
  const t = today(), ts = now(), st = [];
  let gained = 0;
  for (const r of res) {
    const c = byId[r.id]; if (!c) continue;
    if (r.correct) {
      const reps = c.reps + 1, ivl = INTERVALS[Math.min(reps, INTERVALS.length - 1)];
      st.push(env.DB.prepare('UPDATE cards SET reps=?, ivl=?, due=? WHERE id=?').bind(reps, ivl, addDays(t, ivl), c.id));
      gained += XP.review;
    } else {
      st.push(env.DB.prepare('UPDATE cards SET reps=0, ivl=1, due=? WHERE id=?').bind(addDays(t, 1), c.id));
    }
    st.push(env.DB.prepare('INSERT INTO answers(day,part,sec,tag,correct,created_at) VALUES(0,?,?,?,?,?)')
      .bind('review', c.sec, c.tag, r.correct ? 1 : 0, ts));
  }
  if (st.length) await env.DB.batch(st);
  await addXP(env, gained);
  return { gained };
}
