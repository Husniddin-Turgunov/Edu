/**
 * Bitrix24 Helpdesk (Битрикс24 Ответы) qo'llanmalari —
 * manba: helpdesk.bitrix24.ru (public, authsiz /open/ID).
 * Dashboard va /guides sahifalari uchun uz/ru/en tarjimali.
 */

import type { Locale } from "@/lib/akela-content";
import { HELPDESK_IMAGE_SETS } from "@/lib/helpdesk-bodies";

export type HelpdeskArticle = {
  id: string;
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  url: string; // public helpdesk link
  sectionKey: string;
  /** Card cover (local public path or absolute URL). */
  cover?: string;
};

export type HelpdeskSection = {
  key: string;
  title: Record<Locale, string>;
  icon: string; // lucide icon name
  articles: HelpdeskArticle[];
  /** Widget-style cover image for the section card. */
  cover?: string;
  /** Short blurb shown under the title on cover cards. */
  blurb?: Record<Locale, string>;
};

const HD = "https://helpdesk.bitrix24.ru";

function article(
  id: string,
  sectionKey: string,
  title: Record<Locale, string>,
  summary: Record<Locale, string>,
  cover?: string,
): HelpdeskArticle {
  // Agar cover berilmagan bo'lsa — helpdesk screenshotlardan birinchi rasm
  const resolvedCover =
    cover ??
    (HELPDESK_IMAGE_SETS[id]?.[0] as string | undefined) ??
    undefined;
  return { id, sectionKey, title, summary, cover: resolvedCover, url: `${HD}/open/${id}` };
}

/**
 * Dashboard va /guides uchun bo'limlar.
 * Tartib va cover rasmlar manbasi: Bitrix24 helpdesk widget2
 * (https://helpdesk.bitrix24.ru/widget2/) kartalari:
 *   1) С чего начать  2) Мессенджер  3) Задачи и проекты
 *   4) CRM  5) BitrixGPT  6) Онлайн-запись
 */
export const HELPDESK_SECTIONS: HelpdeskSection[] = [
  {
    key: "start",
    title: {
      uz: "Boshlash",
      ru: "С чего начать",
      en: "Getting started",
    },
    icon: "Rocket",
    cover: "/guides-covers/start.png",
    blurb: {
      uz: "Birinchi qadamlar Bitrix24 da",
      ru: "Первые шаги в Битрикс24",
      en: "First steps in Bitrix24",
    },
    articles: [
      article(
        "161724",
        "start",
        { uz: "Bitrix24 bilan tanishish", ru: "С чего начать в Битрикс24", en: "Where to start in Bitrix24" },
        {
          uz: "Portalga kirish, birinchi sozlamalar va jamoani taklif qilish.",
          ru: "Вход на портал, первые настройки и приглашение команды.",
          en: "Portal login, first settings and inviting your team.",
        },
      ),
      article(
        "20922462",
        "start",
        {
          uz: "Katalog tovarlarini yaratish va sozlash",
          ru: "Как создать и настроить каталог товаров",
          en: "How to create and set up a product catalog",
        },
        {
          uz: "CRM va internet-do'kon uchun yagona katalog: bo'limlar, xususiyatlar, mahsulot.",
          ru: "Единый каталог для CRM и интернет-магазина: разделы, свойства, товар.",
          en: "One catalog for CRM and online store: sections, properties, products.",
        },
        "/guides-covers/catalog.jpg",
      ),
      article(
        "148408",
        "start",
        { uz: "Bitrix24 yordam markazi", ru: "Поддержка Битрикс24", en: "Bitrix24 support" },
        {
          uz: "Rasmiy yordam, chat va integrator yordami.",
          ru: "Официальная помощь, чат и поддержка интегратора.",
          en: "Official help, chat and integrator support.",
        },
      ),
    ],
  },
  {
    key: "collab",
    title: { uz: "Hamkorlik", ru: "Совместная работа", en: "Collaboration" },
    icon: "MessageSquare",
    cover: "/guides-covers/messenger.png",
    blurb: {
      uz: "Interfeys, imkoniyatlar, sozlamalar",
      ru: "Интерфейс, возможности, настройки",
      en: "Interface, features, settings",
    },
    articles: [
      article(
        "161730",
        "collab",
        { uz: "Messenger", ru: "Мессенджер", en: "Messenger" },
        {
          uz: "Chatlar, kanallar va jamoaviy muloqot.",
          ru: "Чаты, каналы и командное общение.",
          en: "Chats, channels and team communication.",
        },
      ),
      article(
        "45919",
        "collab",
        { uz: "Kalendar", ru: "Календарь", en: "Calendar" },
        {
          uz: "Uchrashuvlar, sinxronizatsiya va jadvallar.",
          ru: "Встречи, синхронизация и расписания.",
          en: "Meetings, sync and schedules.",
        },
      ),
      article(
        "45920",
        "collab",
        { uz: "Disk va fayllar", ru: "Диск", en: "Drive" },
        {
          uz: "Umumiy disk, papkalar va hujjatlar ustida hamkorlik.",
          ru: "Общий диск, папки и совместная работа с файлами.",
          en: "Shared drive, folders and file collaboration.",
        },
      ),
      article(
        "55667",
        "collab",
        { uz: "Pochta", ru: "Почта", en: "Mail" },
        {
          uz: "Korporativ pochtani ulash va boshqarish.",
          ru: "Подключение и управление корпоративной почтой.",
          en: "Connecting and managing corporate mail.",
        },
      ),
    ],
  },
  {
    key: "tasks",
    title: { uz: "Vazifalar", ru: "Задачи", en: "Tasks" },
    icon: "ListChecks",
    cover: "/guides-covers/tasks.png",
    blurb: {
      uz: "Vositalar va ish rejimlari",
      ru: "Инструменты, режимы работы",
      en: "Tools and work modes",
    },
    articles: [
      article(
        "48933",
        "tasks",
        { uz: "Vazifalar bilan ishlashni boshlash", ru: "Начало работы с задачами", en: "Getting started with tasks" },
        {
          uz: "Vazifa yaratish, deadline va ijrochilar.",
          ru: "Создание задач, сроки и исполнители.",
          en: "Creating tasks, deadlines and assignees.",
        },
      ),
      article(
        "48595",
        "tasks",
        { uz: "Vazifalardagi vositalar", ru: "Инструменты в задачах", en: "Task tools" },
        {
          uz: "Checklist, fayllar, timer va kommentariyalar.",
          ru: "Чеклисты, файлы, таймер и комментарии.",
          en: "Checklists, files, timer and comments.",
        },
      ),
      article(
        "95435",
        "tasks",
        { uz: "Oqimlar (Потоки)", ru: "Потоки", en: "Flows" },
        {
          uz: "Avtomatik vazifalar oqimini sozlash.",
          ru: "Настройка автоматических потоков задач.",
          en: "Setting up automatic task flows.",
        },
      ),
    ],
  },
  {
    key: "crm",
    title: { uz: "CRM", ru: "CRM", en: "CRM" },
    icon: "Users",
    cover: "/guides-covers/crm.png",
    blurb: {
      uz: "Ulash, sozlash va CRM bilan ishlash",
      ru: "Подключение, настройка и работа с CRM",
      en: "Connect, configure and work with CRM",
    },
    articles: [
      article(
        "161866",
        "crm",
        { uz: "CRM da ishni boshlash", ru: "Начало работы в CRM", en: "Getting started with CRM" },
        {
          uz: "Lead, savdo va kontaktlar bilan ishlash asoslari.",
          ru: "Основы работы со сделками, лидами и контактами.",
          en: "Basics of deals, leads and contacts.",
        },
      ),
      article(
        "47411",
        "crm",
        { uz: "Leadlar bilan ishlash", ru: "Лиды", en: "Leads" },
        {
          uz: "Yangi lead yaratish, saralash va savdoga aylantirish.",
          ru: "Создание лидов, квалификация и конверсия в сделку.",
          en: "Creating leads, qualification and conversion to deal.",
        },
      ),
      article(
        "47598",
        "crm",
        { uz: "Savdolar (Сделки)", ru: "Сделки", en: "Deals" },
        {
          uz: "Savdo voronkalari, bosqichlar va yopish.",
          ru: "Воронки продаж, этапы и закрытие сделок.",
          en: "Sales pipelines, stages and closing deals.",
        },
      ),
      article(
        "47596",
        "crm",
        { uz: "Kontaktlar", ru: "Контакты", en: "Contacts" },
        {
          uz: "Mijoz kontaktlarini boshqarish va qidirish.",
          ru: "Управление и поиск контактов клиентов.",
          en: "Managing and searching customer contacts.",
        },
      ),
      article(
        "47599",
        "crm",
        { uz: "Hisob-fakturalar", ru: "Счета", en: "Invoices" },
        {
          uz: "Hisob yaratish va mijozga yuborish.",
          ru: "Создание счетов и отправка клиенту.",
          en: "Creating invoices and sending to clients.",
        },
      ),
    ],
  },
  {
    key: "work",
    title: { uz: "Ish jarayonlari", ru: "Процессы", en: "Workflows" },
    icon: "Workflow",
    cover: "/guides-covers/ai.png",
    blurb: {
      uz: "Avtomatlashtirish va tuzilma",
      ru: "Автоматизация и структура",
      en: "Automation and structure",
    },
    articles: [
      article(
        "143886",
        "work",
        { uz: "Ombor hisobi", ru: "Складской учет", en: "Warehouse" },
        {
          uz: "Qoldiq, hujjatlar va CRM bilan integratsiya.",
          ru: "Остатки, документы и интеграция с CRM.",
          en: "Stocks, documents and CRM integration.",
        },
      ),
      article(
        "151376",
        "work",
        { uz: "Avtomatlashtirish", ru: "Автоматизация", en: "Automation" },
        {
          uz: "Robotlar, triggerlar va RPA sozlash.",
          ru: "Роботы, триггеры и настройка RPA.",
          en: "Robots, triggers and RPA setup.",
        },
      ),
      article(
        "161762",
        "work",
        { uz: "Xodimlar va tuzilma", ru: "Сотрудники", en: "Employees" },
        {
          uz: "Departament jadvali, vaqt hisobi va hisobotlar.",
          ru: "Оргструктура, учёт времени и отчёты.",
          en: "Org structure, time tracking and reports.",
        },
      ),
      article(
        "161614",
        "work",
        { uz: "Marketing va рассылка", ru: "Маркетинг", en: "Marketing" },
        {
          uz: "Email/SMS tarqatmalar va kampaniyalar.",
          ru: "Email/SMS рассылки и кампании.",
          en: "Email/SMS campaigns and broadcasts.",
        },
      ),
      article(
        "45992",
        "work",
        { uz: "Sozlamalar", ru: "Настройки", en: "Settings" },
        {
          uz: "Portal sozlamalari, ruxsatlar va integratsiyalar.",
          ru: "Настройки портала, права и интеграции.",
          en: "Portal settings, permissions and integrations.",
        },
      ),
      article(
        "161796",
        "work",
        { uz: "Telefoniya", ru: "Телефония", en: "Telephony" },
        {
          uz: "Raqam ijarasi, ATS va qo'ng'iroqlar tarixi.",
          ru: "Аренда номера, АТС и история звонков.",
          en: "Number rental, PBX and call history.",
        },
      ),
    ],
  },
];

export const HELPDESK_META = {
  base: HD,
  home: `${HD}/`,
  article: (id: string) => `${HD}/open/${id}`,
} as const;

export function getHelpdeskSection(key: string): HelpdeskSection | undefined {
  return HELPDESK_SECTIONS.find((s) => s.key === key);
}
