"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { ArrowLeft, CheckCircle2, XCircle, Trophy, RefreshCw, ChevronRight } from "lucide-react";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { TestAccessGate } from "@/components/akela/TestAccessGate";
import { Navbar } from "@/components/akela/Navbar";
import onboarding from "@/data/akela-onboarding.json";
import tests from "@/data/akela-tests.json";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import { useEffect } from "react";

const PASSING_SCORE = 70;

function OnboardingTestInner() {
  const params = useParams<{ mi: string; li: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const mi = parseInt(params.mi);
  const li = parseInt(params.li);

  const moduleItem = onboarding[mi] as any;
  const lesson = moduleItem?.lessons?.[li] as any;
  const moduleKey = `module-${mi + 1}`;
  const testData = (tests as any)[moduleKey];

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>(
    testData ? new Array(testData.questions.length).fill(null) : []
  );
  const [showResults, setShowResults] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const score = useMemo(() => {
    if (!testData) return 0;
    return testData.questions.reduce((acc: number, q: any, idx: number) => {
      return acc + (selectedAnswers[idx] === q.correctIndex ? 1 : 0);
    }, 0);
  }, [selectedAnswers, testData]);

  const scorePercent = testData
    ? Math.round((score / testData.questions.length) * 100)
    : 0;
  const passed = scorePercent >= PASSING_SCORE;

  const handleSelect = (optionIndex: number) => {
    if (submitted) return;
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = optionIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < (testData?.questions.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setSubmitted(true);
      setShowResults(true);
    }
  };

  const handleRetry = () => {
    setSelectedAnswers(new Array(testData.questions.length).fill(null));
    setCurrentQuestion(0);
    setSubmitted(false);
    setShowResults(false);
  };

  if (status === "loading") {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="text-sm text-[color:var(--ink-soft)]">Yuklanmoqda...</div>
      </main>
    );
  }

  if (!testData) {
    return (
      <main className="min-h-screen bg-background">
        <LiquidBackground />
        <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">Test topilmadi</h1>
          <p className="mt-2 text-sm text-[color:var(--ink-soft)]">Bu modul uchun test hozircha mavjud emas.</p>
          <Link
            href={`/courses/onboarding/${mi}/${li}`}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md"
          >
            <ArrowLeft className="h-4 w-4" /> Darsga qaytish
          </Link>
        </div>
      </main>
    );
  }

  const question = testData.questions[currentQuestion];
  const isLastQuestion = currentQuestion === testData.questions.length - 1;
  const allAnswered = selectedAnswers.every((a) => a !== null);

  return (
    <main className="min-h-screen bg-background">
      <LiquidBackground />
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href={`/courses/onboarding/${mi}/${li}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Darsga qaytish
        </Link>

        <div className="mt-4">
          <span className="text-xs font-semibold text-[color:var(--ink-soft)] uppercase tracking-wider">
            Modul {mi + 1}: {moduleItem?.title}
          </span>
          <h1 className="mt-2 text-3xl font-extrabold text-[color:var(--emerald-deep)]">
            {testData.title}
          </h1>
        </div>

        <AnimatePresence mode="wait">
          {!showResults ? (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mt-8"
            >
              <div className="glass-card mb-4 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[color:var(--ink-soft)] uppercase tracking-wider">
                    Test
                  </span>
                  <span className="glass-pill text-xs font-bold text-[color:var(--emerald-deep)]">
                    {currentQuestion + 1} / {testData.questions.length}
                  </span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-black/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-indigo-500 transition-all"
                    style={{ width: `${((currentQuestion + 1) / testData.questions.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6">
                <div className="mb-5 flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-sm font-bold text-amber-700">
                    {currentQuestion + 1}
                  </span>
                  <p className="text-base font-semibold text-[color:var(--ink)]">
                    {question.question}
                  </p>
                </div>

                <div className="space-y-2">
                  {question.options.map((option: string, oIdx: number) => {
                    const isSelected = selectedAnswers[currentQuestion] === oIdx;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleSelect(oIdx)}
                        className={`w-full text-left rounded-xl p-4 transition-all border-2 ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-black/5 bg-white/40 hover:border-indigo-200 hover:bg-white/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                              isSelected
                                ? "bg-indigo-600 text-white"
                                : "bg-black/5 text-[color:var(--ink-soft)]"
                            }`}
                          >
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="text-sm text-[color:var(--ink)]">{option}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xs text-[color:var(--ink-soft)]">
                    {PASSING_SCORE}% o'tish bali
                  </span>
                  <button
                    onClick={handleNext}
                    disabled={selectedAnswers[currentQuestion] === null}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
                  >
                    {isLastQuestion ? "Testni yakunlash" : "Keyingi savol"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mt-8"
            >
              <div
                className={`glass-card rounded-2xl p-8 text-center ${
                  passed
                    ? "bg-gradient-to-br from-indigo-50/60 to-indigo-100/30 ring-2 ring-indigo-300/50"
                    : "bg-gradient-to-br from-rose-50/60 to-rose-100/30 ring-2 ring-rose-300/50"
                }`}
              >
                <div
                  className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${
                    passed ? "bg-indigo-500" : "bg-rose-500"
                  } text-white shadow-lg`}
                >
                  {passed ? <Trophy className="h-10 w-10" /> : <XCircle className="h-10 w-10" />}
                </div>
                <h2 className="mt-4 text-2xl font-extrabold text-[color:var(--emerald-deep)]">
                  {passed ? "Tabriklaymiz!" : "Yana harakat qiling"}
                </h2>
                <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
                  {passed
                    ? "Siz testdan muvaffaqiyatli o'tdingiz."
                    : `Testdan o'ta olmadingiz. ${PASSING_SCORE}% kerak edi.`}
                </p>
                <div className="mt-6">
                  <div className="text-5xl font-extrabold text-[color:var(--emerald-deep)]">
                    {scorePercent}%
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
                    {score} / {testData.questions.length} to'g'ri javob
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center gap-2 rounded-xl glass px-4 py-2 text-sm font-semibold text-[color:var(--emerald-deep)]"
                  >
                    <RefreshCw className="h-4 w-4" /> Qaytadan urinish
                  </button>
                  <Link
                    href={`/courses/onboarding/${mi}/${li}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md"
                  >
                    Darsga qaytish
                  </Link>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <h3 className="text-lg font-extrabold text-[color:var(--emerald-deep)]">
                  Javoblar tahlili
                </h3>
                {testData.questions.map((q: any, idx: number) => {
                  const userAnswer = selectedAnswers[idx];
                  const isCorrect = userAnswer === q.correctIndex;
                  return (
                    <div
                      key={idx}
                      className={`glass-card rounded-2xl p-4 ${
                        isCorrect
                          ? "ring-1 ring-indigo-200"
                          : "ring-1 ring-rose-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                            isCorrect
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[color:var(--ink)]">
                            {idx + 1}. {q.question}
                          </p>
                          <div className="mt-2 space-y-1">
                            {q.options.map((opt: string, oIdx: number) => {
                              const isThisCorrect = oIdx === q.correctIndex;
                              const isThisUser = oIdx === userAnswer;
                              return (
                                <div
                                  key={oIdx}
                                  className={`text-xs px-3 py-1.5 rounded-lg ${
                                    isThisCorrect
                                      ? "bg-indigo-100 text-indigo-800 font-semibold"
                                      : isThisUser
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-black/5 text-[color:var(--ink-soft)]"
                                  }`}
                                >
                                  {String.fromCharCode(65 + oIdx)}. {opt}
                                  {isThisCorrect && " ✓"}
                                  {isThisUser && !isThisCorrect && " ✗ (Sizning javobingiz)"}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
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
      body={{ kind: "lesson", a: "akela-onboarding", b: params.mi, c: params.li }}
      testTitle={`Dars testi - bo'lim ${Number(params.mi) + 1}, dars ${Number(params.li) + 1}`}
    >
      <OnboardingTestInner />
    </TestAccessGate>
  );
}
