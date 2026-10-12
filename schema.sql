CREATE TABLE IF NOT EXISTS days (
  day INTEGER PRIMARY KEY,
  kind TEXT, sec TEXT, title TEXT, content TEXT,
  has_tomorrow INTEGER DEFAULT 0,
  lesson_done INTEGER DEFAULT 0,
  quiz_done INTEGER DEFAULT 0,
  tomorrow_done INTEGER DEFAULT 0,
  done_date TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day INTEGER, part TEXT, sec TEXT, tag TEXT, correct INTEGER, created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_answers_sec ON answers(sec, part);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  q TEXT, sec TEXT, tag TEXT,
  ivl INTEGER DEFAULT 1, reps INTEGER DEFAULT 0, due TEXT, created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
CREATE TABLE IF NOT EXISTS activity (date TEXT PRIMARY KEY, xp INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
INSERT OR IGNORE INTO meta(key,value) VALUES
 ('xp','0'),
 ('placement','{"date":"2026-10-06","estimate":56,"sections":{"grammar":39,"reading":71,"listening":80,"compositional":0},"weak_topics":["القلب (Inversion)","الشرط الثالث","الكلام المنقول","صيغة الـ Subjunctive","صيغة ing بعد حروف الجر","المطابقة مع المفرد","مطابقة الفاعل والفعل","أدوات الربط","تركيب الجملة"]}');

-- حلقة المشي (البودكاست)
CREATE TABLE IF NOT EXISTS episodes (
  date TEXT PRIMARY KEY, status TEXT, attempts INTEGER DEFAULT 0, tts_errors INTEGER DEFAULT 0, lease INTEGER,
  title TEXT, script TEXT, words TEXT, plan TEXT, frame TEXT,
  pieces_done INTEGER DEFAULT 0, pieces_total INTEGER DEFAULT 0, bytes INTEGER, seconds REAL,
  error TEXT, created_at TEXT, done_at TEXT, parts TEXT
);
CREATE TABLE IF NOT EXISTS ep_pieces (date TEXT, idx INTEGER, bytes INTEGER, frames INTEGER, PRIMARY KEY(date, idx));

-- تكلفة Claude: كل طلب بتوكناته وتكلفته
CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT, started INTEGER, kind TEXT, model TEXT, status TEXT,
  input INTEGER, output INTEGER, cost REAL, ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_usage_date ON api_usage(date, kind);
