"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { TestAccessGate } from "@/components/akela/TestAccessGate";
import { Navbar } from "@/components/akela/Navbar";
import onboarding from "@/data/akela-onboarding.json";
import tests from "@/data/akela-tests.json";
import { ArrowLeft, BookOpen, CheckCircle2, XCircle, Trophy, Loader2, RotateCcw } from "lucide-react";
import confetti from "canvas-confetti";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";

function OnboardingTestInner() {
  const params = useParams<{ mi: string; li: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const mi = parseInt(params.mi);
  const li = parseInt(params.li);
  const moduleItem = onboarding[mi] as any;
  const lesson = moduleItem?.lessons?.[li] as any;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const testQuestions = useMemo(() => {
    // Look up by module index (module-1, module-2, etc.)
    const moduleKey = `module-${mi + 1}`;
    const testsObj = tests as Record<string, any>;
    const moduleData = testsObj[moduleKey];
    if (moduleData?.questions?.length) {
      return moduleData.questions.map((q: any) => ({
        question: q.question,
        options: q.options,
        correct: q.correctIndex,
      }));
    }
    // Fallback: collect all questions from all modules
    const allQuestions: { question: string; options: string[]; correct: number }[] = [];
    for (const key of Object.keys(testsObj)) {
      const moduleQuestions = testsObj[key]?.questions;
      if (Array.isArray(moduleQuestions)) {
        for (const q of moduleQuestions) {
          allQuestions.push({ question: q.question, options: q.options, correct: q.correctIndex });
        }
      }
    }
    if (allQuestions.length === 0) {
      return Array.from({ length: 5 }, (_, i) => ({ question: `Savol ${i + 1}`, options: ["A", "B", "C", "D"], correct: 0 }));
    }
    const start = ((mi * 5 + li) % Math.max(1, allQuestions.length - 5));
    return allQuestions.slice(start, start + 5);
  }, [mi, li]);

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(testQuestions.length).fill(null));
  const [showResult, setShowResult] = useState(false);

  const q = testQuestions[current];

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const newAnswers = [...answers];
    newAnswers[current] = idx;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (current < testQuestions.length - 1) {
      setCurrent(current + 1);
      setSelected(null);
    } else {
      setShowResult(true);
      const correct = answers.filter((a, i) => a === testQuestions[i].correct).length;
      const pct = (correct / testQuestions.length) * 100;
      if (pct >= 70) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ["#10b981", "#f59e0b", "#3b82f6"] });
      }
    }
  };

  const correct = answers.filter((a, i) => a === testQuestions[i].correct).length;
  const pct = Math.round((correct / testQuestions.length) * 100);

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

  if (!moduleItem || !lesson) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="relative glass-card rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">Test topilmadi</h1>
          <Link href="/courses" className="mt-4 inline-block text-amber-600 underline">← Kurslar</Link>
        </div>
      </main>
    );
  }

  if (showResult) {
    return (
      <main className="min-h-screen bg-background">
        <LiquidBackground />
        <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />
        <div className="mx-auto max-w-2xl px-6 pt-28 pb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-3xl p-10 text-center"
          >
            <div className={`mx-auto mb-4 grid h-20 w-20 place-items-center rounded-2xl ${pct >= 70 ? "bg-gradient-to-br from-indigo-500 to-teal-600" : "bg-gradient-to-br from-rose-500 to-pink-600"} text-white shadow-xl`}>
              {pct >= 70 ? <Trophy className="h-10 w-10" /> : <XCircle className="h-10 w-10" />}
            </div>
            <h1 className="text-3xl font-extrabold text-[color:var(--emerald-deep)]">
              {pct >= 70 ? "Tabriklaymiz! 🎉" : "Xatolik yuz berdi 😔"}
            </h1>
            <p className="mt-3 text-[color:var(--ink-soft)]">
              {correct} / {testQuestions.length} to'g'ri javob ({pct}%)
            </p>
            <div className="mt-6 glass-card rounded-2xl p-6">
              <div className="text-5xl font-extrabold text-[color:var(--emerald-deep)]">{pct}%</div>
              <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
                {pct >= 90 ? "Ajoyib natija!" : pct >= 70 ? "Yaxshi natija!" : "Yana urinib ko'ring!"}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => { setCurrent(0); setSelected(null); setAnswers(new Array(testQuestions.length).fill(null)); setShowResult(false); }}
                className="flex items-center gap-2 rounded-xl glass-card px-5 py-2.5 text-sm font-semibold text-[color:var(--emerald-deep)] hover:-translate-y-0.5 transition-all"
              >
                <RotateCcw className="h-4 w-4" /> Qaytadan
              </button>
              <Link
                href={`/courses/onboarding/${mi}/${li}`}
                className="rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:scale-105 transition-transform"
              >
                ← Darsga qaytish
              </Link>
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <LiquidBackground />
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      <header className="relative pt-24 pb-6">
        <div className="mx-auto max-w-2xl px-6">
          <Link href={`/courses/onboarding/${mi}/${li}`} className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]">
            <ArrowLeft className="h-4 w-4" /> {lesson.title}
          </Link>
          <div className="mt-3 flex items-center gap-2 text-xs text-[color:var(--ink-soft)]">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Modul {mi + 1} · Dars {li + 1} · Test</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-extrabold sm:text-3xl text-[color:var(--emerald-deep)]">✏️ Test</h1>
        </div>
        <div className="mx-auto max-w-2xl px-6 mt-4">
          <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-indigo-500 transition-all duration-500"
              style={{ width: `${((current + 1) / testQuestions.length) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[color:var(--ink-soft)] text-center">
            Savol {current + 1} / {testQuestions.length}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="glass-card rounded-3xl p-8"
          >
            <h2 className="text-lg font-extrabold text-[color:var(--emerald-deep)] mb-6">
              {current + 1}. {q.question}
            </h2>
            <div className="space-y-3">
              {q.options.map((opt: string, idx: number) => {
                const isCorrect = idx === q.correct;
                const isSelected = selected === idx;
                const showCorrect = selected !== null && isCorrect;
                const showWrong = selected !== null && isSelected && !isCorrect;

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    disabled={selected !== null}
                    className={`w-full text-left rounded-xl px-5 py-4 text-sm font-semibold transition-all border-2 ${
                      showCorrect
                        ? "bg-indigo-50 border-indigo-400 text-indigo-800"
                        : showWrong
                        ? "bg-rose-50 border-rose-400 text-rose-800 animate-[wiggle_0.3s_ease-in-out]"
                        : isSelected
                        ? "bg-amber-50 border-amber-400 text-amber-800"
                        : "glass-card border-transparent text-[color:var(--emerald-deep)] hover:border-amber-300 hover:bg-amber-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-extrabold ${
                        showCorrect ? "bg-indigo-500 text-white" : showWrong ? "bg-rose-500 text-white" : "bg-black/5 text-[color:var(--ink-soft)]"
                      }`}>
                        {showCorrect ? <CheckCircle2 className="h-4 w-4" /> : showWrong ? <XCircle className="h-4 w-4" /> : String.fromCharCode(65 + idx)}
                      </span>
                      <span>{opt}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex justify-end"
              >
                <button
                  onClick={handleNext}
                  className="rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:scale-105 transition-transform"
                >
                  {current < testQuestions.length - 1 ? "Keyingi savol →" : "Natijani ko'rish"}
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

/** Telegram bot orqali ruxsat eshigi bilan o'ralgan dars testi */
export default function OnboardingTestPage() {
  const params = useParams<{ mi: string; li: string }>();
  const endpoint = "/api/lesson-access";
  return (
    <TestAccessGate
      endpoint={endpoint}
      body={{ kind: "lesson", a: "onboarding", b: params.mi, c: params.li }}
      testTitle={`Dars testi - bo'lim ${Number(params.mi) + 1}, dars ${Number(params.li) + 1}`}
    >
      <OnboardingTestInner />
    </TestAccessGate>
  );
}
