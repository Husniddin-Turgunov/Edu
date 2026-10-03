"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { cachedFetch } from "@/lib/admin-cache";
import { motion } from "framer-motion";
import { AdminSidebar, AdminHeader } from "@/components/admin/AdminSidebar";
import {
  Search,
  Loader2,
  BookOpen,
  GraduationCap,
  Clock,
  Trophy,
  Target,
  X,
  Plus,
  CheckCircle2,
  XCircle,
  UserCheck,
  TrendingUp,
} from "lucide-react";

type Row = {
  user: {
    id: string;
    email: string;
    name: string;
    surname: string;
    department: string;
    position: string;
    role: string;
    createdAt: string;
  };
  stats: {
    coursesCount: number;
    jobsCount: number;
    lessonsTotal: number;
    lessonsDone: number;
    percent: number;
    timeSec: number;
    timeLabel: string;
    testsTaken: number;
    testsPassed: number;
    avgScore: number;
  };
};

type Detail = {
  user: any;
  stats: Row["stats"];
  assignedCourses: { id: string; title: string }[];
  assignedJobs: { id: string; title: string; slug: string }[];
  recentTests: { title: string; score: number; passed: boolean; at: string; kind: string }[];
};

export default function AdminStudentsPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Assign modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUser, setAssignUser] = useState<Row | null>(null);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [onboardingTitle, setOnboardingTitle] = useState("Tanishtiruv kursi");
  const [assignOnboarding, setAssignOnboarding] = useState(false);
  const [assignJobIds, setAssignJobIds] = useState<string[]>([]);
  const [assignBase, setAssignBase] = useState<{ onboarding: boolean; jobIds: string[] }>({ onboarding: false, jobIds: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role === "user") router.push("/dashboard");
  }, [status, session, router]);

  const load = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background === true;
    if (!background) setLoading(true);
    try {
      const res = await cachedFetch("/api/admin/user-stats", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) setRows(data.rows);
    } catch {}
    if (!background) setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await cachedFetch(`/api/admin/user-stats?userId=${id}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) setDetail(data);
    } catch {}
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (rows.length > 0 && !selectedId) loadDetail(rows[0].user.id);
  }, [rows, selectedId, loadDetail]);

  const openAssign = async (row: Row) => {
    setAssignUser(row);
    setAssignOpen(true);
    setSaving(false);
    try {
      const [jobsRes, onbRes, enrRes] = await Promise.all([
        cachedFetch("/api/jobs", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        cachedFetch("/api/onboarding", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        cachedFetch(`/api/admin/enrollments?userId=${row.user.id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (jobsRes?.ok) setAllJobs(jobsRes.jobs);
      if (onbRes?.ok?.course) setOnboardingTitle(onbRes.course.title || "Tanishtiruv kursi");
      const baseJobs: string[] = enrRes?.ok ? (enrRes.jobs || []).map((j: any) => String(j.id)) : [];
      const baseOnb: boolean = enrRes?.ok ? (enrRes.courses || []).length > 0 : false;
      setAssignBase({ onboarding: baseOnb, jobIds: baseJobs });
      setAssignOnboarding(baseOnb);
      setAssignJobIds(baseJobs);
    } catch {}
  };

  const saveAssign = async () => {
    if (!assignUser) return;
    setSaving(true);
    try {
      const uid = assignUser.user.id;
      // Onboarding toggle
      if (assignOnboarding && !assignBase.onboarding) {
        await fetch("/api/admin/enrollments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: uid, type: "onboarding" }),
        });
      } else if (!assignOnboarding && assignBase.onboarding) {
        await fetch("/api/admin/enrollments", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: uid, type: "onboarding" }),
        });
      }
      // Job diffs — parallel (oldingi sequential for uzun loading edi)
      const toAdd = assignJobIds.filter((id) => !assignBase.jobIds.includes(id));
      const toDel = assignBase.jobIds.filter((id) => !assignJobIds.includes(id));
      await Promise.all([
        ...toAdd.map((jobId) =>
          fetch("/api/admin/enrollments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: uid, type: "job", jobId }),
          }),
        ),
        ...toDel.map((jobId) =>
          fetch("/api/admin/enrollments", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: uid, type: "job", jobId }),
          }),
        ),
      ]);
      setAssignOpen(false);
      load({ background: true });
      if (selectedId === uid) loadDetail(uid);
    } finally {
      setSaving(false);
    }
  };

  const filtered = rows.filter(
    (r) =>
      !search ||
      `${r.user.name} ${r.user.surname} ${r.user.email} ${r.user.department}`.toLowerCase().includes(search.toLowerCase())
  );

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="flex bg-transparent min-h-screen">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <AdminHeader
          title="O'quvchilar"
          subtitle="Kim qancha o'zlashtirdi, testlar va vaqt — pastda dars biriktirish"
        />

        <div className="p-8 max-w-[1600px] space-y-6">
          {/* ===== Tanlangan o'quvchi dashboardi ===== */}
          <section className="rounded-3xl border border-blue-200/60 bg-gradient-to-br from-[#EFF4FF]/80 to-white/60 backdrop-blur p-6">
            {detailLoading || !detail ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin" /> Yuklanmoqda...
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative">
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl font-extrabold shadow-xl">
                      {detail.user?.name?.[0] || "U"}
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <h2 className="text-2xl font-extrabold text-neutral-900">
                      {detail.user?.name} {detail.user?.surname}
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {detail.user?.email}
                      {detail.user?.department ? ` · ${detail.user.department}` : ""}
                    </p>
                  </div>
                </div>

                {/* Main progress + stats grid */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-4">
                  {/* Large circular progress */}
                  <div className="lg:col-span-1 flex flex-col items-center justify-center rounded-2xl bg-white/70 border border-blue-100 p-6">
                    <div className="relative h-32 w-32">
                      <svg width="128" height="128" viewBox="0 0 128 128">
                        <circle cx="64" cy="64" r="54" fill="none" stroke="#e0e7ff" strokeWidth="10" />
                        <circle
                          cx="64" cy="64" r="54" fill="none"
                          stroke="url(#progressGrad)"
                          strokeWidth="10"
                          strokeDasharray={`${(detail.stats.percent / 100) * 2 * Math.PI * 54} ${2 * Math.PI * 54}`}
                          strokeLinecap="round"
                          transform="rotate(-90 64 64)"
                          style={{ transition: "stroke-dasharray 0.8s ease" }}
                        />
                        <defs>
                          <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#2563eb" />
                            <stop offset="100%" stopColor="#6366f1" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-extrabold text-blue-700">{detail.stats.percent}%</span>
                        <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">O'zlashtirish</span>
                      </div>
                    </div>
                  </div>

                  {/* Stat cards */}
                  <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { icon: BookOpen, label: "Darslar", value: `${detail.stats.lessonsDone}/${detail.stats.lessonsTotal}`, color: "from-blue-600 to-indigo-600", ringColor: "#2563eb", pct: detail.stats.lessonsTotal > 0 ? Math.round((detail.stats.lessonsDone / detail.stats.lessonsTotal) * 100) : 0 },
                      { icon: Target, label: "Testlar", value: `${detail.stats.testsPassed}/${detail.stats.testsTaken}`, color: "from-sky-500 to-blue-600", ringColor: "#0ea5e9", pct: detail.stats.testsTaken > 0 ? Math.round((detail.stats.testsPassed / detail.stats.testsTaken) * 100) : 0 },
                      { icon: Trophy, label: "O'rtacha ball", value: `${detail.stats.avgScore}%`, color: "from-indigo-500 to-blue-600", ringColor: "#6366f1", pct: detail.stats.avgScore },
                      { icon: Clock, label: "Sarflangan vaqt", value: detail.stats.timeLabel, color: "from-cyan-500 to-blue-600", ringColor: "#06b6d4", pct: Math.min(100, Math.round(detail.stats.timeSec / 36)) },
                    ].map((s, i) => {
                      const circ = 2 * Math.PI * 18;
                      const dash = (s.pct / 100) * circ;
                      return (
                        <motion.div
                          key={s.label}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + i * 0.08 }}
                          className="relative overflow-hidden rounded-2xl bg-white/70 border border-blue-100 p-4"
                        >
                          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-[0.06]" style={{ background: s.ringColor }} />
                          <div className="flex items-start justify-between mb-3">
                            <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${s.color} text-white shadow-md`}>
                              <s.icon className="w-4 h-4" />
                            </div>
                            <div className="relative h-10 w-10">
                              <svg width="40" height="40" viewBox="0 0 40 40">
                                <circle cx="20" cy="20" r="16" fill="none" stroke={s.ringColor} strokeOpacity="0.12" strokeWidth="4" />
                                <circle cx="20" cy="20" r="16" fill="none" stroke={s.ringColor} strokeWidth="4" strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 20 20)" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[9px] font-extrabold" style={{ color: s.ringColor }}>{s.pct}%</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-lg font-extrabold text-neutral-900">{s.value}</p>
                          <p className="text-[11px] text-neutral-500">{s.label}</p>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Assigned courses/jobs */}
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase py-1">Biriktirilgan:</span>
                  {detail.assignedCourses.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 px-3 py-1 text-[11px] font-bold text-white shadow-md">
                      <GraduationCap className="w-3 h-3" /> {c.title}
                    </span>
                  ))}
                  {detail.assignedJobs.map((j) => (
                    <span key={j.id} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 border border-indigo-200 px-3 py-1 text-[11px] font-bold text-indigo-700">
                      <BookOpen className="w-3 h-3" /> {j.title}
                    </span>
                  ))}
                  {detail.assignedCourses.length === 0 && detail.assignedJobs.length === 0 && (
                    <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-bold text-amber-700">
                      Hech qanday dars biriktirilmagan — pastdagi ro'yxatdan bering
                    </span>
                  )}
                </div>

                {/* Recent tests */}
                {detail.recentTests.length > 0 && (
                  <div className="mt-4 rounded-2xl bg-white/70 border border-blue-100 overflow-hidden">
                    <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-600" />
                      <p className="text-[11px] font-bold uppercase text-neutral-500">So'nggi testlar</p>
                    </div>
                    <div className="divide-y divide-neutral-100">
                      {detail.recentTests.slice(0, 5).map((t, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                          {t.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                          <span className="flex-1 truncate font-medium text-neutral-800">{t.title}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                              <div className={`h-full rounded-full ${t.passed ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${t.score}%` }} />
                            </div>
                            <span className={`text-xs font-black ${t.passed ? "text-emerald-600" : "text-rose-600"}`}>{t.score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ===== Foydalanuvchilar ro'yxati + dars berish ===== */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ism, email yoki bo'lim..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-blue-200/60 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="ml-auto text-xs font-bold text-neutral-500">{filtered.length} o'quvchi</span>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin" /> Yuklanmoqda...
              </div>
            ) : (
              <div className="rounded-2xl bg-white border border-blue-200/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" aria-label="O'quvchilar jadvali">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-[#EFF4FF]/60">
                        <th scope="col" className="text-left p-4 text-xs font-bold text-neutral-500 uppercase">Foydalanuvchi</th>
                        <th scope="col" className="text-left p-4 text-xs font-bold text-neutral-500 uppercase hidden md:table-cell">Darslar</th>
                        <th scope="col" className="text-left p-4 text-xs font-bold text-neutral-500 uppercase hidden lg:table-cell">Testlar</th>
                        <th scope="col" className="text-left p-4 text-xs font-bold text-neutral-500 uppercase hidden lg:table-cell">Vaqt</th>
                        <th scope="col" className="text-right p-4 text-xs font-bold text-neutral-500 uppercase">Amal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filtered.map(({ user: u, stats: s }) => {
                        const sel = selectedId === u.id;
                        return (
                          <tr key={u.id} className={`transition-colors ${sel ? "bg-blue-50/70" : "hover:bg-neutral-50"}`}>
                            <td className="p-4">
                              <button onClick={() => loadDetail(u.id)} className="flex items-center gap-3 text-left">
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm">
                                  {u.name?.[0]}{u.surname?.[0] || ""}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-neutral-900 truncate">{u.name} {u.surname}</p>
                                  <p className="text-xs text-neutral-500 truncate">{u.email}</p>
                                </div>
                              </button>
                            </td>
                            <td className="p-4 hidden md:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 rounded-full bg-neutral-100 overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500" style={{ width: `${s.percent}%` }} />
                                </div>
                                <span className="text-xs font-bold text-neutral-700">{s.percent}%</span>
                              </div>
                              <p className="text-[11px] text-neutral-500 mt-1">{s.lessonsDone}/{s.lessonsTotal} dars · {s.jobsCount + s.coursesCount} biriktirish</p>
                            </td>
                            <td className="p-4 hidden lg:table-cell">
                              <span className="text-xs font-bold text-neutral-700">{s.testsPassed}/{s.testsTaken}</span>
                              <span className="text-[11px] text-neutral-500"> · o'rtacha {s.avgScore}%</span>
                            </td>
                            <td className="p-4 hidden lg:table-cell text-xs text-neutral-600">{s.timeLabel}</td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => openAssign({ user: u, stats: s })}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-blue-700 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:scale-105 transition-transform"
                              >
                                <Plus className="w-3.5 h-3.5" /> Dars berish
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filtered.length === 0 && (
                  <div className="p-10 text-center">
                    <UserCheck className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
                    <p className="text-sm text-neutral-500">Foydalanuvchi topilmadi</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ===== Dars berish modali ===== */}
        {assignOpen && assignUser && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !saving && setAssignOpen(false)}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-extrabold text-neutral-900">Dars berish</h3>
                <button onClick={() => !saving && setAssignOpen(false)} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100" aria-label="Yopish">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-neutral-500 mb-4">
                {assignUser.user.name} {assignUser.user.surname} · {assignUser.user.email}
              </p>

              <label className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={assignOnboarding}
                  onChange={(e) => setAssignOnboarding(e.target.checked)}
                  className="h-4 w-4 accent-blue-600"
                />
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-bold text-neutral-800">{onboardingTitle}</span>
              </label>

              <p className="text-xs font-bold uppercase text-neutral-500 mb-2">Kasbiy kurslar ({assignJobIds.length} tanlandi)</p>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {allJobs.map((j: any) => {
                  const id = String(j._id || j.id);
                  const on = assignJobIds.includes(id);
                  return (
                    <label key={id} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 cursor-pointer text-sm ${on ? "border-blue-500 bg-blue-50/60" : "border-neutral-200 hover:bg-neutral-50"}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setAssignJobIds((prev) => (on ? prev.filter((x) => x !== id) : [...prev, id]))
                        }
                        className="h-4 w-4 accent-blue-600"
                      />
                      <span className="flex-1 font-semibold text-neutral-800 truncate">{j.title}</span>
                    </label>
                  );
                })}
                {allJobs.length === 0 && <p className="text-xs text-neutral-400">Kurslar yuklanmoqda...</p>}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setAssignOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={saveAssign}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
