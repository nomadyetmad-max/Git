// Writing Clinic · 내신 서술형 대비
// 학생이 붙여 넣은 지문에서 출제 기준에 따라 핵심 문장을 골라 서술형 문항을 만들고(op:'make'), 답을 채점(op:'grade')
// 유형 1: 핵심 문장 속 (A)(B) 빈칸, 단답형 / 유형 2: 지문은 그대로, 모의고사 40번처럼 요약문 (A)(B) / 유형 3: 중요 문장의 빈칸을 직접 쓰기
// 공통 조건: ① 핵심 단어 사용(본문 단어 또는 paraphrase, 어형 변화 허용) ② m단어 이하
// 조건(단어 수·핵심 단어)은 코드(exam-cond.js)가 판정하고, 뜻·어법은 AI가 모범 답안과 비교해 판정. 같은 입력 = 같은 결과(시트에 보관).
// 횟수: 기기당 하루 문항 만들기 examMake회, 채점 examGrade회(시트 "분석 기준"). 첨삭 3회와 따로. 암호 확인한 기기는 무제한.
// 환경 변수: ANTHROPIC_API_KEY, MODEL(기본 claude-sonnet-5-5), LOG_URL, LOG_SECRET, UNLOCK_PASSWORD
const crypto = require('crypto');
const { askSheet, getInfo, ipOf, kstTime, tooMany, body, unlimited, cacheGet, cachePut } = require('./_lib/sheet');
const COND = require('../exam-cond.js');
const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const RULES = 'exam-v1';   // 출제·채점 기준을 바꾸면 올려서 저장된 문항을 새로 만들게 함
const mem = new Map();
const sig = (o) => crypto.createHmac('sha256', 'wc-exam|' + (process.env.LOG_SECRET || '')).update(JSON.stringify(o)).digest('hex').slice(0, 24);
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const hash = (...a) => crypto.createHash('sha256').update(a.join('\u0001')).digest('hex').slice(0, 32);

// 출제 기준: 선생님의 모의고사 유형 변형 기준(<문제제작>)에서 서술형에 맞는 부분
const CRITERIA = `How to choose the target (use the passage's own signals, like a Korean mock-exam writer):
- A sentence where the passage's key idea is compressed into one sentence (often the topic sentence or the conclusion) → best for blanks.
- A sentence that turns a common belief around after "But / However / Yet / In fact" → best for blanks.
- If the passage reports an experiment or study result, or contrasts two subjects or claims, the summary-style (A)(B) works best; for contrasts, put the core character of each side into (A) and (B).
- Avoid sentences that are only examples, minor details, or quotations.`;
const TYPE_RULES = {
  1: `TYPE 1 (blanks inside the key sentence): Pick ONE key sentence from the passage. Blank out TWO key chunks of that sentence as (A) and (B). Each answer is short: 2 to 10 words (a single word is allowed only if it is the natural answer). The rest of the sentence stays as it is.
"target": the key sentence copied EXACTLY from the passage. "display": that sentence with the two chunks replaced by "(A)" and "(B)" (for example "... is (A) rather than (B)."). The answers must restore the original meaning; they may be the original words.`,
  2: `TYPE 2 (summary, like mock-exam item 40): Keep the passage as it is. Write ONE summary sentence (15 to 35 words) of the whole passage and blank out its two key parts as (A) and (B). Each answer is short: 1 to 6 words. As in the mock exam, the answers should be the passage's key ideas expressed mainly in different words from the passage (paraphrase).
"target": the full summary sentence with the answers filled in. "display": the summary sentence with "(A)" and "(B)".`,
  3: `TYPE 3 (write the blank yourself): Pick ONE important sentence from the passage and blank out its key part as one blank: a phrase or clause of 5 to 15 words that carries the main idea. The student writes it.
"target": the sentence copied EXACTLY from the passage. "display": the sentence with the blank replaced by "________". Use label "" for the only blank. Considering school-exam trends, about half the time the model answer can be the original words; otherwise a natural rewording.`
};
function makePrompt(passage, type, variant) {
  return `You write school-exam (내신) English writing items for Korean high school students, based on a passage the student pasted.

${CRITERIA}

${TYPE_RULES[type]}
${variant ? `This is retry number ${variant}: choose a DIFFERENT target than the ${variant} most obvious choice(s) if the passage has another good candidate.` : 'Choose the single best target.'}

Conditions given to the student (required for every blank, exactly as in real school exams):
1. Key words: for each blank give 1 to 3 "keywords" the answer must use. A keyword is either a word from the passage or a paraphrase of a passage word (say which in "kwFrom": "original" or "paraphrase"). Write each keyword in its base form (dictionary form); the student may change its form (plural, tense, -ing), but not its part of speech. Keywords must appear in your model answer.
2. Word limit: "maxWords" for each blank = the number of words in your model answer plus 0 to 2. Count words separated by spaces.
Your model answer must fit inside the blank grammatically and satisfy both conditions. Check this yourself before answering.

Also give:
- "why": one or two Korean sentences on why this sentence/summary was chosen (the signal in the passage).
- "ko": a natural Korean translation of the completed target sentence.
- "explain": two or three Korean sentences explaining the model answer and where in the passage the evidence is.
- "accept": for each blank, up to 3 other correct answers that also meet the conditions (can be empty).

Passage:
"""${passage}"""

Answer with JSON only:
{"target": "...", "display": "...", "blanks": [{"label": "A", "answer": "...", "keywords": ["..."], "kwFrom": "original", "maxWords": 5, "accept": ["..."]}], "why": "...", "ko": "...", "explain": "..."}`;
}
function gradePrompt(item, passage, answers) {
  return `You grade a Korean high school student's answer to a school-exam (내신) English writing item. Grade like a fair school teacher.

Passage:
"""${passage}"""

Item (blanks in this sentence): ${JSON.stringify(item.display)}
Completed sentence (model): ${JSON.stringify(item.target)}
${item.blanks.map((b) => `Blank ${b.label || '(only)'}: model answer ${JSON.stringify(b.answer)}; other accepted answers ${JSON.stringify(b.accept || [])}; student's answer ${JSON.stringify(answers[b.label] || '')}`).join('\n')}

For each blank judge two things (do NOT judge the word count or keyword conditions; those are checked separately):
- "meaning": "o" if it conveys the same key idea as the model answer in this context (different wording is fine), "partial" if part of the key idea is missing or slightly off, "x" if wrong or empty.
- "grammar": "o" if it fits grammatically into the blank with no errors, "x" if there is any grammar or spelling error (name it).
- "ko": one or two short Korean sentences telling the student why, and how to fix it if needed. Do not just repeat the model answer.

Answer with JSON only: {"blanks": [{"label": "A", "meaning": "o", "grammar": "o", "ko": "..."}]}`;
}
async function claude(prompt, maxTokens, ms) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms || 50000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }) });
    const data = await r.json().catch(() => null);
    if (!r.ok) { console.error('exam error', r.status, data?.error?.type, data?.error?.message); return { error: r.status === 429 || r.status === 529 ? 'busy' : 'api_' + r.status + (data?.error?.type ? '_' + data.error.type : '') }; }
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const a = text.indexOf('{'), z = text.lastIndexOf('}');
    try { return JSON.parse(text.slice(a, z + 1)); } catch (e) { console.error('exam bad json', data.stop_reason, text.slice(0, 300)); return { error: data.stop_reason === 'max_tokens' ? 'too_long_output' : 'bad_json' }; }
  } catch (e) { console.error('exam failure', e && e.name); return { error: e && e.name === 'AbortError' ? 'timeout' : 'upstream' }; } finally { clearTimeout(timer); }
}
// AI가 만든 문항을 코드로 검증·정리. 사소한 표기 차이는 코드가 바로잡고, 고칠 수 없는 문제만 다시 요청
const loose = (x) => String(x || '').toLowerCase().replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^a-z0-9]/g, '');
function sentencesOf(p) { return (p.match(/[^.!?]+[.!?]+["'”’)\]]*/g) || [p]).map(norm).filter(Boolean); }
// 모델이 옮겨 적은 문장을 지문 속 실제 문장으로 되찾기 (따옴표·띄어쓰기·대소문자 차이 무시)
function findInPassage(passage, target) {
  if (norm(passage).includes(norm(target))) return norm(target);
  const t = loose(target); if (!t) return null;
  const ss = sentencesOf(passage);
  return ss.find((x) => loose(x) === t) || ss.find((x) => loose(x).includes(t) && t.length > 20) || ss.find((x) => t.includes(loose(x)) && loose(x).length > 20) || null;
}
function fixMarks(display, type) {
  let d = norm(display);
  d = d.replace(/[(\[]\s*([AB])\s*[)\]]/g, '($1)');
  if (type === 3) d = d.replace(/\(\s*\)|_{2,}|\[\s*\]|\(blank\)|\[blank\]/gi, '________');
  return d;
}
function checkItem(o, type, passage) {
  if (!o || o.error) return { problem: 'no answer' };
  if (!Array.isArray(o.blanks)) return { problem: 'missing "blanks" array' };
  const labels = type === 3 ? [''] : ['A', 'B'];
  const blanks = type === 3 ? [o.blanks[0]] : labels.map((l, i) => o.blanks.find((b) => String(b.label || '').replace(/[^AB]/gi, '').toUpperCase() === l) || o.blanks[i]);
  if (blanks.some((b) => !b || !norm(b.answer))) return { problem: `need ${labels.length} blank(s) with an "answer"` };
  let target = norm(o.target), display = fixMarks(o.display, type);
  if (type !== 2) { const t = findInPassage(passage, target); if (!t) return { problem: '"target" must be copied exactly from the passage' }; target = t; }
  if (type === 3 ? !/_{3,}/.test(display) : !(display.includes('(A)') && display.includes('(B)'))) return { problem: type === 3 ? '"display" must contain ________ for the blank' : '"display" must contain (A) and (B)' };
  const out = [];
  for (let i = 0; i < blanks.length; i++) {
    const b = blanks[i], answer = norm(b.answer).replace(/[.]$/, ''), n = COND.countWords(answer);
    let keywords = (Array.isArray(b.keywords) ? b.keywords : [b.keywords]).map(norm).filter(Boolean).slice(0, 3);
    // 모범 답안에 없는 핵심 단어는 빼고, 하나도 안 남으면 답안에서 가장 긴 내용어를 핵심 단어로
    keywords = keywords.filter((k) => COND.hasKeyword(answer, k));
    if (!keywords.length) { const w = answer.split(/\s+/).map((x) => x.replace(/[^A-Za-z-]/g, '')).filter((x) => x.length > 3).sort((x, y) => y.length - x.length)[0]; if (!w) return { problem: `blank ${labels[i] || ''} needs a keyword that appears in its model answer` }; keywords = [w.toLowerCase()]; }
    let maxWords = Math.round(Number(b.maxWords) || 0);
    if (!maxWords || maxWords < n) maxWords = n;
    if (maxWords > n + 3) maxWords = n + 2;
    const accept = (Array.isArray(b.accept) ? b.accept : []).map(norm).filter((x) => x && COND.check(x, { keywords, maxWords }).ok).slice(0, 3);
    out.push({ label: labels[i], answer, keywords, kwFrom: b.kwFrom === 'paraphrase' ? 'paraphrase' : 'original', maxWords, accept });
  }
  return { item: { type, target, display, blanks: out, why: norm(o.why).slice(0, 300), ko: norm(o.ko).slice(0, 400), explain: norm(o.explain).slice(0, 600) } };
}
async function used(device) {
  const d = await askSheet({ action: 'exam_quota', device, date: kstTime().slice(0, 10) }, 6000);
  return d.error ? null : { make: d.make || 0, grade: d.grade || 0 };
}
const memUse = new Map();
function memUsed(device) { const m = memUse.get(device); return m && m.d === kstTime().slice(0, 10) ? m : { make: 0, grade: 0 }; }
function memAdd(device, k) { const d = kstTime().slice(0, 10), m = memUse.get(device); const v = m && m.d === d ? m : { d, make: 0, grade: 0 }; v[k]++; memUse.set(device, v); if (memUse.size > 20000) memUse.clear(); }
async function quota(device) { const s = await used(device), m = memUsed(device); return { make: Math.max(m.make, s ? s.make : 0), grade: Math.max(m.grade, s ? s.grade : 0) }; }
function log(row) { return askSheet(Object.assign({ action: 'exam_log', time: kstTime() }, row), 8000); }

const DEADLINE = 56000;   // vercel.json maxDuration 60초보다 조금 짧게
module.exports = async (req, res) => {
  const T0 = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  const { config } = await getInfo(), LIM = { make: config.examMake, grade: config.examGrade };
  if (req.method === 'GET') {
    const dev = String(req.query?.device || ''), unl = unlimited(req);
    const info = { ready: Boolean(process.env.ANTHROPIC_API_KEY), limit: LIM, unlimited: unl };
    if (/^[a-z0-9]{8,40}$/.test(dev) && !unl) info.used = await quota(dev);
    return res.status(200).json(info);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'not_ready' });
  const b = body(req), ip = ipOf(req), unl = unlimited(req);
  const device = /^[a-z0-9]{8,40}$/.test(String(b.device || '')) ? b.device : 'ip-' + ip;
  const passage = norm(b.passage);
  const words = COND.countWords(passage);
  if (words < 40) return res.status(400).json({ error: 'too_short' });
  if (words > 450 || passage.length > 4000) return res.status(413).json({ error: 'too_long' });
  if (tooMany('ex:' + ip, 120)) return res.status(429).json({ error: 'too_many' });

  if (b.op === 'make') {
    const type = [1, 2, 3].includes(b.type) ? b.type : null, variant = Number.isInteger(b.variant) && b.variant >= 0 && b.variant < 5 ? b.variant : 0;
    if (!type) return res.status(400).json({ error: 'bad_request' });
    const key = 'exam-make-' + hash(RULES, MODEL, passage, type, variant);
    let item = mem.get(key);
    if (!item) {
      // 시트 확인 두 가지를 동시에 (함수 실행 시간 60초 안에 끝내기 위해)
      const [saved, u] = await Promise.all([cacheGet(key), unl ? Promise.resolve(null) : quota(device)]);
      item = saved;
      if (!item && u && u.make >= LIM.make) return res.status(429).json({ error: 'daily_limit', used: u, limit: LIM });
    }
    if (!item) {
      // 만들고 → 코드로 검증 → 고칠 수 없는 문제가 있으면 이유를 알려 주고 한 번 더 (남은 시간이 있을 때만)
      let prompt = makePrompt(passage, type, variant), r = null, last = '';
      for (let tries = 0; tries < 2; tries++) {
        const left = DEADLINE - (Date.now() - T0);
        if (left < 15000) break;
        const o = await claude(prompt, 1400, left - 4000);
        if (o && o.error) { last = o.error; if (o.error === 'busy') return res.status(503).json({ error: 'busy' }); continue; }
        r = checkItem(o, type, passage);
        if (r.item) break;
        last = r.problem; console.error('exam make check failed:', r.problem);
        prompt += `\n\nYour previous answer had a problem: ${r.problem}. Fix it and answer again with JSON only.\nPrevious answer: ${JSON.stringify(o).slice(0, 3000)}`;
      }
      if (!r || !r.item) return res.status(502).json({ error: last === 'timeout' ? 'timeout' : 'upstream', detail: String(last).slice(0, 120) });
      item = r.item; memAdd(device, 'make');
      cachePut(key, item).catch(() => {});
      log({ kind: 'make', device, type, words, target: item.target, item: JSON.stringify(item), answers: '', marks: '' }).catch(() => {});
    }
    mem.set(key, item); if (mem.size > 2000) mem.clear();
    return res.status(200).json(Object.assign({}, item, { sig: sig({ passage, item }) }));
  }

  if (b.op === 'grade') {
    const item = b.item;
    if (!item || typeof item !== 'object' || !Array.isArray(item.blanks) || String(b.item.sig || '') !== sig({ passage, item: Object.assign({}, item, { sig: undefined }) })) return res.status(400).json({ error: 'bad_item' });
    const answers = {}; item.blanks.forEach((x) => { answers[x.label] = norm((b.answers || {})[x.label]).slice(0, 300); });
    if (item.blanks.every((x) => !answers[x.label])) return res.status(400).json({ error: 'empty' });
    const conds = item.blanks.map((x) => COND.check(answers[x.label], x));
    const key = 'exam-grade-' + hash(RULES, MODEL, item.sig, JSON.stringify(answers));
    let ai = mem.get(key), u = null;
    if (!ai) [ai, u] = await Promise.all([cacheGet(key), unl ? Promise.resolve(null) : quota(device)]);
    if (!ai) {
      if (u && u.grade >= LIM.grade) return res.status(429).json({ error: 'daily_limit', used: u, limit: LIM });
      const o = await claude(gradePrompt(item, passage, answers), 800);
      if (!o || o.error || !Array.isArray(o.blanks)) return res.status(o && o.error === 'busy' ? 503 : 502).json({ error: (o && o.error) || 'upstream' });
      ai = item.blanks.map((x) => { const g = o.blanks.find((y) => String(y.label || '') === x.label) || o.blanks[0] || {};
        return { meaning: ['o', 'partial', 'x'].includes(g.meaning) ? g.meaning : 'x', grammar: g.grammar === 'o' ? 'o' : 'x', ko: norm(g.ko).slice(0, 300) }; });
      memAdd(device, 'grade'); cachePut(key, ai).catch(() => {});
    }
    mem.set(key, ai);
    // 최종 판정: 빈 답 ×, 뜻이 틀리면 ×, 뜻 일부·어법 오류·조건 위반이면 △ (조건 위반은 실제 시험처럼 감점), 모두 맞으면 ○
    const result = item.blanks.map((x, i) => {
      const a = ai[i], c = conds[i], empty = !answers[x.label];
      const mark = empty || a.meaning === 'x' ? 'x' : a.meaning === 'o' && a.grammar === 'o' && c.ok ? 'o' : 'partial';
      return { label: x.label, answer: answers[x.label], mark, meaning: a.meaning, grammar: a.grammar, cond: c, ko: a.ko };
    });
    await log({ kind: 'grade', device, type: item.type, words, target: item.target, item: '', answers: JSON.stringify(answers), marks: result.map((r) => (r.label || '-') + ':' + r.mark + (r.cond.ok ? '' : ':cond')).join(' ') });
    return res.status(200).json({ blanks: result });
  }
  return res.status(400).json({ error: 'bad_request' });
};
