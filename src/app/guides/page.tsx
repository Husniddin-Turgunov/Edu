"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, LifeBuoy, Search, X, BookOpenText } from "lucide-react";
import { Navbar } from "@/components/akela/Navbar";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";

type Article = {
  id: string;
  title: string;
  sectionId: string;
  section: string;
  parent: string | null;
  order: number;
  blocks: number;
  images: number;
  cover: string | null;
};

function GuidesInner() {
  const [locale, setLocale] = useState<Locale>("uz");
  const [cat, setCat] = useState<{ total: number; articles: Article[] } | null>(null);
  const [q, setQ] = useState("");
  const params = useSearchParams();
  const active = params.get("s");

  const strings = UI_STRINGS[locale];
  const t = {
    uz: { title: "Bitrix24", sub: "Portal yordam markazi", back: "Dashboard", search: "Qidirish…", empty: "Hech narsa topilmadi", sections: "Бўлимлар", all: "Барча мақолалар" },
    ru: { title: "Bitrix24", sub: "Справочник портала", back: "Дашборд", search: "Поиск…", empty: "Ничего не найдено", sections: "Разделы", all: "Все статьи" },
    en: { title: "Bitrix24", sub: "Portal help center", back: "Dashboard", search: "Search…", empty: "Nothing found", sections: "Sections", all: "All articles" },
  }[locale];

  useEffect(() => {
    const saved = localStorage.getItem("akela-locale") as Locale | null;
    if (saved === "uz" || saved === "ru" || saved === "en") setLocale(saved);
  }, []);
  useEffect(() => {
    // RU — asl fayl, uz/en — tarjima qilingan fayl
    const src = locale === "ru" ? "/bitrix-data/index.json" : `/bitrix-data/index.${locale}.json`;
    fetch(src)
      .then((r) => (r.ok ? r.json() : fetch("/bitrix-data/index.json").then((x) => x.json())))
      .then(setCat)
      .catch(() => setCat({ total: 0, articles: [] }));
  }, []);

  const sections = useMemo(() => {
    if (!cat) return [] as { name: string; items: Article[] }[];
    const m = new Map<string, Article[]>();
    for (const a of cat.articles) {
      if (!m.has(a.section)) m.set(a.section, []);
      m.get(a.section)!.push(a);
    }
    return [...m.entries()].map(([name, items]) => ({ name, items })).sort((a, b) => {
      const ia = cat.articles.find((x) => x.section === a.name);
      const ib = cat.articles.find((x) => x.section === b.name);
      return (ia?.order ?? 0) - (ib?.order ?? 0);
    });
  }, [cat]);

  const shown = useMemo(() => {
    let list = cat?.articles ?? [];
    if (active) list = list.filter((a) => a.section === active);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(s));
    }
    return list;
  }, [cat, active, q]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-20 lg:flex lg:gap-8">
      {/* CHAP MENYU — Bitrix kabi */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
          <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
            {t.sections}
          </p>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/guides"
                className={`block rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  !active ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.all}
                <span className="ml-1.5 text-[11px] text-slate-400">{cat?.total ?? 0}</span>
              </Link>
            </li>
            {sections.map((s) => (
              <li key={s.name}>
                <Link
                  href={`/guides?s=${encodeURIComponent(s.name)}`}
                  className={`block rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors ${
                    active === s.name
                      ? "bg-sky-50 font-bold text-sky-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {s.name}
                  <span className="ml-1.5 text-[11px] text-slate-400">{s.items.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ASOSIY */}
      <div className="min-w-0 flex-1">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--ink-soft)] hover:text-blue-600">
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </Link>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-lg">
                <LifeBuoy className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-black text-[color:var(--emerald-deep)]">{t.title}</h1>
                <p className="text-sm text-[color:var(--ink-soft)]">
                  {t.sub} · {cat?.total ?? 0} maqola
                </p>
              </div>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus:border-sky-400"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Tozalash" className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {active && (
          <p className="mb-4 text-sm font-bold text-slate-700">{active}</p>
        )}

        {!cat ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/60" />)}</div>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{t.empty}</p>
        ) : (
          <ul className="space-y-1.5" data-testid="guides-list">
            {shown.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.01, 0.2) }}
              >
                <Link
                  href={`/guides/${a.id}`}
                  data-testid="guides-article-link"
                  className="group flex items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-white"
                >
                  {a.cover ? (
                    <span className="h-11 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </span>
                  ) : (
                    <BookOpenText className="mt-1 h-4 w-4 shrink-0 text-sky-600" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold leading-snug text-[color:var(--emerald-deep)] group-hover:text-sky-700">
                      {a.title}
                    </span>
                    <span className="block text-[11px] text-[color:var(--ink-soft)]">
                      {a.section} · {a.blocks} bloki · {a.images} rasm
                    </span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function GuidesPage() {
  const [locale, setLocale] = useState<Locale>("uz");
  useEffect(() => {
    const s = localStorage.getItem("akela-locale") as Locale | null;
    if (s === "uz" || s === "ru" || s === "en") setLocale(s);
  }, []);
  return (
    <main className="min-h-screen bg-transparent">
      <Navbar locale={locale} strings={UI_STRINGS[locale]} onLocaleChange={setLocale} />
      <Suspense fallback={<div className="h-96" />}>
        <GuidesInner />
      </Suspense>
    </main>
  );
}
