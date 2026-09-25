"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  ChevronDown,
  Users,
  Crown,
  Hash,
} from "lucide-react";
import type { UiStrings, Locale } from "@/lib/akela-content";
import staffing from "@/data/akela-staffing.json";
import { translateDepartment, translateRole, translateName } from "@/lib/staff-translate";

type Member = {
  code: string;
  role: string;
  department: string;
  name: string;
};

type DeptGroup = {
  department: string;
  members: Member[];
};

const DEPARTMENTS = (staffing as { departments: DeptGroup[] }).departments;

// Short human label per department (extract last code segment for chip)
function deptCode(dept: string): string {
  const m = dept.match(/AGM\/[\d\/]+/);
  return m ? m[0] : "";
}

function deptName(dept: string, locale: Locale): string {
  return translateDepartment(dept, locale);
}

// Color rotation for department badges
const PALETTES = [
  "from-indigo-500 to-indigo-600",
  "from-amber-400 to-amber-500",
  "from-teal-500 to-teal-600",
  "from-indigo-600 to-indigo-700",
  "from-amber-500 to-amber-600",
  "from-indigo-700 to-indigo-800",
];

export function CompanyStructure({ strings, locale }: { strings: UiStrings; locale: Locale }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const totalEmployees = DEPARTMENTS.reduce(
    (acc, d) => acc + d.members.length,
    0,
  );

  return (
    <section id="structure" className="relative px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="section-eyebrow">{strings.structure_eyebrow}</span>
          <h2 className="mt-3 font-[var(--font-display)] text-4xl font-extrabold tracking-tight text-[color:var(--emerald-deep)] sm:text-5xl">
            {strings.structure_title}
          </h2>
          <p className="mt-4 text-base text-[color:var(--ink-soft)] sm:text-lg">
            {strings.structure_subtitle}
          </p>

          {/* Summary chips */}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3">
            <div className="glass-pill flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-[color:var(--emerald-mid)]" />
              <span className="font-semibold text-[color:var(--emerald-deep)]">
                {DEPARTMENTS.length}
              </span>
              <span className="text-[color:var(--ink-soft)]">
                {strings.stats_departments.toLowerCase()}
              </span>
            </div>
            <div className="glass-pill flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-[color:var(--emerald-mid)]" />
              <span className="font-semibold text-[color:var(--emerald-deep)]">
                {totalEmployees}
              </span>
              <span className="text-[color:var(--ink-soft)]">
                {strings.stats_employees.toLowerCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Departments accordion — single open at a time */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2 items-start">
          {DEPARTMENTS.map((dept, i) => {
            const open = openIdx === i;
            const palette = PALETTES[i % PALETTES.length];
            const head = dept.members[0];
            const code = deptCode(dept.department);
            const name = deptName(dept.department, locale);
            const isLastOdd = DEPARTMENTS.length % 2 === 1 && i === DEPARTMENTS.length - 1;

            return (
              <motion.div
                key={dept.department}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: (i % 6) * 0.05 }}
                className={`glass-card rounded-3xl transition-all overflow-hidden ${
                  open ? "shadow-2xl ring-2 ring-indigo-300" : ""
                } ${isLastOdd ? "sm:col-span-2 sm:mx-auto sm:w-full sm:max-w-[calc(50%-6px)]" : ""}`}
              >
                <button
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="flex w-full items-center gap-4 p-5 text-left"
                >
                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${palette} text-white shadow-lg`}
                  >
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {code && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[color:var(--emerald-deep)]">
                          <Hash className="h-2.5 w-2.5" />
                          {code}
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
                        {dept.members.length} {strings.structure_members}
                      </span>
                    </div>
                    {/* Bo'lim nomi — border/karta ichida to'liq sig'ishi uchun 2 qatorga ruxsat */}
                    <div
                      title={name || dept.department}
                      className="mt-1 line-clamp-2 break-words text-sm font-bold leading-snug text-[color:var(--emerald-deep)] sm:text-base"
                    >
                      {name || dept.department}
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-[color:var(--ink-soft)]"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-black/5 p-4">
                        <div className="max-h-96 overflow-y-auto pr-1">
                          <div className="space-y-2">
                            {dept.members.map((m, idx) => {
                              const isHead =
                                idx === 0 ||
                                /директор|начальник|руководитель|менеджер|бошлиқ|раҳбар|director|manager|head/i.test(
                                  m.role,
                                );
                              return (
                                <div
                                  key={m.code}
                                  className={`flex items-start gap-3 rounded-2xl p-3 transition-colors ${
                                    isHead
                                      ? "bg-gradient-to-br from-amber-50 to-amber-100/60"
                                      : "bg-white/40 hover:bg-white/60"
                                  }`}
                                >
                                  <div
                                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                                      isHead
                                        ? "bg-gradient-to-br from-amber-400 to-amber-500 text-white"
                                        : "bg-indigo-100 text-[color:var(--emerald-deep)]"
                                    }`}
                                  >
                                    {isHead ? (
                                      <Crown className="h-4 w-4" />
                                    ) : (
                                      m.name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold text-[color:var(--emerald-deep)]">
                                      {translateName(m.name)}
                                    </div>
                                    <div className="truncate text-xs text-[color:var(--ink-soft)]">
                                      {translateRole(m.role, locale)}
                                    </div>
                                    <div className="mt-0.5 font-mono text-[10px] text-[color:var(--ink-soft)]/80">
                                      {m.code}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 text-center text-xs text-[color:var(--ink-soft)]">
          {strings.structure_total}: {totalEmployees} {strings.stats_employees.toLowerCase()} ·{" "}
          {DEPARTMENTS.length} {strings.stats_departments.toLowerCase()}
        </div>
      </div>
    </section>
  );
}
