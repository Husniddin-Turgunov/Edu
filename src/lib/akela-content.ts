/**
 * AKELA GROUP onboarding kontenti —
 * manba: upload qilingan akela-assess loyihasidagi i18n lug'ati (uz/ru/en).
 * Bu yerda faqat yangi xodim tanishtirish uchun kerakli qismlar tartibga solingan.
 */

export type Locale = "uz" | "ru" | "en";

export type OnboardingStep = {
  id: "welcome" | "history" | "about" | "structure" | "leadership" | "timeline" | "rules";
  index: number;
  icon: string; // lucide icon name
  title: string;
  body: string;
  points: string[];
  accentFrom: string; // tailwind gradient from
  accentTo: string; // tailwind gradient to
};

export const ONBOARDING_STEPS: Record<Locale, OnboardingStep[]> = {
  uz: [
    {
      id: "welcome",
      index: 0,
      icon: "Sparkles",
      title: "AKELA GROUP MACHINERYga xush kelibsiz",
      body: "Sizni «AKELA GROUP MACHINERY» MChJ oilasiga qo'shilayotganingiz bilan chin dildan tabriklaymiz. Kompaniya 2004 yilda tashkil etilgan bo'lib, sanoat uskunalarini yetkazib berish, servis xizmati va texnik qo'llab-quvvatlash sohasida faoliyat yuritadi. Bugungi kunda kompaniya 100 dan ortiq xodim bilan ishlaydi va xalqaro hamkorlikni rivojlantirishda davom etmoqda. Ushbu 7 qadam sizga tez va to'g'ri moslashishga yordam beradi.",
      points: [
        "Kompaniya tarixi, qadriyatlari va tashkiliy tuzilmasi bilan tanishing",
        "Xodimlarning huquq va majburiyatlari, ish tartibi va axloq qoidalarini o'rganing",
        "Birinchi ish kuningiz uchun tayyor bo'ling: HRga murojaat, hujjatlar, tizimga kirish",
      ],
      accentFrom: "from-indigo-500/30",
      accentTo: "to-amber-300/20",
    },
    {
      id: "history",
      index: 1,
      icon: "BookOpen",
      title: "Kompaniya tarixi va qadriyatlari",
      body: "2004 yilda AKELA GROUP brendi tashkil etildi va sanoat uskunalarini yetkazib berish faoliyati boshlandi. 2015 yilda AKELA GROUP MACHINERY MChJ davlat ro'yxatidan o'tkazildi. 2016–2020 yillarda poligrafiya, qadoqlash, metall, yog'och, oziq-ovqat, farmatsevtika sanoat tarmoqlari uchun uskunalar yetkazib berish yo'lga qo'yildi. 2021 yildan beri xalqaro hamkorlik rivojlantirilib, servis xizmati kuchaytirildi.",
      points: [
        "Mijozlar, xodimlar, halollik, sifat va hamkorlik — asosiy qadriyatlarimiz",
        "Inson — eng katta boylik va taraqqiyotimizning asosi",
        "Tajriba jarayonlar, yo'riqnomalar va o'quv materiallarida saqlanadi",
        "Har bir yangi xodim yagona moslashuv yo'lidan o'tadi",
      ],
      accentFrom: "from-amber-400/30",
      accentTo: "to-indigo-500/20",
    },
    {
      id: "about",
      index: 2,
      icon: "Building2",
      title: "Kompaniya nima bilan shug'ullanadi",
      body: "AKELA GROUP MACHINERY MChJ sanoat, qadoqlash, metall, yog'och, oziq-ovqat, farmatsevtika va boshqa tarmoqlar uchun uskunalar yetkazib beradi. Kompaniya tuzilmasi Bosh direktor (Kadirov Akbar Abdumanapovich) rahbarligida 9 ta asosiy bo'limdan iborat: HR, Buxgalteriya, Savdo, Xarid, Marketing, Texnik xizmat, Logistika, Ombor, IT va Ofis. Bosh direktor bilan uchrashuv faqat rahbar yordamchisi orqali oldindan kelishilgan holda amalga oshiriladi.",
      points: [
        "Birinchi ish kuni: HRga murojaat, shartnoma bilan tanishish, kompyuter va korporativ akkaunt olish",
        "Osnova va Bitrix24 tizimlariga kirish huquqini olish",
        "Bo'lim rahbari bilan tanishish va ichki tartib qoidalari bilan tanishish",
        "Bitrix24 CRM orqali barcha ish jarayonlari yuritiladi",
      ],
      accentFrom: "from-teal-500/30",
      accentTo: "to-amber-300/20",
    },
    {
      id: "structure",
      index: 3,
      icon: "Network",
      title: "Tashkiliy tuzilma",
      body: "Kompaniyaning boshqaruv tuzilmasi aniq iyerarxiyaga asoslangan: xodim → bo'lim boshlig'ining o'rinbosari → bo'lim boshlig'i → departament boshlig'i → Bosh direktor. Kompaniya 9 ta asosiy bo'lim va 100+ xodimdan iborat. Har bir bo'lim o'z professional yo'nalishi uchun mas'ul: HR (Rajabova Sug'diyona), Buxgalteriya (Gulnora Jakudayeva), Savdo (Elvira Kadirova), Xarid (Sardor Xaqqulov), Texnik xizmat (Husniddin Turg'unov), Logistika (Yoqubjon Yaqubov), Ombor (Mirzaxon Abdusamatov).",
      points: [
        "Bosh direktor: Kadirov Akbar Abdumanapovich",
        "HR bo'limi: xodim qabul qilish, onboarding, buyruqlar, ta'tillar",
        "Buxgalteriya: ish haqi, soliqlar, hisob-kitoblar, moliyaviy hisobotlar",
        "Texnik xizmat: uskunalarni o'rnatish, texnik xizmat, kafolat ishlari, ta'mirlash",
      ],
      accentFrom: "from-indigo-600/30",
      accentTo: "to-amber-400/20",
    },
    {
      id: "leadership",
      index: 4,
      icon: "Users",
      title: "Rahbariyat va kompaniya boshqaruvi",
      body: "AKELA GROUP MACHINERY MChJ-ni boshqaruvi Bosh direktor A. A. Kadirov (Akbar Abdumanapovich) tomonidan amalga oshiriladi. Rahbariyat kompaniyaning strategik rivojlanishini, xalqaro hamkorlik hamda mijozlar bilan ishlashni boshqaradi. Har bir bo'lim boshligi o'z professional yo'nalishi uchun mas'ul.",
      points: [
        "Bosh direktor: A. A. Kadirov — umumiy strategiya va rivojlanish",
        "HR bo'limi: Rajabova Sug'diyona — xodimlar qabuli va onboarding",
        "Har bir bo'lim boshlig'i o'z yo'nalishini mustakblilik qiladi",
        "Rahbarlar bilan uchrashuv faqat oldindan kelishilgan holda amalga oshiriladi",
      ],
      accentFrom: "from-purple-500/30",
      accentTo: "to-indigo-500/20",
    },
    {
      id: "timeline",
      index: 5,
      icon: "Calendar",
      title: "Tarix chiziqlari",
      body: "2004 yilda AKELA GROUP brendi tashkil etildi va sanoat uskunalarini yetkazib berish boshlandi. 2015 yilda AKELA GROUP MACHINERY MChJ davlat ro'yxatidan o'tkazildi. 2016–2020 yillarda poligrafiya, qadoqlash, metall, yog'och, oziq-ovqat, farmatsevtika va boshqa sanoat tarmoqlari uchun uskunalar yetkazib berish yo'lga qo'yildi. 2021 yildan beri xalqaro hamkorlik rivojlantirilib, servis xizmati va texnik qo'llab-quvvatlash kuchaytirildi. Bugungi kunda kompaniya 100 dan ortiq xodim bilan ishlaydi.",
      points: [
        "2004 — AKELA GROUP brendi tashkil etildi",
        "2015 — AKELA GROUP MACHINERY MChJ davlat ro'yxatidan o'tkazildi",
        "2016–2020 — 6 sanoat tarmog'iga ish yo'lga qo'yildi",
        "2021–hozirgacha — xalqaro hamkorlik va servis kuchaytirildi",
      ],
      accentFrom: "from-teal-400/30",
      accentTo: "to-amber-500/20",
    },
    {
      id: "rules",
      index: 6,
      icon: "ShieldCheck",
      title: "Ish qoidalari va axloq kodeksi",
      body: "Kompaniya 6 kunlik ish haftasi bilan ishlaydi. Ish vaqti 09:00 dan 18:00 gacha, tushlik 13:00 dan 14:00 gacha. Oylik ish haqi har oyning 10-sanasida, avans (40%) 25-sanasida to'lanadi. Yangi xodimlar 5 kunlik bepul sinov muddatidan so'ng, 3 oylik fuqarolik-huquqiy shartnoma asosida, keyin mehnat shartnomasi tuziladi. Axloq kodeksi 10 ta bobdan iborat: umumiy qoidalar, kasbiy madaniyat, xizmat faoliyati, tashqi ko'rinish, manfaatlar to'qnashuvi, javobgarlik va boshqalar. Tijorat sirlari 10 yil muddatga himoyalanadi.",
      points: [
        "Kiyinish: klassik ofis yoki biznes-kasual, sport kiyim taqiqlanadi",
        "Maxfiylik: kompaniya ichki ma'lumotlari va tijorat sirlarini saqlash majburiy",
        "Kechikish: sababni darhol rahbarga xabar qilish, tizimli kechikish jarimaga sabab",
        "5 kunlik sinov muddati bepul, 3 oylik sinov pullik, attestatsiyadan keyin mehnat shartnomasi",
      ],
      accentFrom: "from-amber-500/30",
      accentTo: "to-indigo-600/20",
    },
  ],
  ru: [
    {
      id: "welcome",
      index: 0,
      icon: "Sparkles",
      title: "Добро пожаловать в AKELA GROUP",
      body: "Перед началом работы познакомьтесь с компанией, её структурой и общими правилами.",
      points: [
        "Пройдите все семь вводных шагов по порядку.",
        "После завершении материалы останутся на главной странице.",
        "Дальше откроются обучение, тесты и ежедневные отчёты стажёра.",
      ],
      accentFrom: "from-indigo-500/30",
      accentTo: "to-amber-300/20",
    },
    {
      id: "history",
      index: 1,
      icon: "BookOpen",
      title: "История компании",
      body: "AKELA GROUP развивает единые стандарты работы, обучения и ответственности за результат.",
      points: [
        "Компания росла через развитие направлений и профессиональных команд.",
        "Опыт компании закрепляется в процессах, инструкциях и обучающих материалах.",
        "Каждый новый сотрудник проходит единый путь знакомства и адаптации.",
      ],
      accentFrom: "from-amber-400/30",
      accentTo: "to-indigo-500/20",
    },
    {
      id: "about",
      index: 2,
      icon: "Building2",
      title: "Чем занимается компания",
      body: "Подразделения AKELA GROUP совместно создают ценность для клиентов и поддерживают работу компании.",
      points: [
        "Каждое подразделение отвечает за своё профессиональное направление.",
        "Результат строится на качестве, сроках и понятной коммуникации.",
        "Сотрудники используют общие инструменты и стандарты взаимодействия.",
      ],
      accentFrom: "from-teal-500/30",
      accentTo: "to-amber-300/20",
    },
    {
      id: "structure",
      index: 3,
      icon: "Network",
      title: "Структура компании",
      body: "Структура показывает, кто за какое направление отвечает и к кому обращаться по рабочим вопросам.",
      points: [
        "Руководители определяют цели и принимают ключевые решения.",
        "Подразделения и отделы отвечают за отдельные направления работы.",
        "У каждого сотрудника есть должность, руководитель и Зона ответственности.",
      ],
      accentFrom: "from-indigo-600/30",
      accentTo: "to-amber-400/20",
    },
    {
      id: "leadership",
      index: 4,
      icon: "Users",
      title: "Руководство и управление",
      body: "AKELA GROUP MACHINERY MChJ управляется Генеральным директором А. А. Кадыровым (Акбар Абдуманапович). Руководство определяет стратегию развития компании, международное сотрудничество и работу с клиентами. Каждый руководитель отдела отвечает за свою профессиональную область.",
      points: [
        "Генеральный директор: А. А. Кадыров — стратегия и развитие",
        "Отдел HR: Раджабова Сугдия — подбор и адаптация сотрудников",
        "Каждый руководитель отвечает за свою область",
        "Встречи с руководителями назначаются заранее",
      ],
      accentFrom: "from-purple-500/30",
      accentTo: "to-indigo-500/20",
    },
    {
      id: "timeline",
      index: 5,
      icon: "Calendar",
      title: "Исторические вехи",
      body: "В 2004 году был создан бренд AKELA GROUP и началась поставка промышленного оборудования. В 2015 году AKELA GROUP MACHINERY MChJ была включена в государственный реестр. В 2016–2020 годах была расширена деятельность по поставкам для полиграфии, упаковке, металлу, дереву, пищевой и фармацевтической промышленности. С 2021 года развиваются международные связи, усилена сервисная поддержка. В настоящее время компания работает с более чем 100 сотрудниками.",
      points: [
        "2004 — создан бренд AKELA GROUP",
        "2015 — AKELA GROUP MACHINERY MChJ включена в реестр",
        "2016–2020 — расширен направления поставок",
        "2021–н.в. — развитие международного сотрудничества",
      ],
      accentFrom: "from-teal-400/30",
      accentTo: "to-amber-500/20",
    },
    {
      id: "rules",
      index: 6,
      icon: "ShieldCheck",
      title: "Правила работы в компании",
      body: "Соблюдение общих правил помогает команде работать безопасно, предсказуемо и эффективно.",
      points: [
        "Приходите вовремя, соблюдайте график и заранее сообщайте об изменениях.",
        "Ведите задачи и сроки в рабочих системах, фиксируйте результат.",
        "Соблюдайте конфиденциальность и правила информационной безопасности.",
        "Если задача непонятна — сразу обращайтесь к наставнику.",
      ],
      accentFrom: "from-amber-500/30",
      accentTo: "to-indigo-600/20",
    },
  ],
  en: [
    {
      id: "welcome",
      index: 0,
      icon: "Sparkles",
      title: "Welcome to AKELA GROUP",
      body: "Before starting work, learn about the company, its structure, and shared rules.",
      points: [
        "Complete all seven orientation steps in order.",
        "After completion, these materials remain available on your home page.",
        "Learning, tests, and intern daily reports become your next steps.",
      ],
      accentFrom: "from-indigo-500/30",
      accentTo: "to-amber-300/20",
    },
    {
      id: "history",
      index: 1,
      icon: "BookOpen",
      title: "Company history",
      body: "AKELA GROUP develops shared standards for work, learning, and accountability.",
      points: [
        "The company grew by developing business areas and professional teams.",
        "Experience is captured in processes, instructions, and learning materials.",
        "Every new employee follows one consistent adaptation path.",
      ],
      accentFrom: "from-amber-400/30",
      accentTo: "to-indigo-500/20",
    },
    {
      id: "about",
      index: 2,
      icon: "Building2",
      title: "What the company does",
      body: "AKELA GROUP departments work together to create value and support operations.",
      points: [
        "Each department is responsible for its professional area.",
        "Results are built on quality, deadlines, and clear communication.",
        "Employees use shared tools and collaboration standards.",
      ],
      accentFrom: "from-teal-500/30",
      accentTo: "to-amber-300/20",
    },
    {
      id: "structure",
      index: 3,
      icon: "Network",
      title: "Company structure",
      body: "The structure shows who owns each area and whom to contact.",
      points: [
        "Leaders set goals and make key decisions.",
        "Divisions and departments own separate areas of work.",
        "Every employee has a role, manager, and area of responsibility.",
      ],
      accentFrom: "from-indigo-600/30",
      accentTo: "to-amber-400/20",
    },
     {
      id: "leadership",
      index: 4,
      icon: "Users",
      title: "Leadership and management",
      body: "AKELA GROUP MACHINERY MChJ is managed by General Director A. A. Kadirov (Akbar Abdumanapovich). Leadership drives the company's strategic development, international cooperation, and client relations. Each department head is responsible for their professional area.",
      points: [
        "General Director: A. A. Kadirov — strategy and development",
        "HR department: Rajabova Sug'diyona — recruitment and onboarding",
        "Each department head manages their own area",
        "Meetings with managers are scheduled in advance",
      ],
      accentFrom: "from-purple-500/30",
      accentTo: "to-indigo-500/20",
    },
    {
      id: "timeline",
      index: 5,
      icon: "Calendar",
      title: "Historical milestones",
      body: "In 2004, the AKELA GROUP brand was established and industrial equipment supply began. In 2015, AKELA GROUP MACHINERY MChJ was registered. From 2016–2020, supply was launched for printing, packaging, metal, wood, food, and pharmaceutical industries. Since 2021, international cooperation has been developing and service support has been strengthened. Today the company operates with 100+ employees.",
      points: [
        "2004 — AKELA GROUP brand established",
        "2015 — AKELA GROUP MACHINERY registered",
        "2016–2020 — expanded into 6 industries",
        "2021–present — international cooperation and service growth",
      ],
      accentFrom: "from-teal-400/30",
      accentTo: "to-amber-500/20",
    },
    {
      id: "rules",
      index: 6,
      icon: "ShieldCheck",
      title: "Company work rules",
      body: "Shared rules help the team work safely and effectively.",
      points: [
        "Be on time, follow the schedule, and communicate changes in advance.",
        "Track tasks and deadlines in work systems and record results.",
        "Follow confidentiality and information-security rules.",
        "If a task is unclear, contact your mentor immediately.",
      ],
      accentFrom: "from-amber-500/30",
      accentTo: "to-indigo-600/20",
    },
  ],
};

/** Ish intizomi qoidalari ( Discipline & ethics ) */
export type DisciplineRule = {
  icon: string;
  title: string;
  description: string;
  examples: string[];
};

export const DISCIPLINE_RULES: Record<Locale, DisciplineRule[]> = {
  uz: [
    {
      icon: "Clock",
      title: "Ish vaqti va intizomi",
      description:
        "Kompaniyada 6 kunlik ish haftasi joriy etilgan. Ish vaqti har kuni 09:00 dan 18:00 gacha, tushlik 13:00 dan 14:00 gacha. Xodim ertalab va tushlikdan keyin belgilangan vaqtda ish joyida bo'lishi shart. Yangi xodimlar 5 kunlik (bepul) sinov muddatidan, so'ngra 3 oylik fuqarolik-huquqiy shartnoma asosida qabul qilinadi.",
      examples: [
        "Ish boshlanishidan 5 daqiqa oldin ish joyida bo'lish.",
        "Kechikish yoki kasallik haqida ertalab soat 8:30 gacha rahbarga xabar berish.",
        "Ishga tizimli kechikish moliyaviy jarima yoki mehnat munosabatlarini tugatishga sabab bo'ladi.",
        "Oylik ish haqi har oyning 10-sanasida, avans (40%) 25-sanasida to'lanadi.",
      ],
    },
    {
      icon: "Shirt",
      title: "Tashqi ko'rinish va kiyinish",
      description:
        "AKELA GROUP MACHINERY xodimlari klassik ofis yoki biznes-kasual uslubda kiyinishi shart. Kiyim toza, ozoda va kompaniya obro'siga mos bo'lishi kerak. Texnik xodimlar uchun kompaniya maxsus kiyim va shaxsiy himoya vositalarini taqdim etadi.",
      examples: [
        "Klassik ofis kiyimi yoki biznes-kasual asosiy standart.",
        "Mijozlar bilan uchrashuvlarda rasmiyroq kiyim kiyish.",
        "Sport kiyim, shortiklar, futbolkalar, juda tor yoki kalta kiyimlar taqiqlanadi.",
      ],
    },
    {
      icon: "Lock",
      title: "Maxfiylik va tijorat sirlari",
      description:
        "Kompaniyaning ichki ma'lumotlari, mijozlar bazasi, moliyaviy ko'rsatkichlari va tijorat sirlari uchinchi shaxslarga berilmaydi. Tijorat sirlari 10 yil muddatga himoyalanadi. Buxgalteriya ma'lumotlari, shartnoma shartlari, marketing tadqiqotlari, texnologiyalar va narxlar — bularning barchasi tijorat siriga kiradi.",
      examples: [
        "Parollarni qog'ozga yozmaslik, maxfiy hujjatlarni shaxsiy bulutga yuklamaslik.",
        "Ishdan bo'shashdan keyin ham maxfiylik saqlanadi.",
        "Tijorat sirlarini oshkor qilish qonuniy javobgarlikka tortilishga sabab bo'ladi.",
        "Yangi xodim tijorat sirlari bilan tilxat asosida imzo qo'yish orqali tanishtiriladi.",
      ],
    },
    {
      icon: "MessagesSquare",
      title: "Ichki muloqot va axloq",
      description:
        "Barcha ichki muloqotlar rasmiy kanallar orqali yuritiladi: Bitrix24, korporativ Telegram, e-mail. Mijozlar bilan aloqa faqat korporativ kontaktlardan amalga oshiriladi. Kompaniya 10 boblik axloq kodeksiga ega: umumiy qoidalar, kasbiy madaniyat, xizmat faoliyati, tashqi ko'rinish, manfaatlar to'qnashuvi va boshqalar.",
      examples: [
        "Vazifalar faqat Bitrix24 ish tizimida belgilanadi.",
        "Jamoaviy chatlarda hurmatli va aniq yozish.",
        "Hamkasblarni muhokama qilish taqiqlanadi (kollegiallik tamoyili).",
        "Mijoz, hamkor yoki bo'ysunuvchini jinsi, irqi, yoshi bo'yicha kamsitishga yo'l qo'yilmaydi.",
      ],
    },
    {
      icon: "FileCheck",
      title: "Hisobot va natija",
      description:
        "Har bir xodim kunlik va haftalik hisobot beradi. Normativ xlsx jadvaliga ko'ra kunlik, haftalik va oylik hisobotlar to'ldiriladi. Har bir lavozim uchun aniq me'yorlar (normativ) belgilangan — ular bajarilishi monitoring qilinadi.",
      examples: [
        "Kunlik hisobot ish kuni oxirida Bitrix24da topshiriladi.",
        "Vazifa o'zgartirilganda darhol tizimga kiritiladi.",
        "Muddat o'tib ketishining oldini olish uchun oldindan ogohlantirish.",
        "Bajarildi / Bajarilmadi / % ko'rsatkichlari doim to'ldiriladi.",
      ],
    },
    {
      icon: "HandHeart",
      title: "Jamoaviy hurmat va muvaffaqiyat",
      description:
        "Hamkasblar va rahbarlarga nisbatan hurmatli munosabat majburiy. Hech qanday shaklda kamsitish, haqorat yoki bullyingga yo'l qo'yilmaydi. 3 oylik sinov muddatidan muvaffaqiyatli o'tgan xodimlarga 20% gacha oylik maoshini oshirish masalasi ko'rib chiqiladi. Har yarim yilda tavsiyanoma asosida 20% gacha oshirish mumkin. Kompaniya har chorakda xodimlarni moddiy rag'batlantirish uchun mukofot puli ajratadi.",
      examples: [
        "Tenglik va xilma-xillik prinsipiga rioya qilish.",
        "Konfliktlarni tinch yo'l bilan hal qilish.",
        "Yangi xodimlarga yordam berish va qo'llab-quvvatlash.",
        "3 oy ichida attestatsiyadan o'tib, mehnat shartnomasi tuzish.",
      ],
    },
  ],
  ru: [
    {
      icon: "Clock",
      title: "Дисциплина времени",
      description:
        "Рабочий день организован по графику. Опоздания и отсутствия согласовываются заранее с руководителем и HR.",
      examples: [
        "Быть на рабочем месте за 5 минут до начала.",
        "Сообщать о задержке или болезни до 8:30 утра.",
        "Перерывы и обед не выходят за рамки графика.",
      ],
    },
    {
      icon: "Shirt",
      title: "Внешний вид",
      description:
        "Сотрудникам AKELA GROUP рекомендуется деловой стиль одежды. Опрятность и аккуратность обязательны.",
      examples: [
        "Бизнес-casual — основной стандарт.",
        "Более официальная одежда для встреч с клиентами.",
        "Элементы с логотипом предоставляются компанией.",
      ],
    },
    {
      icon: "Lock",
      title: "Конфиденциальность",
      description:
        "Внутренние данные, клиентская база и финансовые показатели не передаются третьим лицам. Сотрудник подписывает NDA.",
      examples: [
        "Не записывать пароли на бумаге.",
        "Не загружать внутренние документы в личное облако.",
        "Конфиденциальность сохраняется и после увольнения.",
      ],
    },
    {
      icon: "MessagesSquare",
      title: "Внутренние коммуникации",
      description:
        "Общение ведётся через корпоративные каналы: Telegram, e-mail, рабочая система. Личные телефоны для решений не используются.",
      examples: [
        "Задачи ставятся только в рабочей системе.",
        "Контакты с клиентами — только корпоративные.",
        "В общих чатах — уважительный и точный тон.",
      ],
    },
    {
      icon: "FileCheck",
      title: "Отчётность",
      description:
        "Каждый сотрудник предоставляет дневной и недельный отчёт с результатами, причинами задержек и следующими работы.",
      examples: [
        "Дневной отчёт — в конце рабочего дня.",
        "Изменения по задаче сразу вносятся в систему.",
        "Заранее предупреждать о возможных просрочках.",
      ],
    },
    {
      icon: "HandHeart",
      title: "Уважение в команде",
      description:
        "Уважительное отношение к коллегам и руководителям обязательно. Дискриминация, оскорбления и буллинг недопустимы.",
      examples: [
        "Соблюдение принципов равенства и разнообразия.",
        "Мирное разрешение конфликтов.",
        "Помощь и поддержка новых сотрудников.",
      ],
    },
  ],
  en: [
    {
      icon: "Clock",
      title: "Time discipline",
      description:
        "The workday follows a fixed schedule. Lateness or absence must be coordinated in advance with the manager and HR.",
      examples: [
        "Be at your desk 5 minutes before start.",
        "Notify delays or illness before 8:30 AM.",
        "Breaks and lunch stay within the schedule.",
      ],
    },
    {
      icon: "Shirt",
      title: "Dress code",
      description:
        "Business style is recommended. Cleanliness and neatness are mandatory; the company provides branded items.",
      examples: [
        "Business-casual as the base standard.",
        "More formal attire for client meetings.",
        "Logo items provided by the company.",
      ],
    },
    {
      icon: "Lock",
      title: "Confidentiality",
      description:
        "Internal data, client base, and financials are never shared with third parties. Every employee signs an NDA.",
      examples: [
        "Never write passwords on paper.",
        "Never upload internal docs to personal clouds.",
        "Confidentiality continues after leaving.",
      ],
    },
    {
      icon: "MessagesSquare",
      title: "Internal communication",
      description:
        "All communication goes through corporate channels: Telegram, e-mail, work system. Personal phones are not for decisions.",
      examples: [
        "Tasks are only assigned in the work system.",
        "Client contacts are corporate only.",
        "Be respectful and precise in group chats.",
      ],
    },
    {
      icon: "FileCheck",
      title: "Reporting",
      description:
        "Every employee provides daily and weekly reports covering results, delays, and next steps.",
      examples: [
        "Daily report at the end of the day.",
        "Update tasks immediately when changed.",
        "Warn about possible overdue items in advance.",
      ],
    },
    {
      icon: "HandHeart",
      title: "Team respect",
      description:
        "Respectful attitude to colleagues and managers is mandatory. Discrimination, insults, and bullying are not tolerated.",
      examples: [
        "Follow equality and diversity principles.",
        "Resolve conflicts peacefully.",
        "Help and support new employees.",
      ],
    },
  ],
};

export type UiStrings = {
  nav_home: string;
  nav_onboarding: string;
  nav_structure: string;
  nav_discipline: string;
  nav_guides: string;
  nav_contact: string;
  hero_eyebrow: string;
  hero_title_1: string;
  hero_title_2: string;
  hero_subtitle: string;
  hero_cta_start: string;
  hero_cta_explore: string;
  stats_employees: string;
  stats_departments: string;
  stats_years: string;
  stats_onboarding_steps: string;
  hero_showcase_title: string;
  hero_showcase_subtitle: string;
  hero_showcase_live: string;
  hero_showcase_progress: string;
  hero_showcase_new_hire: string;
  hero_showcase_team: string;
  hero_showcase_step_welcome: string;
  hero_showcase_step_history: string;
  hero_showcase_step_about: string;
  hero_showcase_step_structure: string;
  hero_showcase_step_leadership: string;
  hero_showcase_step_timeline: string;
  hero_showcase_step_rules: string;
  onboarding_eyebrow: string;
  onboarding_title: string;
  onboarding_subtitle: string;
  onboarding_step_label: string;
  onboarding_of: string;
  onboarding_next: string;
  onboarding_prev: string;
  onboarding_finish: string;
  onboarding_key_points: string;
  structure_eyebrow: string;
  structure_title: string;
  structure_subtitle: string;
  structure_total: string;
  structure_members: string;
  discipline_eyebrow: string;
  discipline_title: string;
  discipline_subtitle: string;
  discipline_examples: string;
  footer_tagline: string;
  footer_company: string;
  footer_rights: string;
  footer_address: string;
  footer_contact_category: string;
  footer_contact_blurb: string;
};

export const UI_STRINGS: Record<Locale, UiStrings> = {
  uz: {
    nav_home: "Bosh sahifa",
    nav_onboarding: "Tanishtirish",
    nav_structure: "Tuzilma",
    nav_discipline: "Intizom",
    nav_guides: "Bitrix24",
    nav_contact: "Bog'lanish",
    hero_eyebrow: "«AKELA GROUP MACHINERY» — Yangi xodim adaptatsiya portali",
    hero_title_1: "AKELA GROUPga",
    hero_title_2: "xush kelibsiz",
    hero_subtitle:
      "2004 yildan beri sanoat uskunalarini yetkazib berish va servis xizmati ko'rsatish sohasida faoliyat yurituvchi «AKELA GROUP MACHINERY» MChJ oilasiga qo'shilayotganingiz bilan tabriklaymiz. Bu portal sizga kompaniya tarixi, tuzilmasi, qoidalari va yangi xodim moslashuvi haqida qisqa vaqt ichida to'liq ma'lumot beradi.",
    hero_cta_start: "Tanishtirishni boshlash",
    hero_cta_explore: "Tuzilmani ko'rish",
    stats_employees: "Xodimlar",
    stats_departments: "Bo'limlar",
    stats_years: "Yillik tajriba",
    stats_onboarding_steps: "Qadamlar",
    hero_showcase_title: "Tanishtirish xaritasi",
    hero_showcase_subtitle: "7 qadamlik sayohat",
    hero_showcase_live: "Jonli",
    hero_showcase_progress: "Jarayon",
    hero_showcase_new_hire: "Yangi xodim\ntayyor",
    hero_showcase_team: "Jamoa\nkutmoqda",
    hero_showcase_step_welcome: "Xush kelibsiz",
    hero_showcase_step_history: "Tarix",
    hero_showcase_step_about: "Faoliyat",
    hero_showcase_step_structure: "Tuzilma",
    hero_showcase_step_leadership: "Rahbariyat",
    hero_showcase_step_timeline: "Chiziqlar",
    hero_showcase_step_rules: "Qoidalar",
    onboarding_eyebrow: "7 qadamlik yo'l",
    onboarding_title: "Yangi xodim tanishtirish",
    onboarding_subtitle:
      "Quyidagi 7 qadam tartib bilan o'ting. Har bir qadamda AKELA GROUP MACHINERY kompaniyasi tarixi, qadriyatlari, tuzilmasi, bo'limlari va axloq qoidalari haqida muhim ma'lumotlar jamlangan.",
    onboarding_step_label: "Qadam",
    onboarding_of: "/",
    onboarding_next: "Keyingisi",
    onboarding_prev: "Oldingi",
    onboarding_finish: "Yakunlash",
    onboarding_key_points: "Asosiy nuqtalar",
    structure_eyebrow: "Tashkilot tuzilmasi",
    structure_title: "Bo'limlar va jamoa",
    structure_subtitle:
      "«AKELA GROUP MACHINERY» 21 bo'lim va 63 xodimdan iborat. Bosh direktor Kadirov Akbar Abdumanapovich rahbarligida HR, Buxgalteriya, Savdo, Xarid, Marketing, Texnik xizmat, Logistika, Ombor, IT va Ofis bo'limlari birgalikda ishlaydi.",
    structure_total: "Jami",
    structure_members: "a'zo",
    discipline_eyebrow: "Ish intizomi va qoidalar",
    discipline_title: "Bizning qoidalarimiz",
    discipline_subtitle:
      "Quyidagi oltita asosiy intizom sohasi barcha xodimlar uchun majburiy: ish vaqti, kiyinish, maxfiylik, muloqot, hisobot va jamoa hurmati. Har birining buzilishi intizomiy va moliyaviy choralarga sabab bo'lishi mumkin.",
    discipline_examples: "Amaliy namunalar",
    footer_tagline:
      "Yangi xodimlar uchun interaktiv adaptatsiya portali.",
    footer_company: "AKELA GROUP MACHINERY",
    footer_rights: "Barcha huquqlar himoyalangan.",
    footer_address: "Tarixt e shar ko'chasi, 3-bino, Zangiatin tumani, Toshkent viloyati, O'zbekiston",
    footer_contact_category: "HR bo'limi",
    footer_contact_blurb:
      "Yangi e'lonlar va yangilanishlardan xabar topishingiz uchun emailingizni kiriting.",
  },
  ru: {
    nav_home: "Главная",
    nav_onboarding: "Знакомство",
    nav_structure: "Структура",
    nav_discipline: "Дисциплина",
    nav_guides: "Bitrix24",
    nav_contact: "Контакты",
    hero_eyebrow: "Портал адаптации новых сотрудников",
    hero_title_1: "Добро пожаловать в",
    hero_title_2: "AKELA GROUP",
    hero_subtitle:
      "Этот портал поможет вам за короткое время изучить компанию, её структуру и правила работы. Liquid glass дизайн и интерактивные шаги.",
    hero_cta_start: "Начать знакомство",
    hero_cta_explore: "Посмотреть структуру",
    stats_employees: "Сотрудников",
    stats_departments: "Отделов",
    stats_years: "Лет опыта",
    stats_onboarding_steps: "Шаги",
    hero_showcase_title: "Карта адаптации",
    hero_showcase_subtitle: "Путешествие из 7 шагов",
    hero_showcase_live: "Эфир",
    hero_showcase_progress: "Прогресс",
    hero_showcase_new_hire: "Новичок\nготов",
    hero_showcase_team: "Команда\nждет",
    hero_showcase_step_welcome: "Приветствие",
    hero_showcase_step_history: "История",
    hero_showcase_step_about: "О компании",
    hero_showcase_step_structure: "Структура",
    hero_showcase_step_leadership: "Руководство",
    hero_showcase_step_timeline: "Вехи",
    hero_showcase_step_rules: "Правила",
    onboarding_eyebrow: "Путь из 7 шагов",
    onboarding_title: "Знакомство нового сотрудника",
    onboarding_subtitle:
      "Пройдите шаги по порядку. На каждом — важная информация о компании.",
    onboarding_step_label: "Шаг",
    onboarding_of: "/",
    onboarding_next: "Далее",
    onboarding_prev: "Назад",
    onboarding_finish: "Завершить",
    onboarding_key_points: "Ключевые моменты",
    structure_eyebrow: "Структура организации",
    structure_title: "Отделы и команда",
    structure_subtitle:
      "AKELA GROUP — это 21 отдел и более 60 сотрудников. Ниже представлены отделы и их участники.",
    structure_total: "Всего",
    structure_members: "участников",
    discipline_eyebrow: "Дисциплина и правила",
    discipline_title: "Наши правила",
    discipline_subtitle:
      "Шесть основных областей дисциплины обязательны для всех сотрудников.",
    discipline_examples: "Практические примеры",
    footer_tagline:
      "Интерактивный портал адаптации новых сотрудников.",
    footer_company: "AKELA GROUP",
    footer_rights: "Все права защищены.",
    footer_address: "Здание 3, улица Тарихтешар, район Зангиатин, Ташкентская область, Узбекистан",
    footer_contact_category: "Отдел HR",
    footer_contact_blurb:
      "Введите адрес электронной почты, чтобы получать новые объявления и обновления.",
  },
  en: {
    nav_home: "Home",
    nav_onboarding: "Onboarding",
    nav_structure: "Structure",
    nav_discipline: "Discipline",
    nav_guides: "Bitrix24",
    nav_contact: "Contact",
    hero_eyebrow: "New employee onboarding portal",
    hero_title_1: "Welcome to",
    hero_title_2: "AKELA GROUP",
    hero_subtitle:
      "This portal helps you learn the company, structure and rules in a short time. Liquid glass design with interactive steps.",
    hero_cta_start: "Start onboarding",
    hero_cta_explore: "Explore structure",
    stats_employees: "Employees",
    stats_departments: "Departments",
    stats_years: "Years of experience",
    stats_onboarding_steps: "Steps",
    hero_showcase_title: "Onboarding Map",
    hero_showcase_subtitle: "7-step journey",
    hero_showcase_live: "Live",
    hero_showcase_progress: "Progress",
    hero_showcase_new_hire: "New hire\nready",
    hero_showcase_team: "Team\nwaiting",
    hero_showcase_step_welcome: "Welcome",
    hero_showcase_step_history: "History",
    hero_showcase_step_about: "About",
    hero_showcase_step_structure: "Structure",
    hero_showcase_step_leadership: "Leadership",
    hero_showcase_step_timeline: "Milestones",
    hero_showcase_step_rules: "Rules",
    onboarding_eyebrow: "7-step journey",
    onboarding_title: "New employee onboarding",
    onboarding_subtitle:
      "Complete the steps in order. Each contains essential information about the company.",
    onboarding_step_label: "Step",
    onboarding_of: "/",
    onboarding_next: "Next",
    onboarding_prev: "Previous",
    onboarding_finish: "Finish",
    onboarding_key_points: "Key points",
    structure_eyebrow: "Organization structure",
    structure_title: "Departments and team",
    structure_subtitle:
      "AKELA GROUP has 21 departments and 60+ employees. Each department and its members are listed below.",
    structure_total: "Total",
    structure_members: "members",
    discipline_eyebrow: "Work discipline and rules",
    discipline_title: "Our rules",
    discipline_subtitle:
      "Six core discipline areas are mandatory for every employee.",
    discipline_examples: "Practical examples",
    footer_tagline:
      "Interactive onboarding portal for new employees.",
    footer_company: "AKELA GROUP",
    footer_rights: "All rights reserved.",
    footer_address: "Building 3, Tarixteshar Street, Zangiata District, Tashkent Region, Uzbekistan",
    footer_contact_category: "HR Department",
    footer_contact_blurb:
      "Enter your email to receive new announcements and updates.",
  },
};
