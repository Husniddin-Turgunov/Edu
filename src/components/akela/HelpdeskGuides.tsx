"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Rocket,
  Users,
  ListChecks,
  MessageSquare,
  Workflow,
  BookOpen,
  BookOpenText,
  LifeBuoy,
} from "lucide-react";
import type { Locale } from "@/lib/akela-content";
import { HELPDESK_SECTIONS, type HelpdeskSection } from "@/lib/helpdesk-content";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Users,
  ListChecks,
  MessageSquare,
  Workflow,
};

const T: Record<Locale, { heading: string; sub: string; open: string; all: string; count: (n: number) => string }> = {
  uz: {
    heading: "Bitrix 24 bilan ishlash yo'riqlari",
    sub: "To'liq darsliklar sayt ichida — uz/ru/en",
    open: "Ochish",
    all: "Barcha yo'riqlar",
    count: (n) => `${n} ta darslik`,
  },
  ru: {
    heading: "Инструкции по работе с Битрикс24",
    sub: "Полные материалы на сайте — uz/ru/en",
    open: "Открыть",
    all: "Все инструкции",
    count: (n) => `${n} материалов`,
  },
  en: {
    heading: "Bitrix24 how-to guides",
    sub: "Full tutorials on our site — uz/ru/en",
    open: "Open",
    all: "All guides",
    count: (n) => `${n} tutorials`,
  },
};

export function HelpdeskGuides({
  locale,
  compact = false,
  id,
}: {
  locale: Locale;
  compact?: boolean;
  id?: string;
}) {
  const t = T[locale] ?? T.uz;
  const sections = compact ? HELPDESK_SECTIONS.slice(0, 3) : HELPDESK_SECTIONS;

  return (
    <section id={id} aria-labelledby="helpdesk-heading" data-testid="helpdesk-guides" className="scroll-mt-28">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-lg">
          <LifeBuoy className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="helpdesk-heading"
            className="text-xl font-extrabold text-[color:var(--emerald-deep)] sm:text-2xl"
          >
            {t.heading}
          </h2>
          <p className="truncate text-xs font-medium text-[color:var(--ink-soft)]">{t.sub}</p>
        </div>
        <Link
          href="/guides"
          className="glass-pill hidden text-sm font-bold text-[color:var(--emerald-deep)] hover:text-blue-600 sm:inline-flex"
        >
          {t.all} →
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section, i) => (
          <HelpdeskSectionCard key={section.key} section={section} locale={locale} t={t} delay={0.06 * i} />
        ))}
      </div>

      {/* Ticket-style quick hits: featured articles as separate tickets */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HELPDESK_SECTIONS.flatMap((s) => s.articles)
          .slice(0, compact ? 6 : 9)
          .map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.04 * i }}
            >
              <Link
                href={`/guides/${a.id}`}
                data-testid="helpdesk-ticket"
                className="group relative block overflow-hidden rounded-2xl border border-dashed border-sky-300 bg-gradient-to-br from-white via-sky-50/60 to-indigo-50/50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-500 hover:shadow-md"
              >
                <span className="absolute right-2 top-2 rounded-full bg-sky-600/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-700">
                  {locale === "uz" ? "Darslik" : locale === "ru" ? "Инструкция" : "Guide"}
                </span>
                <div className="flex items-start gap-2">
                  <BookOpenText className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                  <div className="min-w-0 pr-10">
                    <p className="text-sm font-extrabold leading-snug text-[color:var(--emerald-deep)] group-hover:text-blue-700">
                      {a.title[locale]}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[color:var(--ink-soft)]">
                      {a.summary[locale]}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
      </div>

      <p className="mt-3 text-center sm:hidden">
        <Link href="/guides" className="text-sm font-bold text-[color:var(--emerald-deep)]">
          {t.all} →
        </Link>
      </p>
    </section>
  );
}

function HelpdeskSectionCard({
  section,
  locale,
  t,
  delay,
}: {
  section: HelpdeskSection;
  locale: Locale;
  t: (typeof T)[Locale];
  delay: number;
}) {
  const Icon = ICONS[section.icon] ?? BookOpen;
  const featured = section.articles[0];

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay }}
      data-testid={`helpdesk-section-${section.key}`}
      className="glass-card overflow-hidden rounded-3xl transition-all hover:-translate-y-0.5 hover:shadow-xl"
    >
      {section.cover ? (
        <div className="relative h-32 w-full overflow-hidden bg-slate-100 sm:h-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={section.cover}
            alt={section.title[locale]}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/15 to-transparent" />
          <div className="absolute bottom-2.5 left-4 right-4 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-extrabold text-white drop-shadow-sm">
                {section.title[locale]}
              </h3>
              {section.blurb && (
                <p className="line-clamp-1 text-[11px] font-medium text-white/90">
                  {section.blurb[locale]}
                </p>
              )}
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/90 text-sky-700 shadow-md">
              <Icon className="h-4 w-4" />
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-5 pb-0">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-extrabold text-[color:var(--emerald-deep)]">
                {section.title[locale]}
              </h3>
              <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {t.count(section.articles.length)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[color:var(--ink-soft)]">
              {featured?.summary[locale]}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-5 pt-3">
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
          {t.count(section.articles.length)}
        </span>
        {section.cover && featured && (
          <p className="truncate text-[11px] text-[color:var(--ink-soft)]">
            {featured.summary[locale]}
          </p>
        )}
      </div>

      <ul className="space-y-1 p-3 pt-1.5">
        {section.articles.map((a) => (
          <li key={a.id}>
            <Link
              href={`/guides/${a.id}`}
              data-testid="helpdesk-article-link"
              className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm text-[color:var(--emerald-deep)] transition-colors hover:bg-blue-50"
            >
              {a.cover ? (
                <span className="h-9 w-14 shrink-0 overflow-hidden rounded-md border border-slate-200/80 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                </span>
              ) : (
                <BookOpenText className="h-3.5 w-3.5 shrink-0 text-sky-600 opacity-70 group-hover:opacity-100" />
              )}
              <span className="min-w-0 flex-1">
                <span className="font-semibold group-hover:text-blue-700">{a.title[locale]}</span>
                <span className="mt-0.5 block truncate text-[11px] text-[color:var(--ink-soft)]">
                  {a.summary[locale]}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}
