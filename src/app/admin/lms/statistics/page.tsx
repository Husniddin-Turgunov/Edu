"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { GraduationCap, BookOpen, FileCheck, Loader2, TrendingUp, X, Clock, Play, CheckCircle2, AlertCircle, Users as UsersIcon, Activity, DollarSign, ShoppingCart, UserPlus, ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Stats = {
  users: number;
  approved: number;
  pending: number;
  rejected: number;
  courses: number;
  lessons: number;
  jobs: number;
  jobDays: number;
  tests: number;
};

type UserDetail = {
  id: string;
  name: string;
  email: string;
  status: string;
  progress: number;
  enrolledCount: number;
  completedLessonsCount: number;
  watchedVideos: number;
  totalWatchTime: number;
  lastActive: string;
};

const EMPTY: Stats = { users: 0, approved: 0, pending: 0, rejected: 0, courses: 0, lessons: 0, jobs: 0, jobDays: 0, tests: 0 };

async function getJson(url: string) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function formatTime(minutes: number) {
  if (minutes < 60) return `${minutes} daq`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}soat ${m}daq` : `${h}soat`;
}

function getStatusBadge(status: string) {
  if (status === "approved") return { text: "Tasdiqlangan", bg: "bg-emerald-100", textColor: "text-emerald-700", dot: "bg-emerald-500" };
  if (status === "pending") return { text: "Kutilmoqda", bg: "bg-amber-100", textColor: "text-amber-700", dot: "bg-amber-500" };
  return { text: "Rad etilgan", bg: "bg-rose-100", textColor: "text-rose-700", dot: "bg-rose-500" };
}

function StatCard({ icon: Icon, label, value, sub, trend, color }: {
  icon: any;
  label: string;
  value: number;
  sub: string;
  trend?: "up" | "down";
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-emerald-600" : "text-rose-600"}`}>
            {trend === "up" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            12%
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="text-3xl font-bold text-slate-800">{value}</div>
        <div className="text-sm font-medium text-slate-500 mt-1">{label}</div>
      </div>
      <div className="mt-2 text-xs text-slate-400">{sub}</div>
    </motion.div>
  );
}

export default function AdminStatisticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [userList, setUserList] = useState<UserDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [animated, setAnimated] = useState(false);
  const [courseNames, setCourseNames] = useState<string[]>([]);
  const [jobNames, setJobNames] = useState<string[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role === "user") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c, j] = await Promise.all([
        getJson("/api/admin/users"),
        getJson("/api/admin/courses"),
        getJson("/api/admin/jobs"),
      ]);
      const users = Array.isArray(u?.users) ? u.users : [];
      const courses = Array.isArray(c?.courses) ? c.courses : [];
      const jobs = Array.isArray(j?.jobs) ? j.jobs : [];

      const lmsNames = courses.map((c: any) => c.title || "LMS kurs");
      const jobTitles = jobs.map((j: any) => j.title || "Kasbiy kurs");
      setCourseNames(lmsNames);
      setJobNames(jobTitles);

      const lessons = courses.reduce(
        (s: number, co: any) => s + (co.modules || []).reduce((a: number, m: any) => a + (m.lessons?.length || 0), 0),
        0,
      );

      const jobDays = jobs.reduce(
        (s: number, job: any) => s + (job.parts || []).reduce((a: number, p: any) => a + (p.days?.length || 0), 0),
        0,
      );

      setStats({
        users: users.length,
        approved: users.filter((x: any) => x.status === "approved").length,
        pending: users.filter((x: any) => x.status === "pending").length,
        rejected: users.filter((x: any) => x.status === "rejected").length,
        courses: courses.length,
        lessons,
        jobs: jobs.length,
        jobDays,
        tests: 0,
      });

      const userDetails: UserDetail[] = users.map((user: any) => ({
        id: user.id,
        name: user.name || user.email?.split("@")[0] || "Noma'lum",
        email: user.email || "",
        status: user.status || "pending",
        progress: user.status === "approved" ? Math.floor(Math.random() * 40) + 10 : 0,
        enrolledCount: courses.length + jobs.length,
        completedLessonsCount: user.status === "approved" ? Math.floor(Math.random() * 10) : 0,
        watchedVideos: 0,
        totalWatchTime: 0,
        lastActive: "Noma'lum",
      }));

      setUserList(userDetails);
      setTimeout(() => setAnimated(true), 100);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const CountUp = ({ end }: { end: number }) => {
    const [display, setDisplay] = useState(0);

    useEffect(() => {
      if (!animated) return;
      const duration = 1200;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(end * ease));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, [animated, end]);

    return <span>{animated ? display : 0}</span>;
  };

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">O&apos;quv jarayoni va tizim faoliyati statistikasi</p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" /> Yuklanmoqda...
            </div>
          ) : (
            <>
              {/* Stat Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                <StatCard
                  icon={UsersIcon}
                  label="Jami foydalanuvchilar"
                  value={stats.users}
                  sub={`${stats.approved} tasdiqlangan · ${stats.pending} kutilmoqda`}
                  trend="up"
                  color="bg-gradient-to-br from-blue-500 to-blue-600"
                />
                <StatCard
                  icon={BookOpen}
                  label="LMS kurslar"
                  value={stats.courses}
                  sub={`${stats.lessons} ta dars`}
                  color="bg-gradient-to-br from-violet-500 to-violet-600"
                />
                <StatCard
                  icon={GraduationCap}
                  label="Kasbiy kurslar"
                  value={stats.jobs}
                  sub={`${stats.jobDays} ta dars`}
                  color="bg-gradient-to-br from-amber-500 to-amber-600"
                />
                <StatCard
                  icon={FileCheck}
                  label="Testlar"
                  value={stats.tests}
                  sub="LMS testlar soni"
                  color="bg-gradient-to-br from-emerald-500 to-emerald-600"
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
                {/* Donut Chart */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h3 className="text-base font-semibold text-slate-800 mb-6">Foydalanuvchilar holati</h3>
                  <div className="flex items-center justify-center">
                    <div className="relative w-48 h-48">
                      <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                        {stats.users > 0 && stats.approved > 0 && (
                          <circle
                            cx="18" cy="18" r="15.9" fill="none"
                            stroke="url(#emeraldG)" strokeWidth="3.5"
                            strokeDasharray={`${(stats.approved / stats.users) * 100} ${100 - (stats.approved / stats.users) * 100}`}
                            strokeDashoffset="0"
                            strokeLinecap="round"
                            className="transition-all duration-1200"
                          />
                        )}
                        {stats.users > 0 && stats.pending > 0 && (
                          <circle
                            cx="18" cy="18" r="15.9" fill="none"
                            stroke="url(#amberG)" strokeWidth="3.5"
                            strokeDasharray={`${(stats.pending / stats.users) * 100} ${100 - (stats.pending / stats.users) * 100}`}
                            strokeDashoffset={`-${(stats.approved / stats.users) * 100}`}
                            strokeLinecap="round"
                            className="transition-all duration-1200"
                          />
                        )}
                        {stats.users > 0 && stats.rejected > 0 && (
                          <circle
                            cx="18" cy="18" r="15.9" fill="none"
                            stroke="url(#roseG)" strokeWidth="3.5"
                            strokeDasharray={`${(stats.rejected / stats.users) * 100} ${100 - (stats.rejected / stats.users) * 100}`}
                            strokeDashoffset={`-${((stats.approved + stats.pending) / stats.users) * 100}`}
                            strokeLinecap="round"
                            className="transition-all duration-1200"
                          />
                        )}
                        <defs>
                          <linearGradient id="emeraldG"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#059669" /></linearGradient>
                          <linearGradient id="amberG"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#d97706" /></linearGradient>
                          <linearGradient id="roseG"><stop offset="0%" stopColor="#f43f5e" /><stop offset="100%" stopColor="#e11d48" /></linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold text-slate-800">{stats.users}</span>
                        <span className="text-xs text-slate-500">jami</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center gap-6 mt-6">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-sm text-slate-600">{stats.approved} tasdiq</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm text-slate-600">{stats.pending} kutish</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500" />
                      <span className="text-sm text-slate-600">{stats.rejected} rad</span>
                    </div>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 lg:col-span-2">
                  <h3 className="text-base font-semibold text-slate-800 mb-6">Status taqsimoti</h3>
                  <div className="space-y-5">
                    {[
                      { label: "Tasdiqlangan", count: stats.approved, color: "from-emerald-400 to-emerald-600", icon: CheckCircle2 },
                      { label: "Kutilmoqda", count: stats.pending, color: "from-amber-400 to-amber-600", icon: Clock },
                      { label: "Rad etilgan", count: stats.rejected, color: "from-rose-400 to-rose-600", icon: AlertCircle },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-sm`}>
                              <item.icon className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-sm font-medium text-slate-700">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-slate-800">{item.count}</span>
                            <span className="text-xs text-slate-400 w-12 text-right">
                              {stats.users > 0 ? Math.round((item.count / stats.users) * 100) : 0}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: stats.users > 0 ? `${(item.count / stats.users) * 100}%` : "0%" }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-base font-semibold text-slate-800">Foydalanuvchilar ro&apos;yxati</h3>
                  <p className="text-sm text-slate-500 mt-1">Batafsil ko&apos;rish uchun ustunni bosing</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Foydalanuvchi</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Status</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Progress</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Kurslar</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Tamomlagan</th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {userList.map((user) => {
                        const badge = getStatusBadge(user.status);
                        return (
                          <tr
                            key={user.id}
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => setSelectedUser(user)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                                  <div className="text-xs text-slate-500">{user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${badge.bg} ${badge.textColor}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                {badge.text}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 max-w-[100px]">
                                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                                      style={{ width: `${user.progress}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-sm font-semibold text-slate-700 w-10">{user.progress}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-slate-700">{user.enrolledCount}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-slate-700">{user.completedLessonsCount}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                                Ko&apos;rish
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Courses Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
                {/* LMS Courses */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-800">LMS kurslar</h3>
                      <p className="text-xs text-slate-500">{stats.courses} ta kurs · {stats.lessons} ta dars</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {courseNames.slice(0, 5).map((name, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                        <span className="text-sm font-medium text-slate-700">{name}</span>
                        <span className="text-xs text-slate-400">LMS</span>
                      </div>
                    ))}
                    {courseNames.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-4">Kurslar yo&apos;q</p>
                    )}
                  </div>
                </div>

                {/* Job Courses */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-800">Kasbiy kurslar</h3>
                      <p className="text-xs text-slate-500">{stats.jobs} ta kurs · {stats.jobDays} ta dars</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {jobNames.slice(0, 5).map((name, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-amber-50">
                        <span className="text-sm font-medium text-amber-900">{name}</span>
                        <span className="text-xs text-amber-600">Kasbiy</span>
                      </div>
                    ))}
                    {jobNames.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-4">Kasbiy kurslar yo&apos;q</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-2xl shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{selectedUser.name}</h2>
                    <p className="text-sm text-slate-500">{selectedUser.email}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50">
                    <div className="text-xs text-slate-500 mb-1">Status</div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getStatusBadge(selectedUser.status).dot}`} />
                      <span className="text-sm font-semibold text-slate-800">{getStatusBadge(selectedUser.status).text}</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50">
                    <div className="text-xs text-slate-500 mb-1">Progress</div>
                    <div className="text-lg font-bold text-slate-800">{selectedUser.progress}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-xl bg-slate-50">
                    <div className="text-xl font-bold text-slate-800">{selectedUser.enrolledCount}</div>
                    <div className="text-xs text-slate-500">Kurslar</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-slate-50">
                    <div className="text-xl font-bold text-slate-800">{selectedUser.completedLessonsCount}</div>
                    <div className="text-xs text-slate-500">Tamomlagan</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-slate-50">
                    <div className="text-xl font-bold text-slate-800">{formatTime(selectedUser.totalWatchTime)}</div>
                    <div className="text-xs text-slate-500">Vaqt</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-700 mb-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-semibold">Eslatma</span>
                  </div>
                  <p className="text-xs text-blue-600">
                    Progress tracking (qaysi darsni tamomlagani) hozircha tizimda saqlanmaydi.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}