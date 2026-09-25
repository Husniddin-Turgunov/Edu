"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Navbar } from "@/components/akela/Navbar";
import Animated3DBackground from "@/components/Animated3DBackground";
import VideoPlayer from "@/components/VideoPlayer";
import { ArrowLeft, BookOpen, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";

type CourseData = {
  course: { slug: string; title: string; moduleCount: number };
  module: { title: string; idx: number };
  lesson: {
    guid: string;
    title: string;
    content: string;
    types: string[];
    video: { url: string; title: string; size: string; description: string } | null;
  };
  navigation: {
    prev: { guid: string; title: string; mIdx: number; lIdx: number } | null;
    next: { guid: string; title: string; mIdx: number; lIdx: number } | null;
    current: number;
    total: number;
  };
};

function renderContent(text: string) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let key = 0;
  let currentList: React.ReactNode[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      out.push(
        <ul key={key++} className="space-y-2 ml-4 mb-4">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  for (const line of lines) {
    const t = line.trim();
    
    if (!t) {
      flushList();
      out.push(<div key={key++} style={{ height: 12 }} />);
      continue;
    }
    
    if (t.startsWith("- ")) {
      currentList.push(
        <li key={key++} className="flex gap-3 text-[color:var(--ink-soft)] leading-relaxed">
          <span className="text-amber-500 font-bold mt-1">✦</span>
          <span>{parseInline(t.slice(2))}</span>
        </li>
      );
      continue;
    }

    flushList();
    
    if (t.startsWith("### "))
      out.push(
        <h3
          key={key++}
          className="text-xl font-bold text-[color:var(--emerald-deep)]"
          style={{ margin: "24px 0 12px" }}
        >
          {t.slice(4)}
        </h3>
      );
    else if (t.startsWith("## "))
      out.push(
        <h2
          key={key++}
          className="text-2xl font-extrabold text-[color:var(--emerald-deep)]"
          style={{ margin: "32px 0 16px" }}
        >
          {t.slice(3)}
        </h2>
      );
    else if (t.startsWith("# "))
      out.push(
        <h1
          key={key++}
          className="text-3xl font-extrabold text-[color:var(--emerald-deep)]"
          style={{ margin: "36px 0 20px" }}
        >
          {t.slice(2)}
        </h1>
      );
    else if (t === "---") {
      out.push(
        <hr
          key={key++}
          className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-[color:var(--border)] to-transparent"
        />
      );
    } else {
      out.push(
        <p
          key={key++}
          className="text-[16px] text-[color:var(--ink-soft)] leading-relaxed mb-4"
        >
          {parseInline(t)}
        </p>
      );
    }
  }
  
  flushList();
  return out;
}

function parseInline(s: string): React.ReactNode {
  const parts: (string | React.ReactNode)[] = [];
  let rest = s;
  let i = 0;
  const re = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(rest)) !== null) {
    if (m.index > last) parts.push(rest.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**"))
      parts.push(
        <strong key={i++} className="text-[color:var(--emerald-deep)] font-bold">
          {tok.slice(2, -2)}
        </strong>
      );
    else if (tok.startsWith("_"))
      parts.push(<em key={i++} className="text-[color:var(--ink-soft)] italic">{tok.slice(1, -1)}</em>);
    else if (tok.startsWith("`"))
      parts.push(
        <code
          key={i++}
          className="rounded-lg bg-gradient-to-br from-indigo-50 to-amber-50 px-2 py-1 text-sm font-mono text-[color:var(--emerald-deep)] border border-indigo-200/50"
        >
          {tok.slice(1, -1)}
        </code>
      );
    last = m.index + tok.length;
  }
  if (last < rest.length) parts.push(rest.slice(last));
  return <>{parts}</>;
}

export default function CourseLessonPage() {
  const params = useParams<{ slug: string; mi: string; li: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const [data, setData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mi = parseInt(params.mi);
  const li = parseInt(params.li);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchData() {
      try {
        const res = await fetch(
          `/api/course/lesson?mi=${mi}&li=${li}`
        );
        if (!res.ok) throw new Error("Dars topilmadi");
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [mi, li, status]);

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="relative glass-card rounded-3xl p-8 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm text-[color:var(--ink-soft)]">Yuklanmoqda...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="relative glass-card rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">
            {error || "Dars topilmadi"}
          </h1>
          <Link
            href="/courses"
            className="mt-4 inline-block text-amber-600 underline"
          >
            ← Kurslar
          </Link>
        </div>
      </main>
    );
  }

  const { course, module: moduleItem, lesson, navigation } = data;
  const isTest = lesson.types.includes("test") || lesson.types.includes("quiz");
  const showVideo = !!lesson.video;
  const progress = (navigation.current / navigation.total) * 100;

  return (
    <main className="min-h-screen bg-background">
      <LiquidBackground />
      <Animated3DBackground />
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      {/* Header — enhanced cream style */}
      <header className="relative pt-28 pb-8">
        <div className="mx-auto max-w-4xl px-6">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Barcha kurslar
          </Link>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[color:var(--ink-soft)] uppercase tracking-wider">
            <BookOpen className="h-3.5 w-3.5" />
            <span>
              Modul {moduleItem.idx + 1}: {moduleItem.title}
            </span>
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold text-[color:var(--emerald-deep)] leading-tight">
            {lesson.title}
          </h1>
        </div>
        {/* Enhanced progress bar */}
        <div className="mx-auto max-w-4xl px-6 mt-6">
          <div className="h-2 rounded-full bg-gradient-to-r from-black/5 to-black/10 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-indigo-400 to-indigo-500 transition-all duration-700 ease-out shadow-lg"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between items-center">
            <span className="text-xs font-semibold text-[color:var(--ink-soft)] uppercase tracking-wider">
              Progress
            </span>
            <span className="text-xs font-bold text-[color:var(--emerald-deep)]">
              {navigation.current} / {navigation.total} dars
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
        {/* Dars kontenti */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card rounded-3xl p-8 sm:p-10"
        >
          <div className="flex items-center gap-3 mb-6">
            {isTest ? (
              <span className="glass-pill text-xs font-bold text-amber-700 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                TEST DARS
              </span>
            ) : (
              <span className="glass-pill text-xs font-bold text-[color:var(--emerald-deep)] flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                DARS
              </span>
            )}
            <span className="text-xs text-[color:var(--ink-soft)]">
              {lesson.types.join(" • ")}
            </span>
          </div>

          {isTest ? (
            <div className="rounded-2xl bg-gradient-to-br from-amber-50/80 to-amber-100/40 ring-2 ring-amber-300/50 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <span className="text-3xl">🎯</span>
              </div>
              <h2 className="text-2xl font-extrabold text-amber-900 mb-3">
                Tayyormisiz?
              </h2>
              <p className="text-base text-amber-800 mb-6 max-w-md mx-auto">
                Bu modul bo'yicha olgan bilimlaringizni sinab ko'ring.
              </p>
              <Link
                href={`/courses/onboarding/${moduleItem.idx}/${li}`}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-8 py-4 text-base font-bold text-white shadow-lg hover:scale-105 hover:shadow-xl transition-all"
              >
                🚀 Testni boshlash
              </Link>
            </div>
          ) : (
            <div className="prose prose-slate max-w-none">
              <div className="whitespace-pre-wrap text-[16px] text-[color:var(--ink-soft)] leading-relaxed">
                {lesson.content
                  ? renderContent(lesson.content)
                  : "Bu dars uchun kontent tayyor emas. Iltimos, dars matnini so'rang."}
              </div>
            </div>
          )}

          {/* Video */}
          {showVideo && lesson.video && (
            <div className="mt-10">
              <div className="glass-card rounded-2xl overflow-hidden shadow-xl">
                <div className="bg-gradient-to-br from-[#0e1e3a] via-[#1a2855] to-[#374187] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-rose-500/20 px-3 py-1 text-[10px] font-bold text-rose-300 ring-1 ring-rose-500/30 flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                      Video
                    </span>
                  </div>
                  <h3 className="text-white font-extrabold text-lg">
                    {lesson.video.title}
                  </h3>
                  <p className="text-sm text-white/70 mt-2 leading-relaxed">
                    {lesson.video.description}
                  </p>
                </div>
                <VideoPlayer
                  src={lesson.video.url}
                  title={lesson.video.title}
                  poster="/akela/logo.png"
                />
              </div>
            </div>
          )}
        </motion.article>

        {/* Enhanced Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
          {navigation.prev ? (
            <Link
              href={`/course/${course.slug}/module/${navigation.prev.mIdx}/lesson/${navigation.prev.lIdx}`}
              className="glass-card rounded-xl px-5 py-3 text-sm font-semibold text-[color:var(--emerald-deep)] hover:-translate-y-1 hover:shadow-lg transition-all flex items-center gap-2 group"
            >
              <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span className="truncate max-w-[200px]">
                {navigation.prev.title?.length > 30
                  ? navigation.prev.title.slice(0, 30) + "…"
                  : navigation.prev.title}
              </span>
            </Link>
          ) : (
            <div />
          )}

          {navigation.next ? (
            <Link
              href={`/course/${course.slug}/module/${navigation.next.mIdx}/lesson/${navigation.next.lIdx}`}
              className="rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:scale-105 hover:shadow-xl transition-all flex items-center gap-2 group"
            >
              <span className="truncate max-w-[200px]">
                {navigation.next.title?.length > 30
                  ? navigation.next.title.slice(0, 30) + "…"
                  : navigation.next.title}
              </span>
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <Link
              href="/courses"
              className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:scale-105 hover:shadow-xl transition-all flex items-center gap-2"
            >
              🎉 Kurs tugadi
            </Link>
          )}
        </div>

        {/* Enhanced progress indicator */}
        <div className="glass-card rounded-xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
              {navigation.current}
            </div>
            <div>
              <p className="text-xs font-semibold text-[color:var(--ink-soft)] uppercase tracking-wider">
                Dars progress
              </p>
              <p className="text-sm font-bold text-[color:var(--emerald-deep)]">
                {navigation.current} / {navigation.total}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">
              {Math.round(progress)}%
            </p>
            <p className="text-xs text-[color:var(--ink-soft)]">completed</p>
          </div>
        </div>
      </div>
    </main>
  );
}
