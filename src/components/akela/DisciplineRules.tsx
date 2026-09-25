"use client";

import { motion } from "framer-motion";
import {
  Clock,
  Shirt,
  Lock,
  MessagesSquare,
  FileCheck,
  HandHeart,
  type LucideIcon,
} from "lucide-react";
import type { DisciplineRule, UiStrings } from "@/lib/akela-content";

const ICONS: Record<string, LucideIcon> = {
  Clock,
  Shirt,
  Lock,
  MessagesSquare,
  FileCheck,
  HandHeart,
};

const PALETTES = [
  "from-indigo-500 to-indigo-600",
  "from-amber-400 to-amber-500",
  "from-teal-500 to-teal-600",
  "from-indigo-600 to-indigo-700",
  "from-amber-500 to-amber-600",
  "from-indigo-700 to-indigo-800",
];

export function DisciplineRules({
  rules,
  strings,
}: {
  rules: DisciplineRule[];
  strings: UiStrings;
}) {
  return (
    <section id="discipline" className="relative px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="section-eyebrow">{strings.discipline_eyebrow}</span>
          <h2 className="mt-3 font-[var(--font-display)] text-4xl font-extrabold tracking-tight text-[color:var(--emerald-deep)] sm:text-5xl">
            {strings.discipline_title}
          </h2>
          <p className="mt-4 text-base text-[color:var(--ink-soft)] sm:text-lg">
            {strings.discipline_subtitle}
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {rules.map((r, i) => {
            const Icon = ICONS[r.icon] ?? Clock;
            const palette = PALETTES[i % PALETTES.length];

            return (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.55, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6 }}
                className="glass-card group relative overflow-hidden rounded-3xl p-6"
              >
                {/* Background glow */}
                <div
                  className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${palette} opacity-20 blur-2xl transition-opacity group-hover:opacity-40`}
                />

                <div className="relative">
                  {/* Icon */}
                  <div
                    className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${palette} shadow-lg transition-transform group-hover:scale-110`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  {/* Number */}
                  <div className="absolute right-0 top-0 font-[var(--font-display)] text-5xl font-extrabold text-black/5">
                    {String(i + 1).padStart(2, "0")}
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-[color:var(--emerald-deep)]">
                    {r.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink)]">
                    {r.description}
                  </p>

                  {/* Examples */}
                  <div className="mt-5 border-t border-black/5 pt-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                      {strings.discipline_examples}
                    </div>
                    <ul className="mt-3 space-y-2">
                      {r.examples.map((ex, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs leading-relaxed text-[color:var(--ink)]"
                        >
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r ${palette}`}
                          />
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
