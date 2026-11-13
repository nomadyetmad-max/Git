// Reading Clinic · 문장성분 찾기: 문장 자동 생성기
// 성분 표기: [단어] = 그 성분의 핵심 단어(정답 판정 기준). 수식어는 [] 없이 그대로 씁니다.
// 한 문장은 S, V와 형식에 따라 O(4형식은 둘), C(5형식은 목적격보어)로 이루어지고, 앞뒤에 수식어(부사구·부사절)가 붙습니다.
(function () {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const chance = (p) => Math.random() < p;

  // ---- 사람 주어 (학년별), 각자 붙을 수 있는 수식어
  const PEOPLE = {
    1: { np: [['my [brother]', 's'], ['the [students]', 'p'], ['our [teacher]', 's'], ['the [children]', 'p'], ['my [friends]', 'p'], ['the little [girl]', 's'], ['my [cousin]', 's'], ['the [boys]', 'p']],
         m: ['in my class', 'next door', 'with a red cap', 'from Busan', 'who lived nearby', 'sitting by the window'] },
    2: { np: [['the [volunteers]', 'p'], ['the new [manager]', 's'], ['many [tourists]', 'p'], ['the [scientist]', 's'], ['the [members]', 'p'], ['my older [sister]', 's'], ['the [players]', 'p'], ['the young [chef]', 's']],
         m: ['from Canada', 'at the conference', 'who had prepared for months', 'working at the local hospital', 'in charge of the project', 'on the national team'] },
    3: { np: [['[researchers]', 'p'], ['many [economists]', 'p'], ['[policymakers]', 'p'], ['the [author]', 's'], ['the [participants]', 'p'], ['the senior [engineer]', 's'], ['several [historians]', 'p'], ['the [director]', 's']],
         m: ['in the experiment', 'who had studied the issue for years', 'responsible for the new policy', 'involved in the long-term study', 'at several leading universities', 'with decades of experience in the field'] }
  };
  // ---- 문장 앞뒤에 붙는 수식어 (학년별). front: 문장 앞에 쉼표와 함께, end: 문장 끝
  const ADV = {
    1: { front: ['After school', 'Last weekend', 'In the morning', 'Yesterday', 'On Sunday', 'After dinner'],
         end: ['after school', 'last weekend', 'in the morning', 'yesterday', 'at the park', 'every Sunday', 'before dinner', 'at the party', 'at home'] },
    2: { front: ['During the summer vacation', 'After the long meeting', 'As soon as the class ended', 'Because it was raining heavily', 'Although it was late', 'For the first time'],
         end: ['during the summer vacation', 'for the first time', 'after the long meeting', 'in the end', 'because it was raining heavily', 'although it was late', 'without any help', 'as soon as the class ended'] },
    3: { front: ['Over the past decade', 'In many parts of the world', 'Despite the high cost', 'As a result of the new policy', 'While the experts were still debating the issue', 'Long before the crisis began'],
         end: ['over the past decade', 'in many parts of the world', 'despite the high cost', 'as a result of the new policy', 'while the experts were still debating the issue', 'to a surprising degree', 'with little public attention', 'after years of careful observation'] }
  };
  const P = (g) => () => pick(PEOPLE[g].np);
  // NP 항목: [표현, 수('s'|'p'), 붙을 수 있는 수식어 목록(선택)]
  // 틀(frame): f = 형식, s = 주어 목록 또는 함수, v = 동사(be는 {be:true}), o/io/do/c/oc = 성분 목록
  const FR = {
    1: [
      { f: 1, s: P(1), v: ['[arrived]', '[laughed]', '[slept]', '[smiled]', '[ran]'], need: true },
      { f: 1, s: [['the [bus]', 's'], ['the [train]', 's']], v: ['[stopped]', '[arrived]', '[left]'], need: true },
      { f: 1, s: [['the [baby]', 's'], ['the [puppies]', 'p']], v: ['[slept]', '[cried]', '[played]'], need: true },
      { f: 2, s: P(1), v: [{ be: true }, '[looked]', '[felt]'], c: ['[happy]', '[tired]', '[busy]', '[sleepy]', '[angry]', '[excited]'] },
      { f: 2, s: [['the [movie]', 's'], ['the [story]', 's'], ['the [game]', 's']], v: [{ be: true }, '[seemed]'], c: ['[boring]', '[interesting]', '[exciting]', '[sad]'] },
      { f: 2, s: [['the [soup]', 's'], ['the [cake]', 's']], v: ['[tasted]', '[smelled]'], c: ['[sweet]', '[delicious]', '[salty]', '[good]'] },
      { f: 2, s: [['my [father]', 's'], ['her [uncle]', 's']], v: [{ be: true }, '[became]'], c: ['a [doctor]', 'a famous [cook]', 'a [teacher]', 'a [pilot]'] },
      { f: 3, s: P(1), v: ['[cleaned]'], o: [['the [room]'], ['the [classroom]'], ['the [kitchen]']] },
      { f: 3, s: P(1), v: ['[read]'], o: [['a [book]', 0, ['about dinosaurs', 'from the library']], ['the [letter]', 0, ['from grandma']], ['the [newspaper]']] },
      { f: 3, s: P(1), v: ['[bought]'], o: [['a new [bike]'], ['some [bread]'], ['a [ticket]', 0, ['for the concert']]] },
      { f: 3, s: P(1), v: ['[visited]'], o: [['the [museum]'], ['my [grandmother]'], ['the [zoo]', 0, ['in the city']]] },
      { f: 3, s: P(1), v: ['[watched]'], o: [['a [movie]'], ['the soccer [game]'], ['the [birds]', 0, ['in the tree']]] },
      { f: 3, s: P(1), v: ['[found]', '[lost]'], o: [['the [key]', 0, ['to the front door']], ['my [wallet]'], ['a small [coin]']] },
      { f: 4, s: P(1), v: ['[gave]', '[sent]'], io: [['[me]'], ['[her]'], ['my [sister]'], ['the [children]']], do: [['a [present]'], ['a [letter]'], ['some [flowers]'], ['a [card]']] },
      { f: 4, s: P(1), v: ['[showed]'], io: [['[us]'], ['[me]'], ['the [visitors]']], do: [['the [pictures]', 0, ['from the trip']], ['the [way]', 0, ['to the station']], ['a new [phone]']] },
      { f: 4, s: P(1), v: ['[told]'], io: [['[me]'], ['the [kids]'], ['[us]']], do: [['a funny [story]'], ['the [truth]'], ['a [secret]']] },
      { f: 4, s: [['our [teacher]', 's'], ['my [aunt]', 's']], v: ['[taught]'], io: [['[us]'], ['the [students]'], ['[me]']], do: [['[English]'], ['[math]'], ['a new [song]']] },
      { f: 5, s: P(1), v: ['[made]'], o: [['[me]'], ['my [parents]'], ['the [teacher]'], ['[us]']], c: ['[happy]', '[angry]', '[sad]', '[proud]'] },
      { f: 5, s: P(1), v: ['[kept]'], o: [['the [room]'], ['the [door]'], ['the [window]']], c: ['[clean]', '[open]', '[warm]', '[closed]'] },
      { f: 5, s: P(1), v: ['[found]'], o: [['the [test]'], ['the [movie]'], ['the [book]']], c: ['[difficult]', '[boring]', '[easy]', '[funny]'] },
      { f: 5, s: P(1), v: ['[called]', '[named]'], o: [['the [dog]'], ['the [cat]'], ['the new [puppy]']], c: ['[Max]', '[Coco]', '[Buddy]'] },
      { f: 5, s: P(1), v: ['[asked]', '[told]'], o: [['[me]'], ['the [boy]'], ['[her]']], c: ['to [close] the window', 'to [clean] the room', 'to [wait] outside', 'to [be] quiet'] }
    ],
    2: [
      { f: 1, s: [['the [price]', 's', ['of vegetables', 'of oil']], ['the [temperature]', 's'], ['the [number]', 's', ['of visitors']]], v: ['[rose]', '[fell]', '[increased]', '[dropped]'], need: true },
      { f: 1, s: [['the [meeting]', 's'], ['the [festival]', 's'], ['the [concert]', 's']], v: ['[ended]', '[began]', '[continued]'], need: true },
      { f: 1, s: P(2), v: ['[succeeded]', '[stayed]', '[disappeared]', '[waited]', '[complained]'], need: true },
      { f: 2, s: P(2), v: ['[seemed]', '[looked]', '[remained]', '[became]'], c: ['[nervous]', '[confident]', '[disappointed]', '[calm]', '[silent]'] },
      { f: 2, s: [['the [plan]', 's'], ['the [idea]', 's'], ['his [suggestion]', 's']], v: ['[sounded]', '[seemed]'], c: ['[reasonable]', '[perfect]', '[strange]', '[unrealistic]'] },
      { f: 2, s: [['the [situation]', 's'], ['the [problem]', 's']], v: ['[grew]', '[became]'], c: ['[worse]', '[serious]', '[complicated]'] },
      { f: 2, s: [['the young [chef]', 's'], ['my older [sister]', 's']], v: ['[became]'], c: ['a famous [writer]', 'a successful [lawyer]', 'the [leader]'] },
      { f: 3, s: P(2), v: ['[completed]', '[prepared]', '[submitted]'], o: [['the [project]'], ['a detailed [report]', 0, ['on the survey']], ['the [presentation]']] },
      { f: 3, s: P(2), v: ['[discussed]', '[solved]', '[ignored]'], o: [['the [problem]', 0, ['with the schedule']], ['the [issue]'], ['the [complaints]', 0, ['from customers']]] },
      { f: 3, s: P(2), v: ['[received]', '[won]'], o: [['a [scholarship]'], ['an [award]', 0, ['for excellence']], ['the first [prize]']] },
      { f: 3, s: P(2), v: ['[protected]', '[studied]'], o: [['the [environment]'], ['endangered [animals]'], ['the [forest]', 0, ['near the village']]] },
      { f: 4, s: P(2), v: ['[offered]'], io: [['the [students]'], ['[her]'], ['the new [employees]']], do: [['a [chance]', 0, ['to work abroad']], ['free [lessons]'], ['a better [position]']] },
      { f: 4, s: P(2), v: ['[lent]', '[gave]'], io: [['a [classmate]'], ['[me]'], ['the [team]']], do: [['the class [notes]'], ['some [money]'], ['useful [advice]']] },
      { f: 4, s: P(2), v: ['[asked]'], io: [['the [speaker]'], ['[him]'], ['the [guide]']], do: [['a difficult [question]'], ['a [favor]'], ['several [questions]', 0, ['about the history of the town']]] },
      { f: 4, s: P(2), v: ['[showed]', '[sent]'], io: [['the [audience]'], ['[us]'], ['the [manager]']], do: [['the [results]', 0, ['of the survey']], ['a short [video]'], ['the final [design]']] },
      { f: 5, s: P(2), v: ['[considered]', '[found]'], o: [['the [plan]'], ['the [idea]'], ['the new [system]']], c: ['[impossible]', 'too [risky]', '[confusing]', '[helpful]'] },
      { f: 5, s: P(2), v: ['[kept]'], o: [['the [audience]'], ['the [students]'], ['the [visitors]']], c: ['[interested]', '[focused]', '[entertained]'] },
      { f: 5, s: P(2), v: ['[allowed]', '[encouraged]', '[advised]'], o: [['the [students]'], ['[us]'], ['the new [members]']], c: ['to [join] the club', 'to [try] again', 'to [leave] early', 'to [use] the new equipment'] },
      { f: 5, s: [['the [members]', 'p'], ['the [students]', 'p']], v: ['[elected]'], o: [['[her]'], ['the young [lawyer]'], ['[him]']], c: ['[president]', '[leader]', '[captain]'] },
      { f: 5, s: P(2), v: ['[made]', '[had]'], o: [['the [students]'], ['the [players]'], ['[us]']], c: ['[clean] the classroom', '[repeat] the exercise', '[wait] in line'] }
    ],
    3: [
      { f: 1, s: [['[tensions]', 'p', ['between the two countries']], ['the [population]', 's', ['of the region']], ['[interest]', 's', ['in renewable energy']], ['the [gap]', 's', ['between rich and poor']]], v: ['[grew]', '[increased]', '[persisted]', '[declined]'], need: true },
      { f: 1, s: [['a new [problem]', 's'], ['serious [concerns]', 'p', ['about privacy']], ['unexpected [difficulties]', 'p']], v: ['[arose]', '[emerged]', '[appeared]'], need: true },
      { f: 1, s: P(3), v: ['[hesitated]', '[disagreed]', '[intervened]', '[succeeded]'], need: true },
      { f: 2, s: [['the [results]', 'p', ['of the experiment']], ['the [findings]', 'p'], ['the [evidence]', 's', ['from recent studies']]], v: ['[remained]', '[appeared]', '[seemed]', '[proved]'], c: ['[inconclusive]', 'surprisingly [consistent]', '[difficult] to interpret', '[questionable]'] },
      { f: 2, s: [['the [shortage]', 's', ['of skilled workers']], ['the lack', 's', ['of reliable data']]], v: ['[became]', '[remained]'], c: ['a major [obstacle]', 'a serious [concern]', 'the main [reason] for the delay'] },
      { f: 2, s: P(3), v: ['[remained]', '[grew]', '[became]'], c: ['[skeptical]', 'increasingly [cautious]', '[optimistic] about the outcome', '[reluctant] to change the plan'] },
      { f: 3, s: P(3), v: ['[examined]', '[analyzed]', '[questioned]', '[challenged]', '[underestimated]'], o: [['the long-term [effects]', 0, ['of social media']], ['the [assumption]', 0, ['that people always act rationally']], ['the [impact]', 0, ['of climate change on agriculture']], ['the [data]', 0, ['collected from the survey']]] },
      { f: 3, s: [['the [government]', 's'], ['the [company]', 's'], ['the local [council]', 's']], v: ['[introduced]', '[abandoned]', '[postponed]', '[announced]'], o: [['a new [policy]', 0, ['on plastic waste']], ['the [plan]', 0, ['to expand the airport']], ['strict [regulations]'], ['the [project]']] },
      { f: 4, s: [['the [government]', 's'], ['the [foundation]', 's'], ['the [university]', 's']], v: ['[granted]', '[offered]', '[awarded]', '[denied]'], io: [['local [farmers]'], ['the [researchers]'], ['low-income [families]'], ['the [applicants]']], do: [['financial [support]'], ['a substantial [grant]'], ['equal [opportunities]'], ['[access]', 0, ['to the archive']]] },
      { f: 4, s: P(3), v: ['[gave]', '[sent]', '[showed]'], io: [['the [committee]'], ['the [public]'], ['their [colleagues]']], do: [['a detailed [explanation]', 0, ['of the method']], ['the preliminary [results]'], ['a clear [warning]', 0, ['about the risks']]] },
      { f: 5, s: P(3), v: ['[considered]', '[found]', '[judged]'], o: [['the [proposal]'], ['the new [regulation]'], ['such [measures]']], c: ['[unrealistic]', '[essential] for long-term growth', '[ineffective]', 'largely [irrelevant]'] },
      { f: 5, s: [['the new [law]', 's'], ['the [agreement]', 's'], ['the [guideline]', 's']], v: ['[required]', '[forced]', '[allowed]'], o: [['all [participants]'], ['the [companies]'], ['local [governments]']], c: ['to [submit] a detailed report', 'to [disclose] their environmental impact', 'to [reduce] carbon emissions'] },
      { f: 5, s: [['the new [technology]', 's'], ['the [change]', 's', ['in policy']], ['the [software]', 's']], v: ['[made]', '[rendered]'], o: [['the [process]'], ['the [task]'], ['older [methods]']], c: ['far more [efficient]', '[manageable]', '[obsolete]', 'less [costly]'] },
      { f: 5, s: P(3), v: ['[urged]', '[persuaded]'], o: [['the [government]'], ['the [committee]'], ['their [colleagues]']], c: ['to [reconsider] the original plan', 'to [delay] the decision', 'to [invest] more in education'] }
    ]
  };
  // the lack 수정: 핵심 단어 표시
  FR[3][4].s[1][0] = 'the [lack]';
  // 예비 고1: 고1과 같은 틀·단어, 수식어는 적게(문장을 짧게), 문장 앞 부사절 없음
  FR[0] = FR[1];
  PEOPLE[0] = { np: PEOPLE[1].np, m: ['in my class', 'next door', 'from Busan'] };
  ADV[0] = { front: ['Yesterday', 'After school', 'On Sunday'], end: ['yesterday', 'after school', 'at home', 'at the park', 'in the morning'] };

  // ---- 조각을 토큰으로: role = S/V/O/C 또는 null(수식어), head = 핵심 단어
  function words(str, part, isMod) {
    return str.split(' ').filter(Boolean).map((w) => ({ text: w.replace(/[\[\]]/g, ''), part: isMod ? null : part, owner: part, head: !isMod && /\[/.test(w) }));
  }
  function np(entry, part, pModEntry, pModPeople, peopleMods) {
    const [t, , own] = entry;
    let out = words(t, part, false);
    const mods = own && own.length ? own : peopleMods;
    const p = own && own.length ? pModEntry : pModPeople;
    if (mods && chance(p)) out = out.concat(words(pick(mods), part, true));
    return out;
  }
  const PMOD = { 0: [0.15, 0.1], 1: [0.35, 0.3], 2: [0.6, 0.5], 3: [0.85, 0.7] };   // [자기 수식어 확률, 사람 수식어 확률]
  const NADV = { 0: [0.4, 0.05], 1: [0.55, 0.15], 2: [0.75, 0.35], 3: [0.85, 0.55] }; // [끝 수식어 확률, 앞 수식어 확률]

  // forms: 이 형식들 중에서만 만들기 (약한 형식 복습용, 선택)
  function make(g, forms) {
    const pool = forms && forms.length ? FR[g].filter((x) => forms.includes(x.f)) : FR[g];
    const fr = pick(pool.length ? pool : FR[g]);
    const sEntry = typeof fr.s === 'function' ? fr.s() : pick(fr.s);
    const isPeople = typeof fr.s === 'function';
    const [pe, pp] = PMOD[g];
    let toks = [];
    // 앞 수식어
    const front = chance(NADV[g][1]) ? pick(ADV[g].front) : null;
    if (front) toks = toks.concat(words(front + ',', null, true));
    toks = toks.concat(np(sEntry, 'S', pe, isPeople ? pp : 0, isPeople ? PEOPLE[g].m : null));
    let v = pick(fr.v);
    if (typeof v === 'object') v = sEntry[1] === 'p' ? '[were]' : '[was]';
    toks = toks.concat(words(v, 'V', false));
    if (fr.f === 2) toks = toks.concat(words(pick(fr.c), 'C', false));
    if (fr.f === 3) toks = toks.concat(np(pick(fr.o), 'O1', pe * 0.8, 0));
    if (fr.f === 4) { toks = toks.concat(np(pick(fr.io), 'O1', 0, 0)); toks = toks.concat(np(pick(fr.do), 'O2', pe * 0.8, 0)); }
    if (fr.f === 5) { toks = toks.concat(np(pick(fr.o), 'O1', 0, 0)); toks = toks.concat(words(pick(fr.c), 'C', false)); }
    // 끝 수식어 (1형식은 자연스럽게 하나는 꼭)
    const isClause = (x) => /^(because|although|as soon as|while|long before) /i.test(x);
    const endOk = ADV[g].end.filter((x) => !front || (x.toLowerCase() !== front.toLowerCase() && !(isClause(front) && isClause(x))));
    if ((fr.need && !front) || chance(front ? NADV[g][0] * 0.4 : NADV[g][0])) toks = toks.concat(words(pick(endOk), null, true));
    toks[0].text = toks[0].text[0].toUpperCase() + toks[0].text.slice(1);
    toks[toks.length - 1].text += '.';
    // 4형식 두 목적어, 5형식 목적어+목적격보어 구분해서 정답 성분 목록 만들기
    const comps = [], byPart = {};
    toks.forEach((t, i) => {
      t.i = i;
      if (t.head) { if (!byPart[t.part]) { byPart[t.part] = { lab: t.part[0], heads: [] }; comps.push(byPart[t.part]); } byPart[t.part].heads.push(i); }
    });
    return { toks, comps, form: fr.f };
  }
  window.CORE = { make };
})();
