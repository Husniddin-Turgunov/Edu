"use client";

/**
 * /start — Yangi xodim uchun yagona boshlang'ich sahifa.
 *
 * Ikki qismdan iborat va ikkalasi bir xil uslubda:
 *   1-qadam — Ma'lumotlarni kiritish (xuddi /register bilan bir xil maydonlar,
 *             /api/register ga yuboriladi — qo'shimcha endpoint yo'q)
 *   2-qadam — Barcha qo'llanmalar (HELPDESK_SECTIONS) ketma-ket tartibda,
 *             01 / 02 / 03 ... raqamlari bilan, har biri bir xil kartochkada.
 *
 * Maqsad: xodim "qayerdan boshlash" savolini bir sahifada hal qilishi —
 * avval o'z ma'lumotini, keyin o'qish tartibini.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpenText,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/akela/Navbar";
import { ManualViewer } from "@/components/akela/ManualViewer";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";

/**
 * Barcha qo'llanmalar Bitrix24 «Помощь» dan yig'ilgan haqiqiy katalogdan.
 * Eski `HELPDESK_SECTIONS` o'rniga `/bitrix-data/index.json` o'qiladi —
 * shuning uchun struktura bir xil qoldiriladi (title/summary/cover — 3 til).
 */
type Manual = {
  id: string;
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  cover: string | null;
  sectionCover: string | null;
  sectionTitle: Record<Locale, string>;
  no: number;
  stepInSection: number;
};

const EMPTY_MANUALS: Manual[] = [];

const T = {
  uz: {
    eyebrow: "Yangi xodim uchun",
    title: "Ishga kirish",
    subtitle:
      "Barcha qo'llanmalar shu sahifada ochiladi — boshqa saytga o'tmasdan. O'qish tartibi — ketma-ket.",
    step1: "Ma'lumotlaringiz",
    step1sub: "Portalga kirish uchun — bo'lim va lavozimni ham tanlang",
    step2: "Qo'llanmalar",
    step2sub: "O'qish tartibi — har bir qo'llanma keyingisini ochish uchun",
    manualsCount: "ta qo'llanma",
    section: "Bo'lim",
    open: "Ochish",
    readHere: "O'qish",
    name: "Ism", surname: "Familiya", email: "Email", password: "Parol",
    phone: "Telefon", department: "Bo'lim", position: "Lavozim",
    pick: "Tanlang...", loading: "Yuklanmoqda...", noPositions: "Lavozimlar yo'q",
    pickDeptFirst: "(avval bo'limni tanlang)",
    submit: "Ma'lumotlarni saqlash",
    submitting: "Yuborilmoqda...",
    doneTitle: "Ma'lumotlaringiz qabul qilindi!",
    doneText: "Admin tasdiqlagandan so'ng (1-2 ish kuni) portalga kirishingiz mumkin bo'ladi. Hozircha qo'llanmalarni o'qib chiqing.",
    toManuals: "Qo'llanmalarga o'tish",
    toLogin: "Login sahifasi",
    already: "Allaqachon akkauntingiz bormi? Kirish",
    closed: "Ro'yxatdan o'tish vaqtincha yopilgan. Admin bilan bog'laning.",
    done: "Bajarildi",
    regFor: "Ro'yxatdan o'tish",
  },
  ru: {
    eyebrow: "Для нового сотрудника",
    title: "Начало работы",
    subtitle:
      "Все инструкции открываются прямо на этой странице — без перехода на другой сайт. Читайте по порядку.",
    step1: "Ваши данные",
    step1sub: "Для входа в портал — выберите отдел и должность",
    step2: "Инструкции",
    step2sub: "Порядок чтения — каждая инструкция открывает следующую",
    manualsCount: "инструкций",
    section: "Раздел", open: "Открыть", readHere: "Читать",
    name: "Имя", surname: "Фамилия", email: "Email", password: "Пароль",
    phone: "Телефон", department: "Отдел", position: "Должность",
    pick: "Выберите...", loading: "Загрузка...", noPositions: "Нет должностей",
    pickDeptFirst: "(сначала отдел)", submit: "Сохранить данные",
    submitting: "Отправка...", doneTitle: "Данные приняты!",
    doneText: "После подтверждения администратора (1-2 рабочих дня) вы сможете войти в портал. Пока читайте инструкции.",
    toManuals: "Перейти к инструкциям", toLogin: "Страница входа",
    already: "Уже есть аккаунт? Войти",
    closed: "Регистрация временно закрыта. Свяжитесь с администратором.",
    done: "Готово", regFor: "Регистрация",
  },
  en: {
    eyebrow: "For a new employee",
    title: "Getting started",
    subtitle:
      "All manuals open right here on this page — no jump to another site. Read them in order.",
    step1: "Your details",
    step1sub: "To access the portal — pick your department and position",
    step2: "Manuals",
    step2sub: "Reading order — each manual leads to the next",
    manualsCount: "manuals",
    section: "Section", open: "Open", readHere: "Read",
    name: "First name", surname: "Last name", email: "Email", password: "Password",
    phone: "Phone", department: "Department", position: "Position",
    pick: "Select...", loading: "Loading...", noPositions: "No positions",
    pickDeptFirst: "(pick department first)", submit: "Save my details",
    submitting: "Sending...", doneTitle: "Your details were received!",
    doneText: "You can log in after admin approval (1-2 working days). Meanwhile, read the manuals.",
    toManuals: "Go to manuals", toLogin: "Login page",
    already: "Already have an account? Log in",
    closed: "Registration is temporarily closed. Contact the admin.",
    done: "Done", regFor: "Registration",
  },
} as const;

export default function StartPage() {
  const [locale, setLocale] = useState<Locale>("uz");
  const t = T[locale];
  const strings = UI_STRINGS[locale];

  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  // Bitrix maqolasi SHU YERDA ochiladi — tashqi saytga o'tmaydi
  const [openId, setOpenId] = useState<string | null>(null);
  const [manuals, setManuals] = useState<Manual[]>(EMPTY_MANUALS);
  const [openSection, setOpenSection] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("akela-locale") as Locale | null;
    if (saved === "uz" || saved === "ru" || saved === "en") setLocale(saved);
  }, []);

  // Bitrix24 «Помощь» katalogini yuklaymiz
  useEffect(() => {
    fetch("/bitrix-data/index.json")
      .then((r) => r.json())
      .then((j: { articles?: { id: string; title: string; section: string; order: number; cover: string | null; blocks: number }[] }) => {
        const list = j.articles ?? [];
        const bySection = new Map<string, number>();
        setManuals(
          list.map((a) => {
            const sec = a.section || "—";
            const no = (bySection.get(sec) ?? 0) + 1;
            bySection.set(sec, no);
            const tri = (s: string): Record<Locale, string> => ({ uz: s, ru: s, en: s });
            return {
              id: a.id,
              title: tri(a.title),
              summary: tri(`${sec} · ${a.blocks} bloki`),
              cover: a.cover,
              sectionCover: null,
              sectionTitle: tri(sec),
              no,
              stepInSection: no,
            };
          })
        );
      })
      .catch(() => setManuals(EMPTY_MANUALS));
  }, []);

  const MANUALS = manuals;

  const doneCount = readSet.size;

  return (
    <main className="min-h-screen bg-transparent">
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />
      <LiquidBackground />

      <div className="mx-auto max-w-6xl px-6 pt-32 pb-20">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="section-eyebrow inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> {t.eyebrow}
          </span>
          <h1 className="mt-3 font-[var(--font-display)] text-4xl font-extrabold tracking-tight text-[color:var(--emerald-deep)] sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-4 text-base text-[color:var(--ink-soft)] sm:text-lg">{t.subtitle}</p>
        </motion.div>

        {/* ── 2-qadam: qo'llanmalar ── */}
        <motion.section
          id="start-manuals"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-12"
          data-testid="start-step-manuals"
        >
          <div className="glass-card overflow-hidden rounded-3xl">
            <SectionHeader
              no="01" icon={<BookOpenText className="h-5 w-5" />} title={t.step2} sub={t.step2sub}
              tone="from-violet-600 to-purple-700"
              trailing={
                <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-[11px] font-bold tracking-wider text-white">
                  {doneCount}/{MANUALS.length} {t.done}
                </span>
              }
            />
          </div>

          {/* ketma-ket, bir xil kartochkalar */}
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="start-manuals-list">
            {MANUALS.map((m, i) => {
              const isRead = readSet.has(m.id);
              const cover = m.cover || m.sectionCover;
              return (
                <motion.li
                  key={m.id}
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  className="group glass-card relative flex flex-col overflow-hidden rounded-3xl transition-shadow hover:shadow-xl"
                  data-testid="start-manual-item"
                >
                  {/* ketma-ketlik raqami — chap yuqorida, har kartada bir xil joyda */}
                  <span className="absolute left-3 top-3 z-10 grid h-8 min-w-[2rem] place-items-center rounded-xl bg-slate-900/70 px-2 font-mono text-[11px] font-black tracking-wider text-white backdrop-blur-sm">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {isRead && (
                    <span className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white shadow-lg">
                      <Check className="h-4 w-4" />
                    </span>
                  )}

                  {cover ? (
                    <div className="relative h-36 w-full shrink-0 overflow-hidden bg-slate-100">
                      <img src={cover} alt={m.title[locale]} loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />
                    </div>
                  ) : (
                    <div className="relative h-36 w-full shrink-0 bg-gradient-to-br from-slate-700 to-slate-900">
                      <div className="absolute inset-0 grid place-items-center text-white/20">
                        <BookOpenText className="h-12 w-12" />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
                      {t.section} {m.no} · {m.sectionTitle[locale]}
                    </span>
                    <h3 className="mt-1.5 text-[15px] font-extrabold leading-snug text-[color:var(--emerald-deep)]">
                      {m.title[locale]}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[color:var(--ink)]">
                      {m.summary[locale]}
                    </p>
                    <div className="mt-auto flex items-center gap-2 pt-4">
                      <button type="button" onClick={() => setOpenId(m.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-4 py-2.5 text-[13px] font-bold text-white transition-transform hover:scale-[1.02]">
                        {t.open} <ChevronRight className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setReadSet((p) => { const n = new Set(p); n.add(m.id); return n; })}
                        title={t.readHere} aria-label={t.readHere}
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors ${
                          isRead ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-black/10 bg-white/70 text-[color:var(--ink-soft)] hover:bg-white"
                        }`}>
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </motion.section>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 font-bold text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--emerald-deep)]">
            Dashboard <ChevronRight className="h-4 w-4" />
          </Link>
          <span className="text-black/20">·</span>
          <Link href="/guides" className="inline-flex items-center gap-1.5 font-bold text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--emerald-deep)]">
            {t.step2} <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ── Bitrix maqolasi — SHU SAHIFADA, tashqi saytga o'tmasdan ── */}
      {openId && <ManualViewer id={openId} locale={locale} sectionTitle={manuals.find((m) => m.id === openId)?.sectionTitle.uz} onClose={() => setOpenId(null)} />}
    </main>
  );
}

/** Bo'lim sarlavhasi */
function SectionHeader({ no, icon, title, sub, tone, trailing }: {
  no: string; icon: React.ReactNode; title: string; sub: string; tone: string; trailing?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-4 bg-gradient-to-r ${tone} px-5 py-4 sm:px-7`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 text-white shadow-inner">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-black tracking-[0.2em] text-white/70">{no}</span>
          <h2 className="text-lg font-extrabold text-white drop-shadow-sm sm:text-xl">{title}</h2>
        </div>
        <p className="mt-0.5 text-[13px] font-medium text-white/85">{sub}</p>
      </div>
      {trailing}
    </div>
  );
}
