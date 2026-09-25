"use client";

import { useEffect, useState } from "react";
import { AdminSidebar, AdminHeader } from "@/components/admin/AdminSidebar";
import {
  Award,
  Users,
  FileCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChart,
  Target,
  Zap,
  ClipboardList,
  Download,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

type Overview = {
  totalUsers: number;
  totalTests: number;
  totalResults: number;
  passedResults: number;
  pendingGrading: number;
  avgScore: number;
  passRate: number;
};

type TestStat = {
  id: string;
  title: string;
  passScore: number;
  totalAttempts: number;
  questionCount: number;
  avgScore: number;
  passRate: number;
};

type UserLevel = {
  id: string;
  name: string;
  email: string;
  department: string;
  avgScore: number;
  totalAttempts: number;
  totalPassed: number;
  level: string;
  levelColor: string;
  recentTests: { testTitle: string; score: number; passed: boolean; date: string }[];
};

type DailyResult = { date: string; count: number; avgScore: number };

type SubmissionRow = {
  id: string;
  score: number | null;
  passed: boolean;
  gradingStatus?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  user?: { id: string; name: string; surname?: string; email: string };
  test?: { title: string };
  testId?: string;
  userId?: string;
};

const LEVEL_COLORS: Record<string, string> = {
  "I daraja": "bg-violet-100 text-violet-800 border-violet-200",
  "II daraja": "bg-blue-100 text-blue-800 border-blue-200",
  "III daraja": "bg-amber-100 text-amber-800 border-amber-200",
  "Baholanmagan": "bg-neutral-100 text-neutral-500 border-neutral-200",
};

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#9ca3af"];

/** Ism-familiyani to'liq qaytaradi (surname + name → fullName → name) */
function fullNameOf(u: any): string {
  if (!u) return "";
  const combined = [u.surname, u.name].filter(Boolean).join(" ").trim();
  return combined || u.fullName || u.name || u.email || "";
}

/** Daraja bo'yicha rang */
function levelBadgeClass(level?: string): string {
  const key = level || "Baholanmagan";
  return LEVEL_COLORS[key] || LEVEL_COLORS["Baholanmagan"];
}

export default function SkillsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [view, setView] = useState<"dashboard" | "users" | "tests" | "submissions">("dashboard");
  const [submissions, setSubmissions] = useState<SubmissionRow[] | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [subSearch, setSubSearch] = useState("");
  const [subFilter, setSubFilter] = useState<"all" | "passed" | "failed" | "pending">("all");

  useEffect(() => {
    fetch("/api/admin/skills?action=overview", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Topshiruvlar statistikasi — barcha test topshiruvlari (admin)
  useEffect(() => {
    if (view !== "submissions" || submissions !== null) return;
    setSubmissionsLoading(true);
    fetch("/api/tests/history?all=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setSubmissions(d.ok && Array.isArray(d.results) ? d.results : []); })
      .catch(() => setSubmissions([]))
      .finally(() => setSubmissionsLoading(false));
  }, [view, submissions]);

  if (loading) {
    return (
      <div className="flex h-screen bg-[#F8FAFF]">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-sm text-neutral-500">Yuklanmoqda...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen bg-[#F8FAFF]">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-neutral-500">Ma'lumot topilmadi</p>
        </div>
      </div>
    );
  }

  const { overview, testAnalytics, userLevels, dailyResults } = data;

  // Filtrlangan foydalanuvchilar
  const filtered = userLevels.filter((u: UserLevel) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.department || "").toLowerCase().includes(search.toLowerCase())
  );

  // Daraja taqsimoti
  const levelDistribution = [
    { name: "I daraja", value: userLevels.filter((u: UserLevel) => u.level === "I daraja").length },
    { name: "II daraja", value: userLevels.filter((u: UserLevel) => u.level === "II daraja").length },
    { name: "III daraja", value: userLevels.filter((u: UserLevel) => u.level === "III daraja").length },
  ];

  // Haqiqiy test natijalari bormi? (Baholanmagan hisoblanmaydi)
  const hasTestData = overview.totalResults > 0;

  return (
    <div className="flex h-screen bg-[#F8FAFF]">
      <AdminSidebar />
      <div className="flex-1 overflow-y-auto">
        <AdminHeader
          title="Malaka tekshirish"
          subtitle="Hodimlarning bilim darajasini baholash tizimi"
          action={
            <div className="flex gap-2">
              {([
                ["dashboard", "Dashboard"],
                ["users", "Hodimlar"],
                ["tests", "Testlar"],
                ["submissions", "Topshiruvlar"],
              ] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    view === v
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />

        <div className="p-8">
          {view === "dashboard" && (
            <DashboardView
              overview={overview}
              testAnalytics={testAnalytics}
              userLevels={userLevels}
              dailyResults={dailyResults}
              levelDistribution={levelDistribution}
              hasTestData={hasTestData}
            />
          )}

          {view === "users" && (
            <UsersView
              filtered={filtered}
              search={search}
              setSearch={setSearch}
              expandedUser={expandedUser}
              setExpandedUser={setExpandedUser}
              testAnalytics={testAnalytics}
            />
          )}

          {view === "tests" && <TestsView testAnalytics={testAnalytics} />}

          {view === "submissions" && (
            <SubmissionsView
              submissions={submissions}
              loading={submissionsLoading}
              search={subSearch}
              setSearch={setSubSearch}
              filter={subFilter}
              setFilter={setSubFilter}
              onRefresh={() => { setSubmissions(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ====== Dashboard View ======
function DashboardView({ overview, testAnalytics, userLevels, dailyResults, levelDistribution, hasTestData }: any) {
  const statCards = [
    { label: "Jami hodimlar", value: overview.totalUsers, icon: Users, color: "blue" },
    { label: "Faol testlar", value: overview.totalTests, icon: FileCheck, color: "indigo" },
    { label: "Jami topshirish", value: overview.totalResults, icon: BarChart3, color: "violet" },
    { label: "O'rtacha ball", value: `${overview.avgScore}%`, icon: TrendingUp, color: "emerald" },
    { label: "O'tish foizi", value: `${overview.passRate}%`, icon: Target, color: "amber" },
    { label: "Kutilayotgan", value: overview.pendingGrading, icon: Clock, color: "rose" },
  ];

  return (
    <div className="space-y-6">
      {/* Statistika kartochkalari */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s: any) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-neutral-100 p-4 hover:shadow-lg transition-shadow">
              <div className={`w-10 h-10 rounded-xl bg-${s.color}-50 flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 text-${s.color}-600`} />
              </div>
              <div className="text-2xl font-bold text-neutral-900">{s.value}</div>
              <div className="text-xs text-neutral-500 mt-1">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Grafiklar qatori */}
      {hasTestData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kunlik natijalar */}
          {dailyResults.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-100 p-6">
              <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Kunlik topshirishlar
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyResults}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Topshirishlar" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bilim darajalari taqsimoti */}
          {levelDistribution.some((l: any) => l.value > 0) && (
            <div className="bg-white rounded-2xl border border-neutral-100 p-6">
              <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-violet-600" />
                Bilim darajalari taqsimoti
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <RePieChart>
                  <Pie
                    data={levelDistribution.filter((l: any) => l.value > 0)}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ percent }) => `${Math.round((percent || 0) * 100)}%`}
                    labelLine={false}
                  >
                    {levelDistribution.filter((l: any) => l.value > 0).map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    verticalAlign="bottom"
                    height={46}
                    formatter={(value: string, entry: any) => {
                      const color = entry?.color || "#111";
                      return <span style={{ color, fontSize: 12, fontWeight: 700 }}>{value}</span>;
                    }}
                  />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Testlar bo'yicha o'rtacha ball */}
      {testAnalytics.length > 0 && hasTestData && (
        <div className="bg-white rounded-2xl border border-neutral-100 p-6">
          <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            Testlar bo'yicha o'rtacha ball
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={testAnalytics} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="title" width={200} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgScore" fill="#3b82f6" radius={[0, 6, 6, 0]} name="O'rtacha ball" />
              <Bar dataKey="passRate" fill="#10b981" radius={[0, 6, 6, 0]} name="O'tish foizi %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Eng yaxshi va eng yomon natijalar */}
      {hasTestData && userLevels.some((u: UserLevel) => u.totalAttempts > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-neutral-100 p-6">
            <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Eng yaxshi natijalar
            </h3>
            <div className="space-y-3">
              {[...userLevels]
                .filter((u: UserLevel) => u.totalAttempts > 0)
                .sort((a: UserLevel, b: UserLevel) => b.avgScore - a.avgScore)
                .slice(0, 5)
                .map((u: UserLevel, i: number) => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-neutral-900 truncate">{u.name}</div>
                      <div className="text-xs text-neutral-500">{u.department || "Bo'lim yo'q"}</div>
                    </div>
                    <div className="text-lg font-bold text-emerald-600">{u.avgScore}%</div>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-100 p-6">
            <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              E'tibor talab qilinadiganlar
            </h3>
            <div className="space-y-3">
              {[...userLevels]
                .filter((u: UserLevel) => u.totalAttempts > 0 && u.avgScore < 60)
                .sort((a: UserLevel, b: UserLevel) => a.avgScore - b.avgScore)
                .slice(0, 5)
                .map((u: UserLevel) => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                    <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-neutral-900 truncate">{u.name}</div>
                      <div className="text-xs text-neutral-500">{u.department || "Bo'lim yo'q"}</div>
                    </div>
                    <div className="text-lg font-bold text-rose-600">{u.avgScore}%</div>
                  </div>
                ))}
              {[...userLevels].filter((u: UserLevel) => u.totalAttempts > 0 && u.avgScore < 60).length === 0 && (
                <p className="text-sm text-neutral-400 text-center py-4">Barcha hodimlar yaxshi natija ko'rsatmoqda!</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ma'lumot yo'q holat — badiy */}
      {!hasTestData && (
        <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 rounded-3xl border border-blue-100/60 p-12 overflow-hidden">
          {/* Orqa fon bezaklari */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-200/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-violet-200/20 to-transparent rounded-full translate-y-1/3 -translate-x-1/4" />
          <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-gradient-to-br from-indigo-200/15 to-transparent rounded-full" />

          <div className="relative text-center max-w-lg mx-auto">
            {/* Animatsion ikonka */}
            <div className="relative mx-auto mb-6 w-24 h-24">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl rotate-6 opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <BarChart3 className="w-10 h-10 text-white" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-neutral-800 mb-3">
              Hali ma'lumot to'planmagan
            </h3>
            <p className="text-sm text-neutral-500 leading-relaxed mb-6">
              Hodimlar malaka testini topshirgandan so'ng, ularning natijalari shu yerda
              <span className="font-semibold text-blue-600"> chiroyli grafiklar</span>,
              <span className="font-semibold text-violet-600"> diagrammalar</span> va
              <span className="font-semibold text-emerald-600"> baholar</span> ko'rinishida
              avtomatik paydo bo'ladi.
            </p>

            {/* Kichik features */}
            <div className="flex items-center justify-center gap-6 text-xs text-neutral-400">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Real-vaqt statistika
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                Bilim darajasi
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Trend tahlili
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== Users View ======
function UsersView({ filtered, search, setSearch, expandedUser, setExpandedUser, testAnalytics }: any) {
  const [expandedDetails, setExpandedDetails] = useState<any>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [retaking, setRetaking] = useState<string | null>(null); // "user-test"
  const [reviewData, setReviewData] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (!expandedUser) { setExpandedDetails(null); setReviewData(null); return; }
    setExpandedLoading(true);
    fetch(`/api/admin/skills?action=user&userId=${expandedUser}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setExpandedDetails(d.user); })
      .catch(() => setExpandedDetails(null))
      .finally(() => setExpandedLoading(false));
  }, [expandedUser]);
  return (
    <div className="space-y-4">
      {/* Qidiruv */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hodim qidirish..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Hodimlar kartochkalari */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((u: UserLevel) => (
          <div
            key={u.id}
            className="bg-white rounded-2xl border border-neutral-100 p-5 hover:shadow-lg transition-all cursor-pointer"
            onClick={() => {
              // Karta ma'lumotlarini darhol ko'rsatib, popupni kutishga majbur qilmaymiz.
              setExpandedDetails(u);
              setExpandedUser(u.id);
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  {u.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-bold text-neutral-900">{u.name}</div>
                  <div className="text-xs text-neutral-500">{u.department || "Bo'lim belgilanmagan"}</div>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${LEVEL_COLORS[u.levelColor]}`}>
                {u.level}
              </span>
              {u.totalAttempts === 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[9px] font-bold border border-rose-200">Ota olmagan</span>
              )}
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-500">O'rtacha ball</span>
                <span className="font-bold text-neutral-900 flex items-center gap-1.5">{u.avgScore}%
                  {(u.avgScore > 0 || u.level !== "Baholanmagan") && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                      u.level === "I daraja" ? "bg-violet-50 text-violet-700 border-violet-200" :
                      u.level === "II daraja" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {u.level === "I daraja" ? "I" : u.level === "II daraja" ? "II" : "III"}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    u.avgScore >= 86 ? "bg-violet-500" : u.avgScore >= 70 ? "bg-blue-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${u.avgScore}%` }}
                />
              </div>
            </div>

            {/* Statistika */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-blue-50">
                <div className="text-sm font-bold text-blue-700">{u.totalAttempts}</div>
                <div className="text-[10px] text-blue-500">Topshirish</div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50">
                <div className="text-sm font-bold text-emerald-700">{u.totalPassed}</div>
                <div className="text-[10px] text-emerald-500">O'tilgan</div>
              </div>
              <div className="p-2 rounded-lg bg-violet-50">
                <div className="text-sm font-bold text-violet-700">
                  {u.totalAttempts ? Math.round(u.totalPassed / u.totalAttempts * 100) : 0}%
                </div>
                <div className="text-[10px] text-violet-500">Muvaffaqiyat</div>
              </div>
            </div>

            {/* Kengaytirilgan qism — imkoniyatlar (attempts) va retake */}
            {expandedUser === u.id && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={(event) => {
                  if (event.target === event.currentTarget) setExpandedUser(null);
                }}
              >
                <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                  <div className="mb-5 flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-neutral-900">
                        {fullNameOf(expandedDetails) || u.name}
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500">
                        {expandedDetails?.department || u.department || "Bo'lim belgilanmagan"}
                        {expandedDetails?.position ? ` · ${expandedDetails.position}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${levelBadgeClass(expandedDetails?.level || u.level)}`}
                      >
                        {expandedDetails?.level || u.level}
                      </span>
                      <button
                        type="button"
                        disabled={pdfBusy}
                        onClick={async () => {
                          try {
                            setPdfBusy(true);
                            const id = expandedDetails?.id || u.id;
                            const res = await fetch(
                              `/api/admin/skills/user-report?userId=${encodeURIComponent(id)}`,
                            );
                            if (!res.ok) throw new Error("PDF tayyorlanmadi");
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            const nm = (fullNameOf(expandedDetails) || u.name || "hisobot").replace(/[\\/:*?"<>|]/g, "");
                            a.download = `AKELA-hisobot-${nm}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            setTimeout(() => URL.revokeObjectURL(url), 4000);
                          } catch {
                            alert("PDF yuklanmadi. Qayta urinib ko'ring.");
                          } finally {
                            setPdfBusy(false);
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 px-3 py-2 text-xs font-bold text-white transition-all hover:shadow-md disabled:opacity-60"
                        title="Natija va darajani PDF fayl qilib yuklab olish (to'g'ri/noto'g'ri bilan, A4)"
                      >
                        <Download className="h-4 w-4" />
                        {pdfBusy ? "Yuklanmoqda..." : "PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedUser(null)}
                        className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label="Yopish"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div className="mb-5 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-blue-50 p-3"><div className="text-lg font-bold text-blue-700">{u.totalAttempts}</div><div className="text-[10px] text-blue-500">Topshirish</div></div>
                    <div className="rounded-xl bg-emerald-50 p-3"><div className="text-lg font-bold text-emerald-700">{u.totalPassed}</div><div className="text-[10px] text-emerald-500">O'tilgan</div></div>
                    <div className="rounded-xl bg-violet-50 p-3"><div className="text-lg font-bold text-violet-700">{u.avgScore}%</div><div className="text-[10px] text-violet-500">O'rtacha ball</div></div>
                  </div>
                {expandedDetails && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-neutral-700 mb-2">Imkoniyatlar (urinishlar):</h4>
                    {expandedDetails.testResults && expandedDetails.testResults.length > 0 ? (
                      <>
                        {expandedDetails.testResults.map((attempt: any, i: number) => {
                          const isPlaceholder = attempt.gradingStatus === "retake" && !attempt.completedAt;
                          const isRetakeResult = typeof attempt.answers === "string" && attempt.answers.includes("__retake");
                          return (
                          <div key={i} className="p-3 rounded-xl bg-blue-50/40 border border-blue-100">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-bold text-neutral-800 truncate max-w-[70%]">
                                {attempt.test?.title || `Test #${i + 1}`}
                              </div>
                              <div className="flex items-center gap-2">
                                {isPlaceholder ? (
                                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 whitespace-nowrap">
                                    Qayta topshirish berilgan
                                  </span>
                                ) : (
                                  <>
                                    <span className={`text-xs font-bold ${attempt.passed ? "text-emerald-600" : "text-rose-600"}`}>
                                      {attempt.score ?? "—"}%
                                    </span>
                                    {(attempt.score !== null && attempt.score !== undefined) && (
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                                        attempt.score >= 86 ? "bg-violet-50 text-violet-700 border-violet-200" :
                                        attempt.score >= 70 ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        "bg-amber-50 text-amber-700 border-amber-200"
                                      }`}>
                                        {attempt.score >= 86 ? "I" : attempt.score >= 70 ? "II" : "III"} daraja
                                      </span>
                                    )}
                                    <a
                                      href={`/api/admin/skills/result-report?resultId=${attempt.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Shu test natijasini alohida PDF qilib yuklab olish"
                                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-sm font-extrabold hover:shadow-xl hover:scale-[1.03] transition-all duration-200 flex items-center gap-1.5"
                                    >
                                      📄 PDF
                                    </a>

                                    <button
                                      onClick={() => {
                                        // Faqat yuklaydi (yopmaydi — faqat Yopish tugmasi yopadi)
                                        setReviewLoading(true);
                                        fetch(`/api/admin/skills?action=review&userId=${expandedDetails.id}&testId=${attempt.testId || attempt.test?.id}&resultId=${attempt.id}`, { cache: "no-store" })
                                          .then((r) => r.json())
                                          .then((d) => { if (d.ok) setReviewData({ ...d.review, attemptId: attempt.id, testTitle: attempt.test?.title || "Test" }); })
                                          .catch(() => setReviewData({ error: "Natija yuklanmadi" }))
                                          .finally(() => setReviewLoading(false));
                                      }}
                                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-extrabold hover:shadow-xl hover:scale-[1.03] transition-all duration-200"
                                    >
                                      {reviewData?.attemptId === attempt.id ? "Yopish" : "Ko'rish natija"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {isRetakeResult && (
                              <div className="mb-1 inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300">
                                Qayta topshirishdan keyingi natija
                              </div>
                            )}
                            <div className="text-[10px] text-neutral-500">
                              Sana: {attempt.completedAt ? new Date(attempt.completedAt).toLocaleString("uz-UZ") : (attempt.startedAt ? new Date(attempt.startedAt).toLocaleString("uz-UZ") : "—")}
                            </div>
                          </div>
                          );
                        })}
                        {/* Ko'rish natija natijasi */}
                        {reviewLoading && <div className="py-3 text-center text-xs text-neutral-400">Natija yuklanmoqda...</div>}
                        {reviewData && !reviewData.error && (
                          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 shadow-sm">
                            <div className="flex items-center justify-between mb-3 gap-2">
                              <div className="text-base font-extrabold text-indigo-900">{reviewData.result?.isRetake ? "Qayta topshirish natijasi" : "Test natijasi"}</div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    const userId = expandedDetails?.id;
                                    const testId = reviewData?.test?.id;
                                    if (!userId || !testId || retaking) return;
                                    setRetaking(`${userId}-${testId}`);
                                    fetch(`/api/admin/skills/retake`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ userId, testId }),
                                    })
                                      .then((r) => r.json())
                                      .then((d) => {
                                        if (d.ok) {
                                          // Refresh expanded details so new attempt appears
                                          fetch(`/api/admin/skills?action=user&userId=${userId}`, { cache: "no-store" })
                                            .then((r2) => r2.json())
                                            .then((d2) => { if (d2.ok) setExpandedDetails(d2.user); })
                                            .catch(() => {});
                                        }
                                      })
                                      .catch(() => {})
                                      .finally(() => setRetaking(null));
                                  }}
                                  disabled={!!retaking}
                                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-extrabold hover:shadow-md hover:scale-105 transition-all duration-200 disabled:opacity-50"
                                >
                                  {retaking ? "Berilmoqda..." : "Qayta topshirish"}
                                </button>
                                <button onClick={() => setReviewData(null)} className="text-sm text-neutral-400 hover:text-rose-600 font-semibold">Yopish</button>
                              </div>
                            </div>
                             <div className="grid grid-cols-3 gap-3 mb-4">
                               <div className="p-3 rounded-xl bg-white border border-indigo-200 text-center shadow-sm">
                                <div className="text-sm text-neutral-500 font-medium">Ball</div>
                                <div className="text-xl font-extrabold text-indigo-700">{reviewData.result?.score ?? "—"}%</div>
                              </div>
                              <div className="p-3 rounded-xl bg-white border border-indigo-200 text-center shadow-sm">
                                <div className="text-sm text-neutral-500 font-medium">Natija</div>
                                <div className={`text-xl font-extrabold ${reviewData.result?.passed ? "text-emerald-700" : "text-rose-700"}`}>{reviewData.result?.passed ? "O'tgan" : "Yiqilgan"}</div>
                              </div>
                              <div className="flex min-h-[72px] items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-center shadow-sm">
                                <div className="text-3xl font-black leading-tight text-violet-700">
                                  {(reviewData.result?.score ?? 0) >= 86 ? "I" : (reviewData.result?.score ?? 0) >= 70 ? "II" : "III"} daraja
                                </div>
                              </div>
                            </div>
                            {reviewData.questions && reviewData.questions.length > 0 && (
                               <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                                {reviewData.questions.map((q: any, idx: number) => (
                                  <div key={q.id} className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="text-sm font-extrabold text-neutral-900 flex-1 leading-snug">
                                        <span className="inline-flex w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-extrabold items-center justify-center mr-2 shrink-0">{idx + 1}</span>
                                        <span>{q.text}</span>
                                        {q.answerCorrect === true && <span className="ml-2 inline-block rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase text-white align-middle">To'g'ri</span>}
                                        {q.answerCorrect === false && <span className="ml-2 inline-block rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase text-white align-middle">Noto'g'ri</span>}
                                      </div>
                                      <span className="text-xs px-2 py-1 rounded-md bg-neutral-100 text-neutral-600 font-bold whitespace-nowrap ml-2 mt-0.5">{q.type}</span>
                                    </div>
                                    <div className="space-y-2">
                                      {q.choices && q.choices.map((c: any) => {
                                        const isSelected = (q.selected === c.id) || (Array.isArray(q.selected) && q.selected.includes(c.id)) || (String(q.selected) === String(c.text));
                                        const isCorrect = !!c.isCorrect;
                                        return (
                                          <div
                                            key={c.id}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                              isCorrect && isSelected ? "bg-emerald-50 ring-2 ring-emerald-300 text-emerald-900" :
                                              isCorrect ? "bg-emerald-50/60 ring-1 ring-emerald-200 text-emerald-800" :
                                              isSelected ? "bg-rose-50 ring-2 ring-rose-400 text-rose-800" :
                                              "bg-neutral-50 text-neutral-400"
                                            }`}
                                          >
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-extrabold shrink-0 ${
                                              isCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-neutral-300 bg-neutral-50 text-neutral-400"
                                            }`}>
                                              {isCorrect ? "✓" : isSelected ? "✗" : "○"}
                                            </div>
                                            <span className="truncate flex-1 font-medium">{c.text}</span>
                                            {isSelected && (
                                              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">Siz</span>
                                            )}
                                            {isSelected && !isCorrect && (
                                              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-rose-600 text-white">Noto'g'ri</span>
                                            )}
                                            {isCorrect && (
                                              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">To'g'ri</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                      {!q.choices || q.choices.length === 0 ? (
                                        <div className="text-sm text-neutral-600 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">Yozma javob: <span className="font-extrabold text-neutral-900">{q.selected || "—"}</span> {q.correctAnswer ? `| To'g'ri javob: ${q.correctAnswer}` : ""}</div>
                                      ) : null}
                                    </div>
                                    {q.explanation && (
                                      <div className="mt-3 text-sm text-amber-800 bg-amber-50 rounded-xl px-3.5 py-2.5 border border-amber-200 shadow-sm">
                                        <span className="font-extrabold">Izoh:</span> {q.explanation}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {reviewData && reviewData.error && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{reviewData.error}</div>
                        )}
                      </>
                    ) : (
                      <div>
                        <h4 className="text-xs font-bold text-rose-600 mb-2">Ota olmagan (test topshirmagan)</h4>
                        <p className="text-xs text-neutral-500 mb-3">Bu foydalanuvchi hali hech qanday test urinishini topshirmagan. Quyidagi faol testlar bo'yicha yangi imkoniyat berishingiz mumkin.</p>
                        {(testAnalytics || []).filter((t: any) => t.status === "active" || true).map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100 mb-2">
                            <div className="text-xs font-semibold text-neutral-800 truncate max-w-[70%]">{t.title}</div>
                            <button
                              onClick={() => {
                                setRetaking(`${expandedDetails?.id}-${t.id}`);
                                fetch(`/api/admin/skills/retake`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ userId: expandedDetails?.id, testId: t.id }),
                                })
                                  .then((r) => r.json())
                                  .then((d) => {
                                    if (d.ok) {
                                      // Refresh details
                                      fetch(`/api/admin/skills?action=user&userId=${expandedDetails?.id}`, { cache: "no-store" })
                                        .then((r2) => r2.json())
                                        .then((d2) => { if (d2.ok) setExpandedDetails(d2.user); })
                                        .catch(() => {});
                                    }
                                  })
                                  .catch(() => {})
                                  .finally(() => setRetaking(null));
                              }}
                              disabled={!!retaking}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white text-[10px] font-bold hover:shadow-md transition-all disabled:opacity-50"
                            >
                              {retaking === `${expandedDetails?.id}-${t.id}` ? "Berilmoqda..." : "Qayta topshirish (yangi imkoniyat)"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-neutral-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Hodim topilmadi</p>
        </div>
      )}
    </div>
  );
}

// ====== Submissions View (barcha test topshiruvlari statistikasi) ======
function SubmissionsView({
  submissions,
  loading,
  search,
  setSearch,
  filter,
  setFilter,
  onRefresh,
}: {
  submissions: SubmissionRow[] | null;
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  filter: "all" | "passed" | "failed" | "pending";
  setFilter: (v: "all" | "passed" | "failed" | "pending") => void;
  onRefresh: () => void;
}) {
  if (loading || submissions === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm">Topshiruvlar yuklanmoqda...</p>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const rows = submissions.filter((r) => {
    const userName = [r.user?.name, r.user?.surname].filter(Boolean).join(" ") || r.user?.email || "";
    const matchQ =
      !q ||
      userName.toLowerCase().includes(q) ||
      (r.user?.email || "").toLowerCase().includes(q) ||
      (r.test?.title || "").toLowerCase().includes(q);
    const matchF =
      filter === "all" ||
      (filter === "passed" && r.passed) ||
      (filter === "failed" && !r.passed && r.score !== null) ||
      (filter === "pending" && (r.gradingStatus === "pending" || r.score === null));
    return matchQ && matchF;
  });

  const total = submissions.length;
  const passed = submissions.filter((r) => r.passed).length;
  const pending = submissions.filter((r) => r.gradingStatus === "pending" || r.score === null).length;
  const avg = total
    ? Math.round(submissions.reduce((s, r) => s + (r.score ?? 0), 0) / submissions.filter((r) => r.score !== null).length || 0)
    : 0;

  const summary = [
    { label: "Jami topshiruv", value: total, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "O'tgan", value: passed, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Kutilayotgan baho", value: pending, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "O'rtacha ball", value: `${avg}%`, color: "text-violet-600", bg: "bg-violet-50" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-neutral-100 p-4">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
              <ClipboardList className={`w-4 h-4 ${s.color}`} />
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-neutral-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Foydalanuvchi yoki test bo'yicha qidirish..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            ["all", "Hammasi"],
            ["passed", "O'tgan"],
            ["failed", "Yiqilgan"],
            ["pending", "Kutilayotgan"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                filter === v
                  ? "bg-blue-600 text-white shadow"
                  : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
          className="ml-auto px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 flex items-center gap-1.5"
          title="Yangilash"
        >
          <Download className="w-3.5 h-3.5 rotate-180" /> Yangilash
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
        {rows.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Topshiruv topilmadi</p>
            <p className="text-xs mt-1">Hodimlar test topshirgach, ularning natijalari shu yerda ko'rinadi</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 border-b border-neutral-100 z-10">
                <tr>
                  <th className="text-left p-3 text-xs font-bold text-neutral-500 uppercase">Foydalanuvchi</th>
                  <th className="text-left p-3 text-xs font-bold text-neutral-500 uppercase">Test</th>
                  <th className="text-center p-3 text-xs font-bold text-neutral-500 uppercase">Ball</th>
                  <th className="text-center p-3 text-xs font-bold text-neutral-500 uppercase">Natija</th>
                  <th className="text-center p-3 text-xs font-bold text-neutral-500 uppercase">Baho</th>
                  <th className="text-left p-3 text-xs font-bold text-neutral-500 uppercase">Sana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {rows.map((r) => {
                  const name = [r.user?.name, r.user?.surname].filter(Boolean).join(" ") || r.user?.email || r.userId?.slice(0, 8) || "—";
                  const dateRaw = r.completedAt || r.startedAt || r.createdAt;
                  const dateLabel = dateRaw ? new Date(dateRaw).toLocaleString("uz-UZ") : "—";
                  const isPending = r.gradingStatus === "pending" || r.score === null;
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-neutral-900 truncate max-w-[180px]">{name}</div>
                        <div className="text-xs text-neutral-400 truncate max-w-[180px]">{r.user?.email || ""}</div>
                      </td>
                      <td className="p-3 text-neutral-700 truncate max-w-[220px]">{r.test?.title || "—"}</td>
                      <td className="p-3 text-center">
                        {isPending ? (
                          <span className="text-xs font-bold text-amber-600">—</span>
                        ) : (
                          <span className={`font-bold ${r.passed ? "text-emerald-600" : "text-rose-600"}`}>{r.score}%</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold border ${
                            isPending
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : r.passed
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {isPending ? "Kutilmoqda" : r.passed ? "O'tdi" : "Yiqildi"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs font-semibold ${isPending ? "text-amber-600" : "text-neutral-500"}`}>
                          {isPending ? "Tekshirilmagan" : "Avto"}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-neutral-500 whitespace-nowrap">{dateLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-400 text-right">
        {rows.length} / {total} ta yozuv ko'rsatilmoqda
      </p>
    </div>
  );
}

// ====== Tests View ======
function TestsView({ testAnalytics }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {testAnalytics.map((t: TestStat) => (
          <div key={t.id} className="bg-white rounded-2xl border border-neutral-100 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-bold text-neutral-900">{t.title}</h3>
              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                t.passRate >= 70 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}>
                {t.passRate}% o'tish
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-500">O'rtacha ball</span>
                  <span className="font-bold text-neutral-900">{t.avgScore}%</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      t.avgScore >= 75 ? "bg-emerald-500" : t.avgScore >= 60 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${t.avgScore}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-blue-50">
                  <div className="text-sm font-bold text-blue-700">{t.totalAttempts}</div>
                  <div className="text-[10px] text-blue-500">Topshirish</div>
                </div>
                <div className="p-2 rounded-lg bg-violet-50">
                  <div className="text-sm font-bold text-violet-700">{t.questionCount}</div>
                  <div className="text-[10px] text-violet-500">Savollar</div>
                </div>
                <div className="p-2 rounded-lg bg-amber-50">
                  <div className="text-sm font-bold text-amber-700">{t.passScore}%</div>
                  <div className="text-[10px] text-amber-500">O'tish bali</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {testAnalytics.length === 0 && (
        <div className="text-center py-12 text-neutral-400">
          <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Faol testlar yo'q</p>
        </div>
      )}
    </div>
  );
}
