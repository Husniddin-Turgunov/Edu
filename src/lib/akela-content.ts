/**
 * AKELA GROUP onboarding kontenti —
 * manba: upload qilingan akela-assess loyihasidagi i18n lug'ati (uz/ru/en).
 * Bu yerda faqat yangi xodim tanishtirish uchun kerakli qismlar tartibga solingan.
 */

export type Locale = "uz" | "ru" | "en";

export type OnboardingStep = {
  id: "welcome" | "history" | "about" | "structure" | "rules";
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
      title: "AKELA GROUPga xush kelibsiz",
      body: "Ishni boshlashdan oldin kompaniya, uning tuzilmasi va qoidalari bilan tanishing. Bu besh qadamlik yo'l sizga jamoaga tezroq moslashishga yordam beradi.",
      points: [
        "Barcha besh qadamni tartib bilan o'ting.",
        "Yakunlangandan keyin materiallar bosh sahifada qoladi.",
        "Keyin o'qish, testlar va kunlik hisobotlar ochiladi.",
      ],
      accentFrom: "from-emerald-500/30",
      accentTo: "to-amber-300/20",
    },
    {
      id: "history",
      index: 1,
      icon: "BookOpen",
      title: "Kompaniya tarixi",
      body: "AKELA GROUP ish, ta'lim va natija uchun javobgarlik standartlarini rivojlantiruvchi kompaniya. Biz bir necha yo'nalishlarda faol bo'lib, jamoani doimiy o'sishga olib boramiz.",
      points: [
        "Kompaniya yo'nalishlar va professional jamoalarni rivojlantirish orqali o'sdi.",
        "Tajriba jarayonlar, yo'riqnomalar va o'quv materiallarida saqlanadi.",
        "Har bir yangi xodim yagona moslashuv yo'lidan o'tadi.",
      ],
      accentFrom: "from-amber-400/30",
      accentTo: "to-emerald-500/20",
    },
    {
      id: "about",
      index: 2,
      icon: "Building2",
      title: "Kompaniya nima bilan shug'ullanadi",
      body: "AKELA GROUP bo'limlari qiymat yaratish va kompaniya ishini qo'llab-quvvatlash uchun birga ishlaydi. Har bir bo'lim o'z professional yo'nalishiga mas'ul.",
      points: [
        "Har bir bo'lim o'z professional yo'nalishi uchun javob beradi.",
        "Natija sifat, muddat va tushunarli muloqotga asoslanadi.",
        "Xodimlar umumiy vositalar va hamkorlik standartlaridan foydalanadi.",
      ],
      accentFrom: "from-teal-500/30",
      accentTo: "to-amber-300/20",
    },
    {
      id: "structure",
      index: 3,
      icon: "Network",
      title: "Kompaniya tuzilmasi",
      body: "Tuzilma kim qaysi yo'nalish uchun javob berishini va ish masalalari bo'yicha kimga murojaat qilishni ko'rsatadi. Pastda bo'limlar va ularning rahbarlari keltirilgan.",
      points: [
        "Rahbarlar maqsadlarni belgilaydi va asosiy qarorlarni qabul qiladi.",
        "Bo'limlar alohida ish yo'nalishlari uchun javob beradi.",
        "Har bir xodimning lavozimi, rahbari va mas'uliyat sohasi bor.",
      ],
      accentFrom: "from-emerald-600/30",
      accentTo: "to-amber-400/20",
    },
    {
      id: "rules",
      index: 4,
      icon: "ShieldCheck",
      title: "Kompaniyada ishlash qoidalari",
      body: "Umumiy qoidalar jamoaga xavfsiz, oldindan aytib bo'ladigan va samarali ishlashga yordam beradi. Bu qoidalar barcha xodimlar uchun majburiy hisoblanadi.",
      points: [
        "O'z vaqtida keling va o'zgarishlar haqida oldindan xabar bering.",
        "Vazifa va muddatlarni ish tizimlarida yuriting.",
        "Maxfiylik va axborot xavfsizligi qoidalariga rioya qiling.",
        "Vazifa tushunarsiz bo'lsa, darhol mentorga murojaat qiling.",
      ],
      accentFrom: "from-amber-500/30",
      accentTo: "to-emerald-600/20",
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
        "Пройдите все пять вводных шагов по порядку.",
        "После завершения материалы останутся на главной странице.",
        "Дальше откроются обучение, тесты и ежедневные отчёты стажёра.",
      ],
      accentFrom: "from-emerald-500/30",
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
      accentTo: "to-emerald-500/20",
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
        "У каждого сотрудника есть должность, руководитель и зона ответственности.",
      ],
      accentFrom: "from-emerald-600/30",
      accentTo: "to-amber-400/20",
    },
    {
      id: "rules",
      index: 4,
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
      accentTo: "to-emerald-600/20",
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
        "Complete all five orientation steps in order.",
        "After completion, these materials remain available on your home page.",
        "Learning, tests, and intern daily reports become your next steps.",
      ],
      accentFrom: "from-emerald-500/30",
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
      accentTo: "to-emerald-500/20",
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
      accentFrom: "from-emerald-600/30",
      accentTo: "to-amber-400/20",
    },
    {
      id: "rules",
      index: 4,
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
      accentTo: "to-emerald-600/20",
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
      title: "Vaqt intizomi",
      description:
        "Ish kuni belgilangan grafik asosida tashkil etiladi. Ishga kech qolish yoki ish joyida bo'lmaslik oldindan kelishilgan holda rahbar va HR ga xabar qilinishi shart.",
      examples: [
        "Ish boshlanishidan 5 daqiqa oldin ish joyida bo'lish.",
        "Kechikish yoki kasallik haqida ertalab soat 8:30 gacha xabar berish.",
        "Tushlik va tanaffuslar grafikdan chetga chiqmasligi.",
      ],
    },
    {
      icon: " Shirt",
      title: "Tashqi ko'rinish va kiyim",
      description:
        "AKELA GROUP xodimlari biznes-uslubda kiyinishi tavsiya etiladi. Kiyim toza, NEAT va kompaniya obro'siga mos bo'lishi kerak.",
      examples: [
        "Biznes-casual uslub asosiy standart.",
        "Mijozlar bilan uchrashuvlarda rasmiyroq kiyim.",
        "Tijoriy logotipli elementlar kompaniya tomonidan taqdim etiladi.",
      ],
    },
    {
      icon: "Lock",
      title: "Maxfiylik va axborot xavfsizligi",
      description:
        "Kompaniyaning ichki ma'lumotlari, mijozlar bazasi va moliyaviy ko'rsatkichlar uchinchi shaxslarga berilmaydi. Xodim kompaniya bilan maxfiylik shartnomasini imzolaydi.",
      examples: [
        "Parollarni qog'ozga yozib qo'ymaslik.",
        "Ichki hujjatlarni shaxsiy bulutga yuklamaslik.",
        "Ishdan bo'shashdan keyin ham maxfiylik saqlanadi.",
      ],
    },
    {
      icon: "MessagesSquare",
      title: "Ichki muloqot",
      description:
        "Barcha ichki muloqotlar rasmiy kanallar orqali yuritiladi: korporativ Telegram, e-mail va ish tizimi. Shaxsiy telefonlar orqali muhim qarorlar qabul qilinmaydi.",
      examples: [
        "Vazifalar faqat ish tizimida belgilanadi.",
        "Mijozlar bilan aloqa faqat korporativ kontaktlardan.",
        "Jamoaviy chatlarda hurmatli va aniq yozish.",
      ],
    },
    {
      icon: "FileCheck",
      title: "Hisobot va natija",
      description:
        "Har bir xodim kunlik va haftalik hisobot beradi. Hisobot natijani, kechikish sabablarini va keyingi qadamlarni aniq ko'rsatishi kerak.",
      examples: [
        "Kunlik hisobot ish kuni oxirida topshiriladi.",
        "Vazifa o'zgartirilganda darhol tizimga kiritiladi.",
        "Muddat o'tib ketishining oldini olish uchun oldindan ogohlantirish.",
      ],
    },
    {
      icon: "HandHeart",
      title: "Jamoaviy hurmat",
      description:
        "Hamkasblar va rahbarlarga nisbatan hurmatli munosabat majburiy. Hech qanday shaklda kamsitish, haqorat yoki bullyingga yo'l qo'yilmaydi.",
      examples: [
        "Tenglik va xilma-xillik prinsipiga rioya qilish.",
        "Konfliktlarni tinch yo'l bilan hal qilish.",
        "Yangi xodimlarga yordam berish va qo'llab-quvvatlash.",
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
        "Каждый сотрудник предоставляет дневной и недельный отчёт с результатами, причинами задержек и следующими шагами.",
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
};

export const UI_STRINGS: Record<Locale, UiStrings> = {
  uz: {
    nav_home: "Bosh sahifa",
    nav_onboarding: "Tanishtirish",
    nav_structure: "Tuzilma",
    nav_discipline: "Intizom",
    nav_contact: "Bog'lanish",
    hero_eyebrow: "Yangi xodimlar uchun adaptatsiya portali",
    hero_title_1: "AKELA GROUPga",
    hero_title_2: "xush kelibsiz",
    hero_subtitle:
      "Bu portal sizga kompaniya, uning tuzilmasi va ish qoidalarini qisqa vaqt ichida o'rganishga yordam beradi. Liquid glass dizayn va interaktiv qadamlar orqali tanishtirishga tayyor bo'ling.",
    hero_cta_start: "Tanishtirishni boshlash",
    hero_cta_explore: "Tuzilmani ko'rish",
    stats_employees: "Xodimlar",
    stats_departments: "Bo'limlar",
    stats_years: "Yillik tajriba",
    stats_onboarding_steps: "Tanishtirish qadamlari",
    onboarding_eyebrow: "5 qadamlik yo'l",
    onboarding_title: "Yangi xodim tanishtirish",
    onboarding_subtitle:
      "Quyidagi qadamlarni tartib bilan o'ting. Har bir qadamda kompaniya haqida muhim ma'lumotlar jamlangan.",
    onboarding_step_label: "Qadam",
    onboarding_of: "/",
    onboarding_next: "Keyingisi",
    onboarding_prev: "Oldingi",
    onboarding_finish: "Yakunlash",
    onboarding_key_points: "Asosiy nuqtalar",
    structure_eyebrow: "Tashkilot tuzilmasi",
    structure_title: "Bo'limlar va jamoa",
    structure_subtitle:
      "AKELA GROUP 21 bo'lim va 60+ xodimdan iborat. Quyida har bir bo'lim va uning a'zolari keltirilgan.",
    structure_total: "Jami",
    structure_members: "a'zo",
    discipline_eyebrow: "Ish intizomi va qoidalar",
    discipline_title: "Bizning qoidalarimiz",
    discipline_subtitle:
      "Quyidagi oltita asosiy intizom sohasi barcha xodimlar uchun majburiy hisoblanadi.",
    discipline_examples: "Amaliy namunalar",
    footer_tagline:
      "Yangi xodimlar uchun interaktiv adaptatsiya portali.",
    footer_company: "AKELA GROUP",
    footer_rights: "Barcha huquqlar himoyalangan.",
    footer_address: "Toshkent, O'zbekiston",
  },
  ru: {
    nav_home: "Главная",
    nav_onboarding: "Знакомство",
    nav_structure: "Структура",
    nav_discipline: "Дисциплина",
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
    stats_onboarding_steps: "Шагов знакомства",
    onboarding_eyebrow: "Путь из 5 шагов",
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
    footer_address: "Ташкент, Узбекистан",
  },
  en: {
    nav_home: "Home",
    nav_onboarding: "Onboarding",
    nav_structure: "Structure",
    nav_discipline: "Discipline",
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
    stats_onboarding_steps: "Onboarding steps",
    onboarding_eyebrow: "5-step journey",
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
    footer_address: "Tashkent, Uzbekistan",
  },
};
