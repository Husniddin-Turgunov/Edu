"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { TestAccessGate } from "@/components/akela/TestAccessGate";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Navbar } from "@/components/akela/Navbar";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import confetti from "canvas-confetti";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import { useMyCourses } from "@/hooks/useMyCourses";
import { NoAccess } from "@/components/akela/NoAccess";
import { useProgressTimer } from "@/hooks/useProgressTimer";
import { RelatedVideos } from "@/components/akela/RelatedVideos";

interface ParsedQuizItem {
  question: string;
  options: string[];
  correct: number;
}

function parseTestQuestions(content: string): ParsedQuizItem[] {
  const lines = content.split("\n");
  const items: ParsedQuizItem[] = [];
  let currentQ: string | null = null;
  let currentOpts: string[] = [];
  let currentCorrect = 0;

  const saveQ = () => {
    if (currentQ && currentOpts.length > 0) {
      items.push({
        question: currentQ,
        options: currentOpts,
        correct: currentCorrect,
      });
    }
    currentQ = null;
    currentOpts = [];
    currentCorrect = 0;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check question number like "1. ", "2. ", "10) "
    const qMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (qMatch) {
      saveQ();
      currentQ = qMatch[2].trim();
      continue;
    }

    // Check option like "A) ", "B) ", "A. "
    const optMatch = line.match(/^([A-Da-d])[\.\)]\s*(.+)$/);
    if (optMatch && currentQ) {
      let optText = optMatch[2].trim();
      const isCorrect =
        optText.includes("✓") ||
        optText.toLowerCase().includes("to'g'ri") ||
        optText.toLowerCase().includes("to‘g‘ri") ||
        optText.toLowerCase().includes("правильн");

      optText = optText
        .replace(/✓\s*to[‘'Кј`]g[‘'Кј`]ri\s*javob/gi, "")
        .replace(/✓\s*правильный\s*ответ/gi, "")
        .replace(/✓/g, "")
        .trim();

      if (isCorrect) {
        currentCorrect = currentOpts.length;
      }
      currentOpts.push(optText);
    }
  }
  saveQ();
  return items;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleQuiz(questions: ParsedQuizItem[]): ParsedQuizItem[] {
  // har urinishda savollar va variantlar random
  const shuffledQs = shuffleArray(questions);
  return shuffledQs.map((q) => {
    const correctText = q.options[q.correct];
    const shuffledOpts = shuffleArray(q.options);
    const newCorrect = shuffledOpts.indexOf(correctText);
    return { question: q.question, options: shuffledOpts, correct: newCorrect === -1 ? 0 : newCorrect };
  });
}

// Talabalar test javob kalitlarini maqola matnida ko'rmasligi uchun ✓ belgilarni tozalash
function stripAnswerKeys(text: string) {
  return text
    .replace(/✓\s*to[‘'Кј`]g[‘'Кј`]ri\s*javob/gi, "")
    .replace(/✓\s*правильный\s*ответ/gi, "")
    .replace(/✓/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderLessonMarkdown(content: string) {
  const paragraphs = content.split("\n\n");
  return paragraphs.map((p, pIdx) => {
    const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    if (lines[0].startsWith("Maqsad:")) {
      return (
        <div
          key={pIdx}
          className="my-6 rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-5 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span>Dars maqsadi:</span>
          </div>
          <p className="mt-2 text-sm sm:text-base leading-relaxed text-amber-950 font-medium">
            {stripAnswerKeys(lines[0].replace(/^Maqsad:\s*/, ""))}
          </p>
        </div>
      );
    }

    if (lines[0].startsWith("Chek-list") || lines[0].startsWith("Chek-list —")) {
      return (
        <div
          key={pIdx}
          className="my-6 rounded-2xl border border-indigo-200/60 bg-indigo-500/10 p-6 backdrop-blur-sm"
        >
            <h4 className="text-sm font-extrabold text-[color:var(--emerald-deep)] flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
              {stripAnswerKeys(lines[0])}
            </h4>
            <div className="space-y-2">
              {lines.slice(1).map((item, iIdx) => (
                <div key={iIdx} className="flex items-start gap-2 text-sm text-[color:var(--ink)]">
                  <span className="text-indigo-600 font-bold mt-0.5">✔</span>
                  <span>{stripAnswerKeys(item.replace(/^[☐✔•\-]\s*/, ""))}</span>
                </div>
              ))}
            </div>
        </div>
      );
    }

    return (
      <div key={pIdx} className="my-4 space-y-2">
        {lines.map((line, lIdx) => {
          if (line.length < 60 && (line.endsWith(":") || !line.endsWith("."))) {
            return (
              <h3
                key={lIdx}
                className="text-base sm:text-lg font-bold text-[color:var(--emerald-deep)] mt-4 mb-1"
              >
                {stripAnswerKeys(line)}
              </h3>
            );
          }
          return (
            <p
              key={lIdx}
              className="text-sm sm:text-base leading-relaxed text-[color:var(--ink-soft)]"
            >
              {stripAnswerKeys(line)}
            </p>
          );
        })}
      </div>
    );
  });
}

function JobDayLessonInner() {
  const params = useParams<{ slug: string; pi: string; di: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];

  const slug = params?.slug;
  const pi = parseInt(params?.pi || "0", 10);
  const di = parseInt(params?.di || "0", 10);

  const [job, setJob] = useState<any | null>(null);
  const [jobLoading, setJobLoading] = useState(true);
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

  const validParts = useMemo(() => {
    if (!job) return [];
    return (job.parts || []).filter(
      (p: any) => Array.isArray(p.days) && p.days.length > 0
    );
  }, [job]);

  const currentPart = validParts[pi] || validParts[0];
  const currentDay = currentPart?.days?.[di];

  const rawQuizQuestions = useMemo(() => {
    if (!currentDay?.content) return [];
    return parseTestQuestions(currentDay.content);
  }, [currentDay]);

  // har urinishda random — savollar va variantlar aralashtiriladi
  const [shuffledQuestions, setShuffledQuestions] = useState<ParsedQuizItem[]>([]);
  useEffect(() => {
    if (rawQuizQuestions.length === 0) {
      setShuffledQuestions([]);
      return;
    }
    setShuffledQuestions(shuffleQuiz(rawQuizQuestions));
  }, [rawQuizQuestions, pi, di]);

  const quizQuestions = shuffledQuestions;

  const isTestOnly =
    rawQuizQuestions.length > 0 &&
    (currentDay?.title.toLowerCase().includes("test") ||
      currentDay?.title.toLowerCase().includes("nazorat"));

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [savingResult, setSavingResult] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    setSelectedAnswers({});
    setSubmitted(false);
  }, [pi, di]);

  // Kun progressi: vaqt + test topshirilganda/keyingi kunga o'tganda yakunlash
  const { finish: finishDay } = useProgressTimer({ jobDayId: (currentDay as any)?.id });

  if (status === "loading" || jobLoading || !job || !currentDay) {
    const notFound = !jobLoading && (!job || !currentDay);
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="glass-card rounded-3xl p-8 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-[color:var(--ink-soft)]">{notFound ? "Dars topilmadi..." : "Dars yuklanmoqda..."}</p>
          {notFound && (
            <Link href={job ? `/courses/job/${job.slug}` : "/courses"} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">
              <ArrowLeft className="h-4 w-4" /> Ortga
            </Link>
          )}
        </div>
      </main>
    );
  }

  // Biriktirilmagan kasb kuni — kirish taqiqlanadi (cuid: _id || id)
  if (!access.loading && !access.hasJob(job?._id || job?.id)) {
    return <NoAccess />;
  }

  // Prev / Next calculation
  let prevUrl: string | null = null;
  let nextUrl: string | null = null;

  if (di > 0) {
    prevUrl = `/courses/job/${job.slug}/${pi}/${di - 1}`;
  } else if (pi > 0 && validParts[pi - 1]?.days?.length) {
    prevUrl = `/courses/job/${job.slug}/${pi - 1}/${validParts[pi - 1].days.length - 1}`;
  }

  if (di < currentPart.days.length - 1) {
    nextUrl = `/courses/job/${job.slug}/${pi}/${di + 1}`;
  } else if (pi < validParts.length - 1 && validParts[pi + 1]?.days?.length) {
    nextUrl = `/courses/job/${job.slug}/${pi + 1}/0`;
  }

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const calculateScore = () => {
    let score = 0;
    quizQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct) score++;
    });
    return score;
  };

  const handleFinishQuiz = async () => {
    setSubmitted(true);
    finishDay();
    const score = calculateScore();
    const percent = Math.round((score / quizQuestions.length) * 100);
    if (percent >= 70) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
    // tarixda saqlash — har urinish
    setSavingResult(true);
    try {
      const actualPartIdx = job.parts.findIndex((p: any) => p === currentPart);
      const dayId = (currentDay as any)?.id || null;
      await fetch("/api/job-tests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobSlug: job.slug,
          partIdx: actualPartIdx >= 0 ? actualPartIdx : pi,
          dayIdx: di,
          jobDayId: dayId,
          score: percent,
          passed: percent >= 70,
          answers: selectedAnswers,
        }),
      });
    } catch (e) {
      console.error("Failed to save job test result", e);
    } finally {
      setSavingResult(false);
    }
    // bir marta topshirgandan keyin oddiy oynaga qaytish — 1.5s dan keyin avtomatik, lekin tugma ham bor
    // test chiqib qolmasligi uchun: agar keyingi dars bo'lsa o'sha, bo'lmasa kursga
  };

  const score = calculateScore();
  const percent = quizQuestions.length > 0 ? Math.round((score / quizQuestions.length) * 100) : 0;
  const passed = percent >= 70;

  return (
    <main className="min-h-screen bg-background pb-24">
      <LiquidBackground />
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      <div className="mx-auto max-w-4xl px-6 pt-32">
        {/* Breadcrumb & Navigation */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-[color:var(--ink-soft)]">
          <div className="flex items-center gap-2">
            <Link
              href={`/courses/job/${job.slug}`}
              className="inline-flex items-center gap-1.5 font-bold text-[color:var(--emerald-deep)] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> {job.title}
            </Link>
            <span>/</span>
            <span>{currentPart.title.includes("5 KUN") ? "5 kunlik" : "30 kunlik"}</span>
          </div>

          <span className="glass-pill text-xs font-bold text-[color:var(--emerald-deep)]">
            Dars #{di + 1} / {currentPart.days.length}
          </span>
        </div>

        {/* Lesson Card */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card relative overflow-hidden rounded-3xl p-8 sm:p-12 shadow-xl"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 opacity-15 blur-3xl" />

          {/* Title Header */}
          <div className="border-b border-black/5 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-indigo-100 px-3 py-1 text-xs font-extrabold text-indigo-800">
                {currentDay.kind === "hafta" ? "Haftalik Reja" : `Kun #${currentDay.num || di + 1}`}
              </span>
              {isTestOnly && (
                <span className="rounded-xl bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">
                  ✏️ Nazorat Testi
                </span>
              )}
            </div>

            <h1 className="mt-4 text-2xl sm:text-3xl font-black text-[color:var(--emerald-deep)] leading-tight">
              {currentDay.title}
            </h1>
          </div>

          {/* Content Body */}
          <div className="mt-8">
            {currentDay.videoUrl ? (
          <div className="glass-card rounded-3xl p-6 bg-gradient-to-br from-[#0e1e3a] to-[#1a2855] overflow-hidden mb-8">
            <div className="relative aspect-video bg-gradient-to-br from-[#0e1e3a] to-[#1a2855] overflow-hidden rounded-t-[1.1rem]">
              {/* Video placeholder */}
              <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                <svg className="w-12 h-12 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <polygon points="9,18 15,12 9,6"></polygon>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <p className="mt-1">Video: {currentDay.title}</p>
              </div>
            </div>
            <div className="p-4 text-left">
              <h3 className="font-bold text-neutral-900 mb-2">{currentDay.title}</h3>
              <p className="text-[color:var(--ink-soft)] leading-relaxed">
                {currentDay.videoUrl ? `Video havola: ${currentDay.videoUrl}` : "No video"}
              </p>
              {currentDay.videoUrl && (
                <a
                  href={currentDay.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-white border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" /> Yotish
                </a>
              )}
            </div>
          </div>
        ) : (
          renderLessonMarkdown(currentDay.content)
        )}
          </div>

          {/* Tegishli video darslar (DB dan). Avval sahifa ENG OSTIDA,
              uzun test ro'yxatidan keyin turardi — foydalanuvchi uni
              ko'rmay "chiqmayapti" deb o'ylardi. Endi dars matnidan keyin,
              yaqqol ko'rinadigan joyda. */}
          <div className="mt-8">
            <RelatedVideos />
          </div>

          {/* Interactive Quiz Section if available */}
          {quizQuestions.length > 0 && (
            <div className="mt-12 border-t border-black/10 pt-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-[color:var(--emerald-deep)] flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-amber-600" />
                    Nazorat Testi ({quizQuestions.length} ta savol)
                  </h3>
                  <p className="text-xs sm:text-sm text-[color:var(--ink-soft)] mt-1">
                    O'tish bali: 70%. Har bir savolga javob tanlang va natijani ko'ring.
                  </p>
                </div>

                {submitted && (
                  <div
                    className={`rounded-2xl px-4 py-2 text-center text-xs font-black shadow-md ${
                      passed
                        ? "bg-indigo-600 text-white"
                        : "bg-rose-600 text-white"
                    }`}
                  >
                    <p className="text-sm font-extrabold">{percent}%</p>
                    <p className="text-[10px]">{passed ? "O'TDINGIZ 🎉" : "QAYTA TOPSHIRING"}</p>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {quizQuestions.map((q, qIdx) => {
                  const userPick = selectedAnswers[qIdx];
                  const isAnswered = typeof userPick === "number";

                  return (
                    <div
                      key={qIdx}
                      className="rounded-2xl border border-black/5 bg-white/70 p-5 shadow-sm transition-all"
                    >
                      <p className="text-sm sm:text-base font-bold text-[color:var(--ink)] mb-4">
                        <span className="text-indigo-700 font-extrabold mr-1.5">
                          {qIdx + 1}.
                        </span>
                        {q.question}
                      </p>

                      <div className="space-y-2">
                        {q.options.map((opt, oIdx) => {
                          const isPicked = userPick === oIdx;
                          const isCorrect = oIdx === q.correct;

                          let stateClasses = "bg-white/60 hover:bg-indigo-50 text-[color:var(--ink)] border-black/5";

                          if (submitted) {
                            if (isCorrect) {
                              stateClasses = "bg-indigo-100 border-indigo-500 text-indigo-950 font-bold";
                            } else if (isPicked && !isCorrect) {
                              stateClasses = "bg-rose-100 border-rose-500 text-rose-950 line-through";
                            }
                          } else if (isPicked) {
                            stateClasses = "bg-indigo-600 text-white border-indigo-600 font-bold shadow-md";
                          }

                          return (
                            <button
                              key={oIdx}
                              onClick={() => handleSelect(qIdx, oIdx)}
                              disabled={submitted}
                              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs sm:text-sm transition-all ${stateClasses}`}
                            >
                              <span>
                                <span className="font-mono font-bold mr-2">
                                  {String.fromCharCode(65 + oIdx)})
                                </span>
                                {opt}
                              </span>

                              {submitted && isCorrect && (
                                <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                              )}
                              {submitted && isPicked && !isCorrect && (
                                <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {!submitted ? (
                  <button
                    onClick={handleFinishQuiz}
                    disabled={Object.keys(selectedAnswers).length < quizQuestions.length || savingResult}
                    className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-indigo-600 to-teal-700 px-8 py-3 text-sm font-bold text-white shadow-lg hover:scale-[1.02] disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {savingResult ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Testni tekshirish ({Object.keys(selectedAnswers).length} / {quizQuestions.length})
                  </button>
                ) : (
                  <>
                    <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Natija tarixda saqlandi
                    </div>
                    <button
                      onClick={() => {
                        // har qayta yechishda random
                        setShuffledQuestions(shuffleQuiz(rawQuizQuestions));
                        setSelectedAnswers({});
                        setSubmitted(false);
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-5 py-2.5 text-xs font-bold text-[color:var(--ink)] shadow-sm hover:bg-slate-50 transition-all"
                    >
                      <RotateCcw className="h-4 w-4" /> Qayta yechish (random)
                    </button>
                    <button
                      onClick={() => router.push(`/courses/job/${job.slug}`)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-teal-700 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:scale-[1.02] transition-all"
                    >
                      Kursga qaytish <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              {submitted && (
                <p className="mt-3 text-xs text-neutral-500">Test avtomatik tarixga yozildi. Har safar savollar va variantlar random almashadi. Oddiy oynaga qaytish uchun “Kursga qaytish” ni bosing — test ekranda qolib ketmaydi.</p>
              )}
            </div>
          )}
        </motion.article>

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          {prevUrl ? (
            <Link
              href={prevUrl}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/80 px-6 py-3 text-sm font-bold text-[color:var(--ink)] shadow-md hover:bg-white transition-all"
            >
              <ChevronLeft className="h-4 w-4" /> Oldingi dars
            </Link>
          ) : (
            <div />
          )}

          {nextUrl ? (
            <Link
              href={nextUrl}
              onClick={finishDay}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-teal-700 px-6 py-3 text-sm font-bold text-white shadow-md hover:scale-[1.02] transition-all"
            >
              Keyingi dars <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href={`/courses/job/${job.slug}`}
              onClick={finishDay}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:scale-[1.02] transition-all"
            >
              <Trophy className="h-4 w-4" /> Kursni yakunlash
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}


/** Kasb testiga kirish uchun Telegram bot orqali ruxsat eshigi */
export default function JobDayLessonPage() {
  const params = useParams<{ slug: string; pi: string; di: string }>();
  return (
    <TestAccessGate
      endpoint="/api/lesson-access"
      body={{ kind: "job", a: params.slug, b: params.pi, c: params.di }}
      testTitle={`Kasb testi - ${params.pi}-${params.di}`}
    >
      <JobDayLessonInner />
    </TestAccessGate>
  );
}
