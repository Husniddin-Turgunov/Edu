"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, LifeBuoy, BookOpenText } from "lucide-react";
import { Navbar } from "@/components/akela/Navbar";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import { HELPDESK_SECTIONS } from "@/lib/helpdesk-content";

export default function GuidesPage() {
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const t = {
    uz: { title: "Yo'riqlar", sub: "Bitrix24 darsliklari — uz/ru/en sayt ichida", back: "Dashboard", open: "Ochish" },
    ru: { title: "Инструкции", sub: "Материалы Битрикс24 — uz/ru/en на сайте", back: "Dashboard", open: "Открыть" },
    en: { title: "Guides", sub: "Bitrix24 tutorials — uz/ru/en on our site", back: "Dashboard", open: "Open" },
  }[locale];

  useEffect(() => {
    const saved = localStorage.getItem("akela-locale") as Locale | null;
    if (saved === "uz" || saved === "ru" || saved === "en") setLocale(saved);
  }, []);

  return (
    <main className="min-h-screen bg-transparent">
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      <div className="mx-auto max-w-6xl px-6 pt-28 pb-16 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--ink-soft)] hover:text-blue-600"
            >
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </Link>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-lg">
                <LifeBuoy className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-black text-[color:var(--emerald-deep)] sm:text-3xl">{t.title}</h1>
                <p className="text-sm text-[color:var(--ink-soft)]">{t.sub}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* All sections including full catalog (widget2 order + covers) */}
        <div className="grid gap-4 md:grid-cols-2" data-testid="guides-sections-grid">
          {HELPDESK_SECTIONS.map((section, i) => (
            <motion.section
              key={section.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="glass-card overflow-hidden rounded-3xl"
              data-testid={`guides-section-${section.key}`}
            >
              {section.cover ? (
                <div className="relative h-36 w-full overflow-hidden bg-slate-100 sm:h-44">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={section.cover}
                    alt={section.title[locale]}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/55 via-slate-900/10 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <h2 className="text-lg font-extrabold text-white drop-shadow-sm">
                      {section.title[locale]}
                    </h2>
                    {section.blurb && (
                      <p className="line-clamp-1 text-xs font-medium text-white/90">
                        {section.blurb[locale]}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-5 pt-5">
                  <h2 className="text-lg font-extrabold text-[color:var(--emerald-deep)]">
                    {section.title[locale]}
                  </h2>
                </div>
              )}
              <ul className="space-y-1 p-3 pt-2">
                {section.articles.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/guides/${a.id}`}
                      data-testid="guides-article-link"
                      className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-blue-50"
                    >
                      {a.cover ? (
                        <span className="h-11 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.cover}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </span>
                      ) : (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-50">
                          <BookOpenText className="h-4 w-4 text-sky-600" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[color:var(--emerald-deep)] group-hover:text-blue-700">
                          {a.title[locale]}
                        </span>
                        <span className="line-clamp-1 block text-xs text-[color:var(--ink-soft)]">
                          {a.summary[locale]}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}
        </div>

        {/* Featured tickets (no section list duplication) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="guides-tickets">
          {HELPDESK_SECTIONS.flatMap((s) => s.articles)
            .filter((a) => a.cover)
            .slice(0, 3)
            .map((a) => (
              <Link
                key={a.id}
                href={`/guides/${a.id}`}
                data-testid="guides-ticket"
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
            ))}
        </div>
      </div>
    </main>
  );
}
