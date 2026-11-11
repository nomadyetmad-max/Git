// Writing Clinic 첨삭 기록 → 이 구글 시트에 한 줄씩 쌓입니다.
// 1) 아래 SECRET을 아무도 모를 긴 문자열로 바꾸세요. (Vercel의 LOG_SECRET과 똑같이)
const SECRET = '여기에-비밀값-입력';
const SHEET = '첨삭 기록';
const HEAD = ['시간', '이름', '레벨', '주제', '글의 종류', '단어 수', '문법 점수', '구조 점수', '문법 오류 종류', '보완 필요 구조 항목', '학생 글', '고쳐 쓴 글', '기기'];

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false }); }
  if (!d || d.secret !== SECRET) return out({ ok: false });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) { sh.appendRow(HEAD); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HEAD.length).setFontWeight('bold'); }
  const cell = (v) => { const s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) ? "'" + s : s; };   // 수식 주입 방지
  sh.appendRow([d.time, d.name, d.level, d.topic, d.type, d.words, d.grammar, d.structure, d.errors, d.weak, d.text, d.revised, d.device].map(cell));
  return out({ ok: true });
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
