// Writing Clinic 실시간 도우미: 글을 쓰다 멈추면 방금 쓴 한 문장에 대해 짧은 힌트 하나 (고친 문장은 주지 않음)
// GET: 도우미 설정(레벨별 n초 등, 시트의 "분석 기준" 탭) / POST {op:'check'}: 한 문장 점검 / POST {op:'events'}: 안내 반응 기록
// 첨삭 하루 3회와는 따로 셈. 기기당 하루 ASSIST_DAILY회(기본 30).
// 환경 변수: ANTHROPIC_API_KEY, ASSIST_MODEL(기본 claude-haiku-5-5), ASSIST_DAILY, LOG_URL, LOG_SECRET
const crypto = require('crypto');
const { askSheet, getInfo, ipOf, kstTime, tooMany, body } = require('./_lib/sheet');
const MODEL = process.env.ASSIST_MODEL || 'claude-haiku-5-5';
const DAILY = Number(process.env.ASSIST_DAILY || 30);
const SCOPE = {
  B: 'Only errors that make the meaning unclear or hard to understand (missing verb, wrong word order that changes meaning, wrong word that changes meaning). Ignore small slips.',
  I: 'Errors that make the meaning unclear, plus grammar errors explained by a clear rule (subject-verb agreement, tense, verb form, singular/plural, pronoun, relative clause, conjunction).',
  A: 'All of the above, plus articles, prepositions, collocations and awkward or unnatural expressions.'
};
const saved = new Map(), perDay = new Map();
const kstDate = () => kstTime().slice(0, 10);
function used(device) { const m = perDay.get(device); return m && m.d === kstDate() ? m.n : 0; }
function add(device) { const d = kstDate(), m = perDay.get(device); perDay.set(device, { d, n: m && m.d === d ? m.n + 1 : 1 }); if (perDay.size > 20000) perDay.clear(); }
function prompt(level, sentence, prev, topic) {
  return `You help a Korean high school student who is writing an English paragraph${topic ? ` about "${topic}"` : ''}. The student paused after writing one sentence and asked for a quick check.

Check ONLY the target sentence. Use the earlier sentence only as context.
What to look at (level ${level}): ${SCOPE[level]}
Pick the single most important problem within that scope. If there is none, the sentence is fine.

Rules:
- Never write the corrected sentence, the corrected word, or the right form. The student must fix it. Give a hint that points to WHERE and WHAT KIND of problem it is.
- Write the hint in Korean, one sentence, friendly, under 60 Korean characters. Use grammar terms a Korean high school student knows (주어, 동사, 수 일치, 시제, 관사, 전치사 등).
- "focus" must be copied exactly from the target sentence (a word or short phrase), or "" if the sentence is fine.
- If the sentence is fine, set ok to true and give one short Korean sentence of specific praise.

Earlier sentence: ${prev ? JSON.stringify(prev) : '(none)'}
Target sentence: ${JSON.stringify(sentence)}

Answer with JSON only: {"ok": true or false, "hint": "...", "focus": "..."}`;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const { config } = await getInfo();
    return res.status(200).json({ ready: Boolean(process.env.ANTHROPIC_API_KEY) && config.assistOn !== 0, n: { B: config.assistB, I: config.assistI, A: config.assistA }, step: config.assistStep, daily: DAILY });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const b = body(req), ip = ipOf(req);
  const device = /^[a-z0-9]{8,40}$/.test(String(b.device || '')) ? b.device : 'ip-' + ip;

  // 안내 메시지에 대한 반응 기록 (보여 줌 / 받음 / 괜찮아요 / 무시 / 점검 결과). 문장 내용은 저장하지 않음
  if (b.op === 'events') {
    if (tooMany('ev:' + ip, 200) || !Array.isArray(b.list)) return res.status(204).end();
    const list = b.list.slice(0, 50).map((e) => ({ time: kstTime(), level: ['B', 'I', 'A'].includes(e.level) ? e.level : '', kind: e.kind === 'stuck' ? 'stuck' : 'check',
      act: ['shown', 'accept', 'decline', 'ignore', 'result'].includes(e.act) ? e.act : '', n: Number.isFinite(e.n) ? Math.round(e.n) : '', ok: e.ok === true ? 1 : e.ok === false ? 0 : '', device })).filter((e) => e.act);
    if (list.length) await askSheet({ action: 'assist_log', list }, 8000);
    return res.status(204).end();
  }
  if (b.op !== 'check') return res.status(400).json({ error: 'bad_request' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'not_ready' });
  const level = ['B', 'I', 'A'].includes(b.level) ? b.level : null;
  const sentence = String(b.sentence || '').replace(/\s+/g, ' ').trim(), prev = String(b.prev || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const topic = String(b.topic || '').slice(0, 80);
  if (!level || sentence.split(' ').length < 3 || sentence.length > 400) return res.status(400).json({ error: 'bad_request' });
  // 같은 문장 = 같은 힌트
  const key = crypto.createHash('sha256').update([MODEL, level, prev, sentence].join('\u0001')).digest('hex').slice(0, 32);
  if (saved.has(key)) return res.status(200).json(saved.get(key));
  if (used(device) >= DAILY) return res.status(429).json({ error: 'daily_limit' });
  if (tooMany('as:' + ip, 150)) return res.status(429).json({ error: 'too_many' });
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, temperature: 0, messages: [{ role: 'user', content: prompt(level, sentence, prev, topic) }] }) });
    clearTimeout(timer);
    const data = await r.json().catch(() => null);
    if (!r.ok) { console.error('assist error', r.status, data?.error?.type, data?.error?.message); return res.status(503).json({ error: 'busy' }); }
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const a = text.indexOf('{'), z = text.lastIndexOf('}');
    let out; try { out = JSON.parse(text.slice(a, z + 1)); } catch (e) { return res.status(502).json({ error: 'upstream' }); }
    const focus = typeof out.focus === 'string' && out.focus && sentence.includes(out.focus) ? out.focus.slice(0, 60) : '';
    const result = { ok: out.ok === true, hint: String(out.hint || '').slice(0, 120), focus };
    if (!result.hint) return res.status(502).json({ error: 'upstream' });
    add(device); saved.set(key, result); if (saved.size > 5000) saved.clear();
    return res.status(200).json(result);
  } catch (e) { console.error('assist failure', e && e.name); return res.status(502).json({ error: 'upstream' }); }
};
