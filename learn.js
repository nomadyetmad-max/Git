// Reading Clinic 공통: 기기·학습 코드, 패턴별 기록과 숙련도, 모의고사 연결, 기록 전송
// 기록은 이 기기(localStorage)에 먼저 쌓이고, 학습 코드를 만들면 서버(구글 시트)의 기록과 합쳐져 다른 기기에서도 이어져요.
(function () {
  const GRADE = { 0: '예비 고1', 1: '고1', 2: '고2', 3: '고3' };
  const DEF = { minN: 5, master: 80, recent: 10 };   // 서버의 "분석 기준" 탭 값이 있으면 그걸로 바뀜
  const SEQ_MAX = 60, FIRST_N = 10;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem('wc.' + k); if (v === null) localStorage.removeItem('wc.' + k); else localStorage.setItem('wc.' + k, v); } catch (e) { return null; } }
  function json(k, v) { if (v === undefined) { try { return JSON.parse(store(k) || 'null'); } catch (e) { return null; } } store(k, v === null ? null : JSON.stringify(v)); }
  function deviceId() { let d = store('device'); if (!d || !/^[a-z0-9]{8,40}$/.test(d)) { d = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); store('device', d); } return d; }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- 서버 설정(분석 기준)과 누적 횟수
  let cfg = Object.assign({}, DEF, json('cfg') || {}), plays = null;
  async function load() {
    try {
      const r = await fetch('/api/drill', { cache: 'no-store' }); if (!r.ok) throw 0;
      const d = await r.json();
      if (d.config) { cfg = Object.assign({}, DEF, d.config); json('cfg', d.config); }
      plays = d.plays || null;
    } catch (e) { /* 서버가 없어도 게임은 그대로 */ }
    return { plays, config: cfg };
  }

  // ---- 패턴별 기록: { mod: { 'A-S-rel': { s: '1101', f: '1101' } }, core: { '3': {...} } }
  // s = 최근 결과(첫 시도 기준, 1 정답 · 0 오답), f = 맨 처음 10번(성장 비교용, 더 늘지 않음)
  function hist() { const h = json('hist'); return h && h.mod && h.core ? h : { mod: {}, core: {} }; }
  function record(kind, key, ok) {
    const h = hist(), box = h[kind], e = box[key] || (box[key] = { s: '', f: '' });
    const before = e.s.slice(-1);
    e.s = (e.s + (ok ? '1' : '0')).slice(-SEQ_MAX);
    if (e.f.length < FIRST_N) e.f += ok ? '1' : '0';
    json('hist', h);
    return { wasWrong: before === '0', n: e.s.length };
  }
  const rate = (s) => (s.length ? Math.round(100 * [...s].filter((c) => c === '1').length / s.length) : null);
  function mastery(kind, key) {
    const e = hist()[kind][key] || { s: '', f: '' }, recent = e.s.slice(-cfg.recent), n = e.s.length;
    const r = rate(recent), first = rate(e.f);
    const state = n < cfg.minN ? 'measuring' : r >= cfg.master ? 'mastered' : 'learning';
    return { n, rate: r, first, state, left: Math.max(0, cfg.minN - n) };
  }
  function mastered(kind) { return Object.keys(hist()[kind]).filter((k) => mastery(kind, k).state === 'mastered'); }
  // 약한 패턴: 측정이 끝난 것 중 정답률이 낮은 순
  function weakest(kind, n) {
    return Object.keys(hist()[kind]).map((k) => ({ k, m: mastery(kind, k) })).filter((x) => x.m.state === 'learning')
      .sort((a, b) => a.m.rate - b.m.rate).slice(0, n || 3).map((x) => x.k);
  }

  // ---- 학습 코드: 닉네임 + 숫자 4자리. 실명·학교·연락처는 받지 않음
  function learner() { return json('learner'); }
  async function join(nick, pin) {
    const r = await fetch('/api/drill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'join', nick, pin, device: deviceId() }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw d.error || 'fail';
    json('learner', { nick: d.nick, id: d.id });
    if (d.hist && d.hist.mod && d.hist.core) json('hist', merge(hist(), d.hist));
    return d;
  }
  // 서버 기록이 이 기기 기록보다 길면 서버 것을 씀(이 기기 기록은 가입할 때 서버로 옮겨짐)
  function merge(local, server) {
    ['mod', 'core'].forEach((kind) => Object.keys(server[kind]).forEach((k) => {
      const a = local[kind][k], b = server[kind][k];
      if (!a || (b.s || '').length >= (a.s || '').length) local[kind][k] = { s: b.s || '', f: b.f || '' };
    }));
    return local;
  }
  function leave() { json('learner', null); }

  // ---- 입력 방식: 드래그 / 두 번 톡(시작 단어 → 끝 단어). 터치 화면이면 처음엔 톡
  function inputMode(v) {
    if (v) { store('input', v); return v; }
    const s = store('input'); if (s === 'drag' || s === 'tap') return s;
    return matchMedia('(pointer: coarse)').matches ? 'tap' : 'drag';
  }

  // ---- 모의고사 연결 (exam-map.js에 실제 측정 데이터가 있을 때만)
  function exam(g) { const E = window.EXAM && window.EXAM[g]; return E && Array.isArray(E.sents) && E.sents.length >= 20 ? E : null; }
  // 한 패턴(또는 형식)이 그 학년 모의고사 문장 100개 중 몇 개에 들어 있는지
  function share(kind, key, g) {
    const E = exam(g); if (!E) return null;
    const n = E.sents.filter((s) => (kind === 'core' ? String(s.f) === String(key) : (s.p || []).includes(key))).length;
    return Math.round(100 * n / E.sents.length);
  }
  // 지금까지 익힌(숙련) 패턴·형식만으로 뼈대와 수식 관계를 모두 파악할 수 있는 문장의 비율
  function coverage(g) {
    const E = exam(g); if (!E) return null;
    const mm = new Set(mastered('mod')), mc = new Set(mastered('core')), playedMod = Object.keys(hist().mod).length > 0, playedCore = Object.keys(hist().core).length > 0;
    const pct = (f) => Math.round(100 * E.sents.filter(f).length / E.sents.length);
    return {
      source: E.source || '', total: E.sents.length,
      mod: playedMod ? pct((s) => (s.p || []).every((k) => mm.has(k))) : null,
      core: playedCore ? pct((s) => mc.has(String(s.f))) : null,
      both: playedMod && playedCore ? pct((s) => mc.has(String(s.f)) && (s.p || []).every((k) => mm.has(k))) : null
    };
  }

  // ---- 한 판 기록을 서버로 (실패해도 게임에는 영향 없음)
  function submit(rec) {
    const me = learner();
    const body = JSON.stringify(Object.assign({ op: 'log', device: deviceId(), learner: me ? me.id : '' }, rec));
    try { return fetch('/api/drill', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: body.length < 60000 }).then((r) => r.ok).catch(() => false); }
    catch (e) { return Promise.resolve(false); }
  }
  // 문장 은행·생성 규칙 버전: 데이터가 바뀌면 값이 바뀌어 기록끼리 비교할 때 구분됨
  function version(obj) { const s = typeof obj === 'string' ? obj : JSON.stringify(obj); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }

  window.LEARN = { GRADE, store, json, deviceId, esc, load, config: () => cfg, hist, record, mastery, mastered, weakest, learner, join, leave, inputMode, exam, share, coverage, submit, version };
})();
