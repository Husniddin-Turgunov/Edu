"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, ChevronDown, ChevronUp, PenLine, Search, Filter, ClipboardCheck, Clock, Trophy, XCircle, ArrowLeft } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { parseAnswersJson } from "@/lib/answers-json";

interface GradingItem {
  id: string;
  userId: string;
  testId: string;
  score: number | null;
  passed: boolean;
  gradingStatus: string;
  answers: string;
  completedAt: string | null;
  user: { id: string; name: string | null; email: string | null; surname: string | null };
  test: {
    id: string;
    title: string;
    passScore: number;
    questions: {
      id: string;
      text: string;
      type: string;
      points: number;
      correctAnswer: string | null;
      choices: { id: string; text: string; isCorrect: boolean; order: number }[];
    }[];
  };
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: "Kutilmoqda", className: "bg-amber-100 text-amber-700 border border-amber-200", icon: Clock },
  graded: { label: "Baholandi", className: "bg-green-100 text-green-700 border border-green-200", icon: CheckCircle2 },
  auto: { label: "Avtomatik", className: "bg-blue-100 text-blue-700 border border-blue-200", icon: Trophy },
};

export default function GradingPage() {
  const router = useRouter();
  const [results, setResults] = useState<GradingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchResults = useCallback(async () => {
    try {
      const url = statusFilter === "all" ? "/api/admin/lms/grading" : `/api/admin/lms/grading?status=${statusFilter}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setResults(data.results);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const filteredResults = useMemo(() => {
    let list = results;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.user.name?.toLowerCase().includes(q)) ||
        (r.user.surname?.toLowerCase().includes(q)) ||
        (r.user.email?.toLowerCase().includes(q)) ||
        (r.test.title?.toLowerCase().includes(q))
      );
    }
    // Saralash: pending birinchi, keyin name bo'yicha
    return list.sort((a, b) => {
      if (a.gradingStatus === "pending" && b.gradingStatus !== "pending") return -1;
      if (a.gradingStatus !== "pending" && b.gradingStatus === "pending") return 1;
      const nameA = (a.user.name || a.user.email || "").toLowerCase();
      const nameB = (b.user.name || b.user.email || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [results, search]);

  const pendingCount = results.filter(r => r.gradingStatus === "pending").length;

  const handleGrade = async (result: GradingItem) => {
    const score = scores[result.id];
    if (score === undefined || score < 0 || score > 100) {
      alert("Ballni kiriting (0-100)");
      return;
    }
    setSubmitting(result.id);
    try {
      const res = await fetch("/api/admin/lms/grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: result.id, score, passed: score >= result.test.passScore }),
      });
      const data = await res.json();
      if (data.ok) {
        setResults(prev => prev.map(r => r.id === result.id ? { ...r, score, passed: score >= result.test.passScore, gradingStatus: "graded" } : r));
        setExpandedId(null);
      } else {
        alert(data.error || "Xato");
      }
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <main className="flex bg-transparent min-h-screen">
        <AdminSidebar />
        <main className="flex-1 min-w-0 grid place-items-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </main>
      </main>
    );
  }

  return (
    <main className="flex bg-transparent min-h-screen">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-neutral-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-neutral-100 transition text-neutral-500 hover:text-neutral-900">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-xl font-black text-neutral-900 flex items-center gap-2">
                    <ClipboardCheck className="w-6 h-6 text-violet-600" />
                    Testlarni tekshirish
                  </h1>
                  <p className="text-xs text-neutral-500 mt-0.5">Barcha foydalanuvchilarning test natijalari</p>
                </div>
              </div>
              {pendingCount > 0 && (
                <Link href="/admin/lms/grading" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition shadow-lg shadow-violet-600/20">
                  <PenLine className="w-4 h-4" />
                  Baholash ({pendingCount})
                </Link>
              )}
            </div>
            {/* Filters */}
            <div className="flex gap-3 mt-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Foydalanuvchi yoki test nomi..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-neutral-200 rounded-xl bg-white focus:border-violet-400 focus:outline-none"
                />
              </div>
              <div className="flex gap-1.5">
                {["all", "pending", "graded", "auto"].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg transition ${statusFilter === s ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                  >
                    {s === "all" ? "Barchasi" : STATUS_CONFIG[s]?.label || s}
                    {s === "pending" && pendingCount > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 rounded-full">{pendingCount}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results list */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {filteredResults.length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-lg font-bold text-neutral-700">Natija yo'q</p>
              <p className="text-sm text-neutral-500 mt-1">{search ? "Qidiruv bo'yicha natija topilmadi" : "Hozircha hech kim test topshirmagan"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResults.map((r) => {
                const answers = parseAnswersJson(r.answers).answers;
                // Cheklangan testda faqat KO'RSATILGAN savollarni ko'rsatamiz
                const presentedIds: string[] = Array.isArray(answers.__questionIds) ? answers.__questionIds.map(String) : [];
                const questions = presentedIds.length > 0
                  ? r.test.questions.filter((q: any) => presentedIds.includes(String(q.id)))
                  : r.test.questions;
                const writtenQs = questions.filter(q => q.type === "written");
                const mcqQs = questions.filter(q => q.type !== "written");
                const isExpanded = expandedId === r.id;
                const statusCfg = STATUS_CONFIG[r.gradingStatus] || STATUS_CONFIG.auto;
                const StatusIcon = statusCfg.icon;

                return (
                  <motion.div key={r.id} layout className="glass-card rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-neutral-50 transition-colors"
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-bold text-sm shadow-md">
                        {(r.user.name?.charAt(0) || r.user.email?.charAt(0) || "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-neutral-900">
                          {r.user.surname ? `${r.user.surname} ${r.user.name}` : r.user.name || r.user.email}
                        </div>
                        <div className="text-xs text-neutral-500 truncate">{r.test.title}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.score !== null && (
                          <span className={`text-sm font-black ${r.passed ? "text-green-600" : "text-rose-600"}`}>{r.score}%</span>
                        )}
                        <span className={`px-2 py-1 text-[11px] font-bold rounded-full ${statusCfg.className}`}>
                          <StatusIcon className="w-3 h-3 inline mr-1" />{statusCfg.label}
                        </span>
                        <span className="text-xs text-neutral-400">{r.completedAt ? new Date(r.completedAt).toLocaleDateString("uz-UZ") : ""}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="border-t border-neutral-100 p-4 space-y-4">
                            {/* Savollar ro'yxati */}
                            {questions.map((q, qi) => {
                              const userAnswer = answers[q.id] || "";
                              const isWritten = q.type === "written";
                              const correctChoices = q.choices.filter(c => c.isCorrect).map(c => c.id);
                              const isCorrect = !isWritten && (
                                Array.isArray(userAnswer)
                                  ? userAnswer.length === correctChoices.length && userAnswer.every((v: string) => correctChoices.includes(v))
                                  : correctChoices.includes(userAnswer)
                              );

                              return (
                                <div key={q.id} className={`rounded-xl border p-4 ${isWritten ? "border-violet-200 bg-violet-50/30" : isCorrect ? "border-green-200 bg-green-50/30" : "border-rose-200 bg-rose-50/30"}`}>
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <p className="font-bold text-sm text-neutral-900">
                                      <span className={`mr-1.5 ${isWritten ? "text-violet-600" : isCorrect ? "text-green-600" : "text-rose-600"}`}>{qi + 1}.</span>
                                      {q.text}
                                    </p>
                                    <span className="text-[11px] font-bold text-neutral-400 shrink-0">{q.points} ball</span>
                                  </div>

                                  {isWritten ? (
                                    <>
                                      {q.correctAnswer && (
                                        <div className="mb-2 p-2.5 rounded-lg bg-white border border-green-200">
                                          <span className="text-[11px] font-bold text-green-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Nazoratchi uchun namuna:</span>
                                          <p className="text-sm text-green-800 mt-1 whitespace-pre-wrap">{q.correctAnswer}</p>
                                        </div>
                                      )}
                                      <div className="p-2.5 rounded-lg bg-white border border-violet-200">
                                        <span className="text-[11px] font-bold text-violet-700">Foydalanuvchi javobi:</span>
                                        <p className="text-sm text-violet-900 mt-1 whitespace-pre-wrap">{userAnswer || "(javob yo'q)"}</p>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {q.choices.map(c => {
                                        const selected = userAnswer === c.id;
                                        return (
                                          <div key={c.id} className={`flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg ${c.isCorrect ? "bg-green-100 text-green-800 font-semibold" : selected ? "bg-rose-100 text-rose-800" : "text-neutral-500"}`}>
                                            {c.isCorrect ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : selected ? <XCircle className="w-3.5 h-3.5 text-rose-500" /> : <span className="w-3.5" />}
                                            {c.text}
                                            {c.isCorrect && <span className="text-[10px] font-bold text-green-600 ml-auto">TO'G'RI</span>}
                                            {selected && !c.isCorrect && <span className="text-[10px] font-bold text-rose-500 ml-auto">TANLANGAN</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Baholash */}
                            {r.gradingStatus === "pending" && (
                              <div className="flex items-center gap-3 pt-3 border-t border-neutral-200 bg-amber-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-2xl">
                                <PenLine className="w-4 h-4 text-amber-600 shrink-0" />
                                <span className="text-sm font-semibold text-amber-800">Ball (%):</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={scores[r.id] ?? ""}
                                  onChange={(e) => setScores(prev => ({ ...prev, [r.id]: parseInt(e.target.value) || 0 }))}
                                  className="w-24 px-3 py-2 text-sm border-2 border-amber-300 rounded-lg font-bold focus:border-violet-500 focus:outline-none"
                                  placeholder="0-100"
                                />
                                <button
                                  onClick={() => handleGrade(r)}
                                  disabled={submitting === r.id}
                                  className="ml-auto px-5 py-2 text-sm font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-violet-600/20"
                                >
                                  {submitting === r.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                  <CheckCircle2 className="w-4 h-4" /> Baholash
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </main>
  );
}
