// مواضيع جزء الاستماع في حلقة المشي
// المصدر: مواضيع الاستماع اللي تكررت في تسريبات الستيب (سبتمبر وأكتوبر 2026) + مواضيع قريبة منها.
// الكود يختار كل يوم موضوع من كل قائمة، ويتجنب اللي استُخدم في آخر الحلقات.
// النموذج يكتب نص جديد على الموضوع، ما ينسخ أي نص من التسريبات.

// محاضرة قصيرة (مقطع ١): مواضيع أكاديمية تكررت في الاختبار أولاً
export const LECTURE = [
  'Renewable energy and solar panels', 'How telescopes work, including space and radio telescopes',
  'The history of the Great Mosque of Cordoba', 'Overfishing and how countries can stop it',
  'Non-REM sleep and why the body needs it', 'Why some plants produce caffeine',
  'What an algorithm is, with everyday examples', 'The main parts of a computer',
  'The longest rivers in the world', 'Surprising hobbies of Queen Elizabeth the Second',
  'How the Eiffel Tower was built and why it still stands', 'How fast bears can run and other animal speeds',
  'Why milk and calcium matter for health', 'ADHD in school children',
  'What software engineers actually do', 'The history of martial arts',
  'Coral reefs and why they are dying', 'How bees help farmers',
  'Meteors, meteoroids and near-Earth asteroids', 'How the body uses food: metabolism',
  'The three types of muscle in the human body', 'The Spanish flu of 1918',
  'How earthquakes happen', 'Desalination: turning sea water into drinking water',
  'Ant colonies and how they work together', 'Ibn al-Haytham and the science of light',
];

// إعلان (مقطع ٢): المكان والسبب يتغيرون كل يوم
export const ANNOUNCE = [
  'A manager announces changes to the work schedule to staff', 'A teacher announces the quiz chapters and the presentation day',
  'An airport announcement about a gate change and delay', 'A train station announcement about a cancelled service',
  'A museum announces new opening hours and a special exhibition', 'A university library announces new rules and hours',
  'A hospital announces visiting hours and parking changes', 'A supermarket announces a weekend special offer',
  'A conference organizer announces a change in the session schedule', 'A gym announces new membership prices and classes',
  'A school announces a field trip and what students must bring', 'A university announces the course registration deadline',
  'A recorded phone message from a dental clinic', 'A shopping mall announces a fire drill',
  'A cinema announces show times and a ticket discount', 'A tour guide gives instructions before a city bus tour',
  'A university asks students to complete a campus survey', 'A pilot speaks to passengers before landing',
  'A city announces road closures for a marathon', 'A company announces a new training workshop for employees',
];

// محادثة بين شخصين (مقطع ٣، وأحياناً ٤): مواقف خدمية وجامعية وعملية
export const CONVO = [
  'Ordering pizza by phone with a special offer and delivery time', 'Booking a round-trip flight ticket by phone',
  'Buying a bus ticket at a station counter', 'Reserving a budget hotel room',
  'A job interview for a part-time position', 'A colleague calls to ask about the meeting time for a job application',
  'A student asks a professor for more time on an assignment', 'Booking a doctor appointment at a clinic',
  'Renting an apartment near the university', 'Renting a car at the airport',
  'Returning a faulty phone to a shop', 'Opening a new bank account',
  'Getting a library card and borrowing rules', 'Booking a table at a restaurant for a family dinner',
  'Asking a stranger for directions to the post office', 'A phone survey about shopping habits',
  'Two roommates disagree about cleaning the apartment', 'Two classmates plan a group project',
  'A student has a problem with course registration', 'Asking about gym membership options',
  'Reporting lost luggage at an airport desk', 'Calling technical support about a slow laptop',
  'Booking a desert tour for the weekend', 'Asking a pharmacist about a medicine for a cold',
  'Choosing a new mobile phone plan', 'Two friends compare online shopping and store shopping',
];

// حديث إذاعي أو خبر (مقطع ٤ في الأيام الفردية)
export const RADIO = [
  'How IKEA builds prefabricated homes in factories', 'The history of the Pepsi company',
  'Why airlines overbook flights', 'Tourism in Brazil and what visitors should know',
  'The housing crisis in New Zealand', 'A new airline route and its flight distance',
  'Why people spend so much time on social media', 'The rise of electric cars',
  'Tourism growth in AlUla', 'A new metro line opens in a big city',
  'Working from home: benefits and problems', 'Fast fashion and the environment',
  'A health tip segment about drinking enough water', 'A weather report before a long holiday weekend',
  'Food prices are rising around the world', 'A review of a new science museum',
  'Smartphone use among teenagers', 'Plastic pollution in the oceans',
];

// المحاضرة الطويلة (الجزء الخامس): مواضيع أكاديمية بنمط قطع القراءة والمحاضرات في الستيب
export const TALK = [
  'The Silk Road and world trade', 'How vaccines train the immune system', 'Why antibiotics are losing their power',
  'How memory works when we study', 'The history of the printing press', 'Rainforests and climate',
  'How volcanoes shape the land', 'Exploring Mars', 'Why the dinosaurs disappeared', 'The story of coffee',
  'Cities are growing fast: urbanization', 'The King Fahd Causeway and how bridges over the sea are built',
  'Leonardo da Vinci as a scientist', 'The history of the Olympic Games', 'Camels and life in the desert',
  'Artificial intelligence in everyday life', 'How the human heart works', 'Why we dream',
  'The water cycle', 'The ancient city of Petra', 'The pyramids of Giza', 'The history of anatomy and medicine',
  'Pricing strategies: how companies decide prices', 'Obesity and the food we eat',
  'Aggression in children and how parents can help', 'Types of evidence in a court case',
  'Nano wood: a material stronger than steel', 'How central banks control money',
  'The history of the Congo River region', 'Singapore and its tourist districts',
  'Landscape gardening', 'Project management basics', 'Emotions and the brain',
];

// اختيار ثابت لليوم (لو انعادت كتابة الحلقة نفس اليوم يطلع نفس الاختيار)
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// recent: مواضيع الحلقات السابقة، الأحدث أولاً. نختار موضوع ما انستخدم، وإذا خلصت القائمة ناخذ الأقدم استخداماً
function pick(pool, date, salt, recent, taken) {
  const age = new Map();
  recent.forEach((t, i) => { if (!age.has(t)) age.set(t, i); });
  const start = hash(date + '|' + salt) % pool.length;
  let best = null, bestAge = -1;
  for (let k = 0; k < pool.length; k++) {
    const t = pool[(start + k) % pool.length];
    if (taken.has(t)) continue;
    if (!age.has(t)) { best = t; break; }
    if (age.get(t) > bestAge) { best = t; bestAge = age.get(t); }
  }
  taken.add(best);
  return best;
}

// يرجع أنواع ومواضيع مقاطع اليوم + موضوع المحاضرة الطويلة
export function todaysTopics(date, recent) {
  const taken = new Set();
  const odd = hash(date) % 2 === 1;
  const clips = [
    { kind: 'lecture', topic: pick(LECTURE, date, 'l', recent, taken) },
    { kind: 'announcement', topic: pick(ANNOUNCE, date, 'a', recent, taken) },
    { kind: 'conversation', topic: pick(CONVO, date, 'c1', recent, taken) },
    odd ? { kind: 'radio', topic: pick(RADIO, date, 'r', recent, taken) }
        : { kind: 'conversation', topic: pick(CONVO, date, 'c2', recent, taken) },
  ];
  return { clips, talk: pick(TALK, date, 't', recent, taken) };
}
