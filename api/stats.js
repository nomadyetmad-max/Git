// Writing Clinic 통계 (구글 시트 → 사이트 통계 화면)
// GET: 학생 공개용 통계(이름·글 없음, 1분 캐시) / POST {password}: 선생님용 상세 통계
// 필요한 환경 변수: LOG_URL, LOG_SECRET (기록과 같은 값), STATS_PASSWORD (선생님 화면 비밀번호)
let cache = null, cachedAt = 0;
const fails = new Map();

async function askSheet(detail) {
  if (!process.env.LOG_URL) return { error: 'not_ready' };
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(process.env.LOG_URL.trim(), { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, signal: ctl.signal,
      body: JSON.stringify({ auth: (process.env.LOG_SECRET || '').trim(), action: 'stats', detail }) });
    clearTimeout(timer);
    const d = JSON.parse(await r.text());
    if (d && d.ok && d.stats) return d.stats;
    return { error: 'script_old' };
  } catch (e) { return { error: 'sheet_unreachable' }; }
}
function ipOf(req) { return String(req.headers['x-forwarded-for'] || '?').split(',')[0].trim(); }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    if (cache && Date.now() - cachedAt < 60e3) return res.status(200).json(cache);
    const s = await askSheet(false);
    if (s.error) return res.status(503).json(s);
    cache = s; cachedAt = Date.now();
    return res.status(200).json(s);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.STATS_PASSWORD) return res.status(503).json({ error: 'no_password' });
  const ip = ipOf(req), now = Date.now(), list = (fails.get(ip) || []).filter((t) => now - t < 3600e3);
  if (list.length >= 10) return res.status(429).json({ error: 'too_many' });
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  if (String(body?.password || '') !== process.env.STATS_PASSWORD.trim()) { list.push(now); fails.set(ip, list); return res.status(401).json({ error: 'wrong_password' }); }
  const s = await askSheet(true);
  if (s.error) return res.status(503).json(s);
  return res.status(200).json(s);
};
