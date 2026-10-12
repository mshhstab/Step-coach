// حلقة المشي اليومية: Claude يكتب النص من دروسك وغلطاتك، MeloTTS يحوّله صوت، ونقدّمه كبودكاست خاص
import { CURRICULUM } from './curriculum.js';
import { cleanMp3, silenceFrame } from './mp3.js';

const TTS_MODEL = '@cf/myshell-ai/melotts';
const START_HOUR = 3;          // تبدأ الحلقة تنبني من الساعة ٣ الفجر بتوقيت السعودية
const RUN_MS = 70000;          // أقصى وقت لكل تشغيل مجدول
const RUN_MAX = 25;            // أقصى عدد مقاطع صوتية لكل تشغيل
const MAX_PIECE = 480;         // أقصى طول نص لكل مقطع

const KEEP_DAYS = 25;         // مدة الاحتفاظ بصوت الحلقات

// التخزين: KV (الافتراضي، ما يحتاج تفعيل) أو R2 لو ربطته
const isKV = env => typeof env.POD.getWithMetadata === 'function';
const putAudio = (env, k, data) => isKV(env)
  ? env.POD.put(k, data, { expirationTtl: KEEP_DAYS * 86400 })
  : env.POD.put(k, data, { httpMetadata: { contentType: 'audio/mpeg' } });
async function getAudio(env, k, off, len) {
  if (isKV(env)) { const b = await env.POD.get(k, 'arrayBuffer'); return b ? new Uint8Array(b, off, len) : null; }
  const o = await env.POD.get(k, { range: { offset: off, length: len } });
  return o ? new Uint8Array(await o.arrayBuffer()) : null;
}

const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const riyadhHour = () => new Date(Date.now() + 3 * 3600e3).getUTCHours();
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const now = () => new Date().toISOString();
const LET = ['A', 'B', 'C', 'D'];

/* ---------- رابط البودكاست السري (مشتق من APP_KEY) ---------- */
export async function feedToken(env) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('step-pod:' + String(env.APP_KEY || '').trim()));
  return [...new Uint8Array(d)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join('');
}

async function getMeta(env, k, def) {
  const r = await env.DB.prepare('SELECT value FROM meta WHERE key=?').bind(k).first();
  return r ? JSON.parse(r.value) : def;
}
async function setMeta(env, k, v) {
  await env.DB.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .bind(k, JSON.stringify(v)).run();
}

/* ---------- التشغيل المجدول ---------- */
export async function tick(env) {
  if (!env.AI || !env.POD) return;
  const t = today(), started = Date.now();
  if (await getMeta(env, 'pod_enabled', true)) {
    const ep = await env.DB.prepare('SELECT date FROM episodes WHERE date=?').bind(t).first();
    if (!ep && riyadhHour() >= START_HOUR) await env.DB.prepare(
      "INSERT OR IGNORE INTO episodes(date,status,attempts,created_at) VALUES(?,'script',0,?)").bind(t, now()).run();
  }
  // نص ناقص؟ نكتبه (مع إعادة محاولة كل ١٠ دقايق، ٣ مرات بالكثير)
  const s = await env.DB.prepare(
    "SELECT date FROM episodes WHERE status='script' AND attempts<3 AND (lease IS NULL OR lease<?) ORDER BY date DESC LIMIT 1")
    .bind(Date.now() - 600e3).first();
  if (s) { try { await writeScript(env, s.date); } catch (e) { console.log('script failed', e && e.message); } return; }
  const a = await env.DB.prepare("SELECT date FROM episodes WHERE status='audio' ORDER BY date DESC LIMIT 1").first();
  if (a) { await renderAudio(env, a.date, started); return; }
  // تنظيف: صوت الحلقات القديمة ينحذف (النص يبقى)
  const old = await env.DB.prepare("SELECT date FROM episodes WHERE status='ready' AND date<? LIMIT 1").bind(addDays(t, -(KEEP_DAYS - 1))).first();
  if (old) {
    const { results } = await env.DB.prepare('SELECT idx FROM ep_pieces WHERE date=?').bind(old.date).all();
    if (results.length && !isKV(env)) await env.POD.delete(results.map(r => `ep/${old.date}/${r.idx}.mp3`));
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ep_pieces WHERE date=?').bind(old.date),
      env.DB.prepare("UPDATE episodes SET status='expired' WHERE date=?").bind(old.date),
    ]);
  }
}

async function takeLease(env, date, ms) {
  const r = await env.DB.prepare('UPDATE episodes SET lease=? WHERE date=? AND (lease IS NULL OR lease<?)')
    .bind(Date.now(), date, Date.now() - ms).run();
  return r.meta && r.meta.changes > 0;
}

/* ---------- كتابة النص ---------- */
const SYS = `You write a daily audio lesson ("walking episode") for an adult Saudi learner preparing for the STEP English exam (Qiyas/ETEC). Level: intermediate, target 96+. He listens while walking for one hour with no screen, so everything must work by ear alone.
STEP sections: Reading 40%, Structure/grammar 30%, Listening 20%, Compositional analysis (error identification) 10%. All items are 4-option multiple choice.
Rules for every spoken field:
- Clear, natural spoken English for an intermediate learner: short sentences, everyday words in explanations, no symbols, no formulas, no brackets, no emojis, no abbreviations like "e.g."; say grammar patterns in words ("had plus the past participle").
- Never ask him to look at, read or write anything.
- Never repeat a sentence you already used.
Output ONLY one valid JSON object. No markdown fences.`;

async function scriptInputs(env, t) {
  const placement = await getMeta(env, 'placement', null);
  const { results: wk } = await env.DB.prepare(
    `SELECT tag, COUNT(*) n, SUM(1-correct) w FROM
       (SELECT tag, correct FROM answers WHERE tag<>'' ORDER BY id DESC LIMIT 400)
     GROUP BY tag HAVING n>=3 ORDER BY (w*1.0/n) DESC, n DESC LIMIT 6`).all();
  let weak = wk.filter(r => r.w > 0).map(r => r.tag);
  if (!weak.length) weak = ((placement && placement.weak_topics) || []).slice(0, 6);

  const last = await env.DB.prepare(
    "SELECT day,title,content FROM days WHERE kind IN ('lesson','targeted') ORDER BY day DESC LIMIT 1").first();
  let lastLesson = null;
  if (last) {
    const c = JSON.parse(last.content || '{}');
    lastLesson = { day: last.day, title: last.title, notes: (c.steps || []).map(s => s.explain_ar).join(' | ').slice(0, 1800),
      examples: (c.steps || []).flatMap(s => s.examples || []).slice(0, 10) };
  }
  const done = await env.DB.prepare('SELECT MAX(day) d FROM days WHERE quiz_done=1').first();
  const nextItem = CURRICULUM[Math.min(CURRICULUM.length - 1, ((done && done.d) || 0))];

  const { results: cards } = await env.DB.prepare(
    "SELECT q,tag FROM cards WHERE sec IN ('g','c') ORDER BY (due<=?) DESC, due, id DESC LIMIT 12").bind(t).all();
  const mistakes = cards.map(c => { const q = JSON.parse(c.q); return { tag: c.tag, q: q.q, options: q.options, answer: q.answer, why_ar: q.why_ar }; });

  const { results: eps } = await env.DB.prepare('SELECT date,words FROM episodes WHERE words IS NOT NULL ORDER BY date DESC LIMIT 60').all();
  const used = [...new Set(eps.flatMap(e => JSON.parse(e.words || '[]').map(w => w.w)))].slice(0, 400);
  const want = new Set([1, 3, 7, 14, 30].map(n => addDays(t, -n)));
  const review = eps.filter(e => want.has(e.date)).flatMap(e => JSON.parse(e.words || '[]').slice(0, 4)).slice(0, 12);
  return { weak, lastLesson, nextItem, mistakes, used, review };
}

function context(inp) {
  const L = inp.lastLesson;
  return `Most recent lesson he studied: ${L ? `"${L.title}". Arabic teaching notes: ${L.notes}. Examples: ${L.examples.join(' / ')}` : 'none yet'}.
His next lesson in the app: "${inp.nextItem.title}" (${inp.nextItem.focus}).
His weakest topics right now: ${inp.weak.join(', ') || 'none yet'}.`;
}

// الجزء الأول: كلمات + قواعد + أسئلة (مبني على غلطاتك)
function promptA(inp) {
  const L = inp.lastLesson;
  return `Build part A of today's walking episode.
${context(inp)}
His recent grammar mistakes (JSON): ${JSON.stringify(inp.mistakes)}
Words already taught in earlier episodes (do not reuse): ${inp.used.join(', ') || 'none'}.

Return JSON:
{
 "title": short English episode title, max 8 words,
 "summary_ar": 1-2 Arabic sentences describing the episode,
 "intro": 2-3 warm spoken sentences naming today's focus,
 "words": [15 new academic words that often appear in STEP reading passages, each {"w": word, "ar": Arabic meaning (1-3 words), "def": simple English definition (max 14 words), "ex": natural example sentence (9-16 words)}],
 "grammar": {"topic": short name, "explain": [5 spoken paragraphs, 45-80 words each, teaching ${L ? 'the most recent lesson topic, then a quick refresher on his single weakest topic' : 'his single weakest topic'}], "examples": [8 model sentences for listen-and-repeat, 7-15 words each]},
 "drills": [15 STEP sentence-completion items. First, for each of his recent mistakes, write a NEW sentence that tests the same rule (never copy his old sentence). Fill the rest with his weak topics. Each {"q": sentence with ___ for the blank, "options": [4 short options], "answer": 0-3, "full": the complete correct sentence, "why": 1-2 spoken sentences explaining the rule and the trap}],
 "closing": 2-3 spoken sentences: quick recap and a nudge to open the app for "${inp.nextItem.title}"
}
Spread correct answers evenly across 0,1,2,3.`;
}

// الجزء الثاني: استماع + محاضرة + قصة
function promptB(inp) {
  return `Build part B of today's walking episode: listening practice.
${context(inp)}

Return JSON:
{
 "clips": [8 STEP-style listening clips: mix of short lectures, announcements, a radio talk, a student talking about a problem. Each {"script": 100-160 words of natural single-speaker speech, "questions": [2 {"q": question, "options": [4 short options], "answer": 0-3}]}],
 "talk": {"title": title, "text": a 650-750 word academic talk on a STEP-like topic (science, health, history, education, environment, technology), upper-intermediate level, rich in academic vocabulary},
 "story": {"title": title, "text": a 380-450 word true-to-life story or biography told in the past tense, rich in narrative tenses and linking words}
}
Spread correct answers evenly across 0,1,2,3.`;
}

async function claude(env, prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.MODEL || 'claude-sonnet-5-5', max_tokens: 12000, system: SYS, messages: [{ role: 'user', content: prompt }] })
  });
  const raw = await r.text();
  let d; try { d = JSON.parse(raw); } catch (e) { throw new Error(`رد Claude انقطع (HTTP ${r.status})`); }
  if (!r.ok) throw new Error('Claude API: ' + ((d.error && d.error.message) || r.status));
  if (d.stop_reason === 'max_tokens') throw new Error('نص الحلقة طلع أطول من الحد');
  const text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try { return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); }
  catch (e) { throw new Error('نص الحلقة طلع ناقص (JSON)'); }
}

async function part(env, prompt) {
  try { return await claude(env, prompt); }
  catch (e) { if (/^Claude API/.test(e.message) && !/overloaded|rate/i.test(e.message)) throw e; return await claude(env, prompt); }
}

const arr = x => Array.isArray(x) ? x : [];
const str = x => String(x ?? '').trim();
function mcq(q) {
  if (!q || !str(q.q) || arr(q.options).length !== 4) return null;
  const a = Number(q.answer); if (!(a >= 0 && a <= 3)) return null;
  return { q: str(q.q), options: q.options.map(str), answer: a, full: str(q.full), why: str(q.why) };
}
export function cleanScript(d) {
  const s = {
    title: str(d.title) || 'Daily walk', summary_ar: str(d.summary_ar), intro: str(d.intro), closing: str(d.closing),
    words: arr(d.words).filter(w => w && str(w.w) && str(w.def)).map(w => ({ w: str(w.w), ar: str(w.ar), def: str(w.def), ex: str(w.ex) })),
    grammar: { topic: str(d.grammar && d.grammar.topic), explain: arr(d.grammar && d.grammar.explain).map(str).filter(Boolean),
      examples: arr(d.grammar && d.grammar.examples).map(str).filter(Boolean) },
    drills: arr(d.drills).map(mcq).filter(Boolean),
    clips: arr(d.clips).filter(c => c && str(c.script)).map(c => ({ script: str(c.script), questions: arr(c.questions).map(mcq).filter(Boolean) })),
    talk: { title: str(d.talk && d.talk.title), text: str(d.talk && d.talk.text) },
    story: { title: str(d.story && d.story.title), text: str(d.story && d.story.text) },
  };
  if (s.words.length < 5 || s.drills.length < 5 || s.clips.length < 2) throw new Error('نص الحلقة طلع ناقص');
  return s;
}

/* ---------- من النص إلى خطة صوت: مقاطع + وقفات ---------- */
const speakable = t => str(t).replace(/_{2,}/g, ' blank ').replace(/[*#`~<>[\]{}|]/g, ' ').replace(/\s+/g, ' ').trim();
const wordsOf = t => str(t).split(/\s+/).filter(Boolean).length;

function splitText(t) {
  const parts = t.match(/[^.!?]+[.!?]+["')]*\s*|[^.!?]+$/g) || [t];
  const out = []; let cur = '';
  for (const p of parts) {
    if ((cur + p).length > MAX_PIECE && cur) { out.push(cur.trim()); cur = ''; }
    if (p.length > MAX_PIECE) { for (const w of p.split(/(?<=,)\s+/)) { if ((cur + ' ' + w).length > MAX_PIECE && cur) { out.push(cur.trim()); cur = ''; } cur += ' ' + w; } }
    else cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function buildPlan(s, review, day) {
  const pieces = [], index = new Map(), tl = [];
  const say = text => {
    const t = speakable(text); if (!t) return;
    for (const c of splitText(t)) {
      if (!index.has(c)) { index.set(c, pieces.length); pieces.push(c); }
      tl.push(['p', index.get(c)]);
    }
  };
  const gap = sec => { if (tl.length && tl[tl.length - 1][0] === 's') tl[tl.length - 1][1] += sec; else tl.push(['s', sec]); };
  const shadow = text => gap(Math.min(9, 1.2 + wordsOf(text) * 0.42));
  const opts = q => q.options.map((o, i) => `${LET[i]}: ${o}.`).join(' ');

  say(`Welcome to your STEP walking lesson${day ? `, day ${day}` : ''}. ${s.intro}`); gap(1.5);

  if (review.length) {
    say('Let us start with a quick review of words from earlier episodes. Try to remember each meaning before I say it.'); gap(1);
    for (const w of review) { say(`${w.w}.`); gap(3); say(`${w.w} means ${w.def}`); gap(1); }
    gap(1);
  }

  say(`Part one. ${s.words.length} new words. Listen, then say each word and each sentence out loud with me.`); gap(1.5);
  s.words.forEach((w, i) => {
    say(`Word ${i + 1}. ${w.w}.`); gap(1.5); say(`${w.w}.`); gap(2);
    say(`It means ${w.def}`); gap(0.8);
    if (w.ex) { say(w.ex); shadow(w.ex); say(w.ex); gap(1.5); }
  });
  say('Quick check. I will say a meaning. You say the word.'); gap(1);
  for (const w of s.words.slice().reverse().slice(0, 8)) { say(w.def); gap(4); say(`${w.w}.`); gap(1); }
  gap(1.5);

  if (s.grammar.explain.length) {
    say(`Part two. Grammar. ${s.grammar.topic}.`); gap(1.5);
    for (const p of s.grammar.explain) { say(p); gap(1.2); }
    if (s.grammar.examples.length) {
      say('Now listen and repeat each sentence.'); gap(1);
      for (const e of s.grammar.examples) { say(e); shadow(e); }
    }
    gap(1.5);
  }

  say('Part three. Grammar questions, just like the exam. After the four choices, pick your answer before I tell you.'); gap(1.5);
  s.drills.forEach((q, i) => {
    say(`Question ${i + 1}. ${q.q}`); gap(0.8); say(opts(q)); gap(6);
    say(`The answer is ${LET[q.answer]}: ${q.options[q.answer]}. ${q.why}`); gap(0.8);
    if (q.full) { say(q.full); shadow(q.full); }
  });
  gap(1.5);

  say('Part four. Listening practice. You will hear each clip, then two questions. After the answers, you will hear the clip again.'); gap(1.5);
  s.clips.forEach((c, i) => {
    say(`Clip ${i + 1}.`); gap(1); say(c.script); gap(1.5);
    c.questions.forEach((q, j) => { say(`Question ${j + 1}. ${q.q}`); gap(0.6); say(opts(q)); gap(6); });
    c.questions.forEach((q, j) => { say(`Question ${j + 1}: the answer is ${LET[q.answer]}, ${q.options[q.answer]}.`); gap(0.6); });
    say('Listen again.'); gap(1); say(c.script); gap(2);
  });

  if (s.talk.text) {
    say(`Part five. A short talk: ${s.talk.title}. Listen for the main idea and for today's words.`); gap(1.5);
    say(s.talk.text); gap(2);
    say('One more time. This time, try to catch every detail.'); gap(1.5);
    say(s.talk.text); gap(2);
    const sent = (s.talk.text.match(/[^.!?]+[.!?]+/g) || []).map(x => x.trim()).filter(x => wordsOf(x) >= 5 && wordsOf(x) <= 22).slice(0, 10);
    if (sent.length) {
      say('Now shadowing. Repeat each sentence right after me, with the same rhythm.'); gap(1);
      for (const x of sent) { say(x); shadow(x); }
      gap(1.5);
    }
  }

  if (s.story.text) {
    say(`Part six. A story: ${s.story.title}. Just enjoy it and follow the events.`); gap(1.5);
    say(s.story.text); gap(2);
    say('Listen once more.'); gap(1);
    say(s.story.text); gap(2);
  }

  say('Final review. Here are all of today\'s words one more time. Say the meaning before I do.'); gap(1);
  for (const w of s.words) { say(`${w.w}.`); gap(3); say(w.def); gap(1); }
  gap(1);

  say(s.closing || 'That is all for today. Great work.'); gap(1);
  say('See you tomorrow.');
  return { pieces, tl };
}

export async function writeScript(env, date) {
  if (!(await takeLease(env, date, 600e3))) return { busy: true };
  try {
    const inp = await scriptInputs(env, date);
    const [a, b] = await Promise.all([part(env, promptA(inp)), part(env, promptB(inp))]);
    const s = cleanScript({ ...a, ...b });
    const done = await env.DB.prepare('SELECT MAX(day) d FROM days WHERE quiz_done=1').first();
    const plan = buildPlan(s, inp.review, (done && done.d) || 0);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ep_pieces WHERE date=?').bind(date),
      env.DB.prepare("UPDATE episodes SET status='audio', title=?, script=?, words=?, plan=?, pieces_total=?, error=NULL, lease=NULL WHERE date=?")
        .bind(s.title, JSON.stringify(s), JSON.stringify(s.words), JSON.stringify(plan), plan.pieces.length, date),
    ]);
    return { ok: true };
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 300);
    await env.DB.prepare("UPDATE episodes SET attempts=attempts+1, error=?, lease=?, status=CASE WHEN attempts+1>=3 THEN 'failed' ELSE 'script' END WHERE date=?")
      .bind(msg, Date.now(), date).run();
    throw e;
  }
}

/* ---------- تحويل النص إلى صوت ---------- */
async function tts(env, text) {
  const r = await env.AI.run(TTS_MODEL, { prompt: text, lang: 'en' });
  if (r instanceof ReadableStream) return new Uint8Array(await new Response(r).arrayBuffer());
  if (r instanceof ArrayBuffer || ArrayBuffer.isView(r)) return new Uint8Array(r.buffer ? r.buffer : r);
  const b64 = r && (r.audio || (r.result && r.result.audio));
  if (typeof b64 !== 'string') throw new Error('رد غير متوقع من MeloTTS');
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export async function renderAudio(env, date, started = Date.now()) {
  if (!(await takeLease(env, date, 120e3))) return;
  let ep = await env.DB.prepare('SELECT plan,frame,pieces_total FROM episodes WHERE date=?').bind(date).first();
  const plan = JSON.parse(ep.plan);
  const { results } = await env.DB.prepare('SELECT idx FROM ep_pieces WHERE date=?').bind(date).all();
  const have = new Set(results.map(r => r.idx));
  let frame = ep.frame ? JSON.parse(ep.frame) : null, n = 0;
  for (let i = 0; i < plan.pieces.length && n < RUN_MAX && Date.now() - started < RUN_MS; i++) {
    if (have.has(i)) continue;
    n++;
    try {
      const c = cleanMp3(await tts(env, plan.pieces[i]));
      if (!c.frames) throw new Error('مقطع صوت فاضي');
      if (!frame) { frame = c.info; await env.DB.prepare('UPDATE episodes SET frame=? WHERE date=?').bind(JSON.stringify(frame), date).run(); }
      if (c.info.sr !== frame.sr) throw new Error('صيغة صوت مختلفة');
      await putAudio(env, `ep/${date}/${i}.mp3`, c.data);
      await env.DB.prepare('INSERT OR REPLACE INTO ep_pieces(date,idx,bytes,frames) VALUES(?,?,?,?)').bind(date, i, c.data.length, c.frames).run();
      have.add(i);
    } catch (e) {
      const r = await env.DB.prepare('UPDATE episodes SET tts_errors=tts_errors+1, error=? WHERE date=? RETURNING tts_errors')
        .bind(`مقطع ${i}: ${String((e && e.message) || e).slice(0, 200)}`, date).first();
      if (r && r.tts_errors >= 12) { await env.DB.prepare("UPDATE episodes SET status='failed', lease=NULL WHERE date=?").bind(date).run(); return; }
    }
  }
  if (have.size >= plan.pieces.length) await finish(env, date);
  else await env.DB.prepare('UPDATE episodes SET pieces_done=?, lease=NULL WHERE date=?').bind(have.size, date).run();
}

async function layout(env, date) {
  const ep = await env.DB.prepare('SELECT * FROM episodes WHERE date=?').bind(date).first();
  if (!ep || !ep.plan || !ep.frame) return null;
  const plan = JSON.parse(ep.plan), frame = JSON.parse(ep.frame);
  const { results } = await env.DB.prepare('SELECT idx,bytes,frames FROM ep_pieces WHERE date=?').bind(date).all();
  const P = Object.fromEntries(results.map(r => [r.idx, r]));
  const sil = silenceFrame(frame.header), segs = [];
  let bytes = 0, frames = 0;
  for (const [k, v] of plan.tl) {
    if (k === 'p') { const p = P[v]; if (!p) continue; segs.push({ key: `ep/${date}/${v}.mp3`, size: p.bytes }); bytes += p.bytes; frames += p.frames; }
    else { const nf = Math.max(1, Math.round(v / sil.seconds)); segs.push({ sil: nf, size: nf * sil.len }); bytes += nf * sil.len; frames += nf; }
  }
  return { ep, segs, bytes, seconds: frames * frame.samples / frame.sr, sil };
}

async function finish(env, date) {
  const L = await layout(env, date);
  await env.DB.prepare("UPDATE episodes SET status='ready', pieces_done=pieces_total, bytes=?, seconds=?, done_at=?, lease=NULL WHERE date=?")
    .bind(L.bytes, L.seconds, now(), date).run();
}

/* ---------- تقديم الملف الصوتي (يدعم Range عشان تطبيقات البودكاست) ---------- */
export async function serveAudio(req, env, date) {
  const L = await layout(env, date);
  if (!L || L.ep.status !== 'ready') return new Response('not ready', { status: 404 });
  const total = L.bytes;
  let a = 0, z = total - 1, status = 200;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (m && (m[1] || m[2])) {
    if (m[1]) { a = +m[1]; if (m[2]) z = Math.min(+m[2], total - 1); }
    else { a = Math.max(0, total - +m[2]); }
    if (a > z || a >= total) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${total}` } });
    status = 206;
  }
  const len = z - a + 1;
  const headers = {
    'content-type': 'audio/mpeg', 'accept-ranges': 'bytes', 'content-length': String(len),
    'cache-control': 'public, max-age=86400', 'content-disposition': `inline; filename="step-${date}.mp3"`,
  };
  if (status === 206) headers['content-range'] = `bytes ${a}-${z}/${total}`;
  if (req.method === 'HEAD') return new Response(null, { status, headers });

  const { readable, writable } = typeof FixedLengthStream === 'function' ? new FixedLengthStream(len) : new TransformStream();
  const silBuf = new Uint8Array(L.sil.len * 50);
  for (let i = 0; i < 50; i++) silBuf.set(L.sil.frame, i * L.sil.len);
  (async () => {
    const w = writable.getWriter();
    try {
      let pos = 0;
      for (const s of L.segs) {
        const sa = pos, sz = pos + s.size; pos = sz;
        if (sz <= a) continue;
        if (sa > z) break;
        const from = Math.max(a, sa) - sa, to = Math.min(z + 1, sz) - sa;
        if (s.key) {
          const o = await getAudio(env, s.key, from, to - from);
          if (!o) throw new Error('missing ' + s.key);
          await w.write(o);
        } else {
          let off = from;
          while (off < to) { const n = Math.min(silBuf.length, to - off); const st = off % L.sil.len;
            const chunk = st === 0 ? silBuf.subarray(0, n) : (() => { const t = new Uint8Array(n); for (let i = 0; i < n; i++) t[i] = L.sil.frame[(st + i) % L.sil.len]; return t; })();
            await w.write(chunk); off += n; }
        }
      }
      await w.close();
    } catch (e) { await w.abort(e); }
  })();
  return new Response(readable, { status, headers });
}

/* ---------- ملف البودكاست (RSS) ---------- */
const xml = s => String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const hms = s => { s = Math.round(s || 0); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

export async function feed(req, env, token) {
  const base = new URL(req.url).origin + '/podcast/' + token;
  const { results } = await env.DB.prepare(
    "SELECT date,title,script,bytes,seconds,done_at FROM episodes WHERE status='ready' ORDER BY date DESC LIMIT 40").all();
  const items = results.map(e => {
    const s = JSON.parse(e.script || '{}');
    const words = (s.words || []).map(w => `${w.w}: ${w.ar}`).join('\n');
    const desc = `${s.summary_ar || ''}\n\nكلمات اليوم:\n${words}`;
    return `<item><title>${xml(e.date + ' · ' + e.title)}</title><guid isPermaLink="false">step-${e.date}</guid>
<pubDate>${new Date(e.done_at || e.date).toUTCString()}</pubDate><description>${xml(desc)}</description>
<enclosure url="${base}/${e.date}.mp3" length="${e.bytes}" type="audio/mpeg"/><itunes:duration>${hms(e.seconds)}</itunes:duration></item>`;
  }).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>مدرّب الستيب · حلقة المشي</title><link>${xml(new URL(req.url).origin)}</link><language>en</language>
<description>حلقة يومية للمشي: كلمات وقواعد وأسئلة استماع بنمط الستيب، مبنية على دروسك وغلطاتك.</description>
<itunes:author>Step Coach</itunes:author><itunes:explicit>false</itunes:explicit><itunes:type>episodic</itunes:type>
<itunes:image href="${xml(new URL(req.url).origin)}/podcast-cover.png"/>
<image><url>${xml(new URL(req.url).origin)}/podcast-cover.png</url><title>مدرّب الستيب · حلقة المشي</title><link>${xml(new URL(req.url).origin)}</link></image>
<itunes:category text="Education"><itunes:category text="Language Learning"/></itunes:category>
${items}
</channel></rss>`;
  return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'no-store' } });
}

/* ---------- واجهة التطبيق ---------- */
export async function podState(req, env) {
  const token = await feedToken(env);
  const origin = new URL(req.url).origin;
  const { results } = await env.DB.prepare(
    'SELECT date,status,title,pieces_done,pieces_total,seconds,error FROM episodes ORDER BY date DESC LIMIT 30').all();
  return {
    ready: !!(env.AI && env.POD), enabled: await getMeta(env, 'pod_enabled', true), today: today(), startHour: START_HOUR,
    feed: `${origin}/podcast/${token}/feed.xml`, audioBase: `${origin}/podcast/${token}/`,
    episodes: results,
  };
}

export async function podEpisode(env, date) {
  const e = await env.DB.prepare('SELECT date,status,title,script,seconds FROM episodes WHERE date=?').bind(date).first();
  if (!e) return null;
  return { ...e, script: e.script ? JSON.parse(e.script) : null };
}

export async function podBuild(env) {
  if (!env.AI || !env.POD) throw new Error('ربط Workers AI أو مخزن الصوت ناقص في الإعدادات');
  const t = today();
  const e = await env.DB.prepare('SELECT status FROM episodes WHERE date=?').bind(t).first();
  if (e && (e.status === 'ready' || e.status === 'audio')) return { queued: false, status: e.status };
  // نحطها في الطابور فقط؛ التشغيل المجدول (كل دقيقة) يكتبها ويسجّلها، عشان ما تنقطع لو قفلت الصفحة
  await env.DB.prepare(
    "INSERT INTO episodes(date,status,attempts,created_at) VALUES(?,'script',0,?) ON CONFLICT(date) DO UPDATE SET status='script', attempts=0, tts_errors=0, lease=NULL, error=NULL")
    .bind(t, now()).run();
  return { queued: true, status: 'script' };
}

export async function podToggle(env, on) { await setMeta(env, 'pod_enabled', !!on); return { enabled: !!on }; }
