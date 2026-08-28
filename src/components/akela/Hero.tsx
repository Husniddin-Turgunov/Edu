"use client";

import { motion } from "framer-motion";
import {
  GraduationCap,
  ArrowRight,
  Building2,
  Users,
  CalendarDays,
  ListChecks,
} from "lucide-react";
import type { UiStrings } from "@/lib/akela-content";

export function Hero({
  strings,
  onStart,
  onExplore,
}: {
  strings: UiStrings;
  onStart: () => void;
  onExplore: () => void;
}) {
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
              className="mt-5 font-[var(--font-display)] text-5xl font-extrabold leading-[1.05] tracking-tight text-[color:var(--emerald-deep)] sm:text-6xl lg:text-7xl"
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
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-emerald-900/25 transition-transform hover:scale-[1.03] active:scale-95"
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
              className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              <Stat icon={<Users className="h-4 w-4" />} value="60+" label={strings.stats_employees} />
              <Stat icon={<Building2 className="h-4 w-4" />} value="21" label={strings.stats_departments} />
              <Stat icon={<CalendarDays className="h-4 w-4" />} value="10+" label={strings.stats_years} />
              <Stat icon={<ListChecks className="h-4 w-4" />} value="5" label={strings.stats_onboarding_steps} />
            </motion.div>
          </motion.div>

          {/* Right — glass card showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative hidden lg:block"
          >
            <HeroShowcase />
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
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-2 grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-700 to-emerald-600 text-white">
        {icon}
      </div>
      <div className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-[color:var(--ink-soft)]">
        {label}
      </div>
    </div>
  );
}

function HeroShowcase() {
  return (
    <div className="relative mx-auto aspect-[5/6] w-full max-w-md">
      {/* Main glass card */}
      <div className="glass-card absolute inset-0 rounded-[2.5rem] p-6">
        {/* Card header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-700 to-amber-500">
              <img
                src="/akela/logo-white.png"
                alt=""
                className="h-6 w-6 object-contain"
              />
            </div>
            <div>
              <div className="text-sm font-bold text-[color:var(--emerald-deep)]">
                Onboarding Map
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
                5-step journey
              </div>
            </div>
          </div>
          <div className="glass-pill text-[10px] text-[color:var(--emerald-deep)]">
            Live
          </div>
        </div>

        {/* Steps preview */}
        <div className="mt-6 space-y-2.5">
          {[
            { i: 1, t: "Welcome", c: "from-amber-400 to-amber-500" },
            { i: 2, t: "History", c: "from-emerald-500 to-emerald-600" },
            { i: 3, t: "About", c: "from-teal-400 to-teal-500" },
            { i: 4, t: "Structure", c: "from-emerald-600 to-emerald-700" },
            { i: 5, t: "Rules", c: "from-amber-500 to-amber-600" },
          ].map((s, idx) => (
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
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-600"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer chip */}
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-emerald-900/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
            Progress
          </div>
          <div className="text-sm font-bold text-[color:var(--emerald-deep)]">
            0 / 5
          </div>
        </div>
      </div>

      {/* Floating accent badges */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="glass absolute -left-8 top-1/3 rounded-2xl px-3 py-2 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500 text-white">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="text-[10px] font-semibold text-[color:var(--emerald-deep)]">
            New hire
            <br />
            ready
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="glass absolute -right-6 bottom-12 rounded-2xl px-3 py-2 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-white">
            <Users className="h-4 w-4" />
          </div>
          <div className="text-[10px] font-semibold text-[color:var(--emerald-deep)]">
            Team
            <br />
            waiting
          </div>
        </div>
      </motion.div>
    </div>
  );
}
