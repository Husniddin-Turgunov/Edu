"use client";

// components/admin/ai/AiDataCard.tsx
// Chatdagi statistikani chiroyli, animatsiyali dashboardga aylantiradi.
//
// Maqsad: foydalanuvchi sonlarni YO'QIB qolmasin вЂ” KPI kartalar, donut
// o'lchagich, kunlik grafik (area) va reytingli ustunlar. Barchasi
// framer-motion bilan animatsiyalangan: kartalar ketma-ket paydo bo'ladi,
// ustunlar noldan o'sadi, raqamlar hisoblanadi, donut aylanadi.
//
// Tanilmagan natija -> null (oddiy matnli qadam qoladi).

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Users,
  FileQuestion,
  Send,
  Target,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Trophy,
  ShieldCheck,
  Clock,
  Gauge as GaugeIcon,
} from "lucide-react";

type Props = {
  tool?: string;
  data: unknown;
  summary?: string;
};

/* ------------------------------------------------------------------ */
/*  Animatsiya yordamchilari                                          */
/* ------------------------------------------------------------------ */

/** Raqamni bosqichma-bosqich hisoblab ko'rsatadi (kub ease-out). */
function useCountUp(target: number, durationMs = 900) {
  const safe = Number.isFinite(target) ? target : 0;
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(safe * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [safe, durationMs]);
  return value;
}

const card = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring" as const, stiffness: 260, damping: 24 },
};

function Kpi({
  icon: Icon,
  label,
  value,
  suffix = "",
  hint,
  from,
  to,
  index = 0,
}: {
  icon: any;
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
  from: string;
  to: string;
  index?: number;
}) {
  const shown = useCountUp(value);
  return (
    <motion.div
      {...card}
      transition={{ type: "spring", stiffness: 260, damping: 24, delay: index * 0.06 }}
      whileHover={{ y: -3, scale: 1.02 }}
      className={`relative overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br ${from} ${to} p-2.5 text-white shadow-md`}
    >
      <motion.span
        animate={{ x: ["-120%", "220%"] }}
        transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 2.6, ease: "easeInOut" }}
        className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-white/25 blur-md"
      />
      <div className="relative flex items-center gap-1.5">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-white/25">
          <Icon className="h-3 w-3" />
        </span>
        <span className="truncate text-[10.5px] font-medium uppercase tracking-wide text-white/85">
          {label}
        </span>
      </div>
      <p className="relative mt-1.5 text-[19px] font-extrabold leading-none tabular-nums">
        {Math.round(shown)}
        {suffix}
      </p>
      {hint && <p className="relative mt-1 truncate text-[10.5px] text-white/80">{hint}</p>}
    </motion.div>
  );
}

/** Donut o'lchagich вЂ” o'tish darajasi / o'rtacha ball. */
function Donut({
  value,
  label,
  size = 92,
  color = "#34d399",
  delay = 0.1,
}: {
  value: number;
  label: string;
  size?: number;
  color?: string;
  delay?: number;
}) {
  const shown = useCountUp(value, 1100);
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (c * pct) / 100 }}
            transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-[17px] font-extrabold leading-none tabular-nums text-slate-800">
              {Math.round(shown)}%
            </p>
            <p className="mt-0.5 text-[9.5px] font-medium uppercase tracking-wide text-slate-400">
              {label}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Kunlik topshirishlar вЂ” SVG area grafik. */
function DailyArea({ daily }: { daily: { date: string; attempts: number; avgScore: number }[] }) {
  const rows = (daily || []).slice(-14);
  if (rows.length < 2) return null;
  const w = 260;
  const h = 74;
  const max = Math.max(...rows.map((r) => r.attempts), 1);
  const step = w / (rows.length - 1);
  const pts = rows.map((r, i) => [i * step, h - (r.attempts / max) * (h - 10) - 4] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const shown = useCountUp(rows.reduce((a, r) => a + r.attempts, 0));

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Kunlik topshirishlar
        </p>
        <p className="text-[11px] tabular-nums text-slate-400">
          {rows[0]?.date?.slice(5)} в†’ {rows[rows.length - 1]?.date?.slice(5)}
        </p>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-[74px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ak-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <motion.path
          d={area}
          fill="url(#ak-area)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.35 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="#4f46e5"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.15, ease: "easeInOut" }}
        />
        {pts.map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r={2.4}
            fill="#fff"
            stroke="#4f46e5"
            strokeWidth={1.6}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.03, type: "spring", stiffness: 320, damping: 18 }}
          />
        ))}
      </svg>
      <p className="text-[10.5px] text-slate-400">
        Jami {Math.round(shown)} ta topshirish В· eng ko'p {max} ta/kun
      </p>
    </div>
  );
}

/** Reytingli ustunlar (gorizontal). */
function RankBars({
  rows,
  unit = "%",
  tone = "indigo",
  delay = 0.2,
}: {
  rows: { label: string; value: number; hint?: string }[];
  unit?: string;
  tone?: "indigo" | "rose" | "emerald" | "amber";
  delay?: number;
}) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-500 to-blue-400",
    rose: "from-rose-500 to-pink-400",
    emerald: "from-emerald-500 to-teal-400",
    amber: "from-amber-500 to-orange-400",
  };
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);

  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + i * 0.05, duration: 0.35 }}
          className="group"
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[11.5px] font-medium text-slate-700" title={r.label}>
              {r.label}
            </p>
            <p className="shrink-0 text-[11.5px] font-bold tabular-nums text-slate-800">
              {Math.round(r.value)}
              {unit}
            </p>
          </div>
          <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(3, (Math.abs(r.value) / max) * 100)}%` }}
              transition={{ delay: delay + i * 0.05, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full rounded-full bg-gradient-to-r ${tones[tone]} shadow-sm`}
            />
          </div>
          {r.hint && <p className="mt-0.5 truncate text-[10px] text-slate-400">{r.hint}</p>}
        </motion.div>
      ))}
    </div>
  );
}

/** Xodimlar ro'yxati вЂ” bosh harflar bilan avatar. */
function People({ rows }: { rows: any[] }) {
  const palette = [
    "from-indigo-500 to-blue-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-500",
    "from-violet-500 to-purple-500",
  ];
  return (
    <div className="space-y-1.5">
      {rows.map((u, i) => {
        const name = String(u.fullName || u.label || u.email || "?");
        const initials = name
          .split(" ")
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase() || "")
          .join("");
        const meta = [u.department, u.position].filter(Boolean).join(" В· ");
        return (
          <motion.div
            key={u.id || i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, duration: 0.3 }}
            whileHover={{ x: 3 }}
            className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white/80 px-2 py-1.5"
          >
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${palette[i % palette.length]} text-[11px] font-bold text-white`}
            >
              {initials || "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-slate-800">{name}</p>
              <p className="truncate text-[10.5px] text-slate-500">
                {meta || u.email || "вЂ”"}
                {meta && u.email ? ` В· ${u.email}` : ""}
              </p>
            </div>
            {u.status && (
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold ${
                  u.status === "approved"
                    ? "bg-emerald-50 text-emerald-700"
                    : u.status === "pending"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-rose-50 text-rose-700"
                }`}
              >
                {u.status}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function Frame({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <motion.div
      {...card}
      className="space-y-2 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-3 shadow-sm"
    >
      <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5 text-indigo-500" />
        {title}
      </p>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dispatcher                                                         */
/* ------------------------------------------------------------------ */

export function AiDataCard({ tool, data, summary }: Props) {
  if (!data || typeof data !== "object") return null;
  const d = data as any;

  /* --- Umumiy analitika: to'liq dashboard --- */
  if (d.users && d.tests && d.attempts && d.performance) {
const daily: any[] = d.daily || [];
    // Topshirish bo'lmagan bo'limlar 0% ko'rsatib chalkashtiradi — ular chiqariladi
    const depts: any[] = (d.departments || [])
      .filter((x: any) => Number(x.attempts || 0) > 0)
      .slice(0, 6);
    const weakTests: any[] = (d.topFailingTests || []).slice(0, 5);
    const weakQ: any[] = (d.weakestQuestions || []).slice(0, 5);

    return (
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="mb-2.5 space-y-2"
      >
        {/* KPI kartalar */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Kpi
            index={0}
            icon={Users}
            label="Xodimlar"
            value={Number(d.users.total || 0)}
            hint={`${d.users.active || 0} faol В· ${d.users.pending || 0} kutilmoqda`}
            from="from-indigo-500"
            to="to-blue-600"
          />
          <Kpi
            index={1}
            icon={FileQuestion}
            label="Testlar"
            value={Number(d.tests.total || 0)}
            hint={`${d.tests.active || 0} faol В· ${d.tests.questions || 0} savol`}
            from="from-violet-500"
            to="to-purple-600"
          />
          <Kpi
            index={2}
            icon={Send}
            label="Topshirish"
            value={Number(d.attempts.total || 0)}
            hint={`7 kunda ${d.attempts.last7days || 0}`}
            from="from-emerald-500"
            to="to-teal-600"
          />
          <Kpi
            index={3}
            icon={GaugeIcon}
            label="O'rtacha ball"
            value={Number(d.performance.avgScore || 0)}
            suffix="%"
            hint={`${d.performance.passed || 0} o'tdi В· ${d.performance.failed || 0} otmadi`}
            from="from-amber-500"
            to="to-orange-600"
          />
        </div>

        {/* O'tish darajasi + kunlik grafik */}
        <div className="grid gap-2 sm:grid-cols-2">
          <Frame title="O'tish darajasi" icon={Target}>
            <div className="flex items-center justify-around">
              <Donut value={Number(d.performance.passRate || 0)} label="o'tish" color="#10b981" />
              <Donut value={Number(d.performance.avgScore || 0)} label="ball" color="#6366f1" delay={0.2} />
            </div>
            <div className="flex justify-around text-center">
              <p className="text-[10.5px] text-slate-500">
                o'tgan: <b className="text-emerald-600">{d.performance.passed || 0}</b>
              </p>
              <p className="text-[10.5px] text-slate-500">
                otgan: <b className="text-rose-600">{d.performance.failed || 0}</b>
              </p>
            </div>
          </Frame>

          <Frame title="Kunlik dinamika" icon={TrendingUp}>
            {daily.length > 1 ? (
              <DailyArea daily={daily} />
            ) : (
              <p className="py-4 text-center text-[11.5px] text-slate-400">Kunlik ma'lumot yetarli emas</p>
            )}
          </Frame>
        </div>

        {/* Bo'limlar + zaif testlar */}
{depts.length > 0 ? (
          <Frame title="Bo'limlar kesimi — o'rtacha ball" icon={BarChart3}>
            <RankBars
              rows={depts.map((r) => ({
                label: r.department,
                value: Number(r.avgScore || 0),
                hint: `${r.attempts || 0} topshirish · o'tish ${r.passRate || 0}% · ${r.users || 0} xodim`,
              }))}
            />
          </Frame>
        ) : (
          <Frame title="Bo'limlar kesimi" icon={BarChart3}>
            <p className="py-3 text-center text-[11.5px] text-slate-400">
              Hali topshirishlar yo'q — bo'limlar kesimi uchun statistika to'planadi
            </p>
          </Frame>
        )}

        {(weakTests.length > 0 || weakQ.length > 0) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {weakTests.length > 0 && (
              <Frame title="Ko'p yiqilayotgan testlar" icon={AlertTriangle}>
                <RankBars
                  tone="rose"
                  rows={weakTests.map((t) => ({
                    label: t.title,
                    value: 100 - Number(t.passRate || 0),
                    hint: `${t.attempts || 0} urinish В· o'tish ${t.passRate || 0}%`,
                  }))}
                  unit="%"
                />
              </Frame>
            )}
            {weakQ.length > 0 && (
              <Frame title="Eng zaif savollar" icon={AlertTriangle}>
                <RankBars
                  tone="amber"
                  rows={weakQ.map((q) => ({
                    label: String(q.text || "").slice(0, 70),
                    value: Number(q.correctRate || 0),
                    hint: `${q.testTitle || ""} В· ${q.answered || 0} marta berilgan`,
                  }))}
                />
              </Frame>
            )}
          </div>
        )}

        {(d.aiUsage?.requests > 0 || d.accessRules > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {d.aiUsage?.requests > 0 && (
              <Pill icon={BarChart3} label={`AI so'rov ${d.aiUsage.requests}`} hint={`${d.aiUsage.tokens || 0} token В· $${Number(d.aiUsage.cost || 0).toFixed(4)}`} />
            )}
            {d.accessRules > 0 && (
              <Pill icon={ShieldCheck} label={`Maxsus ko'rinish ${d.accessRules}`} hint="kirish qoidasi" />
            )}
          </div>
        )}

        {summary && <p className="text-[10.5px] text-slate-400">{summary}</p>}
      </motion.div>
    );
  }

/* --- Bo'limlar kesimi --- */
  if (Array.isArray(d.rows) && d.rows[0]?.department) {
    const withData = d.rows.filter((r: any) => Number(r.attempts || 0) > 0);
    const shown = withData.length ? withData : [];
    return (
      <motion.div {...card} className="mb-2.5 space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3">
        <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
          <BarChart3 className="h-3.5 w-3.5 text-indigo-500" /> Bo'limlar kesimi
        </p>
        {shown.length ? (
          <>
            <RankBars
              rows={shown.map((r: any) => ({
                label: r.department,
                value: Number(r.avgScore || 0),
                hint: `${r.attempts || 0} topshirish · o'tish ${r.passRate || 0}% · ${r.users || 0} xodim`,
              }))}
            />
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <MiniBar label="Topshirish" rows={shown.map((r: any) => [r.department, r.attempts] as const)} tone="from-blue-500 to-cyan-400" />
              <MiniBar label="O'tish %" rows={shown.map((r: any) => [r.department, r.passRate] as const)} tone="from-emerald-500 to-teal-400" />
              <MiniBar label="Xodim" rows={shown.map((r: any) => [r.department, r.users] as const)} tone="from-violet-500 to-purple-400" />
            </div>
          </>
        ) : (
          <p className="py-3 text-center text-[11.5px] text-slate-400">
            Bo'limlar kesimi uchun hozircha topshirishlar yo'q
          </p>
        )}
        {summary && <p className="text-[10.5px] text-slate-400">{summary}</p>}
      </motion.div>
    );
  }

  /* --- Zaif savollar --- */
  if (Array.isArray(d.rows) && (d.rows[0]?.correctRate != null || d.rows[0]?.difficulty != null)) {
    return (
      <motion.div {...card} className="mb-2.5 space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3">
        <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> O'zlashtirilmagan savollar
        </p>
        <RankBars
          tone="amber"
          unit="%"
          rows={d.rows.slice(0, 12).map((q: any) => ({
            label: String(q.text || "").slice(0, 90),
            value: Number(q.correctRate || 0),
            hint: `${q.testTitle || ""} В· ${q.answered || 0} marta В· qiyinlik ${Math.round((1 - Number(q.correctRate || 0)) * 100)}%`,
          }))}
        />
        {summary && <p className="text-[10.5px] text-slate-400">{summary}</p>}
      </motion.div>
    );
  }

  /* --- Test analitikasi --- */
  if (d.attempts != null && d.passRate != null && (d.scoreBuckets || d.title)) {
    return (
      <motion.div {...card} className="mb-2.5 space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3">
        <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-700">
          <Trophy className="h-3.5 w-3.5 text-amber-500" /> {d.title || "Test"}
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Kpi index={0} icon={Send} label="Topshirish" value={Number(d.attempts)} hint={`${d.uniqueTakers || 0} xodim`} from="from-indigo-500" to="to-blue-600" />
          <Kpi index={1} icon={GaugeIcon} label="O'rtacha" value={Number(d.avgScore || 0)} suffix="%" hint={`eng yaxshi ${d.bestScore || 0}%`} from="from-emerald-500" to="to-teal-600" />
          <Kpi index={2} icon={Target} label="O'tish" value={Number(d.passRate || 0)} suffix="%" hint={`o'tish balyi ${d.passScore || 0}%`} from="from-amber-500" to="to-orange-600" />
          <Kpi index={3} icon={Clock} label="O'rtacha vaqt" value={Number(d.avgDurationSec || 0)} suffix="s" hint={`${d.questionCount || 0} savol`} from="from-violet-500" to="to-purple-600" />
        </div>
        {Array.isArray(d.scoreBuckets) && d.scoreBuckets.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ball taqsimoti
            </p>
            <div className="flex h-16 items-end gap-1">
              {d.scoreBuckets.map((b: any, i: number) => {
                const max = Math.max(...d.scoreBuckets.map((x: any) => x.count || 0), 1);
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(6, ((b.count || 0) / max) * 52)}px` }}
                      transition={{ delay: 0.1 + i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-blue-400"
                      title={`${b.label}: ${b.count}`}
                    />
                    <span className="truncate text-[8.5px] text-slate-400">{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {Array.isArray(d.questions) && d.questions.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Savol qiyinligi
            </p>
            <RankBars
              tone="amber"
              unit="%"
              delay={0.3}
              rows={d.questions.slice(0, 8).map((q: any) => ({
                label: String(q.text || "").slice(0, 80),
                value: Number(q.correctRate || 0),
                hint: `${q.answered || 0} marta berilgan`,
              }))}
            />
          </div>
        )}
      </motion.div>
    );
  }

  /* --- Xodim analitikasi --- */
  if (d.fullName && d.attempts != null) {
    return (
      <motion.div {...card} className="mb-2.5 space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3">
        <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-700">
          <Users className="h-3.5 w-3.5 text-indigo-500" /> {d.fullName}
          <span className="truncate text-[11px] font-normal text-slate-400">{d.email}</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Kpi index={0} icon={Send} label="Topshirish" value={Number(d.attempts)} hint={`${d.testsTouched || 0} test`} from="from-indigo-500" to="to-blue-600" />
          <Kpi index={1} icon={GaugeIcon} label="O'rtacha" value={Number(d.avgScore || 0)} suffix="%" hint={`eng yaxshi ${d.bestScore || 0}%`} from="from-emerald-500" to="to-teal-600" />
          <Kpi index={2} icon={Target} label="O'tish" value={Number(d.passRate || 0)} suffix="%" hint={`${d.passed || 0}/${d.failed || 0}`} from="from-amber-500" to="to-orange-600" />
          <Kpi index={3} icon={TrendingUp} label="Kurslar" value={Number(d.coursesEnrolled || 0)} hint={`dars ${d.lessonProgress?.completed || 0}/${d.lessonProgress?.total || 0}`} from="from-violet-500" to="to-purple-600" />
        </div>
        {d.jobProgress?.total > 0 && (
          <RankBars
            tone="emerald"
            delay={0.25}
            rows={[
              { label: "Darslar", value: Number(d.lessonProgress?.percent || 0), hint: `${d.lessonProgress?.completed || 0}/${d.lessonProgress?.total || 0}` },
              { label: "Ish bosqichlari", value: Number(d.jobProgress?.percent || 0), hint: `${d.jobProgress?.completed || 0}/${d.jobProgress?.total || 0}` },
            ]}
          />
        )}
        {Array.isArray(d.weakTests) && d.weakTests.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Zaif testlar
            </p>
            <RankBars
              tone="rose"
              delay={0.3}
              rows={d.weakTests.slice(0, 5).map((t: any) => ({
                label: t.title,
                value: Number(t.avgScore || 0),
                hint: `${t.attempts || 0} urinish`,
              }))}
            />
          </div>
        )}
      </motion.div>
    );
  }

  /* --- Foydalanuvchilar ro'yxati --- */
  if (tool === "user.search" && Array.isArray(d.rows) && d.rows.length > 0) {
    return (
      <motion.div {...card} className="mb-2.5 space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3">
        <p className="flex items-center justify-between text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-indigo-500" /> Xodimlar
          </span>
          <span className="text-[11px] font-semibold text-slate-400">{d.rows.length} ta</span>
        </p>
        <People rows={d.rows} />
      </motion.div>
    );
  }

  return null;
}

function Pill({ icon: Icon, label, hint }: { icon: any; label: string; hint?: string }) {
  return (
    <motion.span
      {...card}
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5"
    >
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span className="text-[11.5px] font-semibold text-slate-700">{label}</span>
      {hint && <span className="text-[10.5px] text-slate-400">{hint}</span>}
    </motion.span>
  );
}

/** Kichik vertikal mini-grafik (bo'limlar uchun). */
function MiniBar({
  label,
  rows,
  tone,
}: {
  label: string;
  rows: readonly (readonly [string, number | undefined])[];
  tone: string;
}) {
  const max = Math.max(...rows.map((r) => Number(r[1]) || 0), 1);
  return (
    <div className="rounded-xl border border-slate-100 bg-white/70 p-1.5">
      <p className="truncate text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1 flex h-9 items-end gap-0.5">
        {rows.map((r, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(4, ((Number(r[1]) || 0) / max) * 32)}px` }}
            transition={{ delay: 0.15 + i * 0.05, duration: 0.6 }}
            className={`flex-1 rounded-t-sm bg-gradient-to-t ${tone}`}
            title={`${r[0]}: ${r[1] ?? 0}`}
          />
        ))}
      </div>
    </div>
  );
}
