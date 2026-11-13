// 구글 시트(Apps Script 웹 앱)와 주고받기 + "분석 기준" 탭의 설정값
// 필요한 환경 변수: LOG_URL, LOG_SECRET
// 학생 화면에 보내도 되는 설정만 PUBLIC에 둡니다.
const DEFAULTS = { minN: 5, master: 80, recent: 10, assistB: 12, assistI: 18, assistA: 25, assistStep: 3, assistOn: 1, examMake: 5, examGrade: 20 };
const PUBLIC = Object.keys(DEFAULTS);
let info = null, infoAt = 0;

async function askSheet(payload, ms) {
  if (!process.env.LOG_URL) return { error: 'not_ready' };
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms || 12000);
    const r = await fetch(process.env.LOG_URL.trim(), { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, signal: ctl.signal,
      body: JSON.stringify(Object.assign({ auth: (process.env.LOG_SECRET || '').trim() }, payload)) });
    clearTimeout(timer);
    const d = JSON.parse(await r.text());
    if (d && d.ok) return d;
    if (d && d.reason) return { error: d.reason };
    return { error: 'script_old' };
  } catch (e) { return { error: 'sheet_unreachable' }; }
}
// 누적 횟수와 설정: 1분 동안 재사용 (시트를 매번 부르지 않도록)
async function getInfo() {
  if (info && Date.now() - infoAt < 60e3) return info;
  const d = await askSheet({ action: 'read_info' }, 8000);
  const config = Object.assign({}, DEFAULTS);
  if (!d.error && d.config) PUBLIC.forEach((k) => { const v = Number(d.config[k]); if (Number.isFinite(v) && v >= 0) config[k] = v; });
  info = { plays: d.error ? null : d.plays || null, config, error: d.error || undefined };
  infoAt = Date.now() - (d.error ? 45e3 : 0);   // 실패했으면 15초 뒤 다시 시도
  return info;
}
function forget() { info = null; }
const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
const kstTime = (t) => new Date((t || Date.now()) + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
// 시간당 횟수 제한 (서버 인스턴스별, 최선 노력 방식)
const hits = new Map();
function tooMany(key, max) {
  const now = Date.now(), list = (hits.get(key) || []).filter((t) => now - t < 3600e3);
  if (list.length >= max) return true;
  list.push(now); hits.set(key, list); if (hits.size > 20000) hits.clear();
  return false;
}
function body(req) { let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } return b || {}; }

// 첨삭 화면의 "암호 확인"으로 받은 토큰이면 횟수 제한 없음 (evaluate.js와 같은 계산)
const crypto = require('crypto');
function unlimited(req) {
  const pw = (process.env.UNLOCK_PASSWORD || '').trim(); if (!pw) return false;
  const tok = crypto.createHmac('sha256', pw + '|' + (process.env.LOG_SECRET || '')).update('wc-unlimited-v1').digest('hex').slice(0, 40), got = String(req.headers['x-wc-pass'] || '');
  return got.length === tok.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(tok));
}
// 같은 입력 = 같은 결과: 시트의 "저장된 결과" 탭에 보관
async function cacheGet(key) { const d = await askSheet({ action: 'get', key }, 6000); try { return d && !d.error && d.result ? JSON.parse(d.result) : null; } catch (e) { return null; } }
async function cachePut(key, value) { await askSheet({ action: 'cache_put', key, time: kstTime(), value: JSON.stringify(value) }, 8000); }

module.exports = { askSheet, getInfo, forget, ipOf, kstTime, tooMany, body, DEFAULTS, unlimited, cacheGet, cachePut };
