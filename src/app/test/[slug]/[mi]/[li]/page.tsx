"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { TestAccessGate } from "@/components/akela/TestAccessGate";
import { Navbar } from "@/components/akela/Navbar";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import testsData from "@/data/akela-tests.json";
import onboarding from "@/data/akela-onboarding.json";

type Question = {
  question: string;
  options: string[];
  correctIndex: number;
};

type TestResult = "correct" | "wrong" | null;

function TestPageInner() {
  const params = useParams<{ slug: string; mi: string; li: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];

  const mi = parseInt(params.mi);
  const li = parseInt(params.li);

  const moduleItem = (onboarding as any[])[mi];
  const lesson = moduleItem?.lessons?.[li];

  // Get test questions by module index (module-1, module-2, etc.)
  const moduleKey = `module-${mi + 1}`;
  const moduleData = (testsData as Record<string, any>)[moduleKey];
  const questions: Question[] = moduleData?.questions || [];

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const q = questions[idx];
  const total = questions.length;
  const progress = ((idx + (showResult ? 1 : 0)) / total) * 100;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percent >= 70;

  function handlePick(optIdx: number) {
    if (showResult) return;
    setPicked(optIdx);
    setShowResult(true);
    if (optIdx === q.correctIndex) {
      setScore((s) => s + 1);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

  function next() {
    if (idx < total - 1) {
      setIdx(idx + 1);
      setPicked(null);
      setShowResult(false);
    } else {
      setDone(true);
    }
  }

  function restart() {
    setIdx(0);
    setPicked(null);
    setShowResult(false);
    setScore(0);
    setDone(false);
  }

  if (status === "loading") {
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

  if (!lesson || total === 0) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="relative glass-card rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">
            Test savollari topilmadi
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

  // Final result screen
  if (done) {
    return (
      <main className="min-h-screen bg-background">
        <LiquidBackground />
        <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

        <div className="mx-auto max-w-2xl px-6 pt-32 pb-20 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mx-auto mb-6 h-36 w-36 rounded-full flex items-center justify-center"
            style={{
              background: passed
                ? "linear-gradient(135deg, #10b981, #34d399)"
                : "linear-gradient(135deg, #f59e0b, #fbbf24)",
              boxShadow: passed
                ? "0 12px 40px rgba(16, 185, 129, .3)"
                : "0 12px 40px rgba(245, 158, 11, .3)",
            }}
          >
            {passed ? (
              <Trophy className="h-16 w-16 text-white" />
            ) : (
              <span className="text-6xl">💪</span>
            )}
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-extrabold text-[color:var(--emerald-deep)] mb-3"
          >
            {passed
              ? percent === 100
                ? "Ajoyib! Mukammal!"
                : "Yaxshi ish!"
              : "Yana urinib ko'ring!"}
          </motion.h1>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-6xl font-extrabold mb-2"
            style={{ color: passed ? "var(--emerald-deep)" : "var(--gold)" }}
          >
            {score} / {total}
          </motion.div>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-[color:var(--ink-soft)] mb-8"
          >
            {percent}% to'g'ri javob •{" "}
            {passed
              ? "Siz testdan muvaffaqiyatli o'tdingiz!"
              : "70% dan yuqori natija kerak"}
          </motion.p>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex gap-3 justify-center flex-wrap"
          >
            {!passed && (
              <button
                onClick={restart}
                className="glass-card rounded-xl px-6 py-3 text-sm font-bold text-[color:var(--emerald-deep)] hover:-translate-y-0.5 transition-all flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" /> Qaytadan urinish
              </button>
            )}
            <Link
              href={`/course/akela-onboarding/module/${mi}/lesson/${li}`}
              className="rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:scale-105 transition-transform"
            >
              Darsga qaytish →
            </Link>
            <Link
              href="/courses"
              className="glass-card rounded-xl px-6 py-3 text-sm font-bold text-[color:var(--emerald-deep)] hover:-translate-y-0.5 transition-all"
            >
              🏠 Kurslar
            </Link>
          </motion.div>
        </div>
      </main>
    );
  }

  // Test in progress
  return (
    <main className="min-h-screen bg-background">
      <LiquidBackground />
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      {/* Header */}
      <section className="relative pt-24 pb-6">
        <div className="mx-auto max-w-3xl px-6">
          <Link
            href={`/course/akela-onboarding/module/${mi}/lesson/${li}`}
            className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]"
          >
            <ArrowLeft className="h-4 w-4" /> Darsga qaytish
          </Link>
          <div className="mt-3 text-xs text-[color:var(--ink-soft)]">
            Modul {mi + 1}: {moduleItem.title}
          </div>
          <h1 className="mt-1.5 text-2xl font-extrabold sm:text-3xl text-[color:var(--emerald-deep)]">
            ✏️ {lesson.title}
          </h1>
        </div>
        {/* Progress bar */}
        <div className="mx-auto max-w-3xl px-6 mt-4">
          <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-amber-400 via-indigo-400 to-indigo-500"
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-[color:var(--ink-soft)]">
            <span>Savol {idx + 1} / {total}</span>
            <span>Ball: {score}</span>
          </div>
        </div>
      </section>

      {/* Question */}
      <div className="mx-auto max-w-3xl px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ x: 30, opacity: 0 }}
            animate={shake ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0, opacity: 1 }}
            exit={{ x: -30, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card rounded-3xl p-8 mb-6">
              <h2 className="text-xl font-extrabold text-[color:var(--emerald-deep)] mb-6 leading-relaxed">
                {q.question}
              </h2>
              <div className="flex flex-col gap-3">
                {q.options.map((opt, i) => {
                  let bg = "bg-white/50";
                  let border = "border border-[color:var(--glass-border)]";
                  let textColor = "text-[color:var(--ink-soft)]";
                  let iconBg = "bg-black/5";

                  if (showResult) {
                    if (i === q.correctIndex) {
                      bg = "bg-indigo-50";
                      border = "border-2 border-indigo-500";
                      textColor = "text-indigo-700";
                      iconBg = "bg-indigo-500";
                    } else if (i === picked) {
                      bg = "bg-rose-50";
                      border = "border-2 border-rose-500";
                      textColor = "text-rose-700";
                      iconBg = "bg-rose-500";
                    } else {
                      bg = "bg-black/5";
                      textColor = "text-gray-400";
                    }
                  }

                  return (
                    <motion.button
                      key={i}
                      onClick={() => handlePick(i)}
                      disabled={showResult}
                      whileHover={!showResult ? { scale: 1.02, x: 4 } : {}}
                      whileTap={!showResult ? { scale: 0.98 } : {}}
                      className={`flex items-center gap-4 p-4 rounded-2xl text-left transition-all ${bg} ${border} ${textColor}`}
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          showResult && i === q.correctIndex
                            ? "bg-indigo-500 text-white"
                            : showResult && i === picked
                            ? "bg-rose-500 text-white"
                            : iconBg
                        }`}
                      >
                        {showResult
                          ? i === q.correctIndex
                            ? "✓"
                            : i === picked
                            ? "✗"
                            : String.fromCharCode(65 + i)
                          : String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1 font-medium">{opt}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Result feedback */}
            <AnimatePresence>
              {showResult && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`rounded-2xl p-4 mb-6 flex items-center gap-3 ${
                    picked === q.correctIndex
                      ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                      : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                  }`}
                >
                  {picked === q.correctIndex ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 shrink-0" />
                  )}
                  <span className="font-semibold">
                    {picked === q.correctIndex
                      ? "To'g'ri javob! Ajoyib!"
                      : `To'g'ri javob: ${q.options[q.correctIndex]}`}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Next button */}
            {showResult && (
              <motion.button
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                onClick={next}
                className="w-full rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-6 py-4 text-base font-bold text-white shadow-lg hover:scale-[1.02] transition-transform"
              >
                {idx < total - 1 ? "Keyingi savol →" : "Natijani ko'rish →"}
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

/** Testga kirish uchun Telegram bot orqali ruxsat eshigi bilan o'ralgan sahifa */
export default function TestPage() {
  const params = useParams<{ slug: string; mi: string; li: string }>();
  const endpoint = "/api/lesson-access";
  return (
    <TestAccessGate
      endpoint={endpoint}
      body={{ kind: "lesson", a: params.slug, b: params.mi, c: params.li }}
      testTitle={`Dars testi - bo'lim ${Number(params.mi) + 1}, dars ${Number(params.li) + 1}`}
    >
      <TestPageInner />
    </TestAccessGate>
  );
}
