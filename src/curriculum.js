// منهج ٢٢ أسبوع: ٦ أيام دراسة + يوم مراجعة أسبوعية = ١٥٤ يوم
// كل يوم: [العنوان بالعربي, وصف إنجليزي يوجّه Claude]
// أو كائن لأنواع خاصة: {k:'mock', s:'g'|'r'|'lc'} أو {k:'targeted'}

const MOCK = (s, t) => ({ k: 'mock', s, t });
const TARGET = { k: 'targeted', t: 'درس مخصص لنقاط ضعفك' };

const WEEKS = [
  { t: 'الأزمنة البسيطة والمستمرة', s: 'g', d: [
    ['المضارع البسيط و does/doesn\'t', 'Present simple: forms, third-person -s, does/doesn\'t, common Arab-learner errors'],
    ['المضارع المستمر مقابل البسيط', 'Present continuous vs present simple; stative verbs (know, believe, belong)'],
    ['الماضي البسيط والأفعال الشاذة', 'Past simple: regular and irregular verbs; did/didn\'t + base form'],
    ['الماضي المستمر مع when و while', 'Past continuous vs past simple; when/while/as'],
    ['طرق التعبير عن المستقبل', 'Future: will, be going to, present continuous for arrangements, time clauses (when/as soon as + present)'],
    ['المطابقة مع المفرد وغير المعدود', 'Basic subject-verb agreement: singular subjects, there is/are, uncountable nouns (information, news, advice)'],
  ]},
  { t: 'الأزمنة التامة', s: 'g', d: [
    ['المضارع التام و since/for', 'Present perfect: form, experience, unfinished time, since vs for'],
    ['المضارع التام مقابل الماضي البسيط', 'Present perfect vs past simple; yet/already/just/ago/last'],
    ['المضارع التام المستمر', 'Present perfect continuous vs present perfect simple'],
    ['الماضي التام و by the time', 'Past perfect; by the time/before/after/when sequencing'],
    ['المستقبل التام والمستقبل المستمر', 'Future perfect and future continuous; by + time'],
    ['اختيار الزمن الصحيح في جمل الستيب', 'Mixed tense selection in STEP-style sentence completion using time markers'],
  ]},
  { t: 'مطابقة الفاعل والفعل', s: 'g', d: [
    ['each و every و either و neither', 'Each/every/either/neither (of) + singular verb'],
    ['neither...nor و either...or', 'Correlative subjects and the proximity rule; not only...but also; both...and'],
    ['the number of و a number of', 'The number of vs a number of; collective nouns (team, staff, police, people)'],
    ['الفاعل المفصول بعبارات', 'Subjects separated from verbs: along with, as well as, together with, of-phrases'],
    ['المطابقة داخل جمل الوصل', 'Relative clause agreement: who/which/that + verb agrees with the antecedent'],
    ['ضمائر الكمية والضمائر غير المحددة', 'Indefinite pronouns and quantity expressions: everyone, nobody, most of, half of, some of, percentages'],
  ]},
  { t: 'صيغة ing و to', s: 'g', d: [
    ['أفعال يجي بعدها ing', 'Verbs followed by gerund: enjoy, avoid, finish, mind, suggest, consider, deny'],
    ['أفعال يجي بعدها to', 'Verbs followed by infinitive: want, decide, plan, refuse, afford, manage, agree'],
    ['أفعال يتغير معناها', 'Verbs with change of meaning: stop, remember, forget, try, regret, mean'],
    ['ing بعد حروف الجر و to الجارّة', 'Gerund after prepositions; to as a preposition: look forward to, be used to, object to, get used to'],
    ['to للغرض و too/enough', 'Infinitive of purpose; too/enough + infinitive; in order to'],
    ['الفعل المجرد بعد make و let و help', 'Bare infinitive after make/let/help/had better/would rather and modals'],
  ]},
  { t: 'الجمل الشرطية', s: 'g', d: [
    ['الشرط الصفري والأول و unless', 'Zero and first conditional; unless, as long as, provided that'],
    ['الشرط الثاني و were', 'Second conditional; were for all persons; would/could/might'],
    ['الشرط الثالث', 'Third conditional: If + had + V3, would have + V3'],
    ['الشرط المختلط', 'Mixed conditionals (past condition with present result and vice versa)'],
    ['الشرط المقلوب', 'Inverted conditionals: Had I known, Should you need, Were it not for'],
    ['wish و if only و as if', 'Wish/if only for present, past and future; as if/as though; it\'s time + past'],
  ]},
  { t: 'المبني للمجهول والكلام المنقول', s: 'g', d: [
    ['المجهول في الأزمنة البسيطة', 'Passive voice in simple tenses; by-agent; when to use passive'],
    ['المجهول في الأزمنة التامة والمستمرة', 'Passive in perfect and continuous tenses; modal passives (must be done, should have been done)'],
    ['have something done و it is said', 'Causative have/get something done; impersonal passive: it is said that, he is believed to'],
    ['نقل الجمل الخبرية', 'Reported statements: backshift of tenses, time and place words'],
    ['نقل الأسئلة وترتيب الكلمات', 'Reported and embedded questions: normal word order, if/whether'],
    ['نقل الأوامر وأفعال النقل', 'Reported commands and requests; reporting verbs: advise, warn, deny, admit, suggest'],
  ]},
  { t: 'ضمائر الوصل وأدوات الربط', s: 'g', d: [
    ['who و which و whose و whom', 'Defining relative clauses: who/which/that/whose/whom; omitting the relative pronoun'],
    ['الجمل الوصفية بين فاصلتين', 'Non-defining relative clauses: commas, which (not that), which referring to a whole clause'],
    ['where و when و حروف الجر مع الوصل', 'Relative adverbs where/when/why; preposition + which/whom'],
    ['although و despite و however', 'Contrast linkers: although/though/even though vs despite/in spite of (+ noun/-ing) vs however/nevertheless'],
    ['أدوات السبب والنتيجة', 'Cause and result: because vs because of/due to; so/such...that; therefore/consequently'],
    ['أدوات الغرض والشرط', 'Purpose and condition linkers: so that, in order to, in case, provided that, otherwise'],
  ]},
  { t: 'التراكيب المتقدمة', s: 'g', d: [
    ['القلب بعد الظروف السلبية', 'Inversion after negative adverbials: never, rarely, seldom, hardly...when, no sooner...than, not only, only after'],
    ['صيغة الـ Subjunctive', 'Subjunctive after insist/suggest/recommend/demand that and it is essential/vital that'],
    ['المقارنة والتفضيل المتقدم', 'Comparatives and superlatives: the more...the more, as...as, far/much + comparative, double comparatives errors'],
    ['أدوات التعريف والمعدود', 'Articles a/an/the/zero article; countable vs uncountable; much/many/few/little'],
    ['جمل الـ participle والمعدِّل المعلّق', 'Participle clauses (having done, -ing, -ed) and dangling modifiers'],
    MOCK('g', 'اختبار قواعد مصغّر'),
  ]},
  { t: 'التحليل الكتابي: اكتشاف الخطأ', s: 'c', d: [
    ['كيف يختبرك الستيب في الأخطاء', 'How STEP compositional analysis works: error identification items, scanning order, checking verb, agreement, word form first'],
    ['أخطاء الأفعال والأزمنة', 'Error identification: wrong verb form and tense'],
    ['أخطاء المطابقة والضمائر', 'Error identification: subject-verb agreement and pronoun errors (its/their, who/which)'],
    ['أخطاء صيغة الكلمة', 'Error identification: word form errors (adjective vs adverb vs noun vs verb)'],
    ['أخطاء حروف الجر والتلازم اللفظي', 'Error identification: prepositions and collocations (depend on, interested in, make/do)'],
    ['تدريب مختلط على الأخطاء', 'Mixed error identification drill at STEP difficulty'],
  ]},
  { t: 'التحليل الكتابي: بناء الجملة', s: 'c', d: [
    ['التوازي في الجملة', 'Parallel structure in lists and correlative pairs'],
    ['ترتيب الكلمات', 'Word order: adjective order, adverb position, embedded questions, enough position'],
    ['التكرار والحشو', 'Redundancy and wordiness (return back, the reason is because)'],
    ['مكان المعدِّلات', 'Misplaced and dangling modifiers in full sentences'],
    ['الجملة الناقصة والمتصلة واختيار الجملة الصحيحة', 'Fragments, run-ons, comma splices; choose the correct sentence items'],
    ['تدريب مختلط على التحليل الكتابي', 'Mixed compositional analysis drill: error identification + choose the correct sentence'],
  ]},
  { t: 'القراءة: الفكرة والهدف', s: 'r', d: [
    ['القراءة السريعة للفكرة الرئيسية', 'Skimming for main idea'],
    ['الجملة المفتاحية والغرض من الفقرة', 'Topic sentences and the purpose of each paragraph'],
    ['هدف الكاتب', 'Author\'s purpose questions (to explain, to argue, to compare, to warn)'],
    ['أفضل عنوان للنص', 'Best title questions and distractors that are too narrow or too broad'],
    ['البحث عن التفاصيل', 'Scanning for specific details, numbers and names'],
    ['تدريب قراءة بوقت', 'Timed short passages drill'],
  ]},
  { t: 'القراءة: الكلمات والإحالة', s: 'r', d: [
    ['معنى الكلمة من السياق', 'Vocabulary in context: closest meaning'],
    ['السوابق واللواحق والجذور', 'Prefixes, suffixes and roots to guess meaning'],
    ['على من يعود الضمير', 'Reference questions: it, they, this, which, such'],
    ['كلمات الإشارة والربط', 'Signal words and how they reveal the answer (however, therefore, in contrast)'],
    ['إعادة صياغة الجملة', 'Sentence restatement / paraphrase questions'],
    ['تدريب مختلط', 'Mixed reading drill'],
  ]},
  { t: 'القراءة: الاستنتاج والموقف', s: 'r', d: [
    ['أسئلة الاستنتاج', 'Inference questions: what can be inferred / implied'],
    ['موقف الكاتب ونبرته', 'Author\'s attitude and tone'],
    ['الحقيقة مقابل الرأي', 'Fact vs opinion'],
    ['أسئلة EXCEPT و NOT', 'EXCEPT / NOT TRUE questions strategy'],
    ['النصوص الأكاديمية الطويلة', 'Strategy for long academic passages: read questions first, map paragraphs'],
    ['تدريب قراءة بوقت', 'Timed reading drill with long passages'],
  ]},
  { t: 'المفردات الأكاديمية', s: 'r', d: [
    ['مفردات العلوم والبيئة', 'Academic vocabulary set: science and environment, taught through a passage'],
    ['مفردات الاقتصاد والأعمال', 'Academic vocabulary set: economy and business'],
    ['مفردات التعليم وعلم النفس', 'Academic vocabulary set: education and psychology'],
    ['مفردات الصحة والتقنية', 'Academic vocabulary set: health and technology'],
    ['التلازم اللفظي الشائع', 'Common collocations tested in STEP'],
    ['تدريب سرعة القراءة', 'Speed reading drill'],
  ]},
  { t: 'الاستماع', s: 'l', d: [
    ['المحادثات القصيرة', 'Short conversations: gist and details'],
    ['الأرقام والتواريخ وفخاخ الأصوات', 'Numbers, dates, times; similar-sounding traps (fourteen/forty, can/can\'t)'],
    ['الإعلانات والتعليمات', 'Announcements and instructions'],
    ['المحاضرات: الفكرة الرئيسية', 'Academic lectures: main idea and structure'],
    ['المحاضرات: التفاصيل وموقف المتحدث', 'Lectures: details and speaker\'s attitude'],
    ['تدريب استماع مختلط', 'Mixed listening drill'],
  ]},
  { t: 'نصف اختبار تجريبي', s: 'g', d: [
    MOCK('g', 'تجريبي: القواعد'), MOCK('r', 'تجريبي: القراءة'), MOCK('lc', 'تجريبي: الاستماع والتحليل الكتابي'),
    TARGET, TARGET, TARGET,
  ]},
];

for (let w = 17; w <= 21; w++) {
  WEEKS.push({ t: 'اختبار تجريبي كامل ' + (w - 16), s: 'g', d: [
    MOCK('g', 'تجريبي: القواعد'), MOCK('r', 'تجريبي: القراءة'), MOCK('lc', 'تجريبي: الاستماع والتحليل الكتابي'),
    TARGET, TARGET, TARGET,
  ]});
}

WEEKS.push({ t: 'الأسبوع الأخير', s: 'g', d: [
  TARGET, TARGET,
  ['استراتيجيات يوم الاختبار', 'STEP exam-day strategy: time per section, guessing policy, order of answering, staying calm'],
  TARGET,
  ['مراجعة خفيفة شاملة', 'Light mixed review of the most tested grammar points'],
  ['مراجعة أخيرة للأخطاء الشائعة', 'Final review of the most common error-identification traps'],
]});

export const CURRICULUM = [];
WEEKS.forEach((wk, wi) => {
  const week = wi + 1;
  wk.d.forEach(x => {
    if (Array.isArray(x)) CURRICULUM.push({ week, kind: 'lesson', sec: wk.s, title: x[0], focus: x[1] });
    else if (x.k === 'mock') CURRICULUM.push({ week, kind: 'mock', sec: x.s, title: x.t, focus: '' });
    else CURRICULUM.push({ week, kind: 'targeted', sec: 'g', title: x.t, focus: '' });
  });
  CURRICULUM.push({ week, kind: 'review', sec: wk.s, title: 'مراجعة الأسبوع: ' + wk.t, focus: '' });
});
