/**
 * Bitrix24 helpdesk maqolalari — sayt ichidagi to'liq kontent (uz/ru/en).
 * Tashqi helpdesk havolasi ko'pinchan 404 va faqat ruscha bo'lgani uchun
 * kontent shu yerda saqlanadi; havolalar /guides/[id] ga yo'naltiriladi.
 */

import type { Locale } from "@/lib/akela-content";

export type L = Record<Locale, string>;
export type LList = Record<Locale, string[]>;

export type HelpdeskBodySection = {
  title: L;
  text?: L;
  steps?: LList;
  /** Bitrix helpdesk ushbu bo'lim uchun screenshotlar. */
  image?: string;
  imageAlt?: L;
};

export type HelpdeskBody = {
  intro: L;
  sections: HelpdeskBodySection[];
  tip?: L;
  /** Maqola boshidagi yoki oraliq Bitrix rasmlari. */
  images?: string[];
};

const EMPTY: HelpdeskBody = {
  intro: { uz: "", ru: "", en: "" },
  sections: [],
};

/** id → to'liq kontent. Keyinroq bo'limlar bilan to'ldiriladi. */
export const HELPDESK_BODIES: Record<string, HelpdeskBody> = {
  // ===== Boshlash =====
  "161724": {
    intro: {
      uz: "Bitrix24 — jamoa uchun bitta maydon: vazifalar, CRM, hujjatlar va muloqot. Quyida birinchi qadamlar: portalga kirish, asosiy sozlamalarni o'tkazish va hamkasblarni taklif qilish.",
      ru: "Битрикс24 — единое рабочее пространство для команды: задачи, CRM, документы и общение. Ниже первые шаги: вход на портал, базовые настройки и приглашение коллег.",
      en: "Bitrix24 is one workspace for your team: tasks, CRM, files and chat. Below are the first steps: portal login, basic setup and inviting colleagues.",
    },
    sections: [
      {
        title: { uz: "1. Portalga kirish", ru: "1. Вход на портал", en: "1. Log in to the portal" },
        text: {
          uz: "Kompaniya administratori sizga pochta orqali taklif yuboradi. Havola orqali o'tib, parol o'rnatib, profilingizni to'ldiring (ism, lavozim, telefon).",
          ru: "Администратор пришлёт приглашение на почту. Перейдите по ссылке, задайте пароль и заполните профиль (имя, должность, телефон).",
          en: "An admin sends an email invite. Open the link, set a password and complete your profile (name, role, phone).",
        },
        steps: {
          uz: [
            "Taklif havolasini oching (yoki portal URL manziliga kiring).",
            "Parol yarating va profilingizni to'ldiring.",
            "Birinchi chiqish — bildirishnomalarni va chatni tekshiring.",
          ],
          ru: [
            "Откройте ссылку-приглашение (или URL портала).",
            "Создайте пароль и заполните профиль.",
            "Проверьте уведомления и чат после первого входа.",
          ],
          en: [
            "Open the invite link (or the portal URL).",
            "Create a password and fill in your profile.",
            "After first login, check notifications and chat.",
          ],
        },
      },
      {
        title: { uz: "2. Birinchi sozlamalar", ru: "2. Первые настройки", en: "2. First settings" },
        text: {
          uz: "O'zingiz uchun tilni, vaqt mintaqasini va bildirishnoma uslubini sozlang. Administrator bo'lsangiz — bo'limlarni yarating, ruxsatlarni bering va kerakli modullarni yoqing (Vazifalar, CRM, Disk).",
          ru: "Настройте язык, часовой пояс и уведомления. Если вы администратор — создайте отделы, выдайте права и включите нужные модули (Задачи, CRM, Диск).",
          en: "Set language, time zone and notification preferences. If you are an admin — create departments, assign permissions and enable modules (Tasks, CRM, Drive).",
        },
      },
      {
        title: { uz: "3. Jamoani taklif qilish", ru: "3. Приглашение команды", en: "3. Invite the team" },
        steps: {
          uz: [
            "Sozlamalar → Ma'lumotnoma yoki Foydalanuvchilar bo'limiga o'ting.",
            "\"Yangi foydalanuvchi\" ni bosing, email/telefon kiriting.",
            "Rol va bo'limni tanlang, taklif yuboring.",
            "Jamoani Departamentlar bo'yicha tartiblang — keyinchalik vazifalar va CRM shu bo'limlarga bog'lanadi.",
          ],
          ru: [
            "Откройте Справочник или Пользователи в настройках.",
            "Нажмите «Новый пользователь», укажите email/телефон.",
            "Выберите роль и отдел, отправьте приглашение.",
            "Разложите команду по отделам — задачи и CRM будут привязаны к ним.",
          ],
          en: [
            "Open Directory or Users in settings.",
            "Click New user and enter email/phone.",
            "Pick a role and department, send the invite.",
            "Structure the team by department — tasks and CRM will follow that structure.",
          ],
        },
      },
    ],
    tip: {
      uz: "Maslahat: birinchi kunda faqat profil, til va bildirishnomalarni sozlang — qolganini modullar bo'yicha bosqichma-bosqich o'rganing.",
      ru: "Совет: в первый день настройте только профиль, язык и уведомления — остальное осваивайте по модулям постепенно.",
      en: "Tip: on day one, only set up profile, language and notifications — learn the rest module by module.",
    },
  },
  "20922462": {
    intro: {
      uz: "Katalog — CRM va internet-do'kon uchun yagona mahsulot bazasi: bo'limlar, xususiyatlar va narx. Quyida katalogni yaratish va sozlash tartibi.",
      ru: "Каталог — единая база товаров для CRM и интернет-магазина: разделы, свойства и цены. Ниже порядок создания и настройки каталога.",
      en: "A catalog is a single product base for CRM and the online store: sections, properties and prices. Here is how to create and configure it.",
    },
    sections: [
      {
        title: { uz: "Katalogni yoqish", ru: "Включение каталога", en: "Enable the catalog" },
        steps: {
          uz: [
            "CRM → Katalog (yoki Internet-do'kon → Katalog) bo'limiga o'ting.",
            "Katalogni yoqing — bo'lim daraxti paydo bo'ladi.",
            "Asosiy bo'limlarni yarating (masalan: Uskunalar, Ehtiyot qismlar, Xizmatlar).",
          ],
          ru: [
            "Откройте CRM → Каталог (или Интернет-магазин → Кatalog).",
            "Включите каталог — появится дерево разделов.",
            "Создайте корневые разделы (например: Оборудование, Запчасти, Услуги).",
          ],
          en: [
            "Open CRM → Catalog (or Online store → Catalog).",
            "Turn the catalog on — a section tree appears.",
            "Create top-level sections (e.g. Equipment, Spare parts, Services).",
          ],
        },
      },
      {
        title: { uz: "Mahsulot va xususiyatlar", ru: "Товар и свойства", en: "Product and properties" },
        text: {
          uz: "Har bir mahsulotga nom, artikul, narx va kerakli xususiyatlar (o'lcham, rang, model) qo'shing. Xususiyatlarni bo'limlar bo'yicha saqlang — keyinchalik filtr va SEO uchun ishlatiladi.",
          ru: "Для каждого товара укажите название, артикул, цену и свойства (размер, цвет, модель). Сохраняйте свойства по разделам — они пригодятся для фильтров и SEO.",
          en: "For each product add name, SKU, price and properties (size, color, model). Keep properties per section — they power filters and SEO.",
        },
      },
      {
        title: { uz: "Internet-do'konga ulash", ru: "Привязка к интернет-магазину", en: "Connect to the online store" },
        text: {
          uz: "Katalog tayyor bo'lgach, sayt konstruktorida \"Mahsulotlar\" blokini qo'shing yoki CRM savdo sahifasidan to'g'ridan-to'g'ri tanlang. Ombor bilan integratsiya yoqilsa, qoldiq avtomatik ko'rinadi.",
          ru: "Готовый каталог подключите блоком «Товары» в конструкторе сайта или выбирайте прямо из карточки сделки в CRM. При включённой интеграции со складом остатки подтягиваются автоматически.",
          en: "When ready, add a Products block in the site builder or pick items from a CRM deal card. With warehouse integration on, stock levels sync automatically.",
        },
      },
    ],
    tip: {
      uz: "Avval bo'lim tuzilishini planlang, keyin mahsulotlarni to'ldiring — keyinchalik qayta tashkillashtirish qiyin.",
      ru: "Сначала спланируйте структуру разделов, потом наполняйте товары — перестраивать потом сложнее.",
      en: "Plan the section tree first, then fill products — restructuring later is harder.",
    },
  },
  "148408": {
    intro: {
      uz: "Bitrix24 yordam markazi — rasmiy maqolalar, chat va integrator yordami. Muammo yuzaga kelsa, quyidagi tartibda murojaat qiling.",
      ru: "Центр помощи Битрикс24 — официальные статьи, чат и поддержка интегратора. При проблеме обращайтесь в следующем порядке.",
      en: "Bitrix24 help center — official articles, chat and integrator support. Follow this order when you hit a problem.",
    },
    sections: [
      {
        title: { uz: "Qidiruv va maqolalar", ru: "Поиск и статьи", en: "Search and articles" },
        text: {
          uz: "helpdesk.bitrix24.ru (yoki portal ichidagi \"Yordam\") ustida kalit so'z bilan qidiring. Aksariyat savollar tayyor maqolalarda javob beradi.",
          ru: "Ищите по ключевому слову на helpdesk.bitrix24.ru (или «Помощь» в портале). Большинство вопросов уже разобраны в статьях.",
          en: "Search by keyword on helpdesk.bitrix24.ru (or Help inside the portal). Most questions are already covered.",
        },
      },
      {
        title: { uz: "Onlayn chat", ru: "Онлайн-чат", en: "Live chat" },
        text: {
          uz: "Portal bosh sahifasida chat oynasi ochiladi. Ish vaqti davomida operator javob beradi — screenshots va xato matnini tayyorlab qo'ying.",
          ru: "Окно чата открывается на главной странице портала. В рабочее время отвечает оператор — подготовьте скриншоты и текст ошибки.",
          en: "A chat window opens on the portal home page. An operator replies during business hours — have screenshots and error text ready.",
        },
      },
      {
        title: { uz: "Integrator va mahalliy yordam", ru: "Интегратор и локальная поддержка", en: "Integrator and local support" },
        text: {
          uz: "Portalni qo'shgan hamkasblingiz yoki tashqi integrator sozlamalarda yordam bera oladi. AKELA GROUP ichki savollari uchun IT bo'limiga murojaat qiling.",
          ru: "Настройки помогает скорректировать коллега, добавивший портал, или внешний интегратор. По внутренним вопросам AKELA GROUP обращайтесь в отдел IT.",
          en: "The colleague who set up the portal or an external integrator can help with configuration. For internal AKELA GROUP issues, contact the IT team.",
        },
      },
    ],
  },
  // ===== CRM =====
  "161866": {
    intro: {
      uz: "CRM da ish — lead, kontakt va savdo bilan ishlash. Quyida bazaviy oqim: lead yaratish → saralash → savdoga aylantirish → yopish.",
      ru: "Работа в CRM — лиды, контакты и сделки. Ниже базовый поток: создание лида → квалификация → конвертация в сделку → закрытие.",
      en: "CRM work — leads, contacts and deals. Below is the base flow: create lead → qualify → convert to deal → close.",
    },
    sections: [
      {
        title: { uz: "Voronka va bosqichlar", ru: "Воронка и этапы", en: "Pipeline and stages" },
        text: {
          uz: "Savdo voronkasini kompaniyangizga moslang (masalan: Yangi → Bog'lanish → Texnik hujjat → Kelishuv → Yopildi). Har bir bosqich uchun majburiy maydonlarni belgilang.",
          ru: "Настройте воронку под компанию (например: Новый → Контакт → Техдокументы → Согласование → Закрыто). Задайте обязательные поля для каждого этапа.",
          en: "Tailor the pipeline to your company (e.g. New → Contact → Tech docs → Agreement → Closed). Mark required fields per stage.",
        },
      },
      {
        title: { uz: "Kunlik ish tartibi", ru: "Дневной ритм работы", en: "Daily rhythm" },
        steps: {
          uz: [
            "Yangi leadlarni ertalab ko'rib chiqing va mas'ul belgilang.",
            "Har bir savdoga keyingi amal (qo'ng'iroq, yozishma, uchrashuv) qo'shing.",
            "Kun oxirida muzlatilgan savdolarni sababi bilan yangilang.",
          ],
          ru: [
            "Утром просматривайте новые лиды и назначайте ответственного.",
            "Для каждой сделки добавляйте следующее действие (звонок, письмо, встреча).",
            "В конце дня обновляйте «зависшие» сделки с причиной.",
          ],
          en: [
            "Review new leads each morning and assign owners.",
            "Add a next action to every deal (call, message, meeting).",
            "At day end, update stalled deals with a reason.",
          ],
        },
      },
    ],
    tip: {
      uz: "Bitta maydon to'ldirmaslik — savdo \"Yo'qoladi\"ning asosiy sababi. Har savdoda \"Keyingi qadam\" majburiy qiling.",
      ru: "Главная причина потери сделки — незаполненное поле. Сделайте «Следующий шаг» обязательным.",
      en: "The top deal-killer is an empty field. Make Next step required on every deal.",
    },
  },
  "47411": {
    intro: {
      uz: "Lead — kelajakdagi mijoz haqida birinchi ma'lumot. To'g'ri saralangan lead savdoga aylanadi; saralanmagan lead vaqt yo'qotadi.",
      ru: "Лид — первые данные о будущем клиенте. Хорошо квалифицированный лид превращается в сделку; неквалифицированный только тратит время.",
      en: "A lead is the first record of a future customer. Well-qualified leads become deals; unqualified ones waste time.",
    },
    sections: [
      {
        title: { uz: "Lead yaratish", ru: "Создание лида", en: "Create a lead" },
        steps: {
          uz: [
            "CRM → Leadlar → Yangi.",
            "Manba (sayt, qo'ng'iroq, tavsiya) va mas'ulni tanlang.",
            "Nom, telefon/email va qisqa izoh qoldiring.",
            "Avtomatik rag'batlantirish (robot) yoqilgan bo'lsa, birinchi xabar avtomat ketadi.",
          ],
          ru: [
            "CRM → Лиды → Создать.",
            "Укажите источник (сайт, звонок, рекомендация) и ответственного.",
            "Заполните имя, телефон/email и короткий комментарий.",
            "Если включён робот, первое сообщение уйдёт автоматически.",
          ],
          en: [
            "CRM → Leads → New.",
            "Set source (site, call, referral) and owner.",
            "Add name, phone/email and a short note.",
            "If a robot is on, the first message sends automatically.",
          ],
        },
      },
      {
        title: { uz: "Saralash (kvalifikatsiya)", ru: "Квалификация", en: "Qualification" },
        text: {
          uz: "BUDGET / Authority / Need / Timeline (BANT) bo'yicha tekshiring: byudjet bormi, qaror kimda, kerakmi, qachon kerak. Javob yo'q bo'lsa — leadni \"Rad etildi\" sababi bilan yoping.",
          ru: "Проверьте BANT: бюджет, лицо с решением, потребность, сроки. Если ответа нет — закройте лид с причиной «Отклонён».",
          en: "Check BANT: budget, decision maker, need, timeline. If answers are missing, close the lead as Rejected with a reason.",
        },
      },
      {
        title: { uz: "Savdoga aylantirish", ru: "Конверсия в сделку", en: "Convert to deal" },
        text: {
          uz: "Lead o'tgan bo'lsa, \"Savdoga aylantirish\" tugmasini bosing — kontakt, kompaniya va savdo bitta amalda yaratiladi. Voronka va bosqichni tanlang.",
          ru: "Когда лид готов, нажмите «Конвертировать в сделку» — контакт, компания и сделка создадутся одним действием. Выберите воронку и этап.",
          en: "When ready, click Convert to deal — contact, company and deal are created in one step. Choose pipeline and stage.",
        },
      },
    ],
  },
  "47598": {
    intro: {
      uz: "Savdo (Сделка) — mijoz bilan kelishuv. Har bir savdo voronkada bosqichdan bosqichga siljiydi va oxirida yopiladi (muvaffaqiyatli yoki yo'q).",
      ru: "Сделка — договорённость с клиентом. Сделка двигается по этапам воронки и завершается закрытием (успешно или нет).",
      en: "A deal is an agreement with a customer. It moves through pipeline stages and ends closed-won or closed-lost.",
    },
    sections: [
      {
        title: { uz: "Savdo yaratish va boshqarish", ru: "Создание и управление сделкой", en: "Create and manage a deal" },
        steps: {
          uz: [
            "CRM → Savdolar → Yangi yoki Leaddan konversiya.",
            "Nomi, summasini, voronkani va bosqichni kiriting.",
            "Muddat (close date) qo'ying — statistika shundan hisoblanadi.",
            "Har bosqichda keyingi amalni yozib qoldiring.",
          ],
          ru: [
            "CRM → Сделки → Создать или конвертировать из лида.",
            "Укажите название, сумму, воронку и этап.",
            "Задайте дату закрытия — от неё строится аналитика.",
            "На каждом этапе фиксируйте следующее действие.",
          ],
          en: [
            "CRM → Deals → New or convert from lead.",
            "Enter title, amount, pipeline and stage.",
            "Set a close date — analytics depend on it.",
            "Log the next action at every stage.",
          ],
        },
      },
      {
        title: { uz: "Yopish va sabablar", ru: "Закрытие и причины", en: "Close and reasons" },
        text: {
          uz: "\"Yopildi — ha\" yoki \"Yopildi — yo'q\" belgilang. Rad etish sababini tanlang (narx, muddat, raqobet) — keyinchalik analitikada ishlatiladi.",
          ru: "Отметьте «Закрыто — да» или «Закрыто — нет». Выберите причину отказа (цена, сроки, конкурент) — она пойдёт в аналитику.",
          en: "Mark Closed won or Closed lost. Pick a reason (price, timing, competitor) — it feeds analytics.",
        },
      },
    ],
  },
  "47596": {
    intro: {
      uz: "Kontaktlar — jismoniy shaxslar (mijoz, arizachi, hamkor). Kompaniyalar alohida kartada saqlanadi; ikkalasi savdoga biriktiriladi.",
      ru: "Контакты — физлица (клиент, кандидат, партнёр). Компании хранятся отдельно; обе сущности привязываются к сделкам.",
      en: "Contacts are people (customer, applicant, partner). Companies live in their own cards; both attach to deals.",
    },
    sections: [
      {
        title: { uz: "Kontakt qo'shish va qidirish", ru: "Добавление и поиск контактов", en: "Add and find contacts" },
        steps: {
          uz: [
            "CRM → Kontaktlar → Yangi (yoki lead/savdo ichidan).",
            "Ism, telefon, email — kamida bitta aloqa maydoni to'ldirilsin.",
            "Dublikatni tekshirun: qidiruv maydoniga ism yoki telefon kiriting.",
            "Bo'lim va mas'ulni belgilang.",
          ],
          ru: [
            "CRM → Контакты → Создать (или из лида/сделки).",
            "Имя, телефон, email — заполните хотя бы один канал связи.",
            "Проверьте дубли: введите имя или телефон в поиск.",
            "Укажите отдел и ответственного.",
          ],
          en: [
            "CRM → Contacts → New (or from a lead/deal).",
            "Name, phone, email — fill at least one channel.",
            "Check duplicates via search on name or phone.",
            "Set department and owner.",
          ],
        },
      },
    ],
    tip: {
      uz: "Dublikat kontaktlar statistikani buzadi. Qo'shishdan oldin doim qidiring.",
      ru: "Дубли искажают статистику. Всегда ищите перед созданием.",
      en: "Duplicates skew stats. Always search before creating.",
    },
  },
  "47599": {
    intro: {
      uz: "Hisob-faktura — mijozga to'lov hujjati. CRM ichida yaratiladi, PDF sifatida yuboriladi va savdoga bog'lanadi.",
      ru: "Счёт — платёжный документ клиенту. Создаётся в CRM, отправляется в PDF и привязывается к сделке.",
      en: "An invoice is a payment document for the customer. It is created in CRM, sent as PDF and linked to the deal.",
    },
    sections: [
      {
        title: { uz: "Hisob yaratish", ru: "Создание счёта", en: "Create an invoice" },
        steps: {
          uz: [
            "Savdo kartochkasidan yoki CRM → Hisoblar → Yangi.",
            "Mijoz, mahsulot/xizmat va summangni kiriting.",
            "Shartlar va muddatni ko'rsating.",
            "PDF ni yuklab oling yoki email orqali yuboring.",
          ],
          ru: [
            "Из карточки сделки или CRM → Счета → Создать.",
            "Укажите клиента, товар/услугу и суммы.",
            "Добавьте условия и срок оплаты.",
            "Скачайте PDF или отправьте на email.",
          ],
          en: [
            "From a deal card or CRM → Invoices → New.",
            "Enter customer, product/service and amounts.",
            "Add payment terms and due date.",
            "Download the PDF or email it.",
          ],
        },
      },
      {
        title: { uz: "Holatni kuzatish", ru: "Отслеживание статуса", en: "Track status" },
        text: {
          uz: "Hisob holati: yaratildi → yuborildi → to'landi. To'lov kelgach, holatni qo'lda yangilang yoki bank integratsiyasini ulang.",
          ru: "Статусы: создан → отправлен → оплачен. После оплаты обновите вручную или подключите банковскую интеграцию.",
          en: "Statuses: created → sent → paid. Update manually after payment or connect bank integration.",
        },
      },
    ],
  },
  // ===== Vazifalar =====
  "48933": {
    intro: {
      uz: "Vazifalar — Bitrix24 ning asosiy bajarish tizimi. Har bir ish aniq ijrochi va muddat bilan yaratiladi.",
      ru: "Задачи — основная система исполнения в Битрикс24. Каждая работа создаётся с ответственным и сроком.",
      en: "Tasks are Bitrix24’s core execution system. Every piece of work gets an assignee and a deadline.",
    },
    sections: [
      {
        title: { uz: "Vazifa yaratish", ru: "Создание задачи", en: "Create a task" },
        steps: {
          uz: [
            "\"+ Vazifa\" tugmasi (yoki Shift+K).",
            "Sarlavhani yozing — nima qilinishi aniq ko'rinsin.",
            "Ijrochi va muddatni belgilang.",
            "Kerak bo'lsa prilozhenie (fayl, shrift, havola) qo'shing.",
            "\"Boshlash\" yoki darhol \"Bajarishga topshirish\".",
          ],
          ru: [
            "Кнопка «+ Задача» (или Shift+K).",
            "Напишите заголовок — что именно сделать.",
            "Назначьте исполнителя и срок.",
            "При необходимости добавьте вложение (файл, ссылку).",
            "«Начать» или сразу «Отправить на выполнение».",
          ],
          en: [
            "Click + Task (or Shift+K).",
            "Write a clear title of what to do.",
            "Set assignee and deadline.",
            "Attach files or links if needed.",
            "Start it or send to work immediately.",
          ],
        },
      },
      {
        title: { uz: "Holatlar", ru: "Статусы", en: "Statuses" },
        text: {
          uz: "Yangi → Bajarilmoqda → Kutilmoqda → Bajarildi. \"Kutilmoqda\" — kimdadir javob kutayotganini bildiradi; muddat o'tsa, avtomat xabar ketadi.",
          ru: "Новая → В работе → Ожидает → Выполнена. «Ожидает» — ждём ответа; при просрочке уходит автоматическое уведомление.",
          en: "New → In progress → Waiting → Done. Waiting means blocked on someone; overdue tasks auto-notify.",
        },
      },
    ],
  },
  "48595": {
    intro: {
      uz: "Vazifa ichidagi vositalar: checklist, fayllar, timer, kommentariyalar va bog'liq vazifalar — hammasi bitta kartada.",
      ru: "Инструменты в задаче: чек-лист, файлы, таймер, комментарии и подзадачи — всё в одной карточке.",
      en: "Tools inside a task: checklist, files, timer, comments and subtasks — all on one card.",
    },
    sections: [
      {
        title: { uz: "Checklist", ru: "Чек-лист", en: "Checklist" },
        text: {
          uz: "Katta vazifani kichik qadamlarga bo'ling. Har bajarilgan band belgilanadi — progress ko'rinadi va topshirishda nima qolganini yo'qotmaysiz.",
          ru: "Разбейте большую задачу на шаги. Отмечайте готовое — виден прогресс и ничего не теряется при сдаче.",
          en: "Break big tasks into steps. Tick items as you go — progress is visible and nothing is forgotten at handoff.",
        },
      },
      {
        title: { uz: "Fayllar va kommentariyalar", ru: "Файлы и комментарии", en: "Files and comments" },
        text: {
          uz: "Hujjatlarni vazifaga yuklang (Disk yoki mahalliy). Muhokama chatda emas, vazifa ichida qoldiring — tarix saqlanadi.",
          ru: "Прикрепляйте документы к задаче (Диск или локально). Обсуждайте внутри задачи, а не в чате — история сохранится.",
          en: "Attach documents to the task (Drive or local). Discuss inside the task, not chat — history stays intact.",
        },
      },
      {
        title: { uz: "Timer", ru: "Таймер", en: "Timer" },
        text: {
          uz: "Ish vaqtini o'lchash uchun taymerni bosing/to'xtating. Soatlar hisobotda xodimlar bo'yicha ko'rinadi.",
          ru: "Запускайте/останавливайте таймер для учёта времени. Часы попадают в отчёты по сотрудникам.",
          en: "Start/stop the timer to track effort. Hours roll up into employee reports.",
        },
      },
    ],
  },
  "95435": {
    intro: {
      uz: "Oqimlar (Потоки) — bir xil vazifalar zanjirini avtomatlashtirish: ariza → tekshirish → tasdiq → bajarish.",
      ru: "Потоки — автоматизация цепочки одинаковых задач: заявка → проверка → согласование → выполнение.",
      en: "Flows automate repeated task chains: request → review → approval → execution.",
    },
    sections: [
      {
        title: { uz: "Oqim yaratish", ru: "Создание потока", en: "Create a flow" },
        steps: {
          uz: [
            "Vazifalar → Oqimlar → Yangi.",
            "Bosqichlarni tartiblang: kimda-nima bajariladi.",
            "Har bosqich uchun muddat va avtomatik xabarni sozlang.",
            "Sinov rejimida bir marta ishga tushiring, keyin yoqing.",
          ],
          ru: [
            "Задачи → Потоки → Создать.",
            "Расставьте этапы: кто и что выполняет.",
            "Настройте срок и автонапоминание для каждого этапа.",
            "Сначала прогоните в тестовом режиме, затем включите.",
          ],
          en: [
            "Tasks → Flows → New.",
            "Order the stages: who does what.",
            "Set deadlines and auto-reminders per stage.",
            "Run a test pass first, then enable.",
          ],
        },
      },
    ],
    tip: {
      uz: "Aynan takrorlanadigan 3+ qadamli jarayonlarni oqimga soling — qo'lda shart emas.",
      ru: "Автоматизируйте процессы из 3+ повторяющихся шагов — вручную не нужно.",
      en: "Automate any process with 3+ repeating steps — no need to do it manually.",
    },
  },
  // ===== Hamkorlik =====
  "161730": {
    intro: {
      uz: "Messenger — jamoaviy chat: shaxsiy yozishmalar, guruhlar va kanallar. Email o'rniga tez muhokama uchun.",
      ru: "Мессенджер — командное общение: личные переписки, группы и каналы. Вместо почты для быстрых обсуждений.",
      en: "Messenger is team chat: DMs, groups and channels. Use it instead of email for quick discussions.",
    },
    sections: [
      {
        title: { uz: "Chat va kanallar", ru: "Чаты и каналы", en: "Chats and channels" },
        steps: {
          uz: [
            "Yangi chat — bitta odam yoki guruh (2+ kishi).",
            "Kanal — ochiq ma'lumot uchun (yangiliklar, umumiy elon).",
            "Xabarga javob, reaksiya va fayl qo'shish mumkin.",
            "Muhim xabarni yopishqlab qo'ying (pin).",
          ],
          ru: [
            "Новый чат — один человек или группа (2+).",
            "Канал — для открытой информации (новости, объявления).",
            "В сообщениях: ответы, реакции и вложения.",
            "Важное можно закрепить (pin).",
          ],
          en: [
            "New chat — one person or a group (2+).",
            "Channel — for open info (news, announcements).",
            "Messages support replies, reactions and files.",
            "Pin anything important.",
          ],
        },
      },
    ],
  },
  "45919": {
    intro: {
      uz: "Kalendar — shaxsiy va jamoaviy uchrashuvlar, sinxronizatsiya va eslatmalar.",
      ru: "Календарь — личные и командные встречи, синхронизация и напоминания.",
      en: "Calendar covers personal and team events, sync and reminders.",
    },
    sections: [
      {
        title: { uz: "Uchrashuv yaratish", ru: "Создание встречи", en: "Create an event" },
        steps: {
          uz: [
            "Kalendar → Yangi (yoki \"Qo'shish\").",
            "Sana, vaqt, joy/onlayn havola.",
            "Ishtirokchilarni taklif qiling — ularning kalendari ham yangilanadi.",
            "Takrorlanuvchi uchrashuv (har duşanba) sozlanadi.",
          ],
          ru: [
            "Календарь → Создать.",
            "Дата, время, место/онлайн-ссылка.",
            "Пригласите участников — их календари обновятся.",
            "Настройте повтор (например, каждый понедельник).",
          ],
          en: [
            "Calendar → New.",
            "Date, time, place/online link.",
            "Invite attendees — their calendars update.",
            "Configure recurrence (e.g. every Monday).",
          ],
        },
      },
      {
        title: { uz: "Sinxronizatsiya", ru: "Синхронизация", en: "Sync" },
        text: {
          uz: "Google/Outlook kalendari bilan ulash — sozlamalar → Integratsiyalar. Tashqi jadvallar bir tomonga yoki ikki tomonga sinxron bo'ladi.",
          ru: "Подключите Google/Outlook в Настройки → Интеграции. Внешние календари синхронизируются в одну или обе стороны.",
          en: "Connect Google/Outlook under Settings → Integrations. External calendars sync one-way or two-way.",
        },
      },
    ],
  },
  "45920": {
    intro: {
      uz: "Disk — jamoaviy fayllar ombori: papkalar, kengaytma (versiya) va hamkorlikda tahrir.",
      ru: "Диск — общее файловое хранилище: папки, версии и совместное редактирование.",
      en: "Drive is the shared file store: folders, versions and co-editing.",
    },
    sections: [
      {
        title: { uz: "Papkalar va ruxsatlar", ru: "Папки и права доступа", en: "Folders and permissions" },
        steps: {
          uz: [
            "Disk → Yangi papka (bo'lim bo'yicha tavsiya).",
            "Papkaga ruxsat bering: ko'rish / tahrirlash / boshqarish.",
            "Hujjatni sudrab tashlang yoki yuklang.",
            "Tahrirlashdan oldin nusxa (versiya) avtomat saqlanadi.",
          ],
          ru: [
            "Диск → Новая папка (рекомендуется по отделам).",
            "Выдайте права: просмотр / редактирование / управление.",
            "Перетащите или загрузите файл.",
            "Перед правкой создаётся версия автоматически.",
          ],
          en: [
            "Drive → New folder (ideally by department).",
            "Grant view / edit / manage rights.",
            "Drag-and-drop or upload files.",
            "Versions are auto-saved before edits.",
          ],
        },
      },
    ],
  },
  "55667": {
    intro: {
      uz: "Korporativ pochta — Bitrix24 ichida SMTP/IMAP ulash, yozishmalar va spam filtri.",
      ru: "Корпоративная почта — подключение SMTP/IMAP в Битрикс24, переписки и фильтр спама.",
      en: "Corporate mail connects SMTP/IMAP inside Bitrix24, with threads and spam filter.",
    },
    sections: [
      {
        title: { uz: "Pochta ulash", ru: "Подключение почты", en: "Connect mail" },
        steps: {
          uz: [
            "Pochta → Hisob qo'shish.",
            "Email va parolni kiriting (yoki OAuth — Gmail/Outlook).",
            "SMTP/IMAP serverlarini tekshiring (provayder hujjatida).",
            "Sinov xatini yuboring — muvaffaqiyatli bo'lsa, yoqiladi.",
          ],
          ru: [
            "Почта → Добавить аккаунт.",
            "Введите email и пароль (или OAuth — Gmail/Outlook).",
            "Проверьте SMTP/IMAP (в документации провайдера).",
            "Отправьте тестовое письмо — при успехе аккаунт активируется.",
          ],
          en: [
            "Mail → Add account.",
            "Enter email and password (or OAuth for Gmail/Outlook).",
            "Verify SMTP/IMAP (see provider docs).",
            "Send a test message — on success the account activates.",
          ],
        },
      },
    ],
  },
  // ===== Ish jarayonlari =====
  "143886": {
    intro: {
      uz: "Ombor hisobi — qoldiq, hujjatlar (qabul, chiqim) va CRM bilan avtomatik integratsiya.",
      ru: "Складской учёт — остатки, документы (приход, расход) и интеграция с CRM.",
      en: "Warehouse covers stock, documents (in/out) and CRM integration.",
    },
    sections: [
      {
        title: { uz: "Ombor va mahsulot", ru: "Склад и товары", en: "Warehouse and products" },
        steps: {
          uz: [
            "Ombor → Omborlar → kamida bitta ombor yarating.",
            "Katalogdan mahsulotlarni ulang.",
            "Qabul hujjati bilan boshlang'ich qoldiqni kiriting.",
            "Savdo qilinganda qoldiq avtomat kamayadi.",
          ],
          ru: [
            "Склад → Склады → создайте хотя бы один.",
            "Привяжите товары из каталога.",
            "Внесите начальные остатки документом прихода.",
            "При продаже остаток уменьшается автоматически.",
          ],
          en: [
            "Warehouse → Warehouses → create at least one.",
            "Link products from the catalog.",
            "Post opening stock with a receipt document.",
            "Sales reduce stock automatically.",
          ],
        },
      },
    ],
    tip: {
      uz: "CRM savdosi + ombor = qoldiq doim to'g'ri. Alohida Excel o'rniga shu yerda saqlang.",
      ru: "Сделка CRM + склад = актуальные остатки вместо Excel.",
      en: "CRM deal + warehouse keeps stock accurate — no separate Excel.",
    },
  },
  "151376": {
    intro: {
      uz: "Avtomatlashtirish — robotlar, triggerlar va RPA: ma'lum bir hodisa bo'lganda tizim o'zi harakat qiladi.",
      ru: "Автоматизация — роботы, триггеры и RPA: система сама действует при наступлении события.",
      en: "Automation uses robots, triggers and RPA so the system acts on events by itself.",
    },
    sections: [
      {
        title: { uz: "Robot (avto-javob)", ru: "Робот (авто-действие)", en: "Robot (auto-action)" },
        text: {
          uz: "Masalan: yangi lead → Telegram xabar → vazifa yaratish. Robotlar savdo/karta kartochkasiga biriktiriladi.",
          ru: "Например: новый лид → сообщение в Telegram → создать задачу. Роботы привязываются к карточкам.",
          en: "Example: new lead → Telegram ping → create task. Robots attach to record cards.",
        },
      },
      {
        title: { uz: "Trigger va BIZDAGI RPA", ru: "Триггер и RPA", en: "Trigger and RPA" },
        text: {
          uz: "Trigger — shart bajarilganda (muddat o'tdi, summa oshdi) xabar yoki holat o'zgarishi. RPA — tashqi tizimda murakkab zanjir (API chaqiruv, fayl yozish).",
          ru: "Триггер — при условии (просрочка, сумма выше порога) меняет статус или шлёт уведомление. RPA — сложная цепочка во внешних системах (API, файл).",
          en: "A trigger fires on a condition (overdue, amount over threshold). RPA chains external calls (API, file writes).",
        },
      },
    ],
  },
  "161762": {
    intro: {
      uz: "Xodimlar va tuzilma — departament daraxti, lavozimlar, vaqt hisobi va hisobotlar.",
      ru: "Сотрудники и структура — дерево отделов, должности, учёт времени и отчёты.",
      en: "Employees and structure cover the org tree, roles, time tracking and reports.",
    },
    sections: [
      {
        title: { uz: "Tuzilma qurish", ru: "Построение структуры", en: "Build the structure" },
        steps: {
          uz: [
            "Sozlamalar → Tashkilot → Departamentlar.",
            "Bo'limlar daraxtini yarating (Bosh ofis → Savdo → …).",
            "Xodimlarni bo'lim va lavozimga biriktiring.",
            "Rahbarlarni belgilang — hisobotlar shu bo'yicha chiqadi.",
          ],
          ru: [
            "Настройки → Организация → Отделы.",
            "Постройте дерево отделов.",
            "Привяжите сотрудников к отделу и должности.",
            "Назначьте руководителей — отчёты пойдут по ним.",
          ],
          en: [
            "Settings → Organization → Departments.",
            "Build the department tree.",
            "Assign employees to department and role.",
            "Mark managers — reports roll up through them.",
          ],
        },
      },
      {
        title: { uz: "Vaqt hisobi", ru: "Учёт времени", en: "Time tracking" },
        text: {
          uz: "Vazifa taymeri va grafik bo'yicha soatlar yig'iladi. HR hisobotlarda kunlik/oylik ko'rinish chiqadi.",
          ru: "Часы собираются из таймеров задач и графика. В HR-отчётах — дневной/месячный срез.",
          en: "Hours come from task timers and schedules. HR reports show daily/monthly views.",
        },
      },
    ],
  },
  "161614": {
    intro: {
      uz: "Marketing — email/SMS tarqatmalar, segmentatsiya va kampaniya natijalari.",
      ru: "Маркетинг — email/SMS рассылки, сегментация и результаты кампаний.",
      en: "Marketing covers email/SMS campaigns, segmentation and results.",
    },
    sections: [
      {
        title: { uz: "Tarqatma yaratish", ru: "Создание рассылки", en: "Create a campaign" },
        steps: {
          uz: [
            "Marketing → Tarqatmalar → Yangi.",
            "Segment tanlang (yoki butun baza).",
            "Shablon tahrirlang — mavzu, matn, tugma.",
            "Oldindan ko'rib chiqing, keyin rejalashtiring yoki yuboring.",
          ],
          ru: [
            "Маркетинг → Рассылки → Создать.",
            "Выберите сегмент (или всю базу).",
            "Отредактируйте шаблон — тема, текст, кнопка.",
            "Проверьте превью, затем запланируйте или отправьте.",
          ],
          en: [
            "Marketing → Campaigns → New.",
            "Pick a segment (or the full list).",
            "Edit the template: subject, body, button.",
            "Preview, then schedule or send.",
          ],
        },
      },
    ],
    tip: {
      uz: "Alohida maydonlar (ism, bo'lim) bilan murojaat qiling — ochish darajasi oshadi.",
      ru: "Персонализируйте (имя, отдел) — открываемость растёт.",
      en: "Personalize (name, department) to lift open rates.",
    },
  },
  "45992": {
    intro: {
      uz: "Portal sozlamalari — ruxsatlar, integratsiyalar, tillar va xavfsizlik qoidalari.",
      ru: "Настройки портала — права, интеграции, языки и правила безопасности.",
      en: "Portal settings cover permissions, integrations, languages and security.",
    },
    sections: [
      {
        title: { uz: "Ruxsatlar", ru: "Права доступа", en: "Permissions" },
        text: {
          uz: "Rollar bo'yicha kirish: Administrator, Menejer, Ishchi. Har bir modul (CRM, Disk, Vazifalar) uchun alohida ruxsat darajasi bor — o'rtacha odamga kerak emasini yoping.",
          ru: "Доступ по ролям: Администратор, Менеджер, Работник. Для каждого модуля есть уровень прав — лишнее обычному сотруднику закрывайте.",
          en: "Access by role: Admin, Manager, Employee. Each module has a permission level — hide what staff do not need.",
        },
      },
      {
        title: { uz: "Integratsiyalar", ru: "Интеграции", en: "Integrations" },
        text: {
          uz: "Marketplace yoki sozlamalardan ulang: Telegram, email, 1C, telefoniya. Har bir ulanishdan keyin sinov xabarini yuboring.",
          ru: "Подключайте через Marketplace или настройки: Telegram, email, 1С, телефония. После подключения отправьте тест.",
          en: "Connect via Marketplace or settings: Telegram, email, 1C, telephony. Always send a test after connecting.",
        },
      },
      {
        title: { uz: "Xavfsizlik", ru: "Безопасность", en: "Security" },
        text: {
          uz: "2FA ni yoqing, parol siyosatini belgilang va tashqi foydalanuvchilarni muntazam ko'rib chiqing.",
          ru: "Включите 2FA, задайте политику паролей и периодически проверяйте внешних пользователей.",
          en: "Turn on 2FA, set a password policy and review external users regularly.",
        },
      },
    ],
  },
  "161796": {
    intro: {
      uz: "Telefoniya — raqam ijarasi, ichki ATS, qo'ng'iroqlar tarixi va CRM bilan yozib olish.",
      ru: "Телефония — аренда номера, АТС, история звонков и запись в CRM.",
      en: "Telephony covers number rental, PBX, call history and CRM logging.",
    },
    sections: [
      {
        title: { uz: "Raqam ulash", ru: "Подключение номера", en: "Connect a number" },
        steps: {
          uz: [
            "Telefoniya → Raqamlar → Ijaraga olish yoki ulash.",
            "Vositachini tanlang (Bitrix24 yoki tashqi provayder).",
            "Qo'ng'iroq qoidalarini sozlang (ish vaqti, navbat).",
            "Sinov qo'ng'iroq qiling — tarixda ko'rinishi shart.",
          ],
          ru: [
            "Телефония → Номера → аренда или подключение.",
            "Выберите провайдера (Битрикс24 или внешний).",
            "Настройте правила (часы, очередь).",
            "Сделайте тестовый звонок — он должен появиться в истории.",
          ],
          en: [
            "Telephony → Numbers → rent or connect.",
            "Choose a provider (Bitrix24 or external).",
            "Configure rules (hours, queue).",
            "Place a test call — it must show in history.",
          ],
        },
      },
      {
        title: { uz: "CRM bilan yozib olish", ru: "Запись в CRM", en: "Log to CRM" },
        text: {
          uz: "Qo'ng'iroq kelganda kontakt kartasi ochilda chiqadi. Qo'ng'iroq tugagach, savdo yoki vazifa bilan bog'lab qoldirish mumkin.",
          ru: "При входящем звонке открывается карточка контакта. После разговора можно привязать сделку или задачу.",
          en: "Incoming calls open the contact card. After the call, link a deal or task.",
        },
      },
    ],
  },
};

/**
 * Bitrix helpdesk maqolalaridan yig'ilgan lokal screenshotlar.
 * Kalit — maqola ID; qiymat — /public yo'li ro'yxati.
 * Bo'lim rasmlari (start/tasks/...) shu bo'limdagi maqolalarga tarqatilgan.
 */
export const HELPDESK_IMAGE_SETS: Record<string, string[]> = {
  // ===== Boshlash =====
  "161724": [
    "/guides-article/start-1.jpg",
    "/guides-article/start-3.jpg",
    "/guides-article/start-4.jpg",
  ],
  "148408": [
    "/guides-article/start-3.jpg",
    "/guides-article/start-4.jpg",
  ],
  // Katalog tovarlari — helpdesk open/20922462 body screens 36-47
  "20922462": [
    "/guides-article/20922462-1.jpg",
    "/guides-article/20922462-2.jpg",
    "/guides-article/20922462-3.jpg",
    "/guides-article/20922462-4.jpg",
    "/guides-article/20922462-5.jpg",
    "/guides-article/20922462-6.jpg",
    "/guides-article/20922462-7.jpg",
    "/guides-article/20922462-8.jpg",
    "/guides-article/20922462-9.jpg",
    "/guides-article/20922462-10.jpg",
    "/guides-article/20922462-11.jpg",
    "/guides-article/20922462-12.jpg",
  ],

  // ===== Hamkorlik =====
  "161730": [
    "/guides-article/collab-1.png",
    "/guides-article/collab-3.png",
  ],
  "45919": [
    "/guides-article/collab-4.jpg",
  ],
  "45920": [
    "/guides-article/collab-3.png",
    "/guides-article/collab-1.png",
  ],
  "55667": [
    "/guides-article/collab-1.png",
  ],

  // ===== Vazifalar =====
  "48933": [
    "/guides-article/tasks-1.jpg",
    "/guides-article/tasks-3.jpg",
    "/guides-article/tasks-4.jpg",
  ],
  "48595": [
    "/guides-article/tasks-3.jpg",
    "/guides-article/tasks-4.jpg",
  ],
  "95435": [
    "/guides-article/tasks-4.jpg",
    "/guides-article/tasks-1.jpg",
  ],

  // ===== CRM =====
  "161866": [
    "/guides-article/crm-1.jpg",
    "/guides-article/crm-4.jpg",
  ],
  "47411": [
    "/guides-article/crm-4.jpg",
    "/guides-article/crm-1.jpg",
  ],
  "47598": [
    "/guides-article/crm-1.jpg",
    "/guides-article/crm-4.jpg",
  ],
  "47596": [
    "/guides-article/crm-4.jpg",
  ],
  "47599": [
    "/guides-article/crm-1.jpg",
  ],

  // ===== Ish jarayonlari =====
  "143886": [
    "/guides-article/work-3.jpg",
    "/guides-article/work-4.jpg",
  ],
  "151376": [
    "/guides-article/work-1.jpg",
    "/guides-article/work-3.jpg",
    "/guides-article/work-4.jpg",
  ],
  "161762": [
    "/guides-article/work-4.jpg",
    "/guides-article/work-1.jpg",
  ],
  "161614": [
    "/guides-article/work-1.jpg",
  ],
  "45992": [
    "/guides-article/work-3.jpg",
    "/guides-article/work-4.jpg",
  ],
  "161796": [
    "/guides-article/work-4.jpg",
    "/guides-article/work-3.jpg",
  ],
};

/** Bo'lim kaliti → bo'lim darajasidagi Bitrix rasmlari (fallback). */
export const HELPDESK_SECTION_IMAGES: Record<string, string[]> = {
  start: ["/guides-article/start-1.jpg", "/guides-article/start-3.jpg", "/guides-article/start-4.jpg"],
  collab: ["/guides-article/collab-1.png", "/guides-article/collab-3.png", "/guides-article/collab-4.jpg"],
  tasks: ["/guides-article/tasks-1.jpg", "/guides-article/tasks-3.jpg", "/guides-article/tasks-4.jpg"],
  crm: ["/guides-article/crm-1.jpg", "/guides-article/crm-4.jpg"],
  work: ["/guides-article/work-1.jpg", "/guides-article/work-3.jpg", "/guides-article/work-4.jpg"],
};

export function getHelpdeskImages(id: string): string[] {
  return HELPDESK_IMAGE_SETS[id] ?? [];
}

export function getHelpdeskSectionImages(sectionKey: string): string[] {
  return HELPDESK_SECTION_IMAGES[sectionKey] ?? [];
}

export function getHelpdeskBody(id: string): HelpdeskBody | undefined {
  const body = HELPDESK_BODIES[id];
  if (!body) return undefined;
  const images = getHelpdeskImages(id);
  if (images.length > 0 && !body.images?.length) {
    return { ...body, images };
  }
  return body;
}

export const HELPDESK_BODY_IDS = Object.keys(HELPDESK_BODIES);
