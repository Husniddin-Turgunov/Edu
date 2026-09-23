"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  Clock,
  Target,
  History,
  RotateCcw,
  Shield,
  Trophy,
  Circle,
  ListChecks,
  Timer,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Navbar } from "@/components/akela/Navbar";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";

type Test = any;

function formatTime(sec: number) {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TestTakePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const router = useRouter();
  const { data: session, status } = useSession();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  // Savollar birma-bir: joriy savol indeksi (0-based)
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const autoSubmittedRef = useRef(false);
  const submittingRef = useRef(false);
  // Oldingi urinishni ko'rish (scroll review)
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [review, setReview] = useState<any>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const showToast = useCallback((kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const openReview = useCallback(async (resultId?: string) => {
    if (!id) {
      setReviewError("Test ID topilmadi");
      setReviewOpen(true);
      return;
    }
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewError(null);
    setReview(null);
    try {
      const qs = resultId ? `?resultId=${encodeURIComponent(resultId)}` : "";
      const res = await fetch(`/api/tests/${id}/review${qs}`, { cache: "no-store" });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!res.ok || !data?.ok) {
        // 401 -> sessiya eskirgan
        if (res.status === 401) {
          setReviewError("Sessiya eskirgan — qayta kiring");
        } else if (text && text.trim().startsWith("<")) {
          setReviewError("Server javobi noto'g'ri — qayta urinib ko'ring");
        } else {
          setReviewError(data?.error || `Xato ${res.status}: Natijani yuklab bo'lmadi`);
        }
      } else {
        setReview(data.review);
      }
    } catch {
      setReviewError("Tarmoq xatosi — qayta urinib ko'ring");
    } finally {
      setReviewLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadHistory = useCallback(async () => {
    try {
      const h = await fetch(`/api/tests/history?testId=${id}`).then((r) => r.json()).catch(() => null);
      if (h?.ok) setHistory(h.results);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    if (status !== "authenticated" || !id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tests/${id}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (data.blocked) {
            setBlocked(true);
            setError(data.error || "Urinishlar tugadi");
          } else {
            setError(data.error || "Test topilmadi yoki sizga biriktirilmagan");
          }
          await loadHistory();
          return;
        }
        setTest(data.test);
        if (data.test.timeLimit && data.test.timeLimit > 0) {
          setTimeLeft(data.test.timeLimit * 60);
        } else {
          setTimeLeft(null);
        }
        await loadHistory();
      } catch {
        setError("Yuklashda xato");
      } finally {
        setLoading(false);
      }
    })();
  }, [status, id, loadHistory]);

  const total = test?.questions?.length ?? 0;
  const answered = useMemo(() => {
    if (!test) return 0;
    return Object.keys(answers).filter((k) => {
      const val = answers[k];
      return val !== undefined && val !== null && val !== "";
    }).length;
  }, [answers, test]);

  const unansweredIdx = useMemo(() => {
    if (!test) return [] as number[];
    return test.questions
      .map((q: any, i: number) => ((answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === "") ? i + 1 : -1))
      .filter((n: number) => n > 0);
  }, [answers, test]);

  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;

  const doSubmit = useCallback(async (auto = false) => {
    if (!test || submittingRef.current) return;
    if (!auto && Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== null && answers[k] !== "").length < total) {
      showToast("err", "Barcha savollarga javob bering");
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    setConfirmOpen(false);
    try {
      const res = await fetch(`/api/tests/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast("err", data.error || "Xato yuz berdi");
        return;
      }
      setResult(data.result);
      setSubmitted(true);
      setTimeLeft(null);
      await loadHistory();
      if (data.result?.passed) {
        try {
          const confetti = (await import("canvas-confetti")).default;
          confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
        } catch { /* optional */ }
      }
      showToast("ok", "Natija tarixga yozildi");
    } catch {
      showToast("err", "Tarmoq xatosi — qayta urinib ko'ring");
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  }, [test, answers, total, id, loadHistory, showToast]);

  // Countdown timer — vaqt tugasa avtomatik topshirish
  useEffect(() => {
    if (timeLeft === null || submitted || !test) return;
    if (timeLeft <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        showToast("err", "Vaqt tugadi — javoblar avtomatik topshirildi");
        void doSubmit(true);
      }
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((v) => (v === null ? null : v - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [timeLeft, submitted, test, doSubmit, showToast]);

  // Chiqishda ogohlantirish (javoblar kiritilgan bo'lsa)
  useEffect(() => {
    if (submitted || !test) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (answered > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [answered, submitted, test]);

  const handleSelect = (qId: string, choiceId: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: choiceId }));
  };

  const handleTextAnswer = (qId: string, text: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: text }));
  };

  const handleRetake = async () => {
    setSubmitted(false);
    setResult(null);
    setAnswers({});
    setConfirmOpen(false);
    setCurrentQIdx(0);
    autoSubmittedRef.current = false;
    setLoading(true);
    try {
      const res = await fetch(`/api/tests/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setTest(data.test);
        setBlocked(false);
        setError(null);
        if (data.test.timeLimit && data.test.timeLimit > 0) setTimeLeft(data.test.timeLimit * 60);
        else setTimeLeft(null);
      } else if (data.blocked) {
        setBlocked(true);
        setError(data.error);
      } else {
        setError(data.error || "Qayta ochib bo'lmadi");
      }
    } catch {
      showToast("err", "Qayta yuklashda xato");
    } finally {
      setLoading(false);
    }
  };

  const goToQuestion = (n: number) => {
    // n = 1-based savol raqami
    const idx = Math.max(0, Math.min(total - 1, n - 1));
    setCurrentQIdx(idx);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="glass-card rounded-3xl p-8 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-violet-600" />
          <p className="text-sm text-[color:var(--ink-soft)]">Test yuklanmoqda...</p>
        </div>
      </main>
    );
  }

  if (error && !test) {
    return (
      <main className="min-h-screen bg-background">
        <LiquidBackground />
        <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />
        <div className="mx-auto max-w-3xl px-6 pt-32 pb-12">
          <div className="glass-card rounded-3xl p-8 text-center">
            <Shield className="mx-auto mb-3 h-10 w-10 text-amber-500" />
            <h1 className="text-xl font-bold text-neutral-900">{blocked ? "Urinishlar tugadi" : "Test mavjud emas"}</h1>
            <p className="mt-2 text-sm text-neutral-600">{error}</p>
            {history.length > 0 && (
              <div className="mt-6 text-left">
                <h3 className="flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4" /> Sizning tarixingiz</h3>
                <p className="mt-1 text-xs text-neutral-500">Natijani bosing — barcha savollar, tanlangan va to'g'ri javoblar ko'rinadi</p>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1" data-testid="history-list">
                  {history.map((r: any) => (
                    <button
                      key={r.id}
                      type="button"
                      data-testid="history-review-btn"
                      onClick={() => void openReview(r.id)}
                      className="flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-violet-300 hover:bg-violet-50/40"
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${r.passed ? "bg-indigo-500" : "bg-rose-500"}`}>{r.score ?? 0}%</span>
                      <span className="text-xs text-neutral-600">
                        {new Date(r.completedAt || r.createdAt).toLocaleString()} — {r.passed ? "O'tdi" : "Yiqildi"}
                      </span>
                      <span className="ml-auto rounded-lg bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-700">Ko'rish</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  data-testid="open-latest-review"
                  onClick={() => void openReview(history[0]?.id)}
                  className="mt-3 w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black"
                >
                  Oxirgi natijani batafsil ko'rish
                </button>
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/courses" className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">Kurslarga qaytish</Link>
              <button onClick={() => router.push("/dashboard")} className="rounded-xl border bg-white px-5 py-2.5 text-sm font-bold">Dashboard</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!test) return null;

  const attemptsUsed = history.length;
  const maxAttempts = test.maxAttempts ?? 0;
  const canRetake = maxAttempts === 0 || attemptsUsed < maxAttempts;
  const timerDanger = timeLeft !== null && timeLeft <= 60;
  const timerWarn = timeLeft !== null && timeLeft <= 300;

  return (
    <main className={`min-h-screen bg-background ${!submitted ? "flex h-[100dvh] flex-col overflow-hidden" : "pb-28"}`}>
      <LiquidBackground />
      {/* Test topshirish paytida sayt nav bar YASHIRILADI; natijada qaytadi */}
      {submitted && <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />}

      {/* Sticky progress + timer bar (faqat test paytida) */}
      {!submitted && (
        <div className="z-40 shrink-0 border-b border-black/5 bg-white/90 backdrop-blur-md" data-testid="quiz-topbar">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-neutral-500">
                <span className="truncate">{test.title}</span>
                <span data-testid="answered-count" className="shrink-0 tabular-nums">{answered}/{total} ({progressPct}%)</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${progressPct === 100 ? "bg-emerald-500" : "bg-violet-500"}`}
                  style={{ width: `${progressPct}%` }}
                  data-testid="progress-bar"
                />
              </div>
            </div>
            {timeLeft !== null && (
              <div
                data-testid="timer"
                className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                  timerDanger ? "bg-rose-100 text-rose-700 animate-pulse" : timerWarn ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                <Timer className="h-3.5 w-3.5" />
                {formatTime(timeLeft)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast — nav bor/yo'qqa qarab balandlik */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed left-1/2 z-50 -translate-x-1/2 rounded-2xl border-l-4 bg-white px-5 py-3 shadow-2xl ${
              submitted ? "top-24" : "top-14"
            } ${toast.kind === "ok" ? "border-indigo-500" : "border-rose-500"}`}
            data-testid="toast"
          >
            <p className={`text-sm font-bold ${toast.kind === "ok" ? "text-indigo-700" : "text-rose-700"}`}>{toast.msg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {!submitted ? (
        /* Fullscreen shell: savol ekran markazida, scroll shart emas */
        <div className="flex min-h-0 flex-1 flex-col" data-testid="quiz-shell">
          <div className="mx-auto flex w-full max-w-3xl flex-1 min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto px-4 py-4 sm:px-6">
            {/* Step indicator: faqat bitta savol ko'rinadi */}
            <div className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-neutral-500" data-testid="step-indicator">
              <span data-testid="step-label" className="text-base font-bold text-neutral-800">Savol {currentQIdx + 1} / {total}</span>
              <span className="tabular-nums">{answered}/{total} javoblangan</span>
            </div>

            {/* Step dots */}
            <div className="flex w-full flex-wrap justify-center gap-1.5" data-testid="step-dots" role="navigation" aria-label="Savollar">
              {test.questions.map((q: any, qi: number) => {
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== "";
                const isCurrent = qi === currentQIdx;
                return (
                  <button
                    key={q.id}
                    type="button"
                    aria-label={`Savol ${qi + 1}`}
                    onClick={() => goToQuestion(qi + 1)}
                    className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition ${
                      isCurrent
                        ? "bg-violet-600 text-white ring-2 ring-violet-300"
                        : isAnswered
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                    }`}
                  >
                    {qi + 1}
                  </button>
                );
              })}
            </div>

            {/* Joriy savol — markazda, katta shrift */}
            {(() => {
              const q = test.questions[currentQIdx];
              if (!q) return null;
              const qi = currentQIdx;
              const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== "";
              const isLast = currentQIdx >= total - 1;
              const isFirst = currentQIdx <= 0;
              return (
                <div
                  key={q.id}
                  id={`q-${qi + 1}`}
                  data-testid="current-question"
                  className="glass-card w-full max-w-2xl rounded-3xl p-6 ring-1 transition ring-violet-100 sm:p-8"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-600 text-sm font-bold text-white">
                      {qi + 1}
                    </span>
                    <p className="text-lg font-bold leading-snug text-neutral-900 sm:text-xl md:text-2xl">{q.text}</p>
                    <span className={`ml-auto shrink-0 self-start text-xs font-bold uppercase ${isAnswered ? "text-emerald-600" : "text-neutral-400"}`}>
                      {isAnswered ? "✓" : "—"}
                    </span>
                  </div>
                  {q.type === "written" ? (
                    <div>
                      <textarea
                        value={answers[q.id] || ""}
                        onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                        disabled={submitted}
                        rows={5}
                        autoFocus
                        placeholder="Javobingizni yozing..."
                        className="w-full resize-none rounded-2xl border-2 border-neutral-200 px-5 py-4 text-base transition-colors focus:border-violet-400 focus:outline-none"
                      />
                      <p className="mt-1 text-sm text-neutral-400">Yozma javob — nazoratchi tomonidan tekshiriladi</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {q.choices.map((c: any) => {
                        const selected = answers[q.id] === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelect(q.id, c.id)}
                            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-base transition-all sm:text-lg ${
                              selected ? "border-violet-600 bg-violet-600 text-white" : "border-neutral-200 bg-white hover:bg-neutral-50"
                            }`}
                          >
                            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-bold ${selected ? "border-white bg-white text-violet-700" : "border-neutral-200 bg-neutral-100 text-neutral-600"}`}>
                              {c.order !== undefined ? String.fromCharCode(65 + c.order) : "•"}
                            </span>
                            <span className="flex-1 font-medium">{c.text}</span>
                            {selected && <CheckCircle2 className="h-5 w-5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Prev / Next */}
                  <div className="mt-6 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => goToQuestion(qi)}
                      disabled={isFirst}
                      data-testid="prev-btn"
                      className="flex items-center gap-1.5 rounded-2xl border bg-white px-5 py-3 text-base font-bold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-5 w-5" /> Oldingi
                    </button>
                    {!isLast ? (
                      <button
                        type="button"
                        onClick={() => goToQuestion(qi + 2)}
                        data-testid="next-btn"
                        className="flex items-center gap-1.5 rounded-2xl bg-violet-600 px-6 py-3 text-base font-bold text-white hover:bg-violet-700"
                      >
                        Keyingi <ChevronRight className="h-5 w-5" />
                      </button>
                    ) : answered >= total ? (
                      <button
                        type="button"
                        onClick={() => setConfirmOpen(true)}
                        disabled={saving}
                        data-testid="submit-btn"
                        className="flex items-center gap-2 rounded-2xl bg-neutral-900 px-6 py-3 text-base font-bold text-white hover:bg-black disabled:opacity-60"
                      >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Topshirish
                      </button>
                    ) : (
                      <span data-testid="last-question-badge" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                        Oxirgi savol
                      </span>
                    )}
                  </div>

                  {/* Barcha javoblar tayyor — markazda topshirish */}
                  {answered >= total && isLast && (
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      disabled={saving}
                      data-testid="submit-btn-center"
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-6 py-4 text-lg font-bold text-white hover:bg-black disabled:opacity-60"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Testni topshirish ({answered}/{total})
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Confirm modal */}
          <AnimatePresence>
            {confirmOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
                onClick={() => setConfirmOpen(false)}
                data-testid="confirm-modal"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 12 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 12 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
                >
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <ListChecks className="h-6 w-6" />
                  </div>
                  <h3 className="text-center text-lg font-black text-neutral-900">Testni topshirasizmi?</h3>
                  <p className="mt-2 text-center text-sm text-neutral-600">
                    {answered}/{total} savol javoblangan.
                    {maxAttempts > 0 && ` Qolgan urinish: ${Math.max(0, maxAttempts - attemptsUsed - 1)}.`}
                    {" "}Keyin savollar yangilanadi.
                  </p>
                  <div className="mt-5 flex gap-2">
                    <button type="button" onClick={() => setConfirmOpen(false)} className="flex-1 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold">
                      Orqaga
                    </button>
                    <button
                      type="button"
                      onClick={() => void doSubmit(false)}
                      disabled={saving}
                      data-testid="confirm-submit"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Ha, topshirish
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl px-6 pt-24 pb-12 sm:pt-28">
          <div className="glass-card rounded-3xl p-8 text-center" data-testid="result-panel">
            <div
              className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-xl font-black text-white ${
                result?.passed ? "bg-indigo-500" : "bg-rose-500"
              }`}
            >
              {result?.score ?? 0}%
            </div>
            <h2 className="mt-3 text-xl font-black text-neutral-900">
              {result?.passed ? "Tabriklaymiz! O'tdingiz 🎉" : "Afsus, qayta urinib ko'ring"}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Natija tarixda saqlandi.{" "}
              {result?.passed ? "" : `Kamida ${test.passScore}% kerak edi.`}
            </p>
            <div className="mx-auto mt-4 flex max-w-xs items-center justify-center gap-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1"><Circle className="h-3 w-3 fill-indigo-500 text-indigo-500" /> Siz: {result?.score ?? 0}%</span>
              <span className="flex items-center gap-1"><Circle className="h-3 w-3 fill-neutral-300 text-neutral-300" /> O'tish: {test.passScore}%</span>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {canRetake ? (
                <button
                  type="button"
                  onClick={handleRetake}
                  data-testid="retake-btn"
                  className="flex items-center gap-2 rounded-xl border bg-white px-5 py-2.5 text-sm font-bold"
                >
                  <RotateCcw className="h-4 w-4" /> Qayta topshirish (random)
                </button>
              ) : (
                <span data-testid="retake-blocked" className="rounded-xl bg-neutral-100 px-5 py-2.5 text-sm font-bold text-neutral-500">
                  Urinishlar tugadi ({maxAttempts}/{maxAttempts})
                </span>
              )}
              {/* Topshirilgan testni har doim ko'rish mumkin — urinish bor-yo'qligidan qat'i nazar */}
              <button
                type="button"
                data-testid="open-review-from-result"
                onClick={() => void openReview(result?.id || history[0]?.id)}
                className="flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-black"
              >
                <ListChecks className="h-4 w-4" /> {result?.id || history[0]?.id ? "Javoblarni ko'rish" : "Natijani yuklash..."}
              </button>
              <Link href="/courses" className="flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">
                Kurslarga qaytish <Trophy className="h-4 w-4" />
              </Link>
              <button type="button" onClick={() => router.push("/dashboard")} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white">
                Dashboard
              </button>
            </div>

            {history.length > 0 && (
              <div className="mt-8 text-left">
                <h3 className="flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4" /> Tarix</h3>
                <div className="mt-2 max-h-60 space-y-2 overflow-y-auto pr-1" data-testid="history-list">
                  {history.map((r: any) => (
                    <button
                      key={r.id}
                      type="button"
                      data-testid="history-review-btn"
                      onClick={() => void openReview(r.id)}
                      className="flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-violet-300 hover:bg-violet-50/40"
                    >
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${r.passed ? "bg-indigo-500" : "bg-rose-500"}`}>{r.score ?? 0}%</span>
                      <span className="text-xs text-neutral-600">{new Date(r.completedAt || r.createdAt).toLocaleString()}</span>
                      <span className={`ml-auto rounded-full border px-2 py-0.5 text-xs ${r.passed ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                        {r.passed ? "O'tdi" : "Yiqildi"}
                      </span>
                      <span className="rounded-lg bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-700">Ko'rish</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Oldingi urinish review — scroll panel (savollar + tanlangan + to'g'ri javob) */}
      <AnimatePresence>
        {reviewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 px-4 py-8 backdrop-blur-sm"
            onClick={() => setReviewOpen(false)}
            data-testid="review-overlay"
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-auto flex max-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
              data-testid="review-panel"
            >
              <div className="flex shrink-0 items-start gap-3 border-b border-neutral-100 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-black text-neutral-900 sm:text-lg">
                    {review?.test?.title || "Natijani ko'rish"}
                  </h2>
                  {review?.result && (
                    <p className="mt-0.5 text-xs text-neutral-500" data-testid="review-meta">
                      Ball: {review.result.score ?? 0}% · {new Date(review.result.completedAt).toLocaleString()}
                      {review.revealCorrect ? " · to'g'ri javoblar ochiq" : " · to'g'ri javoblar yashirin (urinishlar bor)"}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="review-close"
                  onClick={() => setReviewOpen(false)}
                  className="shrink-0 rounded-xl border bg-white px-3 py-1.5 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                >
                  Yopish
                </button>
              </div>

              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6"
                data-testid="review-scroll"
                style={{ maxHeight: "calc(100dvh - 10rem)" }}
              >
                {reviewLoading && (
                  <div className="grid place-items-center py-12" data-testid="review-loading">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                  </div>
                )}
                {reviewError && (
                  <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" data-testid="review-error">
                    {reviewError}
                  </p>
                )}
                {review && !reviewLoading && (
                  <div className="space-y-4" data-testid="review-questions">
                    {review.questions.map((q: any, qi: number) => {
                      const selected = q.selected;
                      const selectedArr = Array.isArray(selected) ? selected : selected != null && selected !== "" ? [selected] : [];
                      return (
                        <div
                          key={q.id}
                          data-testid="review-question"
                          className="rounded-2xl border border-neutral-200 bg-white p-4 ring-1 ring-neutral-100"
                        >
                          <div className="mb-3 flex items-start gap-2.5">
                            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">
                              {qi + 1}
                            </span>
                            <p className="text-sm font-bold leading-snug text-neutral-900 sm:text-base">{q.text}</p>
                          </div>

                          {q.type === "written" ? (
                            <div className="space-y-2">
                              <div className="rounded-xl bg-neutral-50 p-3">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Sizning javobingiz</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800" data-testid="review-written-answer">
                                  {typeof selected === "string" && selected ? selected : "—"}
                                </p>
                              </div>
                              {review.revealCorrect && q.correctAnswer && (
                                <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">To'g'ri javob</p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">{q.correctAnswer}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {q.choices.map((c: any) => {
                                const isSelected = selectedArr.includes(c.id);
                                const isCorrect = review.revealCorrect && c.isCorrect;
                                let tone = "border-neutral-200 bg-white text-neutral-800";
                                if (isCorrect && isSelected) tone = "border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-400";
                                else if (isCorrect) tone = "border-emerald-400 bg-emerald-50 text-emerald-900";
                                else if (isSelected) tone = "border-rose-400 bg-rose-50 text-rose-900 ring-1 ring-rose-300";
                                return (
                                  <div
                                    key={c.id}
                                    data-testid="review-choice"
                                    data-selected={isSelected ? "1" : "0"}
                                    data-correct={isCorrect ? "1" : "0"}
                                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${tone}`}
                                  >
                                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current/30 text-[11px] font-black opacity-80">
                                      {c.order !== undefined ? String.fromCharCode(65 + c.order) : "•"}
                                    </span>
                                    <span className="flex-1 font-medium">{c.text}</span>
                                    {isSelected && (
                                      <span className="shrink-0 rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-black uppercase" data-testid="badge-selected">
                                        Siz
                                      </span>
                                    )}
                                    {isCorrect && (
                                      <span className="shrink-0 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-white" data-testid="badge-correct">
                                        To'g'ri
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {!review.revealCorrect && (
                                <p className="text-[11px] font-semibold text-neutral-400">
                                  To'g'ri javoblar urinishlar tugagach ochiladi
                                </p>
                              )}
                            </div>
                          )}

                          {review.revealCorrect && q.explanation && (
                            <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-900">
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
