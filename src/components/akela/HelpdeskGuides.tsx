"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LifeBuoy, BookOpenText, ChevronRight } from "lucide-react";
import type { Locale } from "@/lib/akela-content";

type Article = {
  id: string;
  title: string;
  section: string;
  order: number;
  blocks: number;
  images: number;
  cover: string | null;
};

const T: Record<
  Locale,
  { heading: string; sub: string; all: string; count: (n: number) => string; badge: string }
> = {
  uz: {
    heading: "Bitrix24 bo'yicha yo'riqlar",
    sub: "Portal yordam markazidan to'liq ko'chirilgan",
    all: "Barcha yo'riqlar",
    count: (n) => `${n} ta maqola`,
    badge: "Darslik",
  },
  ru: {
    heading: "Инструкции по Битрикс24",
    sub: "Полностью скопировано из справочника портала",
    all: "Все инструкции",
    count: (n) => `${n} статей`,
    badge: "Инструкция",
  },
  en: {
    heading: "Bitrix24 guides",
    sub: "Fully mirrored from the portal help center",
    all: "All guides",
    count: (n) => `${n} articles`,
    badge: "Guide",
  },
};

/**
 * Bosh sahifadagi yo'riqlar bloki.
 * Ma'lumot `public/bitrix-data/index.json` dan olinadi —
 * hech qanday soxta/eskartirdish kontenti yo'q.
 */
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
  const [cat, setCat] = useState<{ total: number; articles: Article[] } | null>(null);

  useEffect(() => {
    fetch("/bitrix-data/index.json")
      .then((r) => r.json())
      .then(setCat)
      .catch(() => setCat({ total: 0, articles: [] }));
  }, []);

  const groups = useMemo(() => {
    if (!cat) return [] as { name: string; items: Article[] }[];
    const m = new Map<string, Article[]>();
    for (const a of cat.articles) {
      if (!m.has(a.section)) m.set(a.section, []);
      m.get(a.section)!.push(a);
    }
    return [...m.entries()]
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => {
        const ia = cat.articles.find((x) => x.section === a.name);
        const ib = cat.articles.find((x) => x.section === b.name);
        return (ia?.order ?? 0) - (ib?.order ?? 0);
      });
  }, [cat]);

  const shown = compact ? groups.slice(0, 4) : groups;
  const featured = useMemo(
    () => (cat?.articles ?? []).filter((a) => a.cover).slice(0, compact ? 6 : 9),
    [cat, compact]
  );

  return (
    <section id={id} aria-labelledby="helpdesk-heading" data-testid="helpdesk-guides" className="scroll-mt-28">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-lg">
          <LifeBuoy className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="helpdesk-heading" className="text-xl font-extrabold text-[color:var(--emerald-deep)] sm:text-2xl">
            {t.heading}
          </h2>
          <p className="truncate text-xs font-medium text-[color:var(--ink-soft)]">
            {t.sub} · {cat?.total ?? "…"}
          </p>
        </div>
        <Link
          href="/guides"
          className="glass-pill hidden items-center gap-1 text-sm font-bold text-[color:var(--emerald-deep)] hover:text-blue-600 sm:inline-flex"
        >
          {t.all} <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {!cat ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl bg-white/60" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((g, gi) => (
            <motion.section
              key={g.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: Math.min(gi * 0.05, 0.25) }}
              data-testid={`helpdesk-section-${gi}`}
              className="glass-card overflow-hidden rounded-3xl transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex items-center justify-between gap-2 border-b border-black/5 px-5 py-3.5">
                <h3 className="min-w-0 truncate text-base font-extrabold text-[color:var(--emerald-deep)]">
                  {g.name}
                </h3>
                <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  {t.count(g.items.length)}
                </span>
              </div>

              <ul className="space-y-1 p-3 pt-1.5">
                {g.items.slice(0, 4).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/guides/${a.id}`}
                      data-testid="helpdesk-article-link"
                      className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-blue-50"
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
                        <span className="block truncate text-sm font-semibold text-[color:var(--emerald-deep)] group-hover:text-blue-700">
                          {a.title}
                        </span>
                        <span className="block truncate text-[11px] text-[color:var(--ink-soft)]">
                          {a.blocks} bloki · {a.images} rasm
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="px-4 pb-4">
                <Link
                  href={`/guides?s=${encodeURIComponent(g.name)}`}
                  className="flex items-center gap-1 text-[12px] font-bold text-sky-700 hover:text-sky-900"
                >
                  {t.all} ({g.items.length}) <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.section>
          ))}
        </div>
      )}

      {/* Tanlangan maqolalar */}
      {featured.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.2) }}
            >
              <Link
                href={`/guides/${a.id}`}
                data-testid="helpdesk-ticket"
                className="group relative block overflow-hidden rounded-2xl border border-dashed border-sky-300 bg-gradient-to-br from-white via-sky-50/60 to-indigo-50/50 p-4 transition-all hover:-translate-y-0.5 hover:border-sky-500 hover:shadow-md"
              >
                <span className="absolute right-2 top-2 rounded-full bg-sky-600/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-700">
                  {t.badge}
                </span>
                <div className="flex items-start gap-2">
                  <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.cover ?? ""} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </span>
                  <div className="min-w-0 pr-8">
                    <p className="line-clamp-2 text-sm font-extrabold leading-snug text-[color:var(--emerald-deep)] group-hover:text-blue-700">
                      {a.title}
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--ink-soft)]">{a.section}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <p className="mt-3 text-center sm:hidden">
        <Link href="/guides" className="text-sm font-bold text-[color:var(--emerald-deep)]">
          {t.all} →
        </Link>
      </p>
    </section>
  );
}
