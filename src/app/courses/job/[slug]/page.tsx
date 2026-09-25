"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Navbar } from "@/components/akela/Navbar";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  Sparkles,
  Trophy,
  Award,
} from "lucide-react";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import { useMyCourses } from "@/hooks/useMyCourses";
import { NoAccess } from "@/components/akela/NoAccess";

export default function JobCoursePage() {
  const params = useParams<{ slug: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];

  const slug = params?.slug;

  const [job, setJob] = useState<any | null>(null);
  const [jobLoading, setJobLoading] = useState(true);
  const [activePartIndex, setActivePartIndex] = useState(0);
  const access = useMyCourses();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) return;
      try {
        const res = await fetch(`/api/jobs/${slug}`, { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok && data.job) setJob(data.job);
        else if (!cancelled) setJob(null);
      } catch (e) {
        console.error("Failed to load job", e);
        if (!cancelled) setJob(null);
      } finally {
        if (!cancelled) setJobLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading" || jobLoading || !job) {
    const notFound = !jobLoading && !job;
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="glass-card rounded-3xl p-8 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-[color:var(--ink-soft)]">
            {notFound ? "Kasb topilmadi..." : "Yuklanmoqda..."}
          </p>
          {notFound && (
            <Link
              href="/courses"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
            >
              <ArrowLeft className="h-4 w-4" /> Barcha kurslarga qaytish
            </Link>
          )}
        </div>
      </main>
    );
  }

  // Biriktirilmagan kasbni ko'rish taqiqlanadi (cuid: _id || id)
  if (!access.loading && !access.hasJob(job?._id || job?.id)) {
    return <NoAccess />;
  }

  // Filter parts that have actual days
  const validParts = job.parts.filter(
    (p: any) => Array.isArray(p.days) && p.days.length > 0
  );

  const activePart = validParts[activePartIndex] || validParts[0] || job.parts[0];
  const totalDays = validParts.reduce((s: number, p: any) => s + p.days.length, 0);

  return (
    <main className="min-h-screen bg-background pb-20">
      <LiquidBackground />
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      {/* Header */}
      <section className="relative overflow-hidden pt-32 pb-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-[color:var(--ink-soft)]">
            <Link
              href="/courses"
              className="inline-flex items-center gap-1.5 font-medium hover:text-[color:var(--emerald-deep)] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Kurslar
            </Link>
            <span>/</span>
            <span className="truncate max-w-md font-semibold text-[color:var(--emerald-deep)]">
              {job.title}
            </span>
          </div>

          <div className="glass-card relative overflow-hidden rounded-3xl p-8 sm:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-500 to-amber-500 opacity-15 blur-3xl" />
            
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">
                    Kasb #{job.id}
                  </span>
                  {job.hasNormative && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      📊 Normativlar
                    </span>
                  )}
                  <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
                    {totalDays} ta dars & test
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl text-[color:var(--emerald-deep)] leading-tight">
                  {job.title}
                </h1>

                <p className="text-sm sm:text-base text-[color:var(--ink-soft)] leading-relaxed">
                  AKELA GROUP professional moslashuv dasturi: 5 kunlik normativlar stajirovkasi va 30 kunlik (4 haftalik) to'liq kasbiy darslik hamda testlar tizimi.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
                <div className="glass-pill text-center px-5 py-3">
                  <p className="text-xs text-[color:var(--ink-soft)]">Jami darslar</p>
                  <p className="text-2xl font-black text-[color:var(--emerald-deep)]">
                    {totalDays} <span className="text-sm font-normal">kun</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Tabs (Part 1, Part 2, etc.) */}
            {validParts.length > 1 && (
              <div className="mt-8 flex flex-wrap gap-2 border-t border-black/5 pt-6">
                {validParts.map((p: any, idx: number) => {
                  const isActive = idx === activePartIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActivePartIndex(idx)}
                      className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-indigo-600 to-teal-700 text-white shadow-lg shadow-indigo-700/20 scale-[1.02]"
                          : "bg-white/60 text-[color:var(--ink)] hover:bg-white/90"
                      }`}
                    >
                      <Layers className="h-4 w-4" />
                      <span>{p.title.includes("5 KUN") || p.type === "5day" ? "1-QISM: 5 kunlik Normativlar" : `2-QISM: 30 kunlik Professional`}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-white/20 text-white" : "bg-black/5 text-[color:var(--ink-soft)]"}`}>
                        {p.days.length} dars
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Days Grid */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-[color:var(--emerald-deep)] sm:text-2xl">
              {activePart?.title || "Darslar ro'yxati"}
            </h2>
            <p className="text-xs sm:text-sm text-[color:var(--ink-soft)] mt-1">
              Har bir kunlik darsni o'qib, yakunidagi test orqali bilimlaringizni mustahkamlang.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(activePart?.days || []).map((day: any, dIdx: number) => {
            const isTest = day.title.toLowerCase().includes("test") || day.title.toLowerCase().includes("nazorat");
            const isWeek = day.kind === "hafta";
            const actualPartIdx = validParts.findIndex((p: any) => p === activePart);

            return (
              <motion.div
                key={dIdx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: (dIdx % 6) * 0.05 }}
              >
                <Link
                  href={`/courses/job/${job.slug}/${actualPartIdx}/${dIdx}`}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl p-6 transition-all hover:scale-[1.02] hover:shadow-xl ${
                    isWeek
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-600/20"
                      : isTest
                      ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-600/20"
                      : "glass-card hover:border-indigo-300/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-xl px-2.5 py-1 text-xs font-bold ${
                          isWeek || isTest
                            ? "bg-white/20 text-white"
                            : "bg-indigo-100 text-indigo-800"
                        }`}
                      >
                        {isWeek ? "Haftalik Reja" : isTest ? "✏️ Test" : `Kun / Dars #${day.num || dIdx + 1}`}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          isWeek || isTest ? "text-white/80" : "text-[color:var(--ink-soft)]"
                        }`}
                      >
                        {day.content?.length ? `${Math.ceil(day.content.length / 500)} daqiqa` : "5 daqiqa"}
                      </span>
                    </div>

                    <h3
                      className={`mt-3 text-base font-bold leading-snug line-clamp-2 ${
                        isWeek || isTest ? "text-white" : "text-[color:var(--emerald-deep)] group-hover:text-indigo-700"
                      }`}
                    >
                      {day.title}
                    </h3>

                    <p
                      className={`mt-2 text-xs leading-relaxed line-clamp-3 ${
                        isWeek || isTest ? "text-white/80" : "text-[color:var(--ink)]"
                      }`}
                    >
                      {day.content || "Dars mazmuni bilan tanishish uchun bosing."}
                    </p>
                  </div>

                  <div
                    className={`mt-5 flex items-center justify-between border-t pt-3 text-xs font-bold ${
                      isWeek || isTest
                        ? "border-white/20 text-white"
                        : "border-black/5 text-indigo-700 group-hover:translate-x-1 transition-transform"
                    }`}
                  >
                    <span>{isTest ? "Testni topshirish" : "Darsni o'qish"}</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
