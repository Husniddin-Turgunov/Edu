"use client";

// components/admin/ai/AiAnalyticsDashboard.tsx
// Analitik dashbord: umumiy ko'rinish, bo'limlar kesimi, kunlik grafik,
// ko'p yiqilayotgan testlar, eng qiyin savollar, bitta test va bitta xodim.
// Barchasi haqiqiy bazadagi TestResult.answers dan hisoblanadi.

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Users,
  ListChecks,
  Target,
  TrendingUp,
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  RefreshCw,
  Building2,
  FileDown,
  ScrollText,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

type Tab = "overview" | "departments" | "audit" | "usage" | "test" | "user";

type Overview = {
  generatedAt: string;
  users: { total: number; active: number; approved: number; pending: number; admins: number };
  tests: { total: number; active: number; draft: number; archived: number; questions: number };
  attempts: { total: number; last7days: number; last30days: number };
  performance: { avgScore: number; passRate: number; passed: number; failed: number };
  daily: { date: string; attempts: number; avgScore: number }[];
  departments: { department: string; users: number; attempts: number; avgScore: number; passRate: number }[];
  topFailingTests: { testId: string; title: string; attempts: number; passRate: number; avgScore: number }[];
  weakestQuestions: {
    questionId: string;
    testId: string;
    testTitle: string;
    text: string;
    answered: number;
    correctRate: number;
  }[];
  accessRules: number;
  aiUsage: { requests: number; cost: number; tokens: number };
};

type TestAnalytics = {
  testId: string;
  title: string;
  attempts: number;
  uniqueTakers: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  bestScore: number;
  worstScore: number;
  avgDurationSec: number;
  pendingGrading: number;
  passScore: number;
  servedQuestionCount: number;
  scoreBuckets: { label: string; count: number }[];
  hardest: { questionId: string; text: string; answered: number; correctRate: number }[];
};

type UserAnalytics = {
  userId: string;
  fullName: string;
  email: string;
  department: string | null;
  position: string | null;
  status: string;
  isActive: boolean;
  attempts: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  pendingGrading: number;
  lessonProgress: { completed: number; total: number; percent: number };
  jobProgress: { completed: number; total: number; percent: number };
  weakTests: { testId: string; title: string; attempts: number; avgScore: number }[];
  weakQuestions: { questionId: string; testTitle: string; text: string; answered: number; correctRate: number }[];
  accessNotes: { resourceType: string; effect: string; allowRetake: boolean }[];
};

export function AiAnalyticsDashboard({
  tests,
  users,
}: {
  tests: { id: string; title: string }[];
  users: { id: string; label: string; email: string; department: string }[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [testData, setTestData] = useState<TestAnalytics | null>(null);
  const [userData, setUserData] = useState<UserAnalytics | null>(null);
  const [testId, setTestId] = useState("");
  const [userId, setUserId] = useState("");
  const [audit, setAudit] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "overview") {
        const res = await fetch("/api/ai/analytics?view=overview", { cache: "no-store" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        setOverview(data.data);
      } else if (tab === "departments") {
        const res = await fetch("/api/ai/analytics?view=departments", { cache: "no-store" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        setDepartments(data.data);
      } else if (tab === "test" && testId) {
        const res = await fetch(`/api/ai/analytics?view=test&testId=${encodeURIComponent(testId)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        setTestData(data.data);
      } else if (tab === "user" && userId) {
        const res = await fetch(`/api/ai/analytics?view=user&userId=${encodeURIComponent(userId)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        setUserData(data.data);
      } else if (tab === "audit") {
        const res = await fetch("/api/ai/analytics?view=audit", { cache: "no-store" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        setAudit(data.data);
      } else if (tab === "usage") {
        const res = await fetch("/api/ai/analytics?view=usage", { cache: "no-store" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        setUsage(data.data);
      }
    } catch (err: any) {
      setError(err?.message || "Statistikani yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [tab, testId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Umumiy" },
    { key: "departments", label: "Bo'limlar" },
    { key: "test", label: "Test" },
    { key: "user", label: "Xodim" },
    { key: "audit", label: "AI izlari" },
    { key: "usage", label: "Sarf" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition ${
              tab === t.key
                ? "bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}

        {tab === "test" && (
          <select
            value={testId}
            onChange={(e) => setTestId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] outline-none"
          >
            <option value="">— testni tanlang —</option>
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}
        {tab === "user" && (
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] outline-none"
          >
            <option value="">— xodimni tanlang —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label} ({u.email})
              </option>
            ))}
          </select>
        )}

        <button
          onClick={load}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Yangilash
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
          {error}
        </p>
      )}

      {loading && <Loader2 className="mx-auto my-10 h-5 w-5 animate-spin text-indigo-500" />}

      {!loading && tab === "overview" && overview && (
        <div className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              label="Xodimlar"
              value={overview.users.total}
              sub={`${overview.users.active} faol · ${overview.users.pending} kutilmoqda`}
              tone="blue"
            />
            <StatCard
              icon={ListChecks}
              label="Testlar"
              value={overview.tests.total}
              sub={`${overview.tests.active} faol · ${overview.tests.questions} savol`}
              tone="indigo"
            />
            <StatCard
              icon={Target}
              label="O'tish darajasi"
              value={`${overview.performance.passRate}%`}
              sub={`o'tdi ${overview.performance.passed} · yiqildi ${overview.performance.failed}`}
              tone="emerald"
            />
            <StatCard
              icon={TrendingUp}
              label="O'rtacha ball"
              value={`${overview.performance.avgScore}%`}
              sub={`${overview.attempts.total} topshirish · 7 kunda ${overview.attempts.last7days}`}
              tone="cyan"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Kunlik topshirishlar va o'rtacha ball" icon={Activity}>
              {overview.daily.length === 0 ? (
                <Empty text="Hali topshirishlar yo'q." />
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={overview.daily}>
                    <CartesianGrid stroke="#eef1f6" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis yAxisId="a" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="b" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: "#e2e8f0" }}
                      labelFormatter={(v) => `Sana: ${v}`}
                    />
                    <Line yAxisId="a" type="monotone" dataKey="attempts" stroke="#4f46e5" strokeWidth={2} name="Topshirishlar" />
                    <Line yAxisId="b" type="monotone" dataKey="avgScore" stroke="#0d9488" strokeWidth={2} name="O'rtacha ball %" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel title="Ball taqsimoti (bo'limlar)" icon={BarChart3}>
              {overview.departments.length === 0 ? (
                <Empty text="Ma'lumot yo'q." />
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={overview.departments.slice(0, 10)} layout="vertical">
                    <CartesianGrid stroke="#eef1f6" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="department" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: "#e2e8f0" }}
                      formatter={(v: any, _n: any, p: any) => [`${v}%`, p?.payload?.department]}
                    />
                    <Bar dataKey="avgScore" radius={[0, 6, 6, 0]}>
                      {overview.departments.slice(0, 10).map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.avgScore >= 70 ? "#059669" : d.avgScore >= 50 ? "#d97706" : "#dc2626"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Ko'p yiqilayotgan testlar" icon={AlertTriangle}>
              {overview.topFailingTests.length === 0 ? (
                <Empty text="Baholangan topshirishlar yo'q." />
              ) : (
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="pb-1.5 font-medium">Test</th>
                      <th className="pb-1.5 font-medium">Topshirish</th>
                      <th className="pb-1.5 font-medium">O'tish</th>
                      <th className="pb-1.5 font-medium">Ball</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.topFailingTests.map((t) => (
                      <tr key={t.testId} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2">
                          <a href={`/admin/ai/analytics?testId=${t.testId}`} className="text-indigo-600 hover:underline">
                            {t.title}
                          </a>
                        </td>
                        <td className="py-1.5 text-slate-600">{t.attempts}</td>
                        <td className="py-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                              t.passRate >= 70
                                ? "bg-emerald-50 text-emerald-700"
                                : t.passRate >= 40
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {t.passRate}%
                          </span>
                        </td>
                        <td className="py-1.5 text-slate-600">{t.avgScore}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel title="O'zlashtirilmagan savollar" icon={AlertTriangle}>
              {overview.weakestQuestions.length === 0 ? (
                <Empty text="Statistika uchun topshirishlar yetarli emas." />
              ) : (
                <ul className="space-y-1.5">
                  {overview.weakestQuestions.slice(0, 10).map((q) => (
                    <li key={q.questionId} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2">
                      <p className="text-[12.5px] leading-relaxed text-slate-700">{q.text}</p>
                      <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="rounded bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700">
                          {q.correctRate}% to'g'ri
                        </span>
                        <span>{q.answered} marta berilgan</span>
                        <span className="truncate">· {q.testTitle}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <MiniStat label="Maxsus ko'rinish qoidalari" value={overview.accessRules} hint="AI orqali berilgan" />
            <MiniStat label="AI so'rovlari (jami)" value={overview.aiUsage.requests} hint="barcha kunlar" />
            <MiniStat
              label="AI sarfi (jami)"
              value={`$${overview.aiUsage.cost.toFixed(4)}`}
              hint={`${overview.aiUsage.tokens.toLocaleString("uz-UZ")} token`}
            />
          </div>
        </div>
      )}

      {!loading && tab === "departments" && (
        <Panel title="Bo'limlar kesimi" icon={Building2}>
          {departments.length === 0 ? (
            <Empty text="Ma'lumot yo'q." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[12.5px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="pb-2 font-medium">Bo'lim</th>
                    <th className="pb-2 font-medium">Xodimlar</th>
                    <th className="pb-2 font-medium">Faol</th>
                    <th className="pb-2 font-medium">Kutilmoqda</th>
                    <th className="pb-2 font-medium">Topshirish</th>
                    <th className="pb-2 font-medium">O'rtacha</th>
                    <th className="pb-2 font-medium">O'tish</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.department} className="border-t border-slate-100">
                      <td className="py-2 font-medium text-slate-800">{d.department}</td>
                      <td className="py-2 text-slate-600">{d.users}</td>
                      <td className="py-2 text-slate-600">{d.activeUsers}</td>
                      <td className="py-2 text-slate-600">{d.pending}</td>
                      <td className="py-2 text-slate-600">{d.attempts}</td>
                      <td className="py-2 text-slate-600">{d.avgScore}%</td>
                      <td className="py-2">
                        <Meter value={d.passRate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {!loading && tab === "test" && (
        <>
          {!testId ? (
            <Empty text="Yuqoridan testni tanlang." />
          ) : !testData ? null : (
            <div className="space-y-4">
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={Users} label="Topshirgan xodim" value={testData.uniqueTakers} sub={`${testData.attempts} urinish`} tone="blue" />
                <StatCard icon={Target} label="O'tish darajasi" value={`${testData.passRate}%`} sub={` chegar ${testData.passScore}%`} tone="emerald" />
                <StatCard icon={TrendingUp} label="O'rtacha ball" value={`${testData.avgScore}%`} sub={`${testData.bestScore}% — ${testData.worstScore}% oralig'ida`} tone="indigo" />
                <StatCard
                  icon={Clock}
                  label="O'rtacha vaqt"
                  value={formatDuration(testData.avgDurationSec)}
                  sub={`${testData.pendingGrading} ta kutilmoqda`}
                  tone="cyan"
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Panel title="Ball taqsimoti" icon={BarChart3}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={testData.scoreBuckets}>
                      <CartesianGrid stroke="#eef1f6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: "#e2e8f0" }} />
                      <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Topshirishlar" />
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>

                <Panel title="Eng qiyin savollar" icon={AlertTriangle}>
                  {testData.hardest.length === 0 ? (
                    <Empty text="Savollar hali berilmagan." />
                  ) : (
                    <ul className="space-y-1.5">
                      {testData.hardest.map((q) => (
                        <li key={q.questionId} className="rounded-lg bg-slate-50 px-2.5 py-2">
                          <p className="text-[12.5px] leading-relaxed text-slate-700">{q.text}</p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {q.correctRate}% to'g'ri · {q.answered} marta
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && tab === "user" && (
        <>
          {!userId ? (
            <Empty text="Yuqoridan xodimni tanlang." />
          ) : !userData ? null : (
            <div className="space-y-4">
              <header className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-[15px] font-semibold text-slate-800">{userData.fullName}</h3>
                <p className="mt-0.5 text-[12.5px] text-slate-500">
                  {userData.email}
                  {userData.department ? ` · ${userData.department}` : ""}
                  {userData.position ? ` · ${userData.position}` : ""} · {userData.status}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MiniStat label="Topshirish" value={userData.attempts} hint={`${userData.passed} o'tdi`} />
                  <MiniStat label="O'rtacha ball" value={`${userData.avgScore}%`} hint={`o'tish ${userData.passRate}%`} />
                  <MiniStat
                    label="Darslar"
                    value={`${userData.lessonProgress.completed}/${userData.lessonProgress.total}`}
                    hint={`${userData.lessonProgress.percent}%`}
                  />
                  <MiniStat
                    label="Kasbiy kunlar"
                    value={`${userData.jobProgress.completed}/${userData.jobProgress.total}`}
                    hint={`${userData.jobProgress.percent}%`}
                  />
                </div>
              </header>

              <div className="grid gap-3 lg:grid-cols-2">
                <Panel title="Zaif testlar" icon={AlertTriangle}>
                  {userData.weakTests.length === 0 ? (
                    <Empty text="Zaif test yo'q — natija 70% dan yuqori." />
                  ) : (
                    <ul className="space-y-1">
                      {userData.weakTests.map((t) => (
                        <li key={t.testId} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-[12.5px]">
                          <span className="truncate text-slate-700">{t.title}</span>
                          <span className="ml-2 shrink-0 text-slate-500">
                            {t.avgScore}% · {t.attempts} urinish
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Xato qilingan savollar" icon={ListChecks}>
                  {userData.weakQuestions.length === 0 ? (
                    <Empty text="Xato qilingan savol topilmadi." />
                  ) : (
                    <ul className="space-y-1.5">
                      {userData.weakQuestions.slice(0, 10).map((q) => (
                        <li key={q.questionId} className="rounded-lg bg-slate-50 px-2.5 py-2">
                          <p className="text-[12.5px] leading-relaxed text-slate-700">{q.text}</p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {q.correctRate}% to'g'ri · {q.testTitle}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              {userData.accessNotes.length > 0 && (
                <Panel title="Maxsus ruxsatlar" icon={ScrollText}>
                  <ul className="space-y-1">
                    {userData.accessNotes.map((n, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[12.5px]">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${
                            n.effect === "deny" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {n.effect}
                        </span>
                        <span className="text-slate-600">{n.resourceType}</span>
                        {n.allowRetake && (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10.5px] text-indigo-700">
                            qayta topshirish
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              {userData.userId && (
                <a
                  href={`/api/admin/skills/user-report?userId=${userData.userId}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <FileDown className="h-3.5 w-3.5" /> PDF hisobotni yuklab olish
                </a>
              )}
            </div>
          )}
        </>
      )}

      {!loading && tab === "audit" && (
        <Panel title="AI amal izlari" icon={ScrollText}>
          {audit.length === 0 ? (
            <Empty text="Hozircha amal yo'q." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[12.5px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="pb-2 font-medium">Vaqt</th>
                    <th className="pb-2 font-medium">Kim</th>
                    <th className="pb-2 font-medium">Amal</th>
                    <th className="pb-2 font-medium">Natija</th>
                    <th className="pb-2 font-medium">Tafsilot</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-1.5 whitespace-nowrap text-slate-500">
                        {new Date(r.date).toLocaleString("uz-UZ")}
                      </td>
                      <td className="py-1.5 text-slate-700">{r.actor}</td>
                      <td className="py-1.5">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                          {r.action}
                        </code>
                      </td>
                      <td className="py-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${
                            r.outcome === "ok"
                              ? "bg-emerald-50 text-emerald-700"
                              : r.outcome === "denied"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {r.outcome}
                        </span>
                      </td>
                      <td className="py-1.5 text-slate-600">{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {!loading && tab === "usage" && usage && (
        <Panel title="AI sarfi va kvota" icon={Activity}>
          <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
            <StatCard
              icon={Activity}
              label="Model"
              value={usage.provider.model}
              sub={usage.provider.live ? usage.provider.name : "kalit yo'q (offline rejim)"}
              tone="indigo"
            />
            <MiniStat label="Kunlik limit" value={usage.dailyLimit} hint={usage.today} />
            <MiniStat
              label="Bugungi so'rovlar"
              value={usage.rows.find((r: any) => r.day === usage.today)?.requests ?? 0}
              hint="shu foydalanuvchi uchun"
            />
          </div>
          {usage.rows.length === 0 ? (
            <Empty text="Sarf ma'lumoti yo'q." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-[12.5px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="pb-2 font-medium">Kun</th>
                    <th className="pb-2 font-medium">Foydalanuvchi</th>
                    <th className="pb-2 font-medium">So'rov</th>
                    <th className="pb-2 font-medium">Token</th>
                    <th className="pb-2 font-medium">Narx</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.rows.map((r: any, i: number) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-600">{r.day}</td>
                      <td className="py-1.5 text-slate-700">{r.email}</td>
                      <td className="py-1.5 text-slate-600">{r.requests}</td>
                      <td className="py-1.5 text-slate-600">
                        {(r.promptTokens + r.completionTokens).toLocaleString("uz-UZ")}
                      </td>
                      <td className="py-1.5 text-slate-600">${r.cost.toFixed(5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  tone: "blue" | "indigo" | "emerald" | "cyan";
}) {
  const tones: Record<string, string> = {
    blue: "from-blue-600 to-sky-600",
    indigo: "from-indigo-600 to-violet-600",
    emerald: "from-emerald-600 to-teal-600",
    cyan: "from-cyan-600 to-blue-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${tones[tone]} text-white`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11.5px] text-slate-500">{label}</p>
          <p className="truncate text-[20px] font-bold leading-tight text-slate-800">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-[11.5px] text-slate-400">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-[16px] font-bold text-slate-800">{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-800">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-[12.5px] text-slate-500">{text}</p>;
}

function Meter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-[11.5px] text-slate-500">{value}%</span>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds} son`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} daq ${s} son`;
}

export { AiAnalyticsDashboard as default };