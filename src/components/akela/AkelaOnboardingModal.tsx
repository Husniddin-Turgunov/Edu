"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, BookOpen, GraduationCap, ArrowRight, ExternalLink, Sparkles, AlertCircle } from "lucide-react";

type Lesson = { guid: string; title: string; sort: number; types: string[]; isRead: boolean; isClosed: boolean };
type CourseModule = { guid: string; title: string; sort: number; countLessons: number; lessons: Lesson[] };
type AkelaCourse = {
  guid: string;
  title: string;
  description: string;
  countModules: number;
  countLessons: number;
  countStudents: number;
  modules: CourseModule[];
};

type Props = { locale?: "uz" | "ru" | "en" };

export function AkelaOnboardingModal({ open, onClose, locale = "uz" }: { open: boolean; onClose: () => void; locale?: "uz" | "ru" | "en" }) {
  const [data, setData] = useState<AkelaCourse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    setError(null);
    fetch("/api/akela-onboarding", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((j) => setData(j.course as AkelaCourse))
      .catch((e) => setError(e?.message || "Ma'lumot yuklanmadi"))
      .finally(() => setLoading(false));
  }, [open, data]);

  // ESC tugmasi bilan yopish
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-black/5 bg-gradient-to-br from-indigo-500/10 via-teal-500/5 to-transparent p-6 backdrop-blur">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  akela.osnovaedu.uz
                </div>
                <h2 className="mt-1 text-2xl font-extrabold text-[color:var(--emerald-deep)] sm:text-3xl">
                  {data?.title || "«AKELA GROUP MACHINERY»"}
                </h2>
                {data?.description && (
                  <p className="mt-2 text-sm text-[color:var(--ink-soft)] sm:text-base">{data.description}</p>
                )}
                {!data && !loading && !error && (
                  <p className="mt-2 text-sm text-[color:var(--ink-soft)]">Tashqi tizimdan to&apos;liq ma&apos;lumot yuklanmoqda...</p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Yopish"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/5 text-[color:var(--ink)] transition hover:bg-black/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {loading && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-[color:var(--ink-soft)]">
                  <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                  <p>akela.osnovaedu.uz ga ulanilmoqda...</p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-bold">Tashqi tizimdan ma&apos;lumot olinmadi</p>
                    <p className="mt-1 text-xs opacity-80">{error}</p>
                  </div>
                </div>
              )}

              {data && (
                <>
                  {/* Statistika */}
                  <div className="mb-6 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-black/5 bg-indigo-50/60 p-4 text-center">
                      <div className="text-2xl font-extrabold text-indigo-700">{data.countModules}</div>
                      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-700/70">Modul</div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-amber-50/60 p-4 text-center">
                      <div className="text-2xl font-extrabold text-amber-700">{data.countLessons}</div>
                      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700/70">Dars</div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-violet-50/60 p-4 text-center">
                      <div className="text-2xl font-extrabold text-violet-700">{data.countStudents}</div>
                      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-violet-700/70">Xodim</div>
                    </div>
                  </div>

                  {/* Modullar ro'yxati */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">
                      Kurs tarkibi
                    </h3>
                    {data.modules
                      .slice()
                      .sort((a, b) => a.sort - b.sort)
                      .map((m, i) => (
                        <details
                          key={m.guid}
                          open={i === 0}
                          className="group overflow-hidden rounded-2xl border border-black/5 bg-white transition hover:border-indigo-200"
                        >
                          <summary className="flex cursor-pointer items-center gap-3 p-4 select-none">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-teal-600 text-sm font-extrabold text-white">
                              {m.sort + 1}
                            </span>
                            <div className="flex-1">
                              <div className="font-bold text-[color:var(--emerald-deep)]">{m.title}</div>
                              <div className="mt-0.5 text-[11px] text-[color:var(--ink-soft)]">
                                {m.lessons.length} ta dars
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-[color:var(--ink-soft)] transition group-open:rotate-90" />
                          </summary>
                          <div className="border-t border-black/5 bg-black/[0.02] p-3">
                            <ul className="space-y-1">
                              {m.lessons
                                .slice()
                                .sort((a, b) => a.sort - b.sort)
                                .map((l) => (
                                  <li
                                    key={l.guid}
                                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-white"
                                  >
                                    <span
                                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-bold ${
                                        l.isRead
                                          ? "bg-indigo-100 text-indigo-700"
                                          : "bg-black/5 text-[color:var(--ink-soft)]"
                                      }`}
                                    >
                                      {String(l.sort).padStart(2, "0")}
                                    </span>
                                    <span className={`flex-1 ${l.isRead ? "text-[color:var(--ink-soft)] line-through" : "text-[color:var(--ink)]"}`}>
                                      {l.title}
                                    </span>
                                    {l.types.includes("test") && (
                                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                        TEST
                                      </span>
                                    )}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        </details>
                      ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex flex-col gap-3 border-t border-black/5 bg-white/90 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <a
                href="https://akela.osnovaedu.uz/student/courses"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-black/10 px-4 py-2.5 text-sm font-bold text-[color:var(--ink)] transition hover:bg-black/5"
              >
                <ExternalLink className="h-4 w-4" />
                Tashqi tizimda ochish
              </a>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:shadow-xl"
              >
                Yopish
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
