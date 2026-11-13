// 비필수 문장성분 Drill 문장 은행
// 표기: {수식어 덩어리}  [수식 대상의 핵심 단어]  ~단어 = 대상에 넣어도 빼도 정답인 단어
// 패턴 키: A-자리-종류(형용사 역할) / D-대상-종류(부사 역할). bank: 각 패턴마다 [고1, 고2, 고3], pre: 예비 고1
window.DRILL = {
  pos: { S: '주어', O: '목적어', C: '보어', PO: '전치사의 목적어', VO: '준동사의 목적어', VC: '준동사의 보어' },
  adjType: { adj: '형용사 단독', pp: '형용사구(전치사구)', rel: '관계대명사절', rad: '관계부사절', ptc: '분사(구)', to: 'to부정사' },
  advTarget: { V: '동사', NV: '준동사', AJ: '형용사', AV: '다른 부사', PH: '구·절', SE: '문장 전체' },
  advType: { adv: '부사 단독', pp: '부사구(전치사구)', cl: '부사절', to: 'to부정사', pc: '분사구문' },
  bank: {
    'A-S-adj': [
      '~The {brave} [firefighter] carried the child out of the burning house.',
      '~The {sudden} [change] in the weather forced the hikers to return to the village before sunset.',
      '~The {widespread} [belief] that intelligence is fixed at birth has discouraged many students from taking on challenging tasks.'],
    'A-S-pp': [
      '[Students] {from different countries} often share their own traditions during the festival.',
      '~The [rise] {in online shopping} has changed the way small local stores attract customers.',
      '~A [lack] {of sleep over several weeks} can seriously weaken the immune system and reduce our ability to concentrate.'],
    'A-S-rel': [
      '~The [girl] {who sits next to me} always helps me with my math homework.',
      '~The [scientists] {who conducted the experiment} were surprised by the unexpected results.',
      '~The [species] {that survived the sudden climate change} were those able to adapt their diets quickly.'],
    'A-S-rad': [
      '~The [park] {where we played as kids} has become a big parking lot.',
      '~The [reason] {why many teenagers stay up late} is closely related to their use of smartphones.',
      '~The [moment] {when an audience stops paying attention} is often difficult for a speaker to notice in advance.'],
    'A-S-ptc': [
      '~The [boy] {wearing a red cap} is my younger brother.',
      '~The [letters] {written by the soldiers during the war} reveal how much they missed their families.',
      '~The [data] {collected from thousands of participants over a decade} suggest that regular exercise slows cognitive decline.'],
    'A-S-to': [
      '~The ~best [way] {to learn new words} is to read many books.',
      '~The ~first [person] {to reach the top of the mountain} received a special medal from the city.',
      '~The [decision] {to delay the project until next year} disappointed many employees who had worked hard on it.'],
    'A-O-adj': [
      'My mother made a {delicious} [cake] for my birthday.',
      'Regular reading gives children a {valuable} [opportunity] to expand their vocabulary.',
      'Many economists have raised {serious} [concerns] about the long-term effects of rising household debt.'],
    'A-O-pp': [
      'I bought ~a [book] {about space} at the bookstore yesterday.',
      'The city built ~a ~new [library] {with a large reading room for children}.',
      'Recent studies have revealed ~a ~strong [connection] {between the quality of sleep and emotional stability}.'],
    'A-O-rel': [
      'Yesterday I met ~a [man] {who works at the zoo}.',
      'She finally found ~the [necklace] {that she had lost at the beach}.',
      'Successful leaders create ~an [environment] {in which team members feel safe to express different opinions}.'],
    'A-O-rad': [
      'I still remember ~the [day] {when I first rode a bike}.',
      'Last summer we visited ~the [village] {where my grandfather was born}.',
      'Researchers are trying to explain ~the [reason] {why some memories last a lifetime while others fade within hours}.'],
    'A-O-ptc': [
      'Look at ~the [baby] {sleeping on the sofa}.',
      'The museum displays ~ancient [tools] {used by early humans}.',
      'The report includes ~detailed [figures] {showing a steady decline in the number of young farmers}.'],
    'A-O-to': [
      'I need ~some [water] {to drink}.',
      'The volunteers had ~no [time] {to rest during the long rescue operation}.',
      'Governments must find ~effective [ways] {to reduce plastic waste without harming local businesses}.'],
    'A-C-adj': [
      'My father is a {great} [cook].',
      'The library became a {popular} [place] for students preparing for exams.',
      'For many early scientists, curiosity was a {powerful} [motive] that outweighed the risks of failure.'],
    'A-C-pp': [
      'This is ~a [picture] {of my family}.',
      'Kindness is ~the [key] {to a happy relationship}.',
      'The invention of the printing press was ~a [turning point] {in the spread of knowledge across Europe}.'],
    'A-C-rel': [
      'She is ~the [teacher] {who taught me English}.',
      'Seoul is ~a [city] {that never seems to sleep}.',
      'Trust is ~the ~invisible [foundation] {on which every lasting partnership is built}.'],
    'A-C-rad': [
      'This is ~the [house] {where I grew up}.',
      'Spring is ~the [season] {when many birds return from the south}.',
      'That is ~the ~precise [reason] {why the theory was rejected by the scientific community}.'],
    'A-C-ptc': [
      'He is ~the [man] {standing by the door}.',
      'The festival was ~a ~huge [success] {enjoyed by both tourists and local residents}.',
      'The new policy was ~a [compromise] {reached after months of heated debate}.'],
    'A-C-to': [
      'It was ~a ~good [chance] {to make new friends}.',
      'Volunteering is ~a ~meaningful [way] {to give back to the community}.',
      'Admitting a mistake is often ~the ~most ~difficult [thing] {to do for people in positions of authority}.'],
    'A-PO-adj': [
      'We had lunch at a {Chinese} [restaurant].',
      'The students listened to the speaker with {great} [interest].',
      'Many patients recovered faster with {regular} [support] from their family members.'],
    'A-PO-pp': [
      'She lives in ~a [house] {with a big garden}.',
      'The teacher asked us to write an essay about ~the [effects] {of social media}.',
      'Historians still argue over ~the ~true [causes] {of the economic collapse that followed the war}.'],
    'A-PO-rel': [
      'I talked with ~the [girl] {who lives next door}.',
      'We stayed at ~a [hotel] {that had a view of the ocean}.',
      'Few people paid attention to ~the [warnings] {that experts had issued years before the disaster}.'],
    'A-PO-rad': [
      'We went back to ~the [beach] {where we first met}.',
      'I often think about ~the [days] {when we played soccer until dark}.',
      'The documentary focuses on ~the [period] {when the region\'s economy depended entirely on fishing}.'],
    'A-PO-ptc': [
      'I took a picture of ~the [cat] {sleeping in the sun}.',
      'The police are looking for ~a [car] {stolen from the parking lot last night}.',
      'The museum is famous for its collection of [paintings] {created by artists who were ignored during their lifetime}.'],
    'A-PO-to': [
      'He is looking for ~a [place] {to park his car}.',
      'Many students complain about the lack of [time] {to prepare for exams}.',
      'Scientists are searching for ~a ~reliable [method] {to detect the disease at an early stage}.'],
    'A-VO-adj': [
      'I want to buy a {new} [bike].',
      'She enjoys reading {classic} [novels] in her free time.',
      'The goal of the program is to provide {practical} [training] for young people entering the job market.'],
    'A-VO-pp': [
      'I like reading [books] {about animals}.',
      'He decided to sell ~the [car] {with a broken window}.',
      'Policymakers are trying to reduce ~the [gap] {between rich and poor neighborhoods}.'],
    'A-VO-rel': [
      'I hope to meet ~the [singer] {who sang this song}.',
      'She forgot to return ~the [book] {that she borrowed from the library}.',
      'Good teachers know how to ask [questions] {that encourage students to think for themselves}.'],
    'A-VO-rad': [
      'I want to visit ~the [town] {where my father grew up}.',
      'It is hard to forget ~the [day] {when I lost my first game}.',
      'The writer attempts to describe ~the [era] {when ordinary citizens began to question the authority of the king}.'],
    'A-VO-ptc': [
      'I like watching [birds] {flying over the lake}.',
      'She tried to calm ~the [children] {frightened by the loud thunder}.',
      'The researchers hope to identify ~the [factors] {contributing to the rapid spread of the disease}.'],
    'A-VO-to': [
      'I am looking forward to having ~some [time] {to relax}.',
      'We need to find ~a [way] {to save energy at home}.',
      'Leaders must learn to give their team members ~the [freedom] {to make their own decisions}.'],
    'A-VC-adj': [
      'I want to become a {famous} [singer].',
      'He seems to be an {honest} [person].',
      'Many young people dream of becoming {successful} [entrepreneurs] in the technology industry.'],
    'A-VC-pp': [
      'I want to become ~a [member] {of the soccer team}.',
      'Being ~a [leader] {of a large team} requires a lot of patience.',
      'Within the next decade, the new technology is expected to become ~an ~essential [part] {of everyday life}.'],
    'A-VC-rel': [
      'I want to become ~a [doctor] {who helps sick children}.',
      'He hopes to be ~a [writer] {whose books make people laugh}.',
      'The startup aims to become ~a [platform] {that connects local farmers directly with consumers}.'],
    'A-VC-rad': [
      'Our town wants to be ~a [place] {where everyone feels welcome}.',
      'The city plans to become ~a [place] {where young artists can easily find studios}.',
      'After the renovation, the library is expected to be ~a [space] {where people of all ages can learn and share ideas}.'],
    'A-VC-ptc': [
      'She wants to be ~a [singer] {loved by many people}.',
      'It is not easy to become ~a [player] {chosen for the national team}.',
      'The research team hopes to remain ~a [group] {respected for its careful and honest methods}.'],
    'A-VC-to': [
      'He wants to be ~the ~first [person] {to finish the race}.',
      'She wanted to become ~the ~youngest [student] {to win the science award}.',
      'The country is likely to be ~the ~next [nation] {to ban single-use plastic products}.'],

    'D-V-adv': [
      'My grandmother [walks] {slowly} in the park every morning.',
      'The students [listened] {carefully} to the instructions before the experiment began.',
      'The government ~has [responded] {cautiously} to growing public demands for stricter environmental regulations.'],
    'D-V-pp': [
      'We [played] soccer {after school}.',
      'The museum ~will ~be [closed] {for two weeks} next month.',
      'Many species ~have ~quietly [disappeared] {from the northern forests}, and scientists blame rising temperatures.'],
    'D-V-cl': [
      'I [stayed] home {because it rained all day}.',
      'She ~couldn\'t [sleep] {until she finished her report}.',
      'Public trust in the institution [declined] sharply {after the scandal was revealed by a local newspaper}.'],
    'D-V-to': [
      'I [went] to the library {to borrow some books}.',
      'Many people ~are [saving] money {to travel abroad next year}.',
      'The company [reduced] its prices {to attract customers who had switched to cheaper brands}.'],
    'D-V-pc': [
      'She [sat] by the window, {reading a book}.',
      'The children [ran] into the classroom, {laughing loudly}.',
      'The river [flows] through the valley, {providing water for thousands of farms along its banks}.'],
    'D-NV-adv': [
      '[Walking] {slowly} is good for your health.',
      'She decided ~to [speak] {quietly} so that the baby would not wake up.',
      '[Reading] {critically} requires readers to question the author\'s assumptions rather than accept them.'],
    'D-NV-pp': [
      'I like [studying] {in the library}.',
      '[Exercising] {in the morning} helps you stay focused all day.',
      '~To [succeed] {in a competitive market}, small companies must constantly develop new products.'],
    'D-NV-cl': [
      '[Leaving] {before it gets dark} is a good idea.',
      '[Checking] ~your ~answers {before you hand in the test} can save you from careless mistakes.',
      '[Speaking] ~up {when others remain silent} requires a great deal of courage.'],
    'D-NV-to': [
      '[Practicing] ~every ~day {to win the contest} made her very tired.',
      '[Saving] ~money {to buy a car} is not easy for a student.',
      '[Cooperating] ~with ~rival ~companies {to share research costs} has become common in the pharmaceutical industry.'],
    'D-AJ-adv': [
      'This soup is {very} [hot].',
      'The final exam was {surprisingly} [easy] for most students.',
      'The results of the survey were {remarkably} [consistent] across different age groups.'],
    'D-AJ-pp': [
      'She is [good] {at math}.',
      'My parents are [proud] {of my progress in English}.',
      'Many consumers remain [skeptical] {about claims that a product is environmentally friendly}.'],
    'D-AJ-to': [
      'This book is [easy] {to read}.',
      'I was [happy] {to hear the good news from my sister}.',
      'Such complex problems are [difficult] {to solve without cooperation among nations}.'],
    'D-AV-adv': [
      'He speaks {very} [quickly].',
      'The train arrived {quite} [late] because of the heavy snow.',
      'The new policy was implemented {rather} [hastily], without enough discussion among experts.'],
    'D-AV-pp': [
      'I got up [early] {in the morning}.',
      'We arrived home [late] {at night} after a long drive.',
      'The village is located [far] {from any major city}, which makes access to hospitals difficult.'],
    'D-AV-to': [
      'He ran ~fast ~enough {to catch the bus}.',
      'She spoke ~too ~quietly {to be heard in the back row}.',
      'The negotiations progressed ~too ~slowly {to prevent the crisis from spreading to neighboring countries}.'],
    'D-PH-adv': [
      'We met {just} [before lunch].',
      'He came to the party {only} [because his friends asked him].',
      'The plan succeeded {largely} [because the team prepared for every possible risk].'],
    'D-SE-adv': [
      '{Luckily,} [we] [won] ~the ~game.',
      '{Unfortunately,} ~the [concert] ~was [canceled] ~because ~of ~the ~heavy ~rain.',
      '{Surprisingly,} ~the ~new [treatment] [worked] ~better ~for ~older ~patients ~than ~for ~younger ~ones.'],
    'D-SE-pp': [
      '{In fact,} [I] ~don\'t [like] ~spicy ~food.',
      '{To my surprise,} ~my ~shy [brother] [won] ~the ~speech ~contest.',
      '{Despite the economic downturn,} ~the [company] [managed] ~to ~increase ~its ~profits.'],
    'D-SE-cl': [
      '{If it rains tomorrow,} [we] ~will [stay] ~home.',
      '{Although she was very tired,} [she] [finished] ~her ~homework.',
      '{While technology has made communication faster,} [it] ~has ~also [weakened] ~the ~depth ~of ~our ~conversations.'],
    'D-SE-to': [
      '{To be honest,} [I] ~didn\'t [enjoy] ~the ~movie.',
      '{To tell the truth,} [I] ~have ~never [traveled] ~abroad.',
      '{To put it simply,} ~the [plan] [failed] ~because ~nobody ~took ~responsibility ~for ~it.'],
    'D-SE-pc': [
      '{Hearing the news,} [she] [cried].',
      '{Feeling tired after the long trip,} [we] [went] ~to ~bed ~early.',
      '{Faced with rising costs,} ~many ~small [businesses] ~were [forced] ~to ~raise ~their ~prices.']
  },
  // 예비 고1 (중3~고1 3월 모의고사 수준): 패턴마다 한 문장
  pre: {
    'A-S-adj': "~The {old} [dog] sleeps all day.",
    'A-S-pp': "~The [cat] {on the roof} looks very cute.",
    'A-S-rel': "~The [boy] {who lives next door} is my best friend.",
    'A-S-rad': "~The [room] {where I study} is very small.",
    'A-S-ptc': "~The [girl] {singing on the stage} is my sister.",
    'A-S-to': "~His [dream] {to become a pilot} came true.",
    'A-O-adj': "I have a {cute} [puppy].",
    'A-O-pp': "I found ~a [letter] {from my friend}.",
    'A-O-rel': "I have ~a [friend] {who speaks Chinese}.",
    'A-O-rad': "I remember ~the [day] {when we first met}.",
    'A-O-ptc': "I saw ~a [boy] {running in the rain}.",
    'A-O-to': "She has ~many [books] {to read}.",
    'A-C-adj': "She is a {kind} [nurse].",
    'A-C-pp': "He is ~a [student] {from Japan}.",
    'A-C-rel': "He is ~the [boy] {who won the race}.",
    'A-C-rad': "This is ~the [school] {where my mother teaches}.",
    'A-C-ptc': "She is ~the [woman] {sitting on the bench}.",
    'A-C-to': "This is ~a ~good [place] {to swim}.",
    'A-PO-adj': "We live in a {small} [town].",
    'A-PO-pp': "I sat next to ~a [girl] {with long hair}.",
    'A-PO-rel': "I played with ~the [kids] {who live upstairs}.",
    'A-PO-rad': "We went to ~the [park] {where we had a picnic}.",
    'A-PO-ptc': "I gave some food to ~the [cat] {sitting by the door}.",
    'A-PO-to': "She is looking for ~a [pen] {to write with}.",
    'A-VO-adj': "I want to eat {spicy} [food].",
    'A-VO-pp': "I like drawing [pictures] {of animals}.",
    'A-VO-rel': "I want to see ~the [movie] {that you told me about}.",
    'A-VO-rad': "I want to visit ~the [city] {where you were born}.",
    'A-VO-ptc': "I want to buy ~a [cake] {made with fresh fruit}.",
    'A-VO-to': "I need to find ~a [chair] {to sit on}.",
    'A-VC-adj': "I want to be a {good} [teacher].",
    'A-VC-pp': "She wants to be ~a [player] {on the national team}.",
    'A-VC-rel': "I want to become ~a [person] {who helps others}.",
    'A-VC-rad': "I want to make my room ~a [place] {where I can relax}.",
    'A-VC-ptc': "He wants to be ~a [singer] {known all over the world}.",
    'A-VC-to': "I want to be ~the ~first [student] {to arrive at school}.",
    'D-V-adv': "She [sings] {beautifully}.",
    'D-V-pp': "We [swam] {in the river}.",
    'D-V-cl': "I [went] to bed early {because I was tired}.",
    'D-V-to': "He [came] here {to see you}.",
    'D-V-pc': "He [walked] home, {singing a song}.",
    'D-NV-adv': "[Running] {fast} is not easy.",
    'D-NV-pp': "I like [swimming] {in the sea}.",
    'D-NV-cl': "[Studying] {while you listen to music} is hard.",
    'D-NV-to': "[Saving] ~money {to buy a bike} took a long time.",
    'D-AJ-adv': "The box is {really} [heavy].",
    'D-AJ-pp': "He is [afraid] {of dogs}.",
    'D-AJ-to': "I am [happy] {to see you}.",
    'D-AV-adv': "She runs {very} [fast].",
    'D-AV-pp': "I go to bed [late] {at night}.",
    'D-AV-to': "She got up ~early ~enough {to see the sunrise}.",
    'D-PH-adv': "I called you {right} [after school].",
    'D-SE-adv': "{Happily,} [we] [found] ~the ~key.",
    'D-SE-pp': "{In my opinion,} ~this [book] [is] ~boring.",
    'D-SE-cl': "{When I got home,} [I] [took] ~a ~shower.",
    'D-SE-to': "{To tell the truth,} [I] [forgot] ~your ~birthday.",
    'D-SE-pc': "{Seeing me,} [she] [smiled]."
  }
};
