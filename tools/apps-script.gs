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
  return out({ ok: Boolean(ss), version: 2, message: ss ? '연결 준비 완료: ' + ss.getName() : '이 스크립트가 시트에 연결되어 있지 않습니다. 시트의 확장 프로그램 → Apps Script에서 만들어 주세요.', secretSet: SECRET !== '여기에-비밀값-입력' });
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
