"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/components/akela/Navbar";
import { NormativeFloating } from "@/components/akela/NormativeFloating";
import {
  LogOut,
  BookOpen,
  Play,
  Clock,
  GraduationCap,
  Mail,
  Building2,
  ChevronRight,
  Trophy,
  Target,
  Sparkles,
  Lock,
  ShieldAlert,
  X,
} from "lucide-react";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import { usePlacedVideos } from "@/components/akela/RelatedVideos";
import { HelpdeskGuides } from "@/components/akela/HelpdeskGuides";

type MyStats = {
  isAdmin: boolean;
  percent: number;
  lessonsDone: number;
  lessonsTotal: number;
  testsTaken: number;
  testsPassed: number;
  avgScore: number;
  timeLabel: string;
  onboarding: { id: string; title: string; lessonsTotal: number; lessonsDone: number; percent: number } | null;
  jobs: { id: string; title: string; slug: string; daysTotal: number; daysDone: number; percent: number }[];
};

function ProgressRing({ percent, size = 120 }: { percent: number; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={11} className="stroke-white/25" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, percent)) / 100}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="#bfdbfe" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-2xl font-black text-white leading-none">{percent}%</p>
          <p className="text-[10px] font-bold text-blue-100 mt-1">o'zlashtirish</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  // Testga kirishga ruxsat rad etilgan bo'lsa — ogohlantirish banneri
  const [testRejected, setTestRejected] = useState(false);
  const { dashboard: dashVideos } = usePlacedVideos();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Rad etilgan testdan keyin kelganda — ogohlantirishni ko'rsat
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("akela:test-rejected") === "1") {
        setTestRejected(true);
        window.sessionStorage.removeItem("akela:test-rejected");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/my-stats", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok) setStats(data);
      } catch {}
      if (!cancelled) setLoadingStats(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading") {
    return (
      <main className="min-h-screen grid place-items-center bg-transparent">
        <div className="glass-card rounded-3xl p-8 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-[color:var(--ink-soft)]">Yuklanmoqda...</p>
        </div>
      </main>
    );
  }

  if (!session) return null;

  const user = session.user as any;
  const isAdmin = user?.role === "admin" || stats?.isAdmin;
  const hasAnything = !!stats?.onboarding || (stats?.jobs.length || 0) > 0;

  return (
    <main className="min-h-screen bg-transparent">
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      <div className="mx-auto max-w-6xl px-6 pt-28 pb-12 space-y-6">
        {/* Testga kirishga ruxsat rad etilganligi haqida ogohlantirish */}
        {testRejected && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="test-rejected-banner"
            className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-800 shadow-sm"
          >
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">Testni topshirishga ruxsat etilmadi</p>
              <p className="mt-0.5 text-xs leading-relaxed text-rose-700">
                Sizga hozirda testni topshirishga ruxsat etilmadi. Savollaringiz uchun HR bo'limi bilan bog&apos;laning.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTestRejected(false)}
              aria-label="Yopish"
              className="shrink-0 rounded-lg p-1 text-rose-500 hover:bg-rose-100"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
        {/* ===== Hero: profil + umumiy progress ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-8 shadow-2xl shadow-blue-900/30"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-20 h-56 w-56 rounded-full bg-indigo-300/20 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            <ProgressRing percent={stats?.percent || 0} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-200">Xush kelibsiz</p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black text-white truncate">
                {user?.name} {user?.surname || ""}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-blue-100">
                <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {user?.email}</span>
                {user?.department && (
                  <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {user.department}</span>
                )}
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/25">
                  {isAdmin ? "🛠 Admin" : "👤 O'quvchi"}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 max-w-md gap-3">
                {[
                  { icon: BookOpen, v: loadingStats ? "…" : `${stats?.lessonsDone || 0}/${stats?.lessonsTotal || 0}`, l: "dars" },
                  { icon: Target, v: loadingStats ? "…" : `${stats?.testsPassed || 0}/${stats?.testsTaken || 0}`, l: "test" },
                  { icon: Clock, v: loadingStats ? "…" : stats?.timeLabel || "0 son", l: "vaqt" },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl bg-white/10 ring-1 ring-white/15 px-3 py-2.5 backdrop-blur">
                    <s.icon className="h-4 w-4 text-blue-100 mb-1" />
                    <p className="text-sm font-black text-white truncate">{s.v}</p>
                    <p className="text-[10px] font-bold text-blue-200">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                // `redirect: false` — NextAuth o'zi `NEXTAUTH_URL` bo'yicha
                // redirect qiladi va boshqa domenga olib ketsa mumkin.
                // Sessiya shu domen ichida tozalanadi, keyin joriy
                // domenning `/login` siga qadam qilamiz.
                void signOut({ redirect: false }).finally(() => {
                  router.replace("/login");
                  router.refresh();
                });
              }}
              className="inline-flex items-center gap-2 self-start md:self-center rounded-xl bg-white/10 ring-1 ring-white/20 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Chiqish
            </button>
          </div>
        </motion.div>

        {/* ===== Biriktirilmagan holat ===== */}
        {!loadingStats && !hasAnything && !isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-3xl p-12 text-center"
          >
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">Sizga hali dars biriktirilmagan</h2>
            <p className="mt-3 max-w-md mx-auto text-sm text-[color:var(--ink-soft)] leading-relaxed">
              Admin sizga dars biriktirgandan so&apos;ng ular shu yerda va Kurslar sahifasida ko&apos;rinadi.
            </p>
          </motion.div>
        )}

        {/* ===== Mening darslarim ===== */}
        {(hasAnything || isAdmin) && (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
                <Sparkles className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-extrabold text-[color:var(--emerald-deep)] sm:text-2xl">Mening darslarim</h2>
              {!loadingStats && (
                <span className="ml-auto glass-pill text-sm font-bold text-[color:var(--emerald-deep)]">
                  {(stats?.onboarding ? 1 : 0) + (stats?.jobs.length || 0)} ta kurs
                </span>
              )}
            </div>

            {loadingStats ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-44 glass-card rounded-3xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {stats?.onboarding && (
                  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
                    <Link href="/courses" className="group block glass-card rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-2xl">
                      <div className="flex items-center gap-4">
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
                          <GraduationCap className="h-7 w-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">Tanishtiruv kursi</p>
                          <h3 className="truncate text-lg font-extrabold text-[color:var(--emerald-deep)] group-hover:text-blue-600 transition-colors">
                            {stats.onboarding.title}
                          </h3>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--ink-soft)] group-hover:translate-x-1 transition-transform" />
                      </div>
                      <div className="mt-4 h-2.5 rounded-full bg-blue-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500" style={{ width: `${stats.onboarding.percent}%` }} />
                      </div>
                      <p className="mt-2 text-xs font-bold text-[color:var(--ink-soft)]">
                        {stats.onboarding.lessonsDone}/{stats.onboarding.lessonsTotal} dars · {stats.onboarding.percent}%
                      </p>
                    </Link>
                  </motion.div>
                )}

                {(stats?.jobs || []).map((j, i) => (
                  <motion.div key={j.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * (i + 1) }}>
                    <Link href={`/courses/job/${j.slug}`} className="group block glass-card rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-2xl">
                      <div className="flex items-center gap-4">
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
                          <BookOpen className="h-7 w-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">Kasbiy kurs · {j.daysTotal} kun</p>
                          <h3 className="truncate text-lg font-extrabold text-[color:var(--emerald-deep)] group-hover:text-blue-600 transition-colors">
                            {j.title}
                          </h3>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--ink-soft)] group-hover:translate-x-1 transition-transform" />
                      </div>
                      <div className="mt-4 h-2.5 rounded-full bg-blue-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600" style={{ width: `${j.percent}%` }} />
                      </div>
                      <p className="mt-2 text-xs font-bold text-[color:var(--ink-soft)]">
                        {j.daysDone}/{j.daysTotal} kun · {j.percent}%
                      </p>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ===== Bitrix 24 bilan ishlash yo'riqlari (videolar oldida) ===== */}
        <HelpdeskGuides locale={locale} id="bitrix-guides" compact />

        {/* ===== Tavsiya videolar (joylashtirilgan, faqat biriktirilganlarga) ===== */}
        {dashVideos.length > 0 && (hasAnything || isAdmin) && (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
                <Play className="h-5 w-5 fill-white ml-0.5" />
              </span>
              <h2 className="text-xl font-extrabold text-[color:var(--emerald-deep)] sm:text-2xl">Tavsiya videolar</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {dashVideos.map((v: any, i: number) => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}>
                  <Link href={`/courses/videos/${v.id}`} className="group flex items-center gap-4 glass-card rounded-3xl p-5 transition-all hover:-translate-y-1 hover:shadow-2xl">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#0e1e3a] to-[#1a2855] text-white shadow-lg">
                      <Play className="h-6 w-6 fill-white ml-0.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-extrabold text-[color:var(--emerald-deep)] group-hover:text-blue-600">
                        {v.title}
                      </span>
                      {v.duration && <span className="text-xs text-[color:var(--ink-soft)]">{v.duration}</span>}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--ink-soft)] group-hover:translate-x-1 transition-transform" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ===== Tezkor havolalar ===== */}
        <div className="grid md:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Link href="/courses" className="group block glass-card rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
                  <BookOpen className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-extrabold text-[color:var(--emerald-deep)] group-hover:text-blue-600 transition-colors">
                    Barcha darslarim
                  </h3>
                  <p className="text-sm text-[color:var(--ink-soft)]">Biriktirilgan modullar va kasblar</p>
                </div>
                <ChevronRight className="h-5 w-5 text-[color:var(--ink-soft)] group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Link href="/courses/videos" className="group block glass-card rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
                  <Play className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-extrabold text-[color:var(--emerald-deep)] group-hover:text-blue-600 transition-colors">
                    Video darslar
                  </h3>
                  <p className="text-sm text-[color:var(--ink-soft)]">Video kutubxona · o'rtacha {stats?.avgScore || 0}%</p>
                </div>
                <ChevronRight className="h-5 w-5 text-[color:var(--ink-soft)] group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </motion.div>

          {isAdmin && (
            <>
              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Link href="/admin/students" className="group block glass-card rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-2xl ring-2 ring-blue-200">
                  <div className="flex items-center gap-4">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg">
                      <Trophy className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-extrabold text-[color:var(--emerald-deep)] group-hover:text-blue-600 transition-colors">
                        O'quvchilar
                      </h3>
                      <p className="text-sm text-[color:var(--ink-soft)]">Progress va dars biriktirish</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[color:var(--ink-soft)] group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <Link href="/admin" className="group block glass-card rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-2xl ring-2 ring-blue-200">
                  <div className="flex items-center gap-4">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg">
                      <GraduationCap className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-extrabold text-[color:var(--emerald-deep)] group-hover:text-blue-600 transition-colors">
                        Admin panel
                      </h3>
                      <p className="text-sm text-[color:var(--ink-soft)]">Boshqaruv bo'limlari</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[color:var(--ink-soft)] group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Normativ fayl suzuvchi oyna */}
      {user?.department && user?.position && (
        <NormativeFloating department={user.department} position={user.position} />
      )}
    </main>
  );
}
