// Writing Clinic AI 첨삭 중계 서버 (Vercel Serverless Function)
// 필요한 환경 변수: ANTHROPIC_API_KEY
// 선택 환경 변수: MODEL (기본 claude-sonnet-5-5), HOURLY_LIMIT (기기당 1시간 첨삭 횟수, 기본 5),
//                 IP_HOURLY_LIMIT (같은 인터넷 주소당 1시간, 기본 60 — 학원 와이파이처럼 여럿이 함께 쓰는 경우 고려),
//                 DAILY_LIMIT (사이트 전체 하루 첨삭 횟수, 기본 300)
//                 LOG_URL, LOG_SECRET (첨삭 기록을 구글 시트에 쌓는 Apps Script 웹 앱 주소와 비밀값)
//                 USER_DAILY_LIMIT (한 사용자(기기)당 하루 첨삭 횟수, 기본 3), UNLOCK_PASSWORD (입력하면 횟수 제한 없이 사용)
const { buildPromptFor, LEVELS, TOPICS } = require('./_lib/prompt');
const crypto = require('crypto');
// 첨삭 기준(프롬프트)이나 모델이 바뀌면 저장된 결과를 새로 만들도록 버전에 포함
const RULES_VERSION = crypto.createHash('sha256').update(buildPromptFor.toString() + JSON.stringify(LEVELS)).digest('hex').slice(0, 10);

const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const HOURLY = Number(process.env.HOURLY_LIMIT || 5);
const IP_HOURLY = Number(process.env.IP_HOURLY_LIMIT || 60);
const DAILY = Number(process.env.DAILY_LIMIT || 300);
const USER_DAILY = Number(process.env.USER_DAILY_LIMIT || 3);
const kstDate = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const memDay = new Map();        // device -> {date, n}  (시트가 없을 때를 위한 보조 집계)
function unlockToken() {
  const pw = (process.env.UNLOCK_PASSWORD || '').trim();
  return pw ? crypto.createHmac('sha256', pw + '|' + (process.env.LOG_SECRET || '')).update('wc-unlimited-v1').digest('hex').slice(0, 40) : '';
}
function isUnlimited(req) {
  const tok = unlockToken(), got = String(req.headers['x-wc-pass'] || '');
  return Boolean(tok) && got.length === tok.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(tok));
}
function memUsed(device) { const m = memDay.get(device); return m && m.date === kstDate() ? m.n : 0; }
function memAdd(device) { const d = kstDate(), m = memDay.get(device); memDay.set(device, { date: d, n: m && m.date === d ? m.n + 1 : 1 }); if (memDay.size > 20000) memDay.clear(); }
async function askScript(payload) {
  if (!process.env.LOG_URL) return null;
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(process.env.LOG_URL.trim(), { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, signal: ctl.signal,
      body: JSON.stringify(Object.assign({ auth: (process.env.LOG_SECRET || '').trim() }, payload)) });
    clearTimeout(timer);
    return JSON.parse(await r.text());
  } catch (e) { return null; }
}
async function usedToday(device) {
  const d = await askScript({ action: 'quota', device, date: kstDate() });
  return Math.max(memUsed(device), d && d.ok && typeof d.used === 'number' ? d.used : 0);
}
const unlockFails = new Map();
const hits = new Map();          // key -> [timestamps]  (서버 인스턴스별, 최선 노력 방식)
let day = '', dayCount = 0;

function ipOf(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
}
function recent(key) { const now = Date.now(); return (hits.get(key) || []).filter((t) => now - t < 3600e3); }
function allow(ip, device, unlimited) {
  const now = Date.now(), byIp = recent('ip:' + ip), byDev = recent('dev:' + device);
  if ((!unlimited && byDev.length >= HOURLY) || byIp.length >= IP_HOURLY) return 'rate_limited';
  const today = new Date(now + 9 * 3600e3).toISOString().slice(0, 10);   // 한국 날짜
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= DAILY) return 'no_credit';
  byIp.push(now); byDev.push(now); hits.set('ip:' + ip, byIp); hits.set('dev:' + device, byDev); dayCount++;
  if (hits.size > 10000) hits.clear();
  return null;
}
// 같은 글에는 항상 같은 결과: 구글 시트의 "저장된 결과" 탭에서 찾아 그대로 돌려줌
function resultKey(level, topic, gtype, text) {
  const norm = text.replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update([RULES_VERSION, MODEL, level, topic, gtype, norm].join('\u0001')).digest('hex').slice(0, 32);
}
async function findSaved(key) {
  const d = await askScript({ action: 'get', key });
  try { return d && d.ok && d.result ? JSON.parse(d.result) : null; } catch (e) { return null; }
}
async function saveLog(row) {
  if (!process.env.LOG_URL) return;
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(process.env.LOG_URL.trim(), { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, signal: ctl.signal,
      body: JSON.stringify(Object.assign({ secret: (process.env.LOG_SECRET || '').trim() }, row)) });
    const body = await r.text().catch(() => '');
    clearTimeout(timer);
    if (!/"ok":true/.test(body)) console.error('log not saved', r.status, body.slice(0, 200));
  } catch (e) { console.error('log failed', e && e.name); }
}
function logRow(parsed, { name, level, t, gtype, clean, device, key, reused }) {
  const g = parsed.grammar || {}, st = parsed.structure || {};
  return {
    time: new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19),
    name, level: LEVELS[level].name, topic: t.en + ' (' + t.ko + ')',
    type: (gtype || ('자동: ' + (typeof parsed.type === 'string' ? parsed.type : ''))) + (reused ? ' (같은 글, 저장된 결과)' : ''),
    words: clean.split(/\s+/).length, grammar: g.level, structure: st.level,
    errors: (Array.isArray(g.errors) ? g.errors : []).map((e) => (e.label || '') + (e.repeat > 1 ? ' ×' + e.repeat : '')).join(', '),
    weak: (Array.isArray(st.criteria) ? st.criteria : []).filter((c) => c.verdict === 'weak').map((c) => c.name).join(', '),
    text: clean, revised: typeof parsed.revised === 'string' ? parsed.revised : '', device, key
  };
}
function parseJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const info = { ready: Boolean(process.env.ANTHROPIC_API_KEY), logging: Boolean(process.env.LOG_URL), limit: USER_DAILY, unlockable: Boolean(unlockToken()) };
    const dev = String(req.query?.device || '');
    if (/^[a-z0-9]{8,40}$/.test(dev)) { info.unlimited = isUnlimited(req); info.used = info.unlimited ? 0 : await usedToday(dev); }
    return res.status(200).json(info);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }

  if (body && body.action === 'unlock') {
    const ip = ipOf(req), now = Date.now(), list = (unlockFails.get(ip) || []).filter((x) => now - x < 3600e3);
    if (!unlockToken()) return res.status(503).json({ error: 'no_password' });
    if (list.length >= 10) return res.status(429).json({ error: 'too_many' });
    if (String(body.password || '').trim() !== (process.env.UNLOCK_PASSWORD || '').trim()) { list.push(now); unlockFails.set(ip, list); return res.status(401).json({ error: 'wrong_password' }); }
    return res.status(200).json({ token: unlockToken() });
  }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'not_ready' });
  const { level, topic, type, text } = body || {};
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 20) : '';
  if (!LEVELS[level] || typeof text !== 'string' || typeof topic !== 'string') return res.status(400).json({ error: 'bad_request' });
  const t = TOPICS.find((x) => x.en.toLowerCase() === topic.toLowerCase());
  if (!t) return res.status(400).json({ error: 'bad_request' });
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length > 3000) return res.status(413).json({ error: 'too_long' });
  if (clean.split(/\s+/).length < 10) return res.status(400).json({ error: 'bad_request' });
  const types = ['', '주장하는 글', '설명하는 글', '비교·대조하는 글', '문제와 해결을 다루는 글', '경험을 전하는 글'];
  const gtype = types.includes(type) ? type : '';

  const device = /^[a-z0-9]{8,40}$/.test(String(body.device || '')) ? body.device : 'ip-' + ipOf(req);
  const unlimited = isUnlimited(req);
  if (!unlimited) {
    const used = await usedToday(device);
    if (used >= USER_DAILY) return res.status(429).json({ error: 'daily_limit', used, limit: USER_DAILY });
  }
  const blocked = allow(ipOf(req), device, unlimited);
  if (blocked) return res.status(429).json({ error: blocked });

  const key = resultKey(level, t.en, gtype, clean);
  const saved = await findSaved(key);
  if (saved) {
    memAdd(device);
    await saveLog(logRow(saved, { name, level, t, gtype, clean, device, key, reused: true }));
    return res.status(200).json(saved);
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: buildPromptFor(clean, level, t, gtype, false) }] })
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      const kind = data?.error?.type || '';
      console.error('anthropic error', r.status, kind, data?.error?.message);
      if (r.status === 429 || r.status === 529 || kind === 'overloaded_error') return res.status(503).json({ error: 'busy' });
      if (r.status === 400 && /credit|balance|billing/i.test(data?.error?.message || '')) return res.status(503).json({ error: 'no_credit' });
      return res.status(502).json({ error: 'upstream' });
    }
    const textOut = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const parsed = parseJson(textOut);
    if (!parsed || typeof parsed !== 'object') return res.status(502).json({ error: 'upstream' });
    if (parsed.valid !== false) memAdd(device);
    if (parsed.valid !== false) await saveLog(Object.assign(logRow(parsed, { name, level, t, gtype, clean, device, key, reused: false }), { result: JSON.stringify(parsed) }));
    return res.status(200).json(parsed);
  } catch (e) {
    console.error('relay failure', e);
    return res.status(502).json({ error: 'upstream' });
  }
};
