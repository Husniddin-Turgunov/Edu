"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { TestAccessGate } from "@/components/akela/TestAccessGate";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  Trophy,
  XCircle,
} from "lucide-react";

type Locale = "uz" | "ru" | "en";

interface LessonContent {
  sections: Array<{
    heading: Record<Locale, string>;
    text: Record<Locale, string>;
  }>;
}

interface QuizQuestion {
  question: Record<Locale, string>;
  options: Array<Record<Locale, string>>;
  correctIndex: number;
}

interface Lesson {
  id: number;
  day: number;
  title: Record<Locale, string>;
  objective: Record<Locale, string>;
  content: LessonContent;
  quiz: QuizQuestion[];
}

interface Course {
  slug: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  modules: Array<{
    id: string;
    title: Record<Locale, string>;
    lessons: Lesson[];
  }>;
}

export default function CourseLessonPage({
  params,
}: {
  params: Promise<{ slug: string; day: string }>;
}) {
  const PALETTE = [
    "from-indigo-500 to-indigo-600",
    "from-amber-500 to-amber-600",
    "from-blue-500 to-blue-600",
    "from-purple-500 to-purple-600",
    "from-rose-500 to-rose-600",
  ];
  const { slug, day } = use(params);
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [slideDirection, setSlideDirection] = useState<number>(1); // 1 = next, -1 = prev
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<number[][]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("akela-locale") as Locale | null;
    if (saved && ["uz", "ru", "en"].includes(saved)) {
      setLocale(saved);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/courses?slug=${slug}&day=${day}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setCourse(data.course);
        setLesson(data.lesson);
        setAnswers(new Array(data.lesson.quiz.length).fill(null));
      } catch {
        router.push("/courses");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, day, router]);

  function handleAnswer(qIdx: number, shuffledIdx: number) {
    if (submitted) return;
    // Convert shuffled index back to original index
    const originalIdx = shuffledOptions[qIdx][shuffledIdx];
    const next = [...answers];
    next[qIdx] = originalIdx;
    setAnswers(next);
  }

  function handleSubmit() {
    if (answers.includes(null)) return;
    let correct = 0;
    lesson?.quiz.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correct++;
    });
    setScore(correct);
    setSubmitted(true);
  }

  function handleNext() {
    const nextDay = Number(day) + 1;
    if (course) {
      const allLessons = course.modules.flatMap((m) => m.lessons);
      if (nextDay <= allLessons.length) {
        router.push(`/courses/${slug}/${nextDay}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
        setShowQuiz(false);
        setSubmitted(false);
        setAnswers([]);
        setCurrentSection(0);
      } else {
        router.push(`/courses/${slug}/final`);
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-300 border-t-indigo-700" />
      </div>
    );
  }

  if (!course || !lesson) return null;

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const currentIdx = allLessons.findIndex((l) => l.id === Number(day));
  const hasNext = currentIdx < allLessons.length - 1;
  const progress = ((currentIdx + 1) / allLessons.length) * 100;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#f8faf5] via-[#f3f7ed] to-[#e8f5e0]">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-indigo-200/50 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <button
            onClick={() => router.push(`/courses/${slug}`)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700 transition hover:bg-indigo-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-indigo-900">
              {course.title[locale]}
            </div>
            <div className="text-xs text-indigo-600/70">
              {locale === "uz"
                ? `${lesson.day}-kun`
                : locale === "ru"
                  ? `День ${lesson.day}`
                  : `Day ${lesson.day}`}
            </div>
          </div>
          <div className="text-xs font-mono text-indigo-600">
            {currentIdx + 1}/{allLessons.length}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-indigo-100">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Title — always visible */}
        <div className="glass-card mb-4 rounded-2xl p-5 shadow-lg">
          <div className="mb-2 flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[color:var(--emerald-deep)]">
                {lesson.title[locale]}
              </h1>
              <p className="text-[11px] text-[color:var(--ink-soft)]">
                {locale === "uz"
                  ? `${lesson.day}-kun · Bo'lim ${currentSection + 1}/${lesson.content.sections.length}`
                  : locale === "ru"
                    ? `День ${lesson.day} · Раздел ${currentSection + 1}/${lesson.content.sections.length}`
                    : `Day ${lesson.day} · Section ${currentSection + 1}/${lesson.content.sections.length}`}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-indigo-50/80 px-3 py-2">
            <p className="text-xs leading-relaxed text-indigo-800">
              {lesson.objective[locale]}
            </p>
          </div>
        </div>

        {/* Section content — animated */}
        <div className="relative min-h-[320px] overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {!showQuiz ? (
              <motion.div
                key={currentSection}
                initial={{ opacity: 0, x: slideDirection * 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: slideDirection * -50 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="glass-card rounded-2xl p-5 shadow-lg"
              >
                {/* Section header */}
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${PALETTE[currentSection % PALETTE.length]} text-white shadow-sm`}
                  >
                    <span className="text-sm font-bold">{currentSection + 1}</span>
                  </div>
                  <h2 className="text-sm font-bold text-[color:var(--emerald-deep)]">
                    {lesson.content.sections[currentSection].heading[locale]}
                  </h2>
                </div>

                {/* Section text */}
                <p className="text-sm leading-relaxed text-gray-700">
                  {lesson.content.sections[currentSection].text[locale]}
                </p>

                {/* Navigation */}
                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setSlideDirection(-1);
                      setCurrentSection(currentSection - 1);
                    }}
                    disabled={currentSection === 0}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                      currentSection === 0
                        ? "pointer-events-none cursor-not-allowed border-gray-200 text-gray-300"
                        : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    }`}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {locale === "uz"
                      ? "Orqaga"
                      : locale === "ru"
                        ? "Назад"
                        : "Back"}
                  </button>

                  {currentSection < lesson.content.sections.length - 1 ? (
                    <button
                      onClick={() => {
                        setSlideDirection(1);
                        setCurrentSection(currentSection + 1);
                      }}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-indigo-600"
                    >
                      {locale === "uz"
                        ? "Keyingi"
                        : locale === "ru"
                          ? "Далее"
                          : "Next"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        // Shuffle options for each question
                        if (lesson) {
                          const shuffled = lesson.quiz.map((q) => {
                            const indices = q.options.map((_, i) => i);
                            // Fisher-Yates shuffle
                            for (let i = indices.length - 1; i > 0; i--) {
                              const j = Math.floor(Math.random() * (i + 1));
                              [indices[i], indices[j]] = [indices[j], indices[i]];
                            }
                            return indices;
                          });
                          setShuffledOptions(shuffled);
                        }
                        setShowQuiz(true);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-amber-400 hover:to-amber-500"
                    >
                      {locale === "uz"
                        ? "Testni boshlash"
                        : locale === "ru"
                          ? "Начать тест"
                          : "Start Quiz"}
                      <GraduationCap className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Progress dots */}
                <div className="mt-5 flex justify-center gap-1.5">
                  {lesson.content.sections.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSlideDirection(idx > currentSection ? 1 : -1);
                        setCurrentSection(idx);
                      }}
                      className={`h-2 rounded-full transition-all ${
                        idx === currentSection
                          ? "w-6 bg-indigo-600"
                          : idx < currentSection
                            ? "w-2 bg-indigo-400"
                            : "w-2 bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <TestAccessGate
                endpoint="/api/lesson-access"
                body={{ kind: "day", a: slug, b: String(day), c: String(currentSection) }}
                testTitle={`Nazorat testi — ${slug}, ${day}-kun`}
              >
              <motion.div
                key="quiz"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Quiz Header */}
                <div className="glass-card mb-4 rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[color:var(--emerald-deep)]">
                        {locale === "uz"
                          ? "Nazorat testi"
                          : locale === "ru"
                            ? "Контрольный тест"
                            : "Control Test"}
                      </h2>
                      <p className="text-[11px] text-[color:var(--ink-soft)]">
                        {locale === "uz"
                          ? `${lesson.quiz.length} ta savol — 70% o'tish bali`
                          : locale === "ru"
                            ? `${lesson.quiz.length} вопросов — проходной балл 70%`
                            : `${lesson.quiz.length} questions — passing score 70%`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Single Question — animated */}
                <div className="relative min-h-[280px] overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={currentQuestion}
                      initial={{ opacity: 0, x: slideDirection * 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: slideDirection * -50 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="glass-card rounded-2xl p-5 shadow-lg"
                    >
                      {/* Question header */}
                      <div className="mb-4 flex items-start gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-100 text-xs font-bold text-amber-700">
                          {currentQuestion + 1}
                        </span>
                        <p className="text-sm font-semibold text-gray-800">
                          {lesson.quiz[currentQuestion].question[locale]}
                        </p>
                      </div>

                      {/* Options */}
                      <div className="space-y-2 pl-10">
                        {lesson.quiz[currentQuestion].options.map((opt, oIdx) => {
                          const originalOIdx = shuffledOptions[currentQuestion]?.[oIdx] ?? oIdx;
                          const isSelected = answers[currentQuestion] === originalOIdx;
                          const isCorrect = originalOIdx === lesson.quiz[currentQuestion].correctIndex;
                          let optClass = "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50";
                          if (submitted) {
                            if (isCorrect) {
                              optClass = "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200";
                            } else if (isSelected && !isCorrect) {
                              optClass = "border-red-300 bg-red-50";
                            } else {
                              optClass = "border-gray-200 bg-gray-50 opacity-60";
                            }
                          } else if (isSelected) {
                            optClass = "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200";
                          }

                          return (
                            <button
                              key={oIdx}
                              onClick={() => handleAnswer(currentQuestion, oIdx)}
                              disabled={submitted}
                              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-all ${optClass}`}
                            >
                              <span
                                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${
                                  isSelected
                                    ? "border-indigo-500 bg-indigo-500 text-white"
                                    : "border-gray-300 text-gray-400"
                                } ${submitted && isCorrect ? "!border-indigo-500 !bg-indigo-500 !text-white" : ""} ${submitted && isSelected && !isCorrect ? "!border-red-400 !bg-red-400 !text-white" : ""}`}
                              >
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="flex-1">{opt[locale]}</span>
                              {submitted && isCorrect && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-500" />
                              )}
                              {submitted && isSelected && !isCorrect && (
                                <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Navigation */}
                      <div className="mt-6 flex items-center justify-between gap-3">
                        <button
                          onClick={() => {
                            setSlideDirection(-1);
                            setCurrentQuestion(currentQuestion - 1);
                          }}
                          disabled={currentQuestion === 0}
                          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                            currentQuestion === 0
                              ? "pointer-events-none cursor-not-allowed border-gray-200 text-gray-300"
                              : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                          }`}
                        >
                          <ArrowLeft className="h-4 w-4" />
                          {locale === "uz"
                            ? "Orqaga"
                            : locale === "ru"
                              ? "Назад"
                              : "Back"}
                        </button>

                        {currentQuestion < lesson.quiz.length - 1 ? (
                          <button
                            onClick={() => {
                              setSlideDirection(1);
                              setCurrentQuestion(currentQuestion + 1);
                            }}
                            disabled={answers[currentQuestion] === null}
                            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition ${
                              answers[currentQuestion] === null
                                ? "cursor-not-allowed bg-gray-300"
                                : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600"
                            }`}
                          >
                            {locale === "uz"
                              ? "Keyingi"
                              : locale === "ru"
                                ? "Далее"
                                : "Next"}
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={handleSubmit}
                            disabled={answers.includes(null)}
                            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition ${
                              answers.includes(null)
                                ? "cursor-not-allowed bg-gray-300"
                                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500"
                            }`}
                          >
                            {locale === "uz"
                              ? "Yakunlash"
                              : locale === "ru"
                                ? "Завершить"
                                : "Finish"}
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Progress dots */}
                      <div className="mt-5 flex justify-center gap-1.5">
                        {lesson.quiz.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSlideDirection(idx > currentQuestion ? 1 : -1);
                              setCurrentQuestion(idx);
                            }}
                            className={`h-2 rounded-full transition-all ${
                              idx === currentQuestion
                                ? "w-6 bg-amber-500"
                                : idx < currentQuestion
                                  ? "w-2 bg-amber-400"
                                  : "w-2 bg-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Result — only show after submit */}
                {submitted && (
                  <>
                    {/* Summary card */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="glass-card mt-4 rounded-2xl p-6 text-center shadow-xl"
                    >
                      <div
                        className={`mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full ${
                          score >= lesson.quiz.length * 0.7
                            ? "bg-gradient-to-br from-indigo-400 to-indigo-500"
                            : "bg-gradient-to-br from-red-400 to-red-500"
                        } text-white shadow-xl`}
                      >
                        {score >= lesson.quiz.length * 0.7 ? (
                          <Trophy className="h-10 w-10" />
                        ) : (
                          <XCircle className="h-10 w-10" />
                        )}
                      </div>
                      <h3 className="mb-2 text-xl font-bold text-[color:var(--emerald-deep)]">
                        {score}/{lesson.quiz.length}
                      </h3>
                      <p className="mb-1 text-sm text-[color:var(--ink-soft)]">
                        {score >= lesson.quiz.length * 0.7
                          ? locale === "uz"
                            ? "Ajoyib! Testdan o'tdingiz!"
                            : locale === "ru"
                              ? "Отлично! Вы прошли тест!"
                              : "Excellent! You passed the test!"
                          : locale === "uz"
                            ? "Yana bir bor urinib ko'ring"
                            : locale === "ru"
                              ? "Попробуйте ещё раз"
                              : "Try again"}
                      </p>
                      <p className="text-xs text-[color:var(--ink-soft)]/70">
                        {Math.round((score / lesson.quiz.length) * 100)}%{" "}
                        {locale === "uz"
                          ? "to'g'ri"
                          : locale === "ru"
                            ? "правильных"
                            : "correct"}
                      </p>

                      {/* Review toggle */}
                      <button
                        onClick={() => setShowReview(!showReview)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                      >
                        {locale === "uz"
                          ? showReview ? "Yashirish" : "Barcha savollarni ko'rish"
                          : locale === "ru"
                            ? showReview ? "Скрыть" : "Показать все вопросы"
                            : showReview ? "Hide" : "Show all questions"}
                        <ChevronRight className={`h-3 w-3 transition-transform ${showReview ? "rotate-90" : ""}`} />
                      </button>

                      {score < lesson.quiz.length * 0.7 ? (
                        <button
                          onClick={() => {
                            setSubmitted(false);
                            setAnswers(new Array(lesson.quiz.length).fill(null));
                            setCurrentQuestion(0);
                            setShowReview(false);
                          }}
                          className="mt-4 ml-2 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
                        >
                          {locale === "uz"
                            ? "Qaytadan urinish"
                            : locale === "ru"
                              ? "Попробовать снова"
                              : "Try again"}
                        </button>
                      ) : (
                        <button
                          onClick={handleNext}
                          className="mt-4 ml-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:from-indigo-500 hover:to-indigo-600"
                        >
                          {locale === "uz"
                            ? "Keyingi dars"
                            : locale === "ru"
                              ? "Следующий урок"
                              : "Next lesson"}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                    </motion.div>

                    {/* Full question review */}
                    <AnimatePresence>
                      {showReview && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-3 overflow-hidden"
                        >
                          {lesson.quiz.map((q, qi) => {
                            const userAnswer = answers[qi];
                            const isCorrect = userAnswer === q.correctIndex;
                            return (
                              <div
                                key={qi}
                                className={`glass-card rounded-2xl p-4 shadow-md ${
                                  isCorrect ? "ring-2 ring-indigo-300" : "ring-2 ring-red-300"
                                }`}
                              >
                                {/* Question header */}
                                <div className="mb-3 flex items-start gap-2">
                                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-bold text-white ${
                                    isCorrect ? "bg-indigo-500" : "bg-red-500"
                                  }`}>
                                    {qi + 1}
                                  </span>
                                  <p className="text-sm font-semibold text-gray-800">
                                    {q.question[locale]}
                                  </p>
                                </div>

                                {/* Options */}
                                <div className="space-y-1.5 pl-8">
                                  {q.options.map((opt, oi) => {
                                    const isSelected = userAnswer === oi;
                                    const isCorrectOption = oi === q.correctIndex;
                                    let optClass = "text-gray-600";
                                    if (isSelected && isCorrectOption) {
                                      optClass = "font-semibold text-indigo-700";
                                    } else if (isSelected && !isCorrectOption) {
                                      optClass = "font-semibold text-red-600 line-through";
                                    } else if (isCorrectOption) {
                                      optClass = "font-semibold text-indigo-700";
                                    }
                                    return (
                                      <div key={oi} className={`flex items-center gap-2 text-sm ${optClass}`}>
                                        <span className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                                          isCorrectOption ? "border-indigo-500 bg-indigo-500 text-white" :
                                          isSelected ? "border-red-400 bg-red-400 text-white" :
                                          "border-gray-300 text-gray-400"
                                        }`}>
                                          {String.fromCharCode(65 + oi)}
                                        </span>
                                        <span>{opt[locale]}</span>
                                        {isCorrectOption && (
                                          <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-500 ml-auto" />
                                        )}
                                        {isSelected && !isCorrectOption && (
                                          <XCircle className="h-4 w-4 shrink-0 text-red-400 ml-auto" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Result label */}
                                <div className={`mt-3 flex items-center gap-2 text-xs font-semibold pl-8 ${
                                  isCorrect ? "text-indigo-600" : "text-red-600"
                                }`}>
                                  {isCorrect ? (
                                    <>
                                      <CheckCircle2 className="h-4 w-4" />
                                      {locale === "uz" ? "To'g'ri" : locale === "ru" ? "Правильно" : "Correct"}
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-4 w-4" />
                                      {locale === "uz" ? "Noto'g'ri" : locale === "ru" ? "Неправильно" : "Incorrect"}
                                      <span className="text-gray-500 font-normal ml-1">
                                        — {locale === "uz" ? "To'g'ri javob:" : locale === "ru" ? "Правильный ответ:" : "Correct answer:"}{" "}
                                        <span className="font-semibold text-indigo-700">
                                          {String.fromCharCode(65 + q.correctIndex)}. {q.options[q.correctIndex][locale]}
                                        </span>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </motion.div>
              </TestAccessGate>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
