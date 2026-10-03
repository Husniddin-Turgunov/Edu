"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, BookOpen, List } from "lucide-react";
import type { Locale } from "@/lib/akela-content";

type Block =
  | { k: "P" | "H2" | "H3" | "UL" | "OL" | "BLOCKQUOTE"; t: string }
  | { k: "IMG"; n: number; local: string };

type Article = {
  id: string;
  title: string;
  short?: string | null;
  toc?: string[];
  blocks: Block[];
  images?: { n: number; local: string }[];
};

const SKIP = /\/(logo|avatar|icon|badge)\./i;

/**
 * Bitrix24 "Помощь" maqolasini TO'LIQ kontent + rasmlar bilan shu sahifada ochadi.
 * Kontent `public/bitrix-data/articles/<id>.json` dan yuklanadi (tashqi link yo'q).
 */
export function ManualViewer({
  id,
  sectionTitle,
  onClose,
}: {
  id: string;
  locale?: Locale;
  sectionTitle?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Article | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(false);
    fetch(`/bitrix-data/articles/${id}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("404"))))
      .then((j: Article) => alive && setData(j))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const toc = (data?.toc ?? []).filter((t) => t && !/^Коротко/.test(t));
  const short = data?.short ?? null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-neutral-900/55 p-4 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={data?.title ?? "Qo'llanma"}
    >
      <motion.article
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="my-4 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 bg-gradient-to-br from-indigo-700 to-blue-600 px-5 py-4 text-white sm:px-7">
          <div className="min-w-0 flex-1">
            {sectionTitle && (
              <p className="font-mono text-[11px] font-bold tracking-widest text-white/70">
                {sectionTitle}
              </p>
            )}
            <h2 className="mt-1 text-lg font-extrabold leading-snug sm:text-xl">
              {data?.title ?? "Yuklanmoqda…"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-6 sm:px-7">
          {error && (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Maqola topilmadi.
            </p>
          )}

          {!data && !error && (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded-full bg-slate-200"
                  style={{ width: `${90 - i * 7}%` }}
                />
              ))}
            </div>
          )}

          {toc.length > 0 && (
            <nav className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <List className="h-3.5 w-3.5" /> Maqolada
              </p>
              <ul className="space-y-1">
                {toc.map((t, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-slate-700">
                    <span className="text-slate-400">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {short && (
            <div className="mb-6 rounded-2xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-[14px] leading-relaxed text-amber-900">
              <span className="font-extrabold">Коротко: </span>
              {short}
            </div>
          )}

          {data?.blocks.map((b, i) => {
            if (b.k === "IMG") {
              if (!b.local || SKIP.test(b.local)) return null;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={b.local}
                  alt=""
                  loading="lazy"
                  className="my-5 w-full rounded-2xl border border-black/10"
                />
              );
            }
            const t = (b as { t: string }).t;
            if (!t) return null;
            if (b.k === "H2")
              return (
                <h3
                  key={i}
                  className="mt-7 flex items-start gap-2 text-[17px] font-extrabold leading-snug text-[color:var(--emerald-deep)]"
                >
                  <BookOpen className="mt-1 h-4 w-4 shrink-0 text-sky-600" />
                  <span>{t}</span>
                </h3>
              );
            if (b.k === "H3")
              return (
                <h4 key={i} className="mt-4 text-[15px] font-bold text-slate-800">
                  {t}
                </h4>
              );
            if (b.k === "UL" || b.k === "OL") {
              const items = t
                .split(/(?=\S+ — )/)
                .map((s) => s.trim())
                .filter(Boolean);
              return (
                <ul key={i} className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-[color:var(--ink)]">
                  {items.map((s, si) => (
                    <li key={si}>{s}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p
                key={i}
                className="mt-3 text-[15px] leading-relaxed text-[color:var(--ink)]"
              >
                {t}
              </p>
            );
          })}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-black/10 bg-neutral-50 px-5 py-3.5 sm:px-7">
          <p className="text-xs text-[color:var(--ink-soft)]">
            Manba: Bitrix24 «Помощь» · to‘liq ko‘chirilgan
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            Yopish
          </button>
        </footer>
      </motion.article>
    </div>
  );
}
