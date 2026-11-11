// 비필수 문장성분 Drill 랭킹 (구글 시트 "드릴 기록" 탭)
// GET: 학년 × 문장 수별 상위 5명 / POST {op:'submit'}: 기록 저장 후 순위 / POST {op:'name'}: 상위 5등이면 이름 등록
// 필요한 환경 변수: LOG_URL, LOG_SECRET (첨삭 기록과 같은 값)
const crypto = require('crypto');
const MAX_PER_Q = 150, LIMIT_SECS = { 1: 30, 2: 36, 3: 45 };
let cache = null, cachedAt = 0;
const hits = new Map();

async function askSheet(payload) {
  if (!process.env.LOG_URL) return { error: 'not_ready' };
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(process.env.LOG_URL.trim(), { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, signal: ctl.signal,
      body: JSON.stringify(Object.assign({ auth: (process.env.LOG_SECRET || '').trim() }, payload)) });
    clearTimeout(timer);
    const d = JSON.parse(await r.text());
    if (d && d.ok) return d;
    if (d && d.reason) return { error: d.reason };
    return { error: 'script_old' };
  } catch (e) { return { error: 'sheet_unreachable' }; }
}
const ipOf = (req) => String(req.headers['x-forwarded-for'] || '?').split(',')[0].trim();
const sign = (id) => crypto.createHmac('sha256', 'wc-drill|' + (process.env.LOG_SECRET || '')).update(String(id)).digest('hex').slice(0, 32);
const int = (v) => (Number.isInteger(v) ? v : NaN);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    if (cache && Date.now() - cachedAt < 20e3) return res.status(200).json(cache);
    const d = await askSheet({ action: 'rank_top' });
    if (d.error) return res.status(503).json(d);
    cache = { boards: d.boards }; cachedAt = Date.now();
    return res.status(200).json(cache);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const ip = ipOf(req), now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (list.length >= 80) return res.status(429).json({ error: 'too_many' });
  list.push(now); hits.set(ip, list);

  const grade = int(body.grade), count = int(body.count);
  if (![1, 2, 3].includes(grade) || ![10, 20, 30].includes(count)) return res.status(400).json({ error: 'bad_request' });

  if (body.op === 'submit') {
    const score = int(body.score), correct = int(body.correct), secs = int(body.secs);
    if (!(score >= 0 && score <= MAX_PER_Q * count) || !(correct >= 0 && correct <= count) || !(secs >= 0 && secs <= LIMIT_SECS[grade] * count + 5)) return res.status(400).json({ error: 'bad_request' });
    if (score > correct * MAX_PER_Q + (count - correct) * 60) return res.status(400).json({ error: 'bad_request' });
    const device = /^[a-z0-9]{8,40}$/.test(String(body.device || '')) ? body.device : 'ip-' + ip;
    const id = now.toString(36) + crypto.randomBytes(4).toString('hex');
    const time = new Date(now + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
    const d = await askSheet({ action: 'rank_add', id, time, grade, count, score, correct, secs, device });
    if (d.error) return res.status(503).json(d);
    cache = null;
    return res.status(200).json({ id, token: sign(id), rank: d.rank, total: d.total });
  }
  if (body.op === 'name') {
    const id = String(body.id || ''), tok = String(body.token || '');
    if (!/^[a-z0-9]{8,30}$/.test(id) || tok.length !== 32 || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(sign(id)))) return res.status(403).json({ error: 'bad_token' });
    const name = String(body.name || '').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12);
    if (!name) return res.status(400).json({ error: 'bad_name' });
    const d = await askSheet({ action: 'rank_name', id, grade, count, name });
    if (d.error) return res.status(d.error === 'not_top' || d.error === 'already' ? 409 : 503).json(d);
    cache = { boards: d.boards }; cachedAt = Date.now();
    return res.status(200).json(cache);
  }
  return res.status(400).json({ error: 'bad_request' });
};
