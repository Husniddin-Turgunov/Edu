"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  BookOpen,
  Building2,
  Network,
  ShieldCheck,
  Users,
  Calendar,
  Check,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { Locale, OnboardingStep, UiStrings } from "@/lib/akela-content";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  BookOpen,
  Building2,
  Network,
  ShieldCheck,
  Users,
  Calendar,
};

export function OnboardingWizard({
  steps,
  strings,
  onLocale,
  locale,
}: {
  steps: OnboardingStep[];
  strings: UiStrings;
  onLocale: (l: Locale) => void;
  locale: Locale;
}) {
  const [current, setCurrent] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [finished, setFinished] = useState(false);

  const step = steps[current];
  const total = steps.length;
  const isLast = current === total - 1;
  const Icon = ICONS[step.icon] ?? Sparkles;

  const next = () => {
    setCompleted((prev) => new Set(prev).add(current));
    if (isLast) {
      setFinished(true);
    } else {
      setCurrent((c) => Math.min(total - 1, c + 1));
    }
  };

  const prev = () => setCurrent((c) => Math.max(0, c - 1));

  const restart = () => {
    setCurrent(0);
    setCompleted(new Set());
    setFinished(false);
  };

  const jumpTo = (i: number) => {
    setFinished(false);
    setCurrent(i);
  };

  return (
    <section
      id="onboarding"
      className="relative px-4 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="section-eyebrow">{strings.onboarding_eyebrow}</span>
          <h2 className="mt-3 font-[var(--font-display)] text-4xl font-extrabold tracking-tight text-[color:var(--emerald-deep)] sm:text-5xl">
            {strings.onboarding_title}
          </h2>
          <p className="mt-4 text-base text-[color:var(--ink-soft)] sm:text-lg">
            {strings.onboarding_subtitle}
          </p>
        </div>

        {/* Progress rail */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {steps.map((s, i) => {
            const done = completed.has(i) || i < current;
            const active = i === current;
            const SIcon = ICONS[s.icon] ?? Sparkles;
            return (
              <button
                key={s.id}
                onClick={() => jumpTo(i)}
                className={`group relative flex items-center gap-2 rounded-2xl px-3 py-2 transition-all ${
                  active
                    ? "glass-strong shadow-lg"
                    : "glass hover:scale-[1.02]"
                }`}
              >
                <div
                  className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold transition-all ${
                    done
                      ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white"
                      : active
                        ? "bg-gradient-to-br from-amber-400 to-amber-500 text-white"
                        : "bg-black/5 text-[color:var(--ink-soft)]"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : <SIcon className="h-4 w-4" />}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
                    {strings.onboarding_step_label} {i + 1}
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      active
                        ? "text-[color:var(--emerald-deep)]"
                        : "text-[color:var(--ink-soft)]"
                    }`}
                  >
                    {s.title}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main card */}
        <div className="relative mt-10">
          <AnimatePresence mode="wait">
            {!finished ? (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="glass-card relative overflow-hidden rounded-[2rem] p-6 sm:p-10"
              >
                {/* Background accent */}
                <div
                  className={`pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-to-br ${step.accentFrom} ${step.accentTo} blur-3xl`}
                />
                <div
                  className={`pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-gradient-to-tr ${step.accentTo} ${step.accentFrom} blur-3xl`}
                />

                <div className="relative">
                  {/* Step number badge */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${step.accentFrom} ${step.accentTo} shadow-lg`}
                      >
                        <Icon className="h-7 w-7 text-[color:var(--emerald-deep)]" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                          {strings.onboarding_step_label} {step.index + 1}{" "}
                          {strings.onboarding_of} {total}
                        </div>
                        <h3 className="mt-1 font-[var(--font-display)] text-2xl font-extrabold text-[color:var(--emerald-deep)] sm:text-3xl">
                          {step.title}
                        </h3>
                      </div>
                    </div>
                    {/* Progress ring */}
                    <div className="relative grid h-16 w-16 place-items-center">
                      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          fill="none"
                          stroke="oklch(0 0 0 / 0.08)"
                          strokeWidth="4"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          fill="none"
                          stroke="url(#ring-grad)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 28}
                          strokeDashoffset={
                            2 * Math.PI * 28 * (1 - (current + 1) / total)
                          }
                          style={{ transition: "stroke-dashoffset 0.6s ease" }}
                        />
                        <defs>
                          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="oklch(0.78 0.13 70)" />
                            <stop offset="100%" stopColor="oklch(0.42 0.08 258)" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="text-sm font-bold text-[color:var(--emerald-deep)]">
                        {Math.round(((current + 1) / total) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <p className="mt-6 max-w-3xl text-base leading-relaxed text-[color:var(--ink)] sm:text-lg">
                    {step.body}
                  </p>

                  {/* Key points */}
                  <div className="mt-8">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                      {strings.onboarding_key_points}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {step.points.map((p, idx) => {
                        const isLastOdd = step.points.length % 2 === 1 && idx === step.points.length - 1;
                        return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + idx * 0.1, duration: 0.5 }}
                          className={`flex items-start gap-3 rounded-2xl bg-white/50 p-4 backdrop-blur-sm ${isLastOdd ? "sm:col-span-2 sm:mx-auto sm:w-full sm:max-w-[calc(50%-6px)]" : ""}`}
                        >
                          <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 text-[10px] font-bold text-white">
                            {idx + 1}
                          </div>
                          <p className="text-sm leading-relaxed text-[color:var(--ink)]">
                            {p}
                          </p>
                        </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Nav buttons */}
                  <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
                    <button
                      onClick={prev}
                      disabled={current === 0}
                      className="inline-flex items-center gap-2 rounded-2xl glass px-5 py-3 text-sm font-semibold text-[color:var(--emerald-deep)] transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {strings.onboarding_prev}
                    </button>

                    <div className="text-xs text-[color:var(--ink-soft)]">
                      {strings.onboarding_step_label} {current + 1}{" "}
                      {strings.onboarding_of} {total}
                    </div>

                    <button
                      onClick={next}
                      className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-indigo-900/25 transition-transform hover:scale-[1.03] active:scale-95"
                    >
                      {isLast ? strings.onboarding_finish : strings.onboarding_next}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="finished"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="glass-card relative overflow-hidden rounded-[2rem] p-8 text-center sm:p-14"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
                  className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-amber-500 text-white shadow-2xl"
                >
                  <CheckCircle2 className="h-10 w-10" />
                </motion.div>
                <h3 className="mt-6 font-[var(--font-display)] text-3xl font-extrabold text-[color:var(--emerald-deep)] sm:text-4xl">
                  {locale === "uz"
                    ? "Tabriklaymiz!"
                    : locale === "ru"
                      ? "Поздравляем!"
                      : "Congratulations!"}
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-base text-[color:var(--ink-soft)]">
                   {locale === "uz"
                     ? `Siz barcha ${total} ta tanishtirish qadamini muvaffaqiyatli yakunladingiz. Endi siz AKELA GROUP jamoasining to'liq a'zosisiz.`
                     : locale === "ru"
                       ? `Вы успешно прошли все ${total} шага знакомства. Теперь вы полноправный член команды AKELA GROUP.`
                       : `You have successfully completed all ${total} onboarding steps. You are now a full member of the AKELA GROUP team.`}
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <button
                    onClick={restart}
                    className="inline-flex items-center gap-2 rounded-2xl glass px-5 py-3 text-sm font-semibold text-[color:var(--emerald-deep)] hover:scale-[1.03]"
                  >
                    {locale === "uz" ? "Qaytadan o'tish" : locale === "ru" ? "Пройти заново" : "Restart"}
                  </button>
                  <button
                    onClick={() => {
                      const el = document.getElementById("structure");
                      if (el) {
                        const top = el.getBoundingClientRect().top + window.scrollY - 80;
                        window.scrollTo({ top, behavior: "smooth" });
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:scale-[1.03]"
                  >
                    {strings.nav_structure}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
