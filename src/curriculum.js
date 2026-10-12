// منهج ١٨ أسبوع: الدراسة من الأحد للخميس، الجمعة والسبت راحة
// كل أسبوع: ٤ أيام دراسة (الأحد للأربعاء) + يوم مراجعة أسبوعية (الخميس) = ٩٠ يوم
// كل يوم: [العنوان بالعربي, وصف إنجليزي يوجّه Claude]
// أو كائن لأنواع خاصة: {k:'mock', s:'g'|'r'|'lc'} أو {k:'targeted'}

const MOCK = (s, t) => ({ k: 'mock', s, t });
const TARGET = { k: 'targeted', t: 'درس مخصص لنقاط ضعفك' };

const WEEKS = [
  { t: 'الأزمنة البسيطة والمستمرة', s: 'g', d: [
    ['المضارع البسيط و does/doesn\'t', 'Present simple: forms, third-person -s, does/doesn\'t, common Arab-learner errors'],
    ['المضارع المستمر مقابل البسيط', 'Present continuous vs present simple; stative verbs (know, believe, belong); basic agreement: there is/are, uncountable nouns (information, news, advice)'],
    ['الماضي البسيط والمستمر', 'Past simple: regular and irregular verbs, did/didn\'t + base form; past continuous vs past simple with when/while/as'],
    ['طرق التعبير عن المستقبل', 'Future: will, be going to, present continuous for arrangements, time clauses (when/as soon as + present)'],
  ]},
  { t: 'الأزمنة التامة', s: 'g', d: [
    ['المضارع التام مقابل الماضي البسيط', 'Present perfect: form, experience, since vs for, yet/already/just; present perfect vs past simple (ago, last, in 2019)'],
    ['المضارع التام المستمر', 'Present perfect continuous vs present perfect simple'],
    ['الماضي التام والمستقبل التام', 'Past perfect with by the time/before/after/when; future perfect and future continuous with by + time'],
    ['اختيار الزمن الصحيح في جمل الستيب', 'Mixed tense selection in STEP-style sentence completion using time markers'],
  ]},
  { t: 'مطابقة الفاعل والفعل', s: 'g', d: [
    ['each و every و either و neither', 'Each/every/either/neither (of) + singular verb; neither...nor / either...or and the proximity rule; not only...but also; both...and'],
    ['the number of والأسماء الجماعية', 'The number of vs a number of; collective nouns (team, staff, police, people)'],
    ['الفاعل المفصول وجمل الوصل', 'Subjects separated from verbs (along with, as well as, of-phrases); relative clause agreement: who/which/that + verb agrees with the antecedent'],
    ['ضمائر الكمية والضمائر غير المحددة', 'Indefinite pronouns and quantity expressions: everyone, nobody, most of, half of, some of, percentages'],
  ]},
  { t: 'صيغة ing و to', s: 'g', d: [
    ['أفعال يجي بعدها ing أو to', 'Verbs followed by gerund (enjoy, avoid, finish, mind, suggest, consider, deny) vs verbs followed by infinitive (want, decide, plan, refuse, afford, manage, agree)'],
    ['أفعال يتغير معناها', 'Verbs with change of meaning: stop, remember, forget, try, regret, mean'],
    ['ing بعد حروف الجر و to الجارّة', 'Gerund after prepositions; to as a preposition: look forward to, be used to, object to, get used to'],
    ['to للغرض والفعل المجرد', 'Infinitive of purpose, in order to, too/enough + infinitive; bare infinitive after make/let/help/had better/would rather and modals'],
  ]},
  { t: 'الجمل الشرطية', s: 'g', d: [
    ['الشرط الصفري والأول والثاني', 'Zero, first and second conditionals; unless, as long as, provided that; were for all persons; would/could/might'],
    ['الشرط الثالث والمختلط', 'Third conditional (If + had + V3, would have + V3) and mixed conditionals'],
    ['الشرط المقلوب', 'Inverted conditionals: Had I known, Should you need, Were it not for'],
    ['wish و if only و as if', 'Wish/if only for present, past and future; as if/as though; it\'s time + past'],
  ]},
  { t: 'المبني للمجهول والكلام المنقول', s: 'g', d: [
    ['المبني للمجهول في كل الأزمنة', 'Passive voice in simple, perfect and continuous tenses; modal passives (must be done, should have been done); by-agent'],
    ['have something done و it is said', 'Causative have/get something done; impersonal passive: it is said that, he is believed to'],
    ['نقل الجمل والأسئلة', 'Reported statements (backshift, time and place words); reported and embedded questions: normal word order, if/whether'],
    ['نقل الأوامر وأفعال النقل', 'Reported commands and requests; reporting verbs: advise, warn, deny, admit, suggest'],
  ]},
  { t: 'ضمائر الوصل وأدوات الربط', s: 'g', d: [
    ['ضمائر الوصل كاملة', 'Defining and non-defining relative clauses: who/which/that/whose/whom, commas, omitting the pronoun; where/when/why; preposition + which/whom'],
    ['although و despite و however', 'Contrast linkers: although/though/even though vs despite/in spite of (+ noun/-ing) vs however/nevertheless'],
    ['أدوات السبب والنتيجة والغرض', 'Cause and result: because vs because of/due to, so/such...that, therefore/consequently; purpose and condition: so that, in order to, in case, provided that, otherwise'],
    ['تدريب مختلط على الربط والوصل', 'Mixed drill on relative clauses and linkers at real STEP difficulty'],
  ]},
  { t: 'التراكيب المتقدمة', s: 'g', d: [
    ['القلب بعد الظروف السلبية', 'Inversion after negative adverbials: never, rarely, seldom, hardly...when, no sooner...than, not only, only after'],
    ['الـ Subjunctive والمقارنة المتقدمة', 'Subjunctive after insist/suggest/recommend/demand that and it is essential that; comparatives: the more...the more, as...as, far/much + comparative'],
    ['أدوات التعريف والمعدود', 'Articles a/an/the/zero article; countable vs uncountable; much/many/few/little'],
    ['جمل الـ participle والمعدِّل المعلّق', 'Participle clauses (having done, -ing, -ed) and dangling modifiers'],
  ]},
  { t: 'التحليل الكتابي: اكتشاف الخطأ', s: 'c', d: [
    ['كيف يختبرك الستيب في الأخطاء', 'How STEP compositional analysis works: error identification items, scanning order (verb, agreement, word form first); then wrong verb form and tense errors'],
    ['أخطاء المطابقة والضمائر', 'Error identification: subject-verb agreement and pronoun errors (its/their, who/which)'],
    ['أخطاء صيغة الكلمة وحروف الجر', 'Error identification: word form (adjective vs adverb vs noun vs verb), prepositions and collocations (depend on, interested in, make/do)'],
    ['تدريب مختلط على الأخطاء', 'Mixed error identification drill at STEP difficulty'],
  ]},
  { t: 'التحليل الكتابي: بناء الجملة', s: 'c', d: [
    ['التوازي وترتيب الكلمات', 'Parallel structure in lists and correlative pairs; word order: adjective order, adverb position, embedded questions, enough'],
    ['التكرار ومكان المعدِّلات', 'Redundancy and wordiness (return back, the reason is because); misplaced and dangling modifiers'],
    ['الجملة الناقصة واختيار الجملة الصحيحة', 'Fragments, run-ons, comma splices; choose the correct sentence items'],
    ['تدريب مختلط على التحليل الكتابي', 'Mixed compositional analysis drill: error identification + choose the correct sentence'],
  ]},
  { t: 'القراءة: الفكرة والهدف', s: 'r', d: [
    ['الفكرة الرئيسية والجملة المفتاحية', 'Skimming for the main idea; topic sentences and the purpose of each paragraph'],
    ['هدف الكاتب وأفضل عنوان', 'Author\'s purpose questions; best title questions and distractors that are too narrow or too broad'],
    ['البحث عن التفاصيل', 'Scanning for specific details, numbers and names under time pressure'],
    ['مفردات العلوم والبيئة والصحة', 'Academic vocabulary sets: science, environment and health, taught through passages'],
  ]},
  { t: 'القراءة: الكلمات والإحالة', s: 'r', d: [
    ['معنى الكلمة من السياق والجذور', 'Vocabulary in context: closest meaning; prefixes, suffixes and roots to guess meaning'],
    ['على من يعود الضمير وكلمات الربط', 'Reference questions (it, they, this, which, such); signal words that reveal the answer (however, therefore, in contrast)'],
    ['إعادة صياغة الجملة', 'Sentence restatement / paraphrase questions'],
    ['مفردات الاقتصاد والتعليم والتقنية', 'Academic vocabulary sets: economy, education, psychology and technology; common STEP collocations'],
  ]},
  { t: 'القراءة: الاستنتاج والموقف', s: 'r', d: [
    ['أسئلة الاستنتاج', 'Inference questions: what can be inferred / implied'],
    ['موقف الكاتب والحقيقة مقابل الرأي', 'Author\'s attitude and tone; fact vs opinion'],
    ['أسئلة EXCEPT و NOT', 'EXCEPT / NOT TRUE questions strategy'],
    ['النصوص الأكاديمية الطويلة بوقت', 'Strategy for long academic passages (read questions first, map paragraphs) with a timed drill'],
  ]},
  { t: 'الاستماع', s: 'l', d: [
    ['المحادثات القصيرة وفخاخ الأرقام', 'Short conversations: gist and details; numbers, dates, times; similar-sounding traps (fourteen/forty, can/can\'t)'],
    ['الإعلانات والتعليمات', 'Announcements and instructions'],
    ['المحاضرات: الفكرة والتفاصيل', 'Academic lectures: main idea, structure, details and speaker\'s attitude'],
    ['تدريب استماع مختلط', 'Mixed listening drill'],
  ]},
];

for (let i = 1; i <= 3; i++) {
  WEEKS.push({ t: 'اختبار تجريبي كامل ' + i, s: 'g', d: [
    MOCK('g', 'تجريبي: القواعد'), MOCK('r', 'تجريبي: القراءة'), MOCK('lc', 'تجريبي: الاستماع والتحليل الكتابي'),
    TARGET,
  ]});
}

WEEKS.push({ t: 'الأسبوع الأخير', s: 'g', d: [
  TARGET,
  ['استراتيجيات يوم الاختبار', 'STEP exam-day strategy: time per section, guessing policy, order of answering, staying calm'],
  TARGET,
  ['مراجعة أخيرة للأخطاء الشائعة', 'Final review of the most tested grammar points and the most common error-identification traps'],
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
