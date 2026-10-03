"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  ArrowRight,
  Building2,
  Users,
  CalendarDays,
  ListChecks,
  FileText,
  ExternalLink,
} from "lucide-react";
import type { UiStrings } from "@/lib/akela-content";

type HeroNormative = {
  id: string;
  name: string;
  url: string;
  positionName?: string | null;
  departmentName?: string | null;
};

export function Hero({
  strings,
  onStart,
  onExplore,
}: {
  strings: UiStrings;
  onStart: () => void;
  onExplore: () => void;
}) {
  // Foydalanuvchining bo'limi/lavozimidagi normativ fayllar.
  // Fayl yo'q bo'lsa — tugma umuman ko'rinmaydi.
  const [normatives, setNormatives] = useState<HeroNormative[]>([]);
  const [normativesOpen, setNormativesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/position-normatives", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.ok && Array.isArray(data.items)) setNormatives(data.items);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section
      id="home"
      className="relative flex min-h-[100svh] items-center justify-center px-4 pb-20 pt-28 sm:pt-32"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          {/* Left — copy */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.12 } },
            }}
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: { opacity: 1, y: 0 },
              }}
              className="glass-pill inline-flex items-center gap-2"
            >
              <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-amber-500" />
              <span className="text-[color:var(--emerald-deep)]">
                {strings.hero_eyebrow}
              </span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              className="mt-5 font-[var(--font-display)] text-5xl font-extrabold leading-[1.3] tracking-tight text-[color:var(--emerald-deep)] sm:text-6xl lg:text-7xl"
            >
              {strings.hero_title_1}{" "}
              <span className="gold-text">{strings.hero_title_2}</span>
            </motion.h1>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.7, delay: 0.15 },
                },
              }}
              className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--ink-soft)] sm:text-lg"
            >
              {strings.hero_subtitle}
            </motion.p>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.7, delay: 0.25 },
                },
              }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <button
                onClick={onStart}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-900/25 transition-transform hover:scale-[1.03] active:scale-95"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <GraduationCap className="h-4 w-4" />
                {strings.hero_cta_start}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={onExplore}
                className="inline-flex items-center gap-2 rounded-2xl glass px-6 py-3.5 text-sm font-semibold text-[color:var(--emerald-deep)] transition-transform hover:scale-[1.03] active:scale-95"
              >
                <Building2 className="h-4 w-4" />
                {strings.hero_cta_explore}
              </button>

              {/* ===== Normativ hujjatlar (faqat foydalanuvchining bo'limida fayl bo'lsa) ===== */}
              {normatives.length > 0 && (
                <button
                  type="button"
                  onClick={() => setNormativesOpen(true)}
                  data-testid="hero-normative-btn"
                  className="inline-flex items-center gap-2 rounded-2xl glass px-6 py-3.5 text-sm font-semibold text-[color:var(--emerald-deep)] transition-transform hover:scale-[1.03] active:scale-95"
                >
                  <FileText className="h-4 w-4" />
                  Normativ hujjatlar
                  <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                    {normatives.length}
                  </span>
                </button>
              )}

              {normativesOpen && (
                <div
                  className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
                  onClick={() => setNormativesOpen(false)}
                >
                  <div
                    className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-base font-black">Normativ hujjatlar</h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      {normatives[0]?.departmentName ? `Bo'lim: ${normatives[0].departmentName}` : ""}
                    </p>
                    <div className="mt-4 space-y-2">
                      {normatives.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 transition-colors hover:bg-blue-50"
                        >
                          <a
                            href={n.url}
                            target="_blank"
                            rel="noopener"
                            data-testid="hero-normative-item"
                            className="flex min-w-0 flex-1 items-center gap-3"
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100">
                              <FileText className="h-4 w-4 text-blue-600" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-blue-800">{n.name}</span>
                              {n.positionName && (
                                <span className="block text-[10px] text-blue-500">{n.positionName}</span>
                              )}
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          </a>
                          {/* Yuklab olish */}
                          <a
                            href={`/api/normatives/download?url=${encodeURIComponent(n.url)}&name=${encodeURIComponent(n.name)}`}
                            data-testid="hero-normative-download"
                            title="Yuklab olish"
                            className="shrink-0 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            Yuklab olish
                          </a>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setNormativesOpen(false)}
                        className="rounded-xl border px-4 py-2 text-sm font-semibold"
                      >
                        Yopish
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Stats inline */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.7, delay: 0.35 },
                },
              }}
              className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              <Stat icon={<Users className="h-4 w-4" />} value="60+" label={strings.stats_employees} />
              <Stat icon={<Building2 className="h-4 w-4" />} value="21" label={strings.stats_departments} />
              <Stat icon={<CalendarDays className="h-4 w-4" />} value="20+" label={strings.stats_years} />
              <Stat icon={<ListChecks className="h-4 w-4" />} value="7" label={strings.stats_onboarding_steps} />
            </motion.div>
          </motion.div>

          {/* Right — glass card showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative hidden lg:block"
          >
            <HeroShowcase strings={strings} />
          </motion.div>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 sm:block"
      >
        <div className="flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">
          <span>Scroll</span>
          <span className="flex h-9 w-5 items-start justify-center rounded-full border border-[color:var(--ink-soft)]/40 p-1">
            <motion.span
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="h-2 w-1 rounded-full bg-[color:var(--emerald-mid)]"
            />
          </span>
        </div>
      </motion.div>
    </section>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="glass-card rounded-xl px-3 py-2.5 flex items-center gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-700 to-indigo-600 text-white">
        {icon}
      </div>
      <div>
        <div className="text-lg font-extrabold leading-tight text-[color:var(--emerald-deep)]">
          {value}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
          {label}
        </div>
      </div>
    </div>
  );
}

function HeroShowcase({ strings }: { strings: UiStrings }) {
  const showcaseSteps = [
    { i: 1, t: strings.hero_showcase_step_welcome, c: "from-amber-400 to-amber-500" },
    { i: 2, t: strings.hero_showcase_step_history, c: "from-indigo-500 to-indigo-600" },
    { i: 3, t: strings.hero_showcase_step_about, c: "from-teal-400 to-teal-500" },
    { i: 4, t: strings.hero_showcase_step_structure, c: "from-indigo-600 to-indigo-700" },
    { i: 5, t: strings.hero_showcase_step_leadership, c: "from-purple-500 to-purple-600" },
    { i: 6, t: strings.hero_showcase_step_timeline, c: "from-teal-400 to-amber-500" },
    { i: 7, t: strings.hero_showcase_step_rules, c: "from-amber-500 to-amber-600" },
  ];
  return (
    <div className="relative mx-auto aspect-[5/6] w-full max-w-md">
      {/* Main glass card */}
      <div className="glass-card absolute inset-0 rounded-[2.5rem] p-6">
        {/* Card header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.06]">
              <img
                src="/akela/logo.png"
                alt="AKELA"
                className="h-7 w-7 object-contain"
              />
            </div>
            <div>
              <div className="text-sm font-bold text-[color:var(--emerald-deep)]">
                {strings.hero_showcase_title}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
                {strings.hero_showcase_subtitle}
              </div>
            </div>
          </div>
          <div className="glass-pill text-[10px] text-[color:var(--emerald-deep)]">
            {strings.hero_showcase_live}
          </div>
        </div>

        {/* Steps preview */}
        <div className="mt-6 space-y-2.5">
          {showcaseSteps.map((s, idx) => (
            <motion.div
              key={s.i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + idx * 0.12, duration: 0.5 }}
              className="flex items-center gap-3 rounded-2xl bg-white/40 p-3 backdrop-blur"
            >
              <div
                className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${s.c} text-xs font-bold text-white shadow`}
              >
                {s.i}
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-[color:var(--emerald-deep)]">
                  {s.t}
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${20 + idx * 18}%` }}
                    transition={{ delay: 1 + idx * 0.1, duration: 0.7 }}
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-indigo-600"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer chip */}
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-indigo-900/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
            {strings.hero_showcase_progress}
          </div>
          <div className="text-sm font-bold text-[color:var(--emerald-deep)]">
            0 / 7
          </div>
        </div>
      </div>

      {/* Floating accent badges */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="glass absolute -left-8 top-1/3 rounded-2xl px-4 py-2.5 shadow-xl"
      >
        <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
            <div className="whitespace-pre-line text-[11px] font-semibold leading-tight text-[color:var(--emerald-deep)]">
            {strings.hero_showcase_new_hire}
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="glass absolute -right-6 bottom-12 rounded-2xl px-4 py-2.5 shadow-xl"
      >
        <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
              <Users className="h-5 w-5" />
          </div>
            <div className="whitespace-pre-line text-[11px] font-semibold leading-tight text-[color:var(--emerald-deep)]">
            {strings.hero_showcase_team}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
