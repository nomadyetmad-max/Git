// Writing Clinic · Reading Clinic 기록 → 이 구글 시트에 쌓입니다. (v10)
// 처음 한 번: 아래 SECRET을 바꾸고 → 배포 → 편집기에서 setupAutomation 함수를 한 번 실행(주간 브리핑·알림 예약, 권한 허용).
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
  if (d && d.action === 'quota') {
    if (String(d.auth).trim() !== SECRET.trim()) return out({ ok: false, reason: 'secret' });
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);
    if (!sh || sh.getLastRow() < 2 || !d.device) return out({ ok: true, used: 0 });
    const n = sh.getLastRow() - 1, from = Math.max(2, sh.getLastRow() - 3000 + 1);   // 최근 3,000줄만 확인 (빠르게)
    const times = sh.getRange(from, 1, sh.getLastRow() - from + 1, 1).getDisplayValues(), devs = sh.getRange(from, 13, sh.getLastRow() - from + 1, 1).getDisplayValues();
    let used = 0; for (let i = 0; i < times.length; i++) if (String(times[i][0]).slice(0, 10) === d.date && String(devs[i][0]) === String(d.device)) used++;
    return out({ ok: true, used });
  }
  // Reading Clinic 기록·학습 코드·도우미 기록·설정 (v10)
  if (d && READ_ACTIONS[d.action]) {
    if (String(d.auth).trim() !== SECRET.trim()) return out({ ok: false, reason: 'secret' });
    return out(READ_ACTIONS[d.action](d));
  }
  // 예전 랭킹 요청(v9 이전 사이트)은 조용히 거절
  if (d && /^rank2?_/.test(d.action || '')) return out({ ok: false, reason: 'ranking_removed' });
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
  return out({ ok: Boolean(ss), version: 10, message: ss ? '연결 준비 완료: ' + ss.getName() : '이 스크립트가 시트에 연결되어 있지 않습니다. 시트의 확장 프로그램 → Apps Script에서 만들어 주세요.', secretSet: SECRET !== '여기에-비밀값-입력' });
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
  const LV = ['Basic', 'Intermediate', 'Advanced'], lv = {}; LV.forEach((k) => (lv[k] = { count: 0, g: 0, s: 0, n: 0, errs: {} }));
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
    String(errors).split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => { const m = x.match(/×\s*(\d+)$/); const k = errGroup(x.replace(/×\s*\d+$/, '').trim()); add(errs, k, m ? Number(m[1]) : 1); if (lv[level]) add(lv[level].errs, k, m ? Number(m[1]) : 1); groups.push(k); });
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
    levels: LV.map((k) => ({ name: k, count: lv[k].count, grammar: avg(lv[k], 'g'), structure: avg(lv[k], 's'), errors: top(lv[k].errs, 3) })),
    topics: top(topics, 8), types: top(types, 6), errors: top(errs, 8), weak: top(weak, 8) };
  if (detail) {
    res.students = Object.keys(people).map((k) => { const p = people[k]; return { name: p.name, count: p.count, grammar: avg(p, 'g'), structure: avg(p, 's'), errors: top(p.errs, 3).map((e) => e.name), last: p.last }; }).sort((a, b) => b.count - a.count);
    res.recent = recent.slice(-30).reverse();
  }
  return res;
}


// =====================================================================================
// Reading Clinic (v10): 문장별 풀이 기록, 학습 코드, 분석 기준, 주간 브리핑, 자동 알림
// 시트 탭: "Reading 기록" · "학습자" · "어시스턴트 기록" · "분석 기준" · "결정 기록" · "주간 브리핑"
// 예전 "드릴 기록"(랭킹) 탭은 지우지 않고, 누적 연습 횟수에만 더해 셉니다.
// =====================================================================================
const RD = 'Reading 기록', LEARNERS = '학습자', ASSIST = '어시스턴트 기록', CONFIG = '분석 기준', DECIDE = '결정 기록', BRIEF = '주간 브리핑', OLD_DRILL = '드릴 기록';
const RD_HEAD = ['기록 ID', '시간', '종류', '학년', '문장 수', '첫 시도 정답', '다시 해서 정답', '힌트', '걸린 시간(초)', '기기', '학습자', '입력', '복습', '버전', '상세(JSON)'];
// 분석 기준: 값 칸만 고치면 사이트와 브리핑에 바로 반영돼요(사이트는 1분 안에). 키 칸은 고치지 마세요.
const CONFIG_ROWS = [
  ['숙련도: 측정 최소 횟수', 5, '한 패턴(형식)을 이 횟수 이상 풀어야 정답률을 보여 줌. 그 전에는 "측정 중"', 'minN'],
  ['숙련도: 익힘 기준(%)', 80, '최근 정답률이 이 값 이상이면 "익힘"', 'master'],
  ['숙련도: 최근 몇 번으로 계산', 10, '정답률을 계산할 최근 시도 수(첫 시도만)', 'recent'],
  ['브리핑: 판단 보류 기준(회)', 30, '이 횟수보다 적게 풀린 패턴은 브리핑에서 "판단 보류"', 'briefMinN'],
  ['저품질 판: 문장당 평균 시간(초) 미만', 2, '이보다 빠르면서', 'lowQualSecs'],
  ['저품질 판: 정답률(%) 이하', 30, '정답률도 이 값 이하인 판은 찍기로 보고 분석에서 뺌', 'lowQualAcc'],
  ['문장 검토: 정답률(%) 이하', 20, '이 정답률 이하인 문장(패턴×학년)은 문장·채점 오류 후보로 브리핑에 표시', 'flagAcc'],
  ['문장 검토: 최소 시도 수', 10, '이 횟수 이상 풀린 문장만 검토 후보로 봄', 'flagMinN'],
  ['분석 제외: 기기·학습 코드 닉네임', '', '쉼표로 구분. 선생님 테스트 기기나 닉네임을 적으면 브리핑에서 빠짐', 'exclude'],
  ['도우미: Basic 멈춤 시간(초)', 12, 'Writing에서 쓰다 이만큼 멈추면 도우미가 말을 검(문장 중간이면 1.5배)', 'assistB'],
  ['도우미: Intermediate 멈춤 시간(초)', 18, '', 'assistI'],
  ['도우미: Advanced 멈춤 시간(초)', 25, '', 'assistA'],
  ['도우미: "괜찮아요"를 누를 때 늘리는 초', 3, '학생 기기마다 자동 조정(기본값의 절반~두 배 사이)', 'assistStep'],
  ['도우미: 켜기(1) / 끄기(0)', 1, '0이면 Writing 도우미가 나타나지 않음', 'assistOn'],
  ['알림: Writing 하루 첨삭 경고(회)', 200, '하루 첨삭이 이 횟수를 넘으면 메일(비용 확인용)', 'writingWarn'],
  ['알림: Reading 기록이 끊긴 시간', 24, '이 시간 동안 기록이 하나도 없으면(평소엔 있었는데) 메일', 'quietHours'],
  ['브리핑 받을 메일', '', '비워 두면 이 스크립트 주인의 메일', 'mail']
];
const PUBLIC_KEYS = ['minN', 'master', 'recent', 'assistB', 'assistI', 'assistA', 'assistStep', 'assistOn'];
const READ_ACTIONS = {
  read_info: () => ({ ok: true, plays: readPlays(), config: pick(readConfig(), PUBLIC_KEYS) }),
  read_log: (d) => readLog(d),
  learner_join: (d) => learnerJoin(d),
  assist_log: (d) => assistLog(d)
};
function pick(o, keys) { const r = {}; keys.forEach((k) => { if (k in o) r[k] = o[k]; }); return r; }
function safeCell(v) { const s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function tab(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); if (head) { sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); } }
  return sh;
}
function rows(sh, cols) { return sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, cols).getValues() : []; }
// 시간 칸은 글자 그대로('YYYY-MM-DD HH:MM:SS') 저장하고 화면에 보이는 값으로 읽어서 비교
function rowsText(sh, cols) { return sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, cols).getDisplayValues() : []; }
const asText = (v) => "'" + String(v == null ? '' : v);

// ---- 분석 기준 탭: 없으면 기본값으로 만들고, 새 항목이 생기면 아래에 덧붙임
function readConfig() {
  const sh = tab(CONFIG, ['항목', '값', '설명', '키(고치지 마세요)']);
  const have = rows(sh, 4), keys = have.map((r) => String(r[3]));
  CONFIG_ROWS.forEach((r) => { if (!keys.includes(r[3])) { sh.appendRow(r); have.push(r); } });
  const cfg = {};
  CONFIG_ROWS.forEach((r) => (cfg[r[3]] = r[1]));
  have.forEach((r) => { const k = String(r[3]); if (!k) return; const v = r[1]; cfg[k] = typeof v === 'number' ? v : (String(v).trim() !== '' && !isNaN(Number(v)) ? Number(v) : String(v).trim()); });
  return cfg;
}

// ---- 누적 연습 횟수 (예전 랭킹 탭 + 새 기록 탭)
function readPlays() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), p = { mod: 0, core: 0 };
  const old = ss.getSheetByName(OLD_DRILL);
  if (old && old.getLastRow() > 1) old.getRange(2, 10, old.getLastRow() - 1, 1).getValues().forEach((r) => { if (r[0] === '문장성분 찾기') p.core++; else p.mod++; });
  const sh = ss.getSheetByName(RD);
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 3, sh.getLastRow() - 1, 1).getValues().forEach((r) => { if (r[0] === 'core') p.core++; else p.mod++; });
  return p;
}

// ---- 한 판 기록: 한 줄 = 한 판, 문장별 결과는 상세(JSON) 칸에
function readLog(d) {
  const lock = LockService.getScriptLock(); lock.waitLock(8000);
  try {
    tab(RD, RD_HEAD).appendRow([d.id, asText(d.time), d.kind, d.grade, d.count, d.correct, d.retry, d.hints, d.secs, asText(d.device), asText(d.learner), d.input, d.review, d.ver, d.detail].map(safeCell));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// ---- 학습 코드: 닉네임이 같고 ID(닉네임+숫자로 만든 값)가 다르면 다른 학생 → taken
// 처음 만들 때 이 기기의 예전 기록(학습자 칸이 빈 줄)을 이 학습자로 옮기고, 지금까지의 패턴별 기록을 돌려줌
function learnerJoin(d) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = tab(LEARNERS, ['닉네임', '학습자 ID', '만든 시간', '처음 기기']);
    const list = rows(sh, 2), nick = String(d.nick), id = String(d.id);
    const same = list.find((r) => String(r[0]).toLowerCase() === nick.toLowerCase());
    if (same && String(same[1]) !== id) return { ok: false, reason: 'taken' };
    if (!same) sh.appendRow([nick, id, d.time, d.device].map(safeCell));
    const rd = tab(RD, RD_HEAD);
    if (d.device && rd.getLastRow() > 1) {
      const n = rd.getLastRow() - 1, cols = rd.getRange(2, 10, n, 2).getValues();
      let changed = false;
      cols.forEach((r) => { if (String(r[0]) === String(d.device) && !r[1]) { r[1] = asText(id); changed = true; } });
      if (changed) rd.getRange(2, 10, n, 2).setValues(cols);
    }
    return { ok: true, hist: learnerHist(id) };
  } finally { lock.releaseLock(); }
}
function learnerHist(id) {
  const h = { mod: {}, core: {} }, rd = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RD);
  if (!rd) return h;
  rowsText(rd, 15).forEach((r) => {
    if (String(r[10]) !== id) return;
    const kind = r[2] === 'core' ? 'core' : 'mod';
    let items; try { items = JSON.parse(r[14]); } catch (e) { return; }
    items.forEach((it) => { const e = h[kind][it.k] || (h[kind][it.k] = { s: '', f: '' }); e.s = (e.s + (it.ok ? '1' : '0')).slice(-60); if (e.f.length < 10) e.f += it.ok ? '1' : '0'; });
  });
  return h;
}

// ---- Writing 도우미 반응 기록 (문장 내용은 없음)
function assistLog(d) {
  const sh = tab(ASSIST, ['시간', '레벨', '종류', '반응', 'n초', '점검 결과(1 문제없음 · 0 힌트)', '기기']);
  const list = (d.list || []).slice(0, 50).map((e) => [asText(e.time)].concat([e.level, e.kind, e.act, e.n, e.ok, e.device].map(safeCell)));
  if (list.length) sh.getRange(sh.getLastRow() + 1, 1, list.length, 7).setValues(list);
  return { ok: true };
}

// =====================================================================================
// 주간 브리핑 (매주 토요일 아침 메일) · 매일 점검 알림
// 숫자는 모두 이 코드가 계산하고, AI(선택)는 그 숫자로 읽기 쉬운 글만 씁니다.
// AI 요약을 쓰려면: 프로젝트 설정 → 스크립트 속성에 ANTHROPIC_API_KEY 추가 (없으면 표만 보냄)
// =====================================================================================
const POS = { S: '주어', O: '목적어', C: '보어', PO: '전치사의 목적어', VO: '준동사의 목적어', VC: '준동사의 보어' };
const ADJ = { adj: '형용사 단독', pp: '형용사구(전치사구)', rel: '관계대명사절', rad: '관계부사절', ptc: '분사(구)', to: 'to부정사' };
const ADVT = { V: '동사', NV: '준동사', AJ: '형용사', AV: '다른 부사', PH: '구·절', SE: '문장 전체' };
const ADVK = { adv: '부사 단독', pp: '부사구(전치사구)', cl: '부사절', to: 'to부정사', pc: '분사구문' };
const GR = { 0: '예비 고1', 1: '고1', 2: '고2', 3: '고3' };
const MCODE = { none: '수식어 안 고름', under: '수식어 덩어리 일부만', over: '수식어 범위 넘침', shift: '수식어 시작·끝 어긋남', other: '다른 수식어 덩어리' };
const TCODE = { none: '대상 안 고름', self: '대상에 수식어 포함', near: '수식어 바로 옆 단어를 대상으로', other: '엉뚱한 단어를 대상으로', under: '대상 일부만', over: '대상 범위 넘침' };
const CN = { S: '주어', V: '동사', O: '목적어', O2: '직접목적어', C: '보어' };
function patName(k) { const [t, a, b] = String(k).split('-'); return t === 'A' ? POS[a] + ' × ' + ADJ[b] : t === 'D' ? ADVT[a] + ' × ' + ADVK[b] : k + '형식'; }
function coreCode(comp, code) {
  if (code === 'miss') return CN[comp] + ' 못 찾음';
  if (code === 'over') return CN[comp] + ' 덩어리에 다른 성분까지';
  if (code === 'nohead') return CN[comp] + ' 핵심 단어 빠짐';
  if (/^as:/.test(code)) return CN[comp] + '를 ' + CN[code.slice(3)] + '로 고름';
  return CN[comp] + ' ' + code;
}
function extraCode(x) { const [t, l] = String(x).split(':'); return t === 'none' ? '문장에 없는 ' + CN[l] + '를 고름' : CN[l] + '가 아닌 부분을 ' + CN[l] + '로 고름'; }
const pct = (a, b) => (b ? Math.round(100 * a / b) : null);
const kstNow = () => new Date(Date.now() + 9 * 3600e3);
const kstStr = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
function median(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

// 기간 [from, to) 동안의 Reading 기록 묶음
function readingPeriod(all, from, to, cfg, nickOf) {
  const ex = String(cfg.exclude || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const P = { games: { mod: 0, core: 0 }, lowq: 0, excluded: 0, users: {}, items: { mod: [], core: [] }, vers: {}, gameAcc: [] };
  all.forEach((r) => {
    const time = String(r[1]); if (time < from || time >= to) return;
    const dev = String(r[9]), lid = String(r[10]), who = (lid && nickOf[lid]) || '';
    if (ex.length && (ex.includes(dev.toLowerCase()) || (who && ex.includes(who.toLowerCase())))) { P.excluded++; return; }
    let items; try { items = JSON.parse(r[14]); } catch (e) { return; }
    if (!items.length) return;
    const avg = items.reduce((a, x) => a + (x.s || 0), 0) / items.length, acc = pct(items.filter((x) => x.ok).length, items.length);
    if (avg < cfg.lowQualSecs && acc <= cfg.lowQualAcc) { P.lowq++; return; }
    const kind = r[2] === 'core' ? 'core' : 'mod';
    P.games[kind]++; P.users[lid || dev] = (P.users[lid || dev] || 0) + 1; P.vers[r[13]] = true;
    P.gameAcc.push({ user: lid || dev, time, kind, acc });
    items.forEach((x) => P.items[kind].push(Object.assign({ grade: Number(r[3]), input: r[11], review: Number(r[12]) === 1 }, x)));
  });
  return P;
}
function group(items, keyFn) { const o = {}; items.forEach((x) => { const k = keyFn(x); (o[k] = o[k] || []).push(x); }); return o; }
function accOf(list) { return pct(list.filter((x) => x.ok).length, list.length); }

function weeklyData() {
  const cfg = readConfig(), ss = SpreadsheetApp.getActiveSpreadsheet(), now = kstNow();
  const to = kstStr(now), from = kstStr(new Date(now.getTime() - 7 * 864e5)), prevFrom = kstStr(new Date(now.getTime() - 14 * 864e5));
  const nickOf = {}; const lsh = ss.getSheetByName(LEARNERS); if (lsh) rows(lsh, 2).forEach((r) => (nickOf[String(r[1])] = String(r[0])));
  const rd = ss.getSheetByName(RD), all = rd ? rowsText(rd, 15) : [];
  const W = readingPeriod(all, from, to, cfg, nickOf), Pv = readingPeriod(all, prevFrom, from, cfg, nickOf);
  const minN = Number(cfg.briefMinN) || 30;
  const out = { period: from.slice(0, 10) + ' ~ ' + to.slice(0, 10), cfg: { briefMinN: minN, flagAcc: cfg.flagAcc, flagMinN: cfg.flagMinN }, reading: {}, writing: {}, assist: {}, decisions: [], questions: [] };
  const R = out.reading;
  R.games = W.games; R.prevGames = Pv.games; R.users = Object.keys(W.users).length; R.lowQualityExcluded = W.lowq; R.testExcluded = W.excluded;
  R.versionsThisWeek = Object.keys(W.vers).length;
  ['mod', 'core'].forEach((kind) => {
    const it = W.items[kind], pv = Pv.items[kind];
    R[kind] = {
      items: it.length, firstTryAcc: accOf(it), prevFirstTryAcc: accOf(pv),
      byGrade: Object.entries(group(it, (x) => x.grade)).map(([g, l]) => ({ grade: GR[g], n: l.length, acc: accOf(l) })),
      retrySuccess: pct(it.filter((x) => x.r === 1).length, it.filter((x) => x.r !== null && x.r !== undefined).length),
      hintRate: pct(it.filter((x) => x.h > 0).length, it.length),
      medianSecs: (m => (m === null ? null : Math.round(m * 10) / 10))(median(it.map((x) => x.s || 0))),
      byInput: Object.entries(group(it, (x) => x.input || 'drag')).map(([k, l]) => ({ input: k === 'tap' ? '두 번 톡' : '드래그', n: l.length, acc: accOf(l) }))
    };
    // 패턴(형식)별 정답률: 표본이 적으면 판단 보류
    const byKey = Object.entries(group(it, (x) => x.k)).map(([k, l]) => ({ k, name: patName(k), n: l.length, acc: accOf(l) }));
    R[kind].patterns = byKey.filter((x) => x.n >= minN).sort((a, b) => a.acc - b.acc);
    R[kind].pending = byKey.filter((x) => x.n < minN).length;
    // 자주 혼동하는 부분: 오답의 유형별 개수 (패턴 × 오답 유형)
    const conf = {};
    it.filter((x) => !x.ok).forEach((x) => {
      const labels = kind === 'mod' ? [x.m && x.m !== 'ok' ? MCODE[x.m] : null, x.t && x.t !== 'ok' ? TCODE[x.t] : null]
        : Object.keys(x.c || {}).filter((c) => x.c[c] !== 'ok').map((c) => coreCode(c, x.c[c])).concat((x.x || []).map(extraCode));
      labels.filter(Boolean).forEach((lab) => { const k = patName(x.k) + ' | ' + lab; conf[k] = (conf[k] || 0) + 1; });
    });
    const wrongBy = group(it.filter((x) => !x.ok), (x) => patName(x.k));
    R[kind].confusions = Object.entries(conf).map(([k, n]) => { const [p, lab] = k.split(' | '); return { pattern: p, type: lab, n, shareOfWrong: pct(n, (wrongBy[p] || []).length) }; })
      .filter((x) => x.n >= 3).sort((a, b) => b.n - a.n).slice(0, 8);
    // 문장 검토 후보: 패턴(형식) × 학년 정답률이 아주 낮은 것 (문장이나 채점 규칙 오류일 수 있음)
    R[kind].flagged = Object.entries(group(it, (x) => x.k + '|' + x.grade)).map(([k, l]) => { const [p, g] = k.split('|'); return { pattern: patName(p), key: p, grade: GR[g], n: l.length, acc: accOf(l) }; })
      .filter((x) => x.n >= cfg.flagMinN && x.acc <= cfg.flagAcc);
  });
  // 성장: 이번 주에 2판 이상 한 학생의 첫 판 → 마지막 판 정답률 변화 (종류별)
  R.growth = ['mod', 'core'].map((kind) => {
    const byUser = group(W.gameAcc.filter((g) => g.kind === kind), (g) => g.user), d = [];
    Object.values(byUser).forEach((l) => { if (l.length >= 2) { l.sort((a, b) => (a.time < b.time ? -1 : 1)); d.push(l[l.length - 1].acc - l[0].acc); } });
    return { kind: kind === 'mod' ? '수식어 찾기' : '문장성분 찾기', students: d.length, avgChange: d.length ? Math.round(d.reduce((a, x) => a + x, 0) / d.length) : null };
  });
  // Writing
  const wsh = ss.getSheetByName(SHEET), wrows = wsh && wsh.getLastRow() > 1 ? wsh.getRange(2, 1, wsh.getLastRow() - 1, 9).getDisplayValues() : [];
  const inW = (t, a, b) => String(t) >= a && String(t) < b, real = (r) => String(r[1]).trim() !== '테스트' && !/저장된 결과/.test(r[4]);
  const ww = wrows.filter((r) => real(r) && inW(r[0], from, to)), wp = wrows.filter((r) => real(r) && inW(r[0], prevFrom, from));
  const errs = {}; ww.forEach((r) => String(r[8]).split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => { const k = errGroup(x.replace(/×\s*\d+$/, '').trim()); errs[k] = (errs[k] || 0) + 1; }));
  out.writing = { count: ww.length, prevCount: wp.length, byLevel: Object.entries(group(ww, (r) => r[2])).map(([k, l]) => ({ level: k, n: l.length })),
    topErrors: Object.entries(errs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ error: k, n })) };
  // 도우미
  const ash = ss.getSheetByName(ASSIST), arows = ash && ash.getLastRow() > 1 ? ash.getRange(2, 1, ash.getLastRow() - 1, 7).getDisplayValues().filter((r) => inW(r[0], from, to)) : [];
  out.assist = ['B', 'I', 'A'].map((lv) => {
    const l = arows.filter((r) => r[1] === lv && r[2] === 'check'), c = (a) => l.filter((r) => r[3] === a).length, res = l.filter((r) => r[3] === 'result');
    return { level: { B: 'Basic', I: 'Intermediate', A: 'Advanced' }[lv], nSeconds: cfg['assist' + lv], shown: c('shown'), accept: c('accept'), decline: c('decline'), ignore: c('ignore'), acceptRate: pct(c('accept'), c('shown')), hintGiven: res.filter((r) => r[5] === '0').length };
  });
  // 지난 2주의 결정 기록
  const dsh = tab(DECIDE, ['날짜', '결정한 것', '확인할 지표', '결과 메모']);
  out.decisions = rows(dsh, 4).filter((r) => r[0] && kstStr(new Date(new Date(r[0]).getTime() + 9 * 3600e3)) >= prevFrom).map((r) => ({ date: Utilities.formatDate(new Date(r[0]), 'Asia/Seoul', 'yyyy-MM-dd'), what: String(r[1]), watch: String(r[2]) }));
  // 이번 주에 판단할 것 (규칙으로 고름, 최대 5개)
  const Q = out.questions;
  ['mod', 'core'].forEach((kind) => {
    const name = kind === 'mod' ? '수식어 찾기' : '문장성분 찾기';
    R[kind].flagged.forEach((f) => Q.push(`[문장 검토] ${name} · ${f.pattern} (${f.grade}) 정답률 ${f.acc}% (${f.n}회): 문장이나 채점 기준에 문제가 없는지 확인할까요?`));
    const c = R[kind].confusions[0]; if (c && c.shareOfWrong >= 50) Q.push(`[수업 소재] ${name} · ${c.pattern}에서 틀린 경우의 ${c.shareOfWrong}%가 "${c.type}"이에요 (${c.n}회). 설명 문구나 힌트를 바꾸거나 수업에서 다룰까요?`);
    const w = R[kind].patterns[0]; if (w && w.acc < 50) Q.push(`[어려운 패턴] ${name} · ${w.name} 정답률 ${w.acc}% (${w.n}회). 쉬운 문장을 먼저 보여 주는 등 조정할까요?`);
    const bi = R[kind].byInput; if (bi.length === 2 && bi.every((x) => x.n >= minN) && Math.abs(bi[0].acc - bi[1].acc) >= 15) Q.push(`[입력 방식] ${name}에서 드래그와 두 번 톡의 정답률 차이가 커요 (${bi.map((x) => x.input + ' ' + x.acc + '%').join(' · ')}). 고르는 방식이 결과에 영향을 주는지 볼까요?`);
  });
  out.assist.forEach((a) => { if (a.shown >= minN && a.acceptRate !== null && (a.acceptRate < 20 || a.acceptRate > 70)) Q.push(`[도우미] ${a.level} 수락률 ${a.acceptRate}% (${a.shown}회 중). 멈춤 시간 ${a.nSeconds}초를 ${a.acceptRate < 20 ? '늘릴까요' : '줄일까요'}?`); });
  if (R.versionsThisWeek > 1) Q.push('[참고] 이번 주에 문장 은행이나 생성 규칙이 바뀌었어요. 지난주와 비교할 때 주의하세요.');
  out.questions = Q.slice(0, 5);
  return out;
}

// 표 형태의 브리핑(HTML). 숫자는 weeklyData가 계산한 그대로
function briefHtml(D, story) {
  const e = (s) => String(s == null ? '–' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const ul = (a) => '<ul>' + a.map((x) => '<li>' + x + '</li>').join('') + '</ul>';
  const R = D.reading, sec = [];
  if (story) sec.push('<h3>요약</h3>' + story.split('\n').filter(Boolean).map((l) => '<p>' + e(l) + '</p>').join(''));
  sec.push('<h3>이번 주에 판단할 것</h3>' + (D.questions.length ? ul(D.questions.map(e)) : '<p>특별히 판단할 것이 없어요.</p>'));
  sec.push('<h3>Reading Clinic</h3>' + ul([
    `연습 ${R.games.mod + R.games.core}판 (수식어 ${R.games.mod} · 문장성분 ${R.games.core}) · 지난주 ${R.prevGames.mod + R.prevGames.core}판 · 이용자 ${R.users}명`,
    `분석에서 뺀 판: 찍기로 보이는 판 ${R.lowQualityExcluded} · 제외 목록 ${R.testExcluded}`,
    ...R.growth.map((g) => `${g.kind} 성장: 2판 이상 한 학생 ${g.students}명의 첫 판 → 마지막 판 정답률 변화 ${g.avgChange === null ? '–' : (g.avgChange > 0 ? '+' : '') + g.avgChange + '%p'}`)
  ].map(e)));
  ['mod', 'core'].forEach((kind) => {
    const K = R[kind], name = kind === 'mod' ? '수식어 찾기' : '문장성분 찾기';
    sec.push(`<h4>${name}</h4>` + ul([
      `풀린 문장 ${K.items} · 첫 시도 정답률 ${e(K.firstTryAcc)}% (지난주 ${e(K.prevFirstTryAcc)}%) · 다시 해서 맞힌 비율 ${e(K.retrySuccess)}% · 힌트 사용 ${e(K.hintRate)}% · 문장당 시간(중앙값) ${e(K.medianSecs)}초`,
      '학년별: ' + (K.byGrade.map((x) => `${x.grade} ${x.acc}% (${x.n})`).join(' · ') || '–'),
      '입력 방식별: ' + (K.byInput.map((x) => `${x.input} ${x.acc}% (${x.n})`).join(' · ') || '–'),
      `정답률 낮은 ${kind === 'mod' ? '패턴' : '형식'}: ` + (K.patterns.slice(0, 5).map((x) => `${x.name} ${x.acc}% (${x.n})`).join(' · ') || '–') + ` · ${D.cfg.briefMinN}회 미만이라 판단 보류 ${K.pending}개`,
      '자주 혼동하는 부분: ' + (K.confusions.slice(0, 5).map((x) => `${x.pattern}에서 "${x.type}" ${x.n}회 (오답의 ${x.shareOfWrong}%)`).join(' · ') || '–'),
      `문장 검토 후보 (정답률 ${D.cfg.flagAcc}% 이하, ${D.cfg.flagMinN}회 이상): ` + (K.flagged.map((x) => `${x.pattern} ${x.grade} ${x.acc}% (${x.n})`).join(' · ') || '없음')
    ].map(e)));
  });
  const Wr = D.writing;
  sec.push('<h3>Writing Clinic</h3>' + ul([
    `첨삭 ${Wr.count}회 (지난주 ${Wr.prevCount}) · ` + (Wr.byLevel.map((x) => `${x.level} ${x.n}`).join(' · ') || '–'),
    '자주 나온 오류: ' + (Wr.topErrors.map((x) => `${x.error} ${x.n}`).join(' · ') || '–'),
    ...D.assist.map((a) => `도우미 ${a.level} (멈춤 ${a.nSeconds}초): 제안 ${a.shown} · 받음 ${a.accept} · 괜찮아요 ${a.decline} · 무시 ${a.ignore} · 수락률 ${e(a.acceptRate)}% · 힌트 준 문장 ${a.hintGiven}`)
  ].map(e)));
  sec.push('<h3>지난 결정</h3>' + (D.decisions.length ? ul(D.decisions.map((x) => e(`${x.date} · ${x.what}` + (x.watch ? ` → 확인할 지표: ${x.watch}` : '')))) : '<p>"결정 기록" 탭에 이번 주에 바꾸기로 한 것을 한 줄 적어 두면, 다음 브리핑에서 함께 보여 줘요.</p>'));
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6"><h2>Reading · Writing Clinic 주간 브리핑</h2><p>${e(D.period)} (한국 시간)</p>${sec.join('')}<p style="color:#888">기준은 시트의 "분석 기준" 탭에서 바꿀 수 있어요.</p></div>`;
}
// 선택: AI가 숫자를 바꾸지 않고 읽기 쉬운 요약만 씀
function briefStory(D) {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) return '';
  const model = PropertiesService.getScriptProperties().getProperty('BRIEF_MODEL') || 'claude-sonnet-5-5';
  const prompt = '아래 JSON은 학생용 영어 학습 사이트(Reading Clinic, Writing Clinic)의 지난 7일 데이터를 코드로 계산한 결과입니다. 사이트 주인(영어 강사)이 1분 안에 읽을 요약을 한국어로 5~7줄 써 주세요.\n'
    + '규칙: JSON에 있는 숫자만 쓰고 새 숫자를 계산하거나 지어내지 마세요. 표본이 적은 것은 단정하지 마세요. 판단은 주인이 하므로 결론 대신 "확인해 볼 만한 점"으로 쓰세요. 한 줄에 하나씩, 머리 기호 없이.\n\n' + JSON.stringify(D);
  try {
    const r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, payload: JSON.stringify({ model, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }) });
    const d = JSON.parse(r.getContentText());
    return (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  } catch (e) { return ''; }
}
function ownerMail(cfg) { return String(cfg.mail || '').trim() || Session.getEffectiveUser().getEmail(); }
function weeklyBriefing() {
  const cfg = readConfig(), D = weeklyData(), story = briefStory(D), html = briefHtml(D, story);
  MailApp.sendEmail({ to: ownerMail(cfg), subject: '[Clinic 주간 브리핑] ' + D.period, htmlBody: html });
  tab(BRIEF, ['보낸 시간', '기간', '판단할 것', '데이터(JSON)']).appendRow([kstStr(kstNow()), D.period, D.questions.join('\n'), JSON.stringify(D).slice(0, 45000)].map(safeCell));
}
// 매일 밤 점검: 기록 끊김, Writing 사용량. 같은 알림은 하루 한 번만
function dailyCheck() {
  const cfg = readConfig(), ss = SpreadsheetApp.getActiveSpreadsheet(), now = kstNow(), props = PropertiesService.getScriptProperties(), today = kstStr(now).slice(0, 10), msgs = [];
  const rd = ss.getSheetByName(RD);
  if (rd && rd.getLastRow() > 1) {
    const times = rd.getRange(2, 2, rd.getLastRow() - 1, 1).getDisplayValues().map((r) => String(r[0]));
    const quiet = kstStr(new Date(now.getTime() - (Number(cfg.quietHours) || 24) * 3600e3)), week = kstStr(new Date(now.getTime() - 8 * 864e5));
    const recent = times.filter((t) => t >= quiet).length, before = times.filter((t) => t >= week && t < quiet).length;
    if (!recent && before >= 35) msgs.push(`Reading 기록이 ${cfg.quietHours}시간 동안 하나도 없어요 (지난주에는 ${before}판). 사이트와 시트 연결(LOG_URL, LOG_SECRET, Apps Script 배포)을 확인해 주세요.`);
  }
  const wsh = ss.getSheetByName(SHEET);
  if (wsh && wsh.getLastRow() > 1) {
    const n = wsh.getRange(Math.max(2, wsh.getLastRow() - 3000), 1, Math.min(3000, wsh.getLastRow() - 1), 1).getDisplayValues().filter((r) => String(r[0]).slice(0, 10) === today).length;
    if (n >= Number(cfg.writingWarn)) msgs.push(`오늘 Writing 첨삭이 ${n}회예요 (경고 기준 ${cfg.writingWarn}회). API 사용량을 확인해 주세요.`);
  }
  if (msgs.length && props.getProperty('alerted') !== today + msgs.length) {
    MailApp.sendEmail({ to: ownerMail(cfg), subject: '[Clinic 알림] 확인이 필요해요', body: msgs.join('\n\n') });
    props.setProperty('alerted', today + msgs.length);
  }
}
// 처음 한 번 실행: 탭 만들기, 브리핑(토요일 9시)·점검(매일 21시) 예약. 프로젝트 설정의 시간대를 (GMT+09:00) 서울로 해 두세요.
function setupAutomation() {
  readConfig(); tab(DECIDE, ['날짜', '결정한 것', '확인할 지표', '결과 메모']); tab(RD, RD_HEAD);
  ScriptApp.getProjectTriggers().forEach((t) => { if (['weeklyBriefing', 'dailyCheck'].includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('weeklyBriefing').timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY).atHour(9).create();
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(21).create();
  return '예약 완료: 매주 토요일 9시 브리핑, 매일 21시 점검 → ' + ownerMail(readConfig());
}
// 브리핑을 지금 바로 받아 보고 싶을 때 실행
function sendBriefingNow() { weeklyBriefing(); }
