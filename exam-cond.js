// 내신 서술형 조건 검사 (학생 화면과 서버가 같은 규칙을 씀)
// 1) 단어 수: 띄어쓰기로 나눈 덩어리 중 글자·숫자가 있는 것만 셈 (don't = 1단어, well-known = 1단어)
// 2) 핵심 단어 사용: 어형 변화 허용(복수·3인칭 -s, 과거·과거분사, -ing, 비교급·최상급, 불규칙 동사).
//    품사를 바꾸는 파생어(decide → decision)는 인정하지 않음. 여러 단어로 된 핵심어는 첫 단어만 어형 변화 허용, 나머지는 그대로 이어져야 함.
(function (root) {
  const IRR = {
    be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'], have: ['has', 'had', 'having'], do: ['does', 'did', 'done', 'doing'], go: ['goes', 'went', 'gone'],
    become: ['became'], begin: ['began', 'begun'], bring: ['brought'], build: ['built'], buy: ['bought'], catch: ['caught'], choose: ['chose', 'chosen'],
    come: ['came'], cost: [], cut: [], deal: ['dealt'], draw: ['drew', 'drawn'], drink: ['drank', 'drunk'], drive: ['drove', 'driven'], eat: ['ate', 'eaten'],
    fall: ['fell', 'fallen'], feel: ['felt'], fight: ['fought'], find: ['found'], fly: ['flew', 'flown', 'flies'], forget: ['forgot', 'forgotten'], get: ['got', 'gotten'],
    give: ['gave', 'given'], grow: ['grew', 'grown'], hear: ['heard'], hide: ['hid', 'hidden'], hold: ['held'], keep: ['kept'], know: ['knew', 'known'],
    lay: ['laid'], lead: ['led'], leave: ['left'], lend: ['lent'], lie: ['lay', 'lain', 'lying'], lose: ['lost'], make: ['made'], mean: ['meant'], meet: ['met'],
    pay: ['paid'], put: [], read: [], ride: ['rode', 'ridden'], rise: ['rose', 'risen'], run: ['ran'], say: ['said'], see: ['saw', 'seen'], seek: ['sought'],
    sell: ['sold'], send: ['sent'], set: [], shake: ['shook', 'shaken'], show: ['shown'], sing: ['sang', 'sung'], sit: ['sat'], sleep: ['slept'], speak: ['spoke', 'spoken'],
    spend: ['spent'], stand: ['stood'], steal: ['stole', 'stolen'], swim: ['swam', 'swum'], take: ['took', 'taken'], teach: ['taught'], tell: ['told'],
    think: ['thought'], throw: ['threw', 'thrown'], understand: ['understood'], wear: ['wore', 'worn'], win: ['won'], write: ['wrote', 'written'],
    arise: ['arose', 'arisen'], bear: ['bore', 'born', 'borne'], bind: ['bound'], break: ['broke', 'broken'], forgive: ['forgave', 'forgiven'], freeze: ['froze', 'frozen'],
    overcome: ['overcame'], undergo: ['underwent', 'undergone'], withdraw: ['withdrew', 'withdrawn'], strive: ['strove', 'striven'],
    good: ['better', 'best'], well: ['better', 'best'], bad: ['worse', 'worst'], many: ['more', 'most'], much: ['more', 'most'], little: ['less', 'least'],
    child: ['children'], person: ['people'], man: ['men'], woman: ['women'], foot: ['feet'], tooth: ['teeth'], mouse: ['mice'], phenomenon: ['phenomena'], criterion: ['criteria'], datum: ['data']
  };
  const V = /[aeiou]/;
  function forms(w) {
    w = String(w).toLowerCase();
    const f = new Set([w].concat(IRR[w] || []));
    const stem = w.replace(/e$/, ''), y = /[^aeiou]y$/.test(w), dbl = /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(w) ? w + w.slice(-1) : null;
    f.add(/(s|x|z|ch|sh|o)$/.test(w) ? w + 'es' : y ? w.slice(0, -1) + 'ies' : w + 's');
    if (/(s|x|z|ch|sh|o)$/.test(w)) f.add(w + 's');
    f.add(/e$/.test(w) ? w + 'd' : y ? w.slice(0, -1) + 'ied' : w + 'ed');
    f.add(/ie$/.test(w) ? w.slice(0, -2) + 'ying' : /[^e]e$/.test(w) && w.length > 2 ? stem + 'ing' : w + 'ing');
    f.add(/e$/.test(w) ? w + 'r' : y ? w.slice(0, -1) + 'ier' : w + 'er');
    f.add(/e$/.test(w) ? w + 'st' : y ? w.slice(0, -1) + 'iest' : w + 'est');
    if (/f$/.test(w)) f.add(w.slice(0, -1) + 'ves'); if (/fe$/.test(w)) f.add(w.slice(0, -2) + 'ves');
    if (dbl && V.test(w)) { f.add(dbl + 'ed'); f.add(dbl + 'ing'); f.add(dbl + 'er'); f.add(dbl + 'est'); }
    return f;
  }
  const tokens = (s) => String(s || '').toLowerCase().replace(/[’‘]/g, "'").split(/\s+/).map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')).filter((t) => /[a-z0-9]/.test(t));
  function countWords(s) { return tokens(s).length; }
  // 핵심어가 답에 들어 있는지: 하이픈·아포스트로피로 붙은 말은 나눠서도 봄
  function hasKeyword(answer, keyword) {
    const toks = tokens(answer), parts = tokens(keyword); if (!parts.length) return true;
    const pieces = []; toks.forEach((t) => { pieces.push(t); t.split(/[-']/).forEach((p) => p && p !== t && pieces.push(p)); });
    const first = forms(parts[0]);
    if (parts.length === 1) return pieces.some((t) => first.has(t));
    for (let i = 0; i + parts.length <= toks.length; i++) if (first.has(toks[i]) && parts.slice(1).every((p, j) => toks[i + 1 + j] === p)) return true;
    return false;
  }
  function check(answer, cond) {
    const n = countWords(answer), max = Number(cond.maxWords) || 0;
    const kws = (cond.keywords || []).map((k) => ({ k, ok: hasKeyword(answer, k) }));
    return { words: { n, max, ok: n > 0 && (!max || n <= max) }, keywords: kws, ok: n > 0 && (!max || n <= max) && kws.every((x) => x.ok) };
  }
  const api = { countWords, hasKeyword, check, forms };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EXAMCOND = api;
})(typeof window !== 'undefined' ? window : globalThis);
