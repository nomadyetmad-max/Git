// Writing Clinic 실시간 도우미
// GET: 설정(레벨별 멈춤 시간 n초 등, 시트의 "분석 기준" 탭)
// POST {op:'suggest'}: 쓰다 n초 멈추면 커서 자리에 맞는 추천 단어(+ 레벨에 따라 문장 마무리·이어 쓸 구), 모두 한국어 뜻과 함께
// POST {op:'grammar'}: 문장 하나를 끝낼 때마다 문법 오류가 있으면 고친 문장과 한국어 설명
// POST {op:'events'}: 학생 반응 기록(보여 줌·고름·닫음·무시), 글 내용은 저장하지 않음
// 첨삭 하루 3회와 따로, 기기당 하루 ASSIST_DAILY회(기본 80). 같은 입력 = 같은 결과(서버 메모리에 저장).
// 환경 변수: ANTHROPIC_API_KEY, ASSIST_MODEL(기본 claude-haiku-5-5), ASSIST_DAILY, LOG_URL, LOG_SECRET
const crypto = require('crypto');
const { askSheet, getInfo, ipOf, kstTime, tooMany, body } = require('./_lib/sheet');
const MODEL = process.env.ASSIST_MODEL || 'claude-haiku-5-5';
const DAILY = Number(process.env.ASSIST_DAILY || 80);
const GRAMMAR_SCOPE = {
  B: 'Only errors that make the meaning unclear (missing or wrong verb, broken word order, a wrong word that changes the meaning). Ignore small slips such as articles or prepositions.',
  I: 'Errors that make the meaning unclear, plus grammar errors explained by a clear rule (subject-verb agreement, tense, verb form, singular/plural, pronoun, relative clause, conjunction). Ignore articles, prepositions and style.',
  A: 'All grammar errors, including articles, prepositions and wrong collocations. Ignore pure style preferences.'
};
// 레벨별 추천 범위: B는 문장 마무리까지, I는 이어 쓸 구, A는 단어만
const SUGGEST = {
  B: { cont: 'Also give "cont": if the caret is inside a sentence, the rest of the current sentence (from the caret to the period) in simple words; if the caret is at the start of a new sentence, one short simple next sentence.', words: 'easy, common words a Korean middle/high school student knows' },
  I: { cont: 'Also give "cont": a short phrase (3 to 7 words) that could come right after the caret. Do not finish the whole sentence.', words: 'words at Korean high school mock-exam level' },
  A: { cont: 'Set "cont" to null.', words: 'precise, more advanced words suitable for a strong high school writer' }
};
const saved = new Map(), perDay = new Map();
const kstDate = () => kstTime().slice(0, 10);
function used(device) { const m = perDay.get(device); return m && m.d === kstDate() ? m.n : 0; }
function add(device) { const d = kstDate(), m = perDay.get(device); perDay.set(device, { d, n: m && m.d === d ? m.n + 1 : 1 }); if (perDay.size > 20000) perDay.clear(); }
const q = (s) => JSON.stringify(s);

function suggestPrompt(level, before, after, topic, gtype) {
  const atStart = !/\S/.test(before) || /[.!?]["')\]]*\s*$/.test(before);
  return `A Korean high school student is writing an English paragraph${topic ? ` about "${topic}"` : ''}${gtype ? ` (type of writing: ${gtype})` : ''}. They stopped typing for a while at the caret, so they may be stuck.

Read the whole paragraph for context, then help with what comes right at the caret.
The caret is ${atStart ? 'at the start of a new sentence' : 'in the middle of a sentence'}.

Give "words": up to 4 ${SUGGEST[level].words} that could come right at the caret and fit both the sentence and the whole paragraph. Use the exact form that fits there (for example the right verb form or plural). A word can be a short fixed phrase (up to 3 words).
${SUGGEST[level].cont}
For every English item give "ko": its natural Korean meaning in this context (for "cont", a Korean translation of the whole suggestion).
Do not repeat what the student already wrote. Keep the student's own idea; do not change the topic. Never include anything inappropriate for teenagers.

Paragraph before the caret: ${q(before)}
Paragraph after the caret: ${q(after)}

Answer with JSON only: {"words": [{"en": "...", "ko": "..."}], "cont": {"en": "...", "ko": "..."} or null}`;
}
function grammarPrompt(level, sentence, prev) {
  return `A Korean high school student is writing an English paragraph and just finished one sentence. Check that sentence for grammar errors.
What to correct (level ${level}): ${GRAMMAR_SCOPE[level]}
If there is an error within that scope, give the corrected sentence with the smallest possible change (keep the student's words and idea).
"focus": the wrong part copied exactly from the original sentence. "ko": one short, friendly Korean sentence explaining the rule (use terms like 주어, 동사, 수 일치, 시제, 관사, 전치사).
If there is no error within that scope, set ok to true and the other fields to "".

Earlier sentence (context only): ${prev ? q(prev) : '(none)'}
Sentence to check: ${q(sentence)}

Answer with JSON only: {"ok": true or false, "fixed": "...", "focus": "...", "ko": "..."}`;
}
async function ask(prompt, maxTokens) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }) });
    const data = await r.json().catch(() => null);
    if (!r.ok) { console.error('assist error', r.status, data?.error?.type, data?.error?.message); return null; }
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const a = text.indexOf('{'), z = text.lastIndexOf('}');
    return JSON.parse(text.slice(a, z + 1));
  } catch (e) { console.error('assist failure', e && e.name); return null; } finally { clearTimeout(timer); }
}
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const { config } = await getInfo();
    return res.status(200).json({ ready: Boolean(process.env.ANTHROPIC_API_KEY) && config.assistOn !== 0, n: { B: config.assistB, I: config.assistI, A: config.assistA }, step: config.assistStep, daily: DAILY });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const b = body(req), ip = ipOf(req);
  const device = /^[a-z0-9]{8,40}$/.test(String(b.device || '')) ? b.device : 'ip-' + ip;

  if (b.op === 'events') {
    if (tooMany('ev:' + ip, 200) || !Array.isArray(b.list)) return res.status(204).end();
    const list = b.list.slice(0, 50).map((e) => ({ time: kstTime(), level: ['B', 'I', 'A'].includes(e.level) ? e.level : '', kind: e.kind === 'grammar' ? 'grammar' : 'suggest',
      act: ['shown', 'pick', 'close', 'ignore', 'apply', 'keep'].includes(e.act) ? e.act : '', n: Number.isFinite(e.n) ? Math.round(e.n) : '', ok: typeof e.what === 'string' ? e.what.slice(0, 10) : '', device })).filter((e) => e.act);
    if (list.length) await askSheet({ action: 'assist_log', list }, 8000);
    return res.status(204).end();
  }
  if (b.op !== 'suggest' && b.op !== 'grammar') return res.status(400).json({ error: 'bad_request' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'not_ready' });
  const level = ['B', 'I', 'A'].includes(b.level) ? b.level : null;
  if (!level) return res.status(400).json({ error: 'bad_request' });

  let prompt, key, max;
  if (b.op === 'suggest') {
    const before = String(b.before || '').slice(-2500), after = String(b.after || '').slice(0, 500);
    if (before.trim().split(/\s+/).length < 2) return res.status(400).json({ error: 'bad_request' });
    prompt = suggestPrompt(level, before, after, clip(b.topic, 80), clip(b.gtype, 30)); max = 400;
    key = ['s', MODEL, level, before, after, clip(b.topic, 80), clip(b.gtype, 30)].join('\u0001');
  } else {
    const sentence = clip(b.sentence, 400), prev = clip(b.prev, 400);
    if (sentence.split(' ').length < 3) return res.status(400).json({ error: 'bad_request' });
    prompt = grammarPrompt(level, sentence, prev); max = 300;
    key = ['g', MODEL, level, prev, sentence].join('\u0001');
  }
  key = crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
  if (saved.has(key)) return res.status(200).json(saved.get(key));
  if (used(device) >= DAILY) return res.status(429).json({ error: 'daily_limit' });
  if (tooMany('as:' + ip, 300)) return res.status(429).json({ error: 'too_many' });
  const out = await ask(prompt, max);
  if (!out || typeof out !== 'object') return res.status(502).json({ error: 'upstream' });

  let result;
  if (b.op === 'suggest') {
    const item = (x) => (x && typeof x.en === 'string' && x.en.trim() ? { en: clip(x.en, 160), ko: clip(x.ko, 160) } : null);
    const words = (Array.isArray(out.words) ? out.words : []).map(item).filter(Boolean).slice(0, 4);
    const cont = level === 'A' ? null : item(out.cont);
    if (!words.length && !cont) return res.status(502).json({ error: 'upstream' });
    result = { words, cont };
  } else {
    const sentence = clip(b.sentence, 400), fixed = clip(out.fixed, 400);
    const bad = out.ok === false && fixed && fixed !== sentence;
    result = bad ? { ok: false, fixed, focus: sentence.includes(String(out.focus || '')) ? clip(out.focus, 80) : '', ko: clip(out.ko, 160) } : { ok: true };
  }
  add(device); saved.set(key, result); if (saved.size > 5000) saved.clear();
  return res.status(200).json(result);
};
