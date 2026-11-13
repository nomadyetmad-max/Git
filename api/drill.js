// Reading Clinic 기록 (구글 시트 "Reading 기록" 탭) + 학습 코드
// GET: 누적 연습 횟수와 학생 화면용 설정(분석 기준 탭)
// POST {op:'log'}: 한 판의 문장별 결과 저장 / POST {op:'join'}: 학습 코드 만들기·불러오기
// 필요한 환경 변수: LOG_URL, LOG_SECRET (첨삭 기록과 같은 값)
const crypto = require('crypto');
const { askSheet, getInfo, forget, ipOf, kstTime, tooMany, body } = require('./_lib/sheet');

const CODE = /^[A-Za-z0-9:]{1,12}$/;
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const pair = (r) => (Array.isArray(r) && r.length === 2 && r.every((x) => Number.isInteger(x) && x >= 0 && x < 200) ? r : null);
// 문장 하나의 기록: 정해진 칸만 남기고 나머지는 버림
function cleanItem(it, kind) {
  if (!it || typeof it !== 'object') return null;
  const o = { k: String(it.k || '').slice(0, 12), g: [0, 1, 2, 3].includes(it.g) ? it.g : null, ok: it.ok ? 1 : 0, r: it.r === null || it.r === undefined ? null : it.r ? 1 : 0,
    s: num(it.s, 0, 3600), fa: num(it.fa, 0, 3600), h: Number.isInteger(it.h) && it.h >= 0 && it.h <= 5 ? it.h : 0 };
  if (!/^[A-Za-z0-9-]{1,12}$/.test(o.k)) return null;
  if (kind === 'mod') {
    o.m = CODE.test(it.m || '') ? it.m : ''; o.t = CODE.test(it.t || '') ? it.t : '';
    o.sel = Array.isArray(it.sel) ? it.sel.map((x) => (x === null ? null : pair(x))).slice(0, 2) : null;
  } else {
    o.c = {}; if (it.c && typeof it.c === 'object') Object.keys(it.c).slice(0, 6).forEach((k) => { if (/^[SVOC]2?$/.test(k) && CODE.test(String(it.c[k]))) o.c[k] = String(it.c[k]); });
    o.x = Array.isArray(it.x) ? it.x.filter((x) => CODE.test(String(x))).slice(0, 6) : [];
    o.sel = Array.isArray(it.sel) ? it.sel.filter((x) => Array.isArray(x) && /^[SVOC]$/.test(x[0]) && Number.isInteger(x[1]) && Number.isInteger(x[2])).slice(0, 8) : null;
    o.w = Number.isInteger(it.w) && it.w > 0 && it.w < 200 ? it.w : null;
  }
  return o;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json(await getInfo());
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const b = body(req), ip = ipOf(req);

  if (b.op === 'log') {
    if (tooMany('log:' + ip, 300)) return res.status(429).json({ error: 'too_many' });
    const kind = b.kind === 'core' ? 'core' : b.kind === 'mod' ? 'mod' : null;
    if (!kind || ![0, 1, 2, 3].includes(b.grade) || !Array.isArray(b.items) || !b.items.length || b.items.length > 30) return res.status(400).json({ error: 'bad_request' });
    const items = b.items.map((x) => cleanItem(x, kind)).filter(Boolean);
    if (!items.length) return res.status(400).json({ error: 'bad_request' });
    const device = /^[a-z0-9]{8,40}$/.test(String(b.device || '')) ? b.device : 'ip-' + ip;
    const learner = /^[a-f0-9]{24}$/.test(String(b.learner || '')) ? b.learner : '';
    const secs = items.reduce((a, x) => a + (x.s || 0), 0);
    const row = { id: Date.now().toString(36) + crypto.randomBytes(3).toString('hex'), time: kstTime(), kind, grade: b.grade, count: items.length,
      correct: items.filter((x) => x.ok).length, retry: items.filter((x) => x.r === 1).length, hints: items.reduce((a, x) => a + x.h, 0), secs: Math.round(secs),
      device, learner, input: b.input === 'tap' ? 'tap' : 'drag', review: b.review ? 1 : 0, ver: String(b.ver || '').slice(0, 40), detail: JSON.stringify(items) };
    if (row.detail.length > 45000) return res.status(413).json({ error: 'too_long' });
    const d = await askSheet(Object.assign({ action: 'read_log' }, row));
    if (d.error) return res.status(503).json(d);
    forget();
    return res.status(200).json({ ok: true });
  }

  if (b.op === 'join') {
    // 숫자 4자리는 맞혀 보기 쉬우니, 실패가 많은 주소는 잠시 막음
    if (tooMany('join:' + ip, 30)) return res.status(429).json({ error: 'too_many' });
    const nick = String(b.nick || '').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12);
    if (nick.length < 2) return res.status(400).json({ error: 'bad_name' });
    if (!/^\d{4}$/.test(String(b.pin || ''))) return res.status(400).json({ error: 'bad_pin' });
    if (!process.env.LOG_SECRET) return res.status(503).json({ error: 'not_ready' });
    const id = crypto.createHmac('sha256', 'wc-learner|' + process.env.LOG_SECRET.trim()).update(nick.toLowerCase() + '|' + b.pin).digest('hex').slice(0, 24);
    const device = /^[a-z0-9]{8,40}$/.test(String(b.device || '')) ? b.device : '';
    const d = await askSheet({ action: 'learner_join', nick, id, device, time: kstTime() }, 20000);
    if (d.error === 'taken') { tooMany('join:' + ip, 30); tooMany('join:' + ip, 30); return res.status(409).json({ error: 'taken' }); }
    if (d.error) return res.status(503).json(d);
    return res.status(200).json({ id, nick, hist: d.hist || null });
  }
  return res.status(400).json({ error: 'bad_request' });
};
