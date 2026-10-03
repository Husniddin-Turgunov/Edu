"use client";

// components/admin/ai/AiActivity.tsx
// AI ishlayotgan paytdagi jonli vizual: orb pulsatsiyasi, bosqich matni,
// o'tgan vaqt, va bosqichlar timeline'i (framer-motion bilan).
// Maqsad — foydalanuvchi har daqiqada nimani qilayotganini aniq ko'rsin.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AiMotionOrb, type AiMotionMode } from "./AiMotionOrb";
import {
  Bot,
  Sparkles,
  Wrench,
  CheckCircle2,
  XCircle,
  Loader2,
  TriangleAlert,
  Brain,
  Database,
  Globe,
  PenLine,
  BarChart3,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

export type ActivityStep = {
  type: "thinking" | "action" | "result" | "warning" | "dashboard" | "answer";
  tool?: string;
  title?: string;
  args?: unknown;
  summary?: string;
  ok?: boolean;
  /** Tekshiruv tizimi: natija qayta o'qilib tasdiqlandi */
  verified?: boolean;
  verifyNote?: string;
};

/** Bosqich matnlari — qaysi turdagi harakat bo'lishiga qarab. */
const PHASE_TEXT: Record<string, { label: string; icon: any }> = {
  thinking: { label: "Tahlil qilyapti", icon: Brain },
  action: { label: "Bajaruvchi chaqiryapti", icon: Wrench },
  result: { label: "Natija olindi", icon: CheckCircle2 },
  warning: { label: "Ogohlantirish", icon: TriangleAlert },
  dashboard: { label: "Dashboard yaratilmoqda", icon: BarChart3 },
  answer: { label: "Javob yozilmoqda", icon: PenLine },
};

/** O'tgan vaqt hisoblagichi (har 100 ms). */
function useElapsed(active: boolean, startedAt: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    setElapsed(Math.max(0, Date.now() - startedAt));
    const id = setInterval(() => setElapsed(Math.max(0, Date.now() - startedAt)), 100);
    return () => clearInterval(id);
  }, [active, startedAt]);
  return elapsed;
}

function formatElapsed(ms: number) {
  if (ms < 1000) return `${Math.round(ms / 100) / 10} s`;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Katta pulsatsiyalangan orb + faza matni + o'tgan vaqt.
 * `step` — oxirgi bosqich (yo'q bo'lsa umumiy "fikrlanmoqda").
 * `mode` — animatsiya holati: `generating` (kod yozilmoqda), `answering`
 * (kattalashib-kichraydi), `typing` (foydalanuvchi yozmoqda).
 */
export function AiWorkingOrb({
  active,
  step,
  startedAt,
  mode = "idle",
}: {
  active: boolean;
  step?: ActivityStep | null;
  startedAt: number;
  mode?: AiMotionMode;
}) {
  const elapsed = useElapsed(active, startedAt);
  const phase = step ? PHASE_TEXT[step.type] || PHASE_TEXT.thinking : PHASE_TEXT.thinking;
  const Icon = phase.icon;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="mb-3 flex items-center gap-3 rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/70 px-3.5 py-3"
        >
          {/* Orb — "ai motion" animatsiyasi, holatga qarab o'zgaradi.
              72 px "generating" yozuvi sig'adigan eng kichik o'lcham. */}
          <AiMotionOrb mode={mode} size={72} />

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
              <Icon className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
              {phase.label}
              <span className="font-mono text-[11px] font-normal text-slate-400">
                {formatElapsed(elapsed)}
              </span>
            </p>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200/80">
              <motion.div
                animate={{ x: ["-100%", "180%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-500 via-blue-400 to-transparent"
              />
            </div>
            {step && step.title && (
              <p className="mt-1 truncate text-[11.5px] text-slate-500">
                {step.title}
                {step.tool ? ` · ${step.tool}` : ""}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Bosqichlar timeline'i — har bir harakat animatsiya bilan paydo bo'ladi.
 * Natijalar yashil (muvaffaqiyat) yoki qizil (xato) belgisi bilan.
 *
 * `settled` — ish tugagach ro'yxat QISQARADI: foydalanuvchi uzoq turgan
 * "qanday qadamlar bo'ldi" devorini ko'rmaydi, faqat bitta qator
 * ("3 ta amal bajarildi") qoladi. Rasm effekt bilan yopiladi, o'chganda
 * esa yana yumshoq tarqaladi. Bosish bilan yana ochiladi.
 */
export function AiSteps({ steps, settled }: { steps: ActivityStep[]; settled?: boolean }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;

  // Ish tugagach va foydalanuvchi ochmagan bo'lsa — yopiq holat.
  const collapsed = Boolean(settled) && !open;
  const done = steps.filter((s) => s.type === "result" && s.ok !== false).length;
  const failed = steps.filter((s) => s.type === "result" && s.ok === false).length;

  return (
    <div className="mb-2">
      {collapsed && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[11.5px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          title="Bajarilgan qadamlar ro'yxatini ochish"
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          {steps.length} ta amal bajarildi
          {failed > 0 && <span className="text-rose-500">({failed} ta xato)</span>}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      )}

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.35, ease: "easeInOut" } }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {settled && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mb-1.5 inline-flex items-center gap-1 text-[11px] text-slate-400 transition hover:text-slate-600"
              >
                <ChevronUp className="h-3 w-3" /> Yopish
              </button>
            )}
            <div className="space-y-1.5">
              {steps.map((s, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26, delay: i === 0 ? 0 : 0.04 }}
                >
                  <StepCard step={s} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {done > 0 && !collapsed && <span className="hidden">{done}</span>}
    </div>
  );
}

function StepCard({ step }: { step: ActivityStep }) {
  if (step.type === "thinking") {
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-500">
        <Sparkles className="h-3 w-3 shrink-0 text-indigo-400" /> {step.summary}
      </div>
    );
  }

  if (step.type === "warning") {
    return (
      <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
        <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" /> {step.summary}
      </div>
    );
  }

  if (step.type === "action") {
    return (
      <div className="relative overflow-hidden rounded-lg bg-slate-50 px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-700">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            className="inline-flex h-3.5 w-3.5 items-center justify-center"
          >
            <Wrench className="h-3.5 w-3.5 text-indigo-500" />
          </motion.span>
          {step.title}
          <code className="ml-1 rounded bg-slate-200/70 px-1.5 py-0.5 text-[10.5px] font-normal text-slate-600">
            {step.tool}
          </code>
        </div>
        {step.args != null && Object.keys(step.args as Record<string, unknown>).length > 0 && (
          <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-900/5 px-2 py-1 text-[10.5px] leading-relaxed text-slate-600">
            {JSON.stringify(step.args).slice(0, 320)}
          </pre>
        )}
        <motion.div
          animate={{ x: ["-100%", "220%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[12.5px] ${
        step.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-800"
      }`}
    >
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        className="mt-0.5 shrink-0"
      >
        {step.ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-rose-500" />
        )}
      </motion.span>
      <p className="whitespace-pre-wrap leading-relaxed">{step.summary}</p>
      {/* TEKSHIRUV: natija bazadan/diskdan qayta o'qilib tasdiqlandimi.
          Bu belgi "qildim" degan gapning ishonchlilik darajasini ko'rsatadi. */}
      {step.verified === true && (
        <span className="mt-1 flex shrink-0 items-center gap-1 rounded bg-white/70 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-700">
          <ShieldCheck className="h-3 w-3" />
          tekshirildi
        </span>
      )}
    </div>
  );
}

/**
 * Yakuniy javob uchun "yozayotgan" effekti — harf harf ochiladi.
 * Uzun matn tez, qisqa matn bir oz sekinroq yoziladi. `onDone` — matn
 * to'liq chiqqanda chaqiriladi (footer/usage shundan keyin ko'rinadi).
 */
export function TypewriterText({
  text,
  speed = 14,
  cursor = true,
  onDone,
}: {
  text: string;
  speed?: number;
  cursor?: boolean;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!text) {
      setShown(0);
      onDone?.();
      return;
    }
    doneRef.current = false;
    let n = 0;
    // Har tick'da nechta belgi: matn qancha uzun bo'lsa shuncha tez,
    // lekin hech qachon "birdan tugamaydi" — doim kamida ~0.6 s yoziladi.
    const chunk = Math.max(1, Math.round(text.length / 90));
    const id = setInterval(() => {
      n = Math.min(text.length, n + chunk);
      setShown(n);
      if (n >= text.length) {
        clearInterval(id);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone?.();
        }
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  const typing = shown < text.length;
  return (
    <span>
      {text.slice(0, shown)}
      {cursor && typing && (
        <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] animate-pulse bg-indigo-500 align-baseline" />
      )}
    </span>
  );
}

/**
 * "Dashboard yaratilmoqda..." — skelet kartalar + progress.
 * Haqiqiy dashboard shundan keyin animatsiya bilan ochiladi.
 * `onDone` — yig'ish animatsiyasi tugaganda chaqiriladi.
 */
export function DashboardBuilding({ onDone }: { onDone?: () => void }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const DURATION = 1100;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      setPct(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
      else onDone?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="mb-2.5 overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-white via-indigo-50/40 to-blue-50/50 p-3"
    >
      <div className="flex items-center gap-2">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          className="grid h-5 w-5 place-items-center"
        >
          <BarChart3 className="h-4 w-4 text-indigo-600" />
        </motion.span>
        <p className="text-[12px] font-semibold text-slate-700">Dashboard yaratilmoqda...</p>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-indigo-500">{pct}%</span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
        <motion.div
          style={{ width: `${pct}%` }}
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400"
        />
      </div>

      {/* Skelet KPI qatorlari — shu payt chiziqlar "chizilmoqda" */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="relative h-[54px] overflow-hidden rounded-xl border border-slate-200/70 bg-white p-2"
          >
            <div className="h-2 w-1/2 overflow-hidden rounded bg-slate-200">
              <motion.div
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
                className="h-full w-full bg-gradient-to-r from-transparent via-slate-400/60 to-transparent"
              />
            </div>
            <div className="mt-2 h-4 w-2/3 overflow-hidden rounded bg-slate-200/90">
              <motion.div
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: 0.15 + i * 0.12, ease: "easeInOut" }}
                className="h-full w-full bg-gradient-to-r from-transparent via-indigo-300/70 to-transparent"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
            className="h-1.5 w-1.5 rounded-full bg-indigo-500"
          />
        ))}
        <span className="text-[10.5px] text-slate-400">grafiklar va KPI kartalar yig'ilmoqda</span>
      </div>
    </motion.div>
  );
}

/**
 * Bot avatar — xabar pufog'idagi kichik ikona.
 *
 * Kichik o'lchamda shart bo'lib ORGINAL animatsiya o'z holicha qoladi:
 * `AiMotionOrb` yozuvni 48 px dan katta o'lchamlarda chiqaradi, shuning uchun
 * bu yerda ko'z sof holda qoladi.
 *
 * Atrofida qo'shimcha pulsatsiya YO'Q. Sfera o'zi rang almashib turadi va ko'z
 * qarqaraydi — bu yetarli. Uning ustiga yana halqa yoki xira nur qo'shilsa,
 * yumshoq gradientga begona ko'rinib, atrofga "sochilgan" effekt beradi.
 */
export function AiAvatar({ size = 28 }: { active?: boolean; size?: number }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <AiMotionOrb mode="idle" size={size} />
    </span>
  );
}

export { Bot, Database, Globe, PenLine, Loader2 };