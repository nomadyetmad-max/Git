// Writing Clinic AI 첨삭 중계 서버 (Vercel Serverless Function)
// 필요한 환경 변수: ANTHROPIC_API_KEY
// 선택 환경 변수: MODEL (기본 claude-sonnet-5-5), HOURLY_LIMIT (기기당 1시간 첨삭 횟수, 기본 5),
//                 IP_HOURLY_LIMIT (같은 인터넷 주소당 1시간, 기본 60 — 학원 와이파이처럼 여럿이 함께 쓰는 경우 고려),
//                 DAILY_LIMIT (사이트 전체 하루 첨삭 횟수, 기본 300)
const { buildPromptFor, LEVELS, TOPICS } = require('./_lib/prompt');

const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const HOURLY = Number(process.env.HOURLY_LIMIT || 5);
const IP_HOURLY = Number(process.env.IP_HOURLY_LIMIT || 60);
const DAILY = Number(process.env.DAILY_LIMIT || 300);
const hits = new Map();          // key -> [timestamps]  (서버 인스턴스별, 최선 노력 방식)
let day = '', dayCount = 0;

function ipOf(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
}
function recent(key) { const now = Date.now(); return (hits.get(key) || []).filter((t) => now - t < 3600e3); }
function allow(ip, device) {
  const now = Date.now(), byIp = recent('ip:' + ip), byDev = recent('dev:' + device);
  if (byDev.length >= HOURLY || byIp.length >= IP_HOURLY) return 'rate_limited';
  const today = new Date(now + 9 * 3600e3).toISOString().slice(0, 10);   // 한국 날짜
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= DAILY) return 'no_credit';
  byIp.push(now); byDev.push(now); hits.set('ip:' + ip, byIp); hits.set('dev:' + device, byDev); dayCount++;
  if (hits.size > 10000) hits.clear();
  return null;
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
  if (req.method === 'GET') return res.status(200).json({ ready: Boolean(process.env.ANTHROPIC_API_KEY) });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'not_ready' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const { level, topic, type, text } = body || {};
  if (!LEVELS[level] || typeof text !== 'string' || typeof topic !== 'string') return res.status(400).json({ error: 'bad_request' });
  const t = TOPICS.find((x) => x.en.toLowerCase() === topic.toLowerCase());
  if (!t) return res.status(400).json({ error: 'bad_request' });
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length > 3000) return res.status(413).json({ error: 'too_long' });
  if (clean.split(/\s+/).length < 10) return res.status(400).json({ error: 'bad_request' });
  const types = ['', '주장하는 글', '설명하는 글', '비교·대조하는 글', '문제와 해결을 다루는 글', '경험을 전하는 글'];
  const gtype = level === 'A' && types.includes(type) ? type : '';

  const device = /^[a-z0-9]{8,40}$/.test(String(body.device || '')) ? body.device : 'ip-' + ipOf(req);
  const blocked = allow(ipOf(req), device);
  if (blocked) return res.status(429).json({ error: blocked });

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
    return res.status(200).json(parsed);
  } catch (e) {
    console.error('relay failure', e);
    return res.status(502).json({ error: 'upstream' });
  }
};
