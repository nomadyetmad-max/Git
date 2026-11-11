// Writing Clinic 첨삭 기록 → 이 구글 시트에 한 줄씩 쌓입니다.
// 1) 아래 SECRET을 아무도 모를 긴 문자열로 바꾸세요. (Vercel의 LOG_SECRET과 똑같이)
const SECRET = '여기에-비밀값-입력';
const SHEET = '첨삭 기록';
const SAVED = '저장된 결과';   // 같은 글에 같은 결과를 돌려주기 위한 보관함 (지우면 다음 첨삭 때 새로 만듦)
const HEAD = ['시간', '이름', '레벨', '주제', '글의 종류', '단어 수', '문법 점수', '구조 점수', '문법 오류 종류', '보완 필요 구조 항목', '학생 글', '고쳐 쓴 글', '기기'];

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, reason: 'format' }); }
  if (d && d.action === 'get') {
    if (String(d.auth).trim() !== SECRET.trim()) return out({ ok: false, reason: 'secret' });
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SAVED);
    if (!sh || !d.key) return out({ ok: true, result: null });
    const hit = sh.getRange('A:A').createTextFinder(String(d.key)).matchEntireCell(true).findNext();
    return out({ ok: true, result: hit ? sh.getRange(hit.getRow(), 3).getValue() : null });
  }
  if (d && d.action === 'stats') {
    if (String(d.auth).trim() !== SECRET.trim()) return out({ ok: false, reason: 'secret' });
    return out({ ok: true, stats: stats(Boolean(d.detail)) });
  }
  if (!d || String(d.secret).trim() !== SECRET.trim()) { console.log('비밀값이 Vercel의 LOG_SECRET과 다릅니다.'); return out({ ok: false, reason: 'secret' }); }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) { sh.appendRow(HEAD); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HEAD.length).setFontWeight('bold'); }
  const cell = (v) => { const s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) ? "'" + s : s; };   // 수식 주입 방지
  sh.appendRow([d.time, d.name, d.level, d.topic, d.type, d.words, d.grammar, d.structure, d.errors, d.weak, d.text, d.revised, d.device].map(cell));
  if (d.key && d.result) {
    const sv = ss.getSheetByName(SAVED) || ss.insertSheet(SAVED);
    if (sv.getLastRow() === 0) { sv.appendRow(['글 식별값', '처음 첨삭 시간', '결과(JSON)']); sv.setFrozenRows(1); }
    const lock = LockService.getScriptLock(); lock.waitLock(5000);
    try {
      const dup = sv.getRange('A:A').createTextFinder(String(d.key)).matchEntireCell(true).findNext();
      if (!dup) sv.appendRow([String(d.key), String(d.time), "'" + String(d.result)]);
    } finally { lock.releaseLock(); }
  }
  return out({ ok: true });
}
// 브라우저로 웹 앱 주소를 열었을 때 연결 상태를 보여 줍니다.
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return out({ ok: Boolean(ss), version: 3, message: ss ? '연결 준비 완료: ' + ss.getName() : '이 스크립트가 시트에 연결되어 있지 않습니다. 시트의 확장 프로그램 → Apps Script에서 만들어 주세요.', secretSet: SECRET !== '여기에-비밀값-입력' });
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---- 통계 (사이트의 통계 화면에서 사용). 이름이 '테스트'인 줄과 '저장된 결과'를 다시 꺼낸 줄은 빼고 계산합니다.
const ERR_GROUPS = [
  [/수\s*일치|주어.?동사|agreement/i, '수 일치'], [/시제|tense/i, '시제'], [/관사|article/i, '관사'], [/전치사|preposition/i, '전치사'],
  [/관계/, '관계사'], [/대명사|pronoun/i, '대명사'], [/접속|연결/, '접속사·연결어'], [/어순|word order/i, '어순'],
  [/동사\s*(형태|형)|to부정사|동명사|분사|원형|verb form/i, '동사 형태'], [/조각|fragment|run.?on|무주어|주어 누락|동사 누락|문장 구성|불완전/i, '문장 구성'],
  [/단수|복수|가산|불가산|명사의 수/, '명사의 수'], [/철자|spelling/i, '철자'], [/구두점|쉼표|마침표|대문자|punctuation/i, '구두점·대문자'],
  [/어색|연어|collocation|표현|단어 선택|어휘/i, '어색한 표현·어휘']
];
function errGroup(label) { for (const [re, name] of ERR_GROUPS) if (re.test(label)) return name; return label || '기타'; }
function stats(detail) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);
  const rows = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 13).getDisplayValues() : [];
  const now = new Date(Date.now() + 9 * 3600e3), today = now.toISOString().slice(0, 10);
  const day = (n) => new Date(now.getTime() - n * 864e5).toISOString().slice(0, 10);
  const weekFrom = day(6), days = []; for (let i = 13; i >= 0; i--) days.push({ date: day(i), count: 0 });
  const LV = ['Basic', 'Intermediate', 'Advanced'], lv = {}; LV.forEach((k) => (lv[k] = { count: 0, g: 0, s: 0, n: 0 }));
  const topics = {}, types = {}, errs = {}, weak = {}, people = {}, recent = [];
  let total = 0, todayN = 0, weekN = 0;
  const add = (o, k, n) => { if (k) o[k] = (o[k] || 0) + (n || 1); };
  rows.forEach((r) => {
    const [time, name, level, topic, type, , g, st, errors, weakItems, text, revised] = r;
    if (String(name).trim() === '테스트' || /저장된 결과/.test(type)) return;
    total++; const date = String(time).slice(0, 10);
    if (date === today) todayN++; if (date >= weekFrom) weekN++;
    const dd = days.find((x) => x.date === date); if (dd) dd.count++;
    if (lv[level]) { lv[level].count++; const G = Number(g), S = Number(st); if (G && S) { lv[level].g += G; lv[level].s += S; lv[level].n++; } }
    add(topics, String(topic).replace(/\s*\(.*\)$/, '')); add(types, String(type).replace(/^자동:\s*/, '') || '미정');
    const groups = [];
    String(errors).split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => { const m = x.match(/×\s*(\d+)$/); const k = errGroup(x.replace(/×\s*\d+$/, '').trim()); add(errs, k, m ? Number(m[1]) : 1); groups.push(k); });
    String(weakItems).split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => add(weak, x));
    if (detail) {
      const who = String(name).trim() || '(이름 없음)';
      const p = people[who] || (people[who] = { name: who, count: 0, g: 0, s: 0, n: 0, errs: {}, last: '' });
      p.count++; if (Number(g) && Number(st)) { p.g += Number(g); p.s += Number(st); p.n++; } groups.forEach((k) => add(p.errs, k)); p.last = time > p.last ? time : p.last;
      recent.push({ time, name: who, level, topic, type, g, s: st, errors, text, revised });
    }
  });
  const top = (o, n) => Object.keys(o).map((k) => ({ name: k, count: o[k] })).sort((a, b) => b.count - a.count).slice(0, n);
  const avg = (x, k) => (x.n ? Math.round((x[k] / x.n) * 10) / 10 : null);
  const res = { updated: now.toISOString().slice(0, 16).replace('T', ' '), total, today: todayN, week: weekN, days,
    levels: LV.map((k) => ({ name: k, count: lv[k].count, grammar: avg(lv[k], 'g'), structure: avg(lv[k], 's') })),
    topics: top(topics, 8), types: top(types, 6), errors: top(errs, 8), weak: top(weak, 8) };
  if (detail) {
    res.students = Object.keys(people).map((k) => { const p = people[k]; return { name: p.name, count: p.count, grammar: avg(p, 'g'), structure: avg(p, 's'), errors: top(p.errs, 3).map((e) => e.name), last: p.last }; }).sort((a, b) => b.count - a.count);
    res.recent = recent.slice(-30).reverse();
  }
  return res;
}
