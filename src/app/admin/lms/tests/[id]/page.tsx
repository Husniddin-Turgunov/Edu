"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  History,
  Settings,
  Trash2,
  Plus,
  Edit3,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  ListChecks,
  Clock,
  Target,
  Globe,
  Shuffle,
  FileSpreadsheet,
  Download,
  Upload,
  ExternalLink,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { HistorySection } from "./HistorySection";

type Choice = { id: string; text: string; isCorrect: boolean; order: number };
type Question = { id: string; text: string; type: string; points: number; order: number; explanation?: string; correctAnswer?: string; choices: Choice[] };
type EditableChoice = { id?: string; text: string; isCorrect: boolean };
type EditableQuestion = { text: string; type: string; points: number; explanation: string; correctAnswer: string; choices: EditableChoice[] };
type Test = any;

export default function AdminTestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const router = useRouter();
  const { status, data: session } = useSession();
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<string[]>([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<string[]>([]);
  const [historyReviews, setHistoryReviews] = useState<Record<string, any>>({});
  const [historyLoadingIds, setHistoryLoadingIds] = useState<string[]>([]);
  const [historyErrorIds, setHistoryErrorIds] = useState<string[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState<EditableQuestion | null>(null);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const showToast = (k: "ok" | "err", msg: string) => { setToast({ kind: k, msg }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role === "user") router.push("/dashboard");
  }, [status, session, router]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id || status !== "authenticated") return;
    const silent = !!opts?.silent;
    if (!silent) setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/tests/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) setErr(data.error || "Topilmadi");
      else setTest(data.test);
      // history
      try {
        const h = await fetch(`/api/tests/history?testId=${id}&all=1`, { cache: "no-store" }).then(r => r.json());
        if (h?.ok) setHistory(h.results || []);
      } catch {}
    } catch { setErr("Yuklashda xato"); }
    finally { if (!silent) setLoading(false); }
  }, [id, status]);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async () => {
    if (!test || toggling) return;
    setToggling(true);
    const next = test.status === "active" ? "draft" : "active";
    const res = await fetch(`/api/admin/tests/${test.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    const data = await res.json();
    if (data.ok) { setTest({ ...test, status: next }); showToast("ok", next === "active" ? "Test KO'RINADI" : "Yashirildi"); }
    else showToast("err", data.error || "Xato");
    setToggling(false);
  };

  const openEdit = () => {
    if (!test) return;
    let assigned: string[] = [];
    try { assigned = JSON.parse(test.assignedUserIds || "[]"); } catch {}
    setEditForm({ title: test.title, description: test.description || "", language: test.language, timeLimit: test.timeLimit, passScore: test.passScore, maxAttempts: test.maxAttempts ?? 1, questionCount: test.questionCount ?? 10, shuffleQuestions: !!test.shuffleQuestions, shuffleChoices: !!test.shuffleChoices, visibility: test.visibility || "all", assignedUserIds: assigned });
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!test) return;
    setSaving(true);
    try {
      const payload: any = { ...editForm };
      if (payload.visibility === "all") payload.assignedUserIds = [];
      const res = await fetch(`/api/admin/tests/${test.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.ok) { setShowEdit(false); load({ silent: true }); showToast("ok", "Saqlandi"); } else showToast("err", data.error || "Xato");
    } finally { setSaving(false); }
  };

  // O'chirilgan savollarni darhol UI dan olib tashlash — reload kerak emas, kechikish bo'lmaydi
  const removeQuestionsFromState = (ids: string[]) => {
    const removed = new Set(ids);
    setTest((current: any) => current ? { ...current, questions: (current.questions || []).filter((q: any) => !removed.has(q.id)) } : current);
    setSelectedQuestionIds((current) => current.filter((qid) => !removed.has(qid)));
    setExpandedQuestionIds((current) => current.filter((qid) => !removed.has(qid)));
    setEditingQuestionId((current) => (current && removed.has(current) ? null : current));
    setQuestionDraft((current) => (editingQuestionId && removed.has(editingQuestionId) ? null : current));
  };

  const deleteQuestion = async (qid: string) => {
    if (!confirm("Savolni o'chirish?")) return;
    const snapshot: Question[] = test?.questions || [];
    removeQuestionsFromState([qid]); // optimistik: darhol yo'qoladi
    const res = await fetch(`/api/admin/questions/${qid}`, { method: "DELETE" });
    if (!res.ok) {
      setTest((current: any) => current ? { ...current, questions: snapshot } : current);
      showToast("err", "Savolni o'chirib bo'lmadi");
      return;
    }
    showToast("ok", "Savol o'chirildi");
  };

  const toggleQuestionSelection = (qid: string) => {
    setSelectedQuestionIds((current) => current.includes(qid) ? current.filter((id) => id !== qid) : [...current, qid]);
  };

  const toggleQuestionExpanded = (qid: string) => {
    setExpandedQuestionIds((current) => current.includes(qid) ? current.filter((id) => id !== qid) : [...current, qid]);
  };

  const startQuestionEdit = (q: Question) => {
    setEditingQuestionId(q.id);
    setExpandedQuestionIds((current) => current.includes(q.id) ? current : [...current, q.id]);
    setQuestionDraft({
      text: q.text,
      type: q.type,
      points: q.points,
      explanation: q.explanation || "",
      correctAnswer: q.correctAnswer || "",
      choices: (q.choices || []).map((choice) => ({ id: choice.id, text: choice.text, isCorrect: choice.isCorrect })),
    });
  };

  const saveQuestion = async (qid: string) => {
    if (!questionDraft) return;
    setSavingQuestionId(qid);
    const res = await fetch(`/api/admin/questions/${qid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(questionDraft),
    });
    const data = await res.json();
    if (data.ok) {
      setEditingQuestionId(null);
      setQuestionDraft(null);
      await load({ silent: true });
      showToast("ok", "Savol va variantlar saqlandi");
    } else {
      showToast("err", data.error || "Saqlab bo'lmadi");
    }
    setSavingQuestionId(null);
  };

  const updateDraftChoice = (index: number, patch: Partial<EditableChoice>) => {
    setQuestionDraft((current) => current ? { ...current, choices: current.choices.map((choice, i) => i === index ? { ...choice, ...patch } : choice) } : current);
  };

  const toggleHistorySelection = (resultId: string) => {
    setSelectedHistoryIds((current) => current.includes(resultId)
      ? current.filter((item) => item !== resultId)
      : [...current, resultId]);
  };

  const loadHistoryReview = async (result: any) => {
    if (historyReviews[result.id] || historyLoadingIds.includes(result.id)) return;
    setHistoryLoadingIds((current) => [...current, result.id]);
    setHistoryErrorIds((current) => current.filter((item) => item !== result.id));
    try {
      const res = await fetch(`/api/admin/skills?action=review&userId=${encodeURIComponent(result.userId)}&testId=${encodeURIComponent(id)}&resultId=${encodeURIComponent(result.id)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Natija yuklanmadi");
      setHistoryReviews((current) => ({ ...current, [result.id]: data.review }));
    } catch {
      setHistoryErrorIds((current) => [...current, result.id]);
    } finally {
      setHistoryLoadingIds((current) => current.filter((item) => item !== result.id));
    }
  };

  const toggleHistoryExpanded = async (result: any) => {
    const opening = !expandedHistoryIds.includes(result.id);
    setExpandedHistoryIds((current) => opening ? [...current, result.id] : current.filter((item) => item !== result.id));
    if (opening) await loadHistoryReview(result);
  };

  const openSelectedHistory = async () => {
    const selected = history.filter((result) => selectedHistoryIds.includes(result.id));
    setExpandedHistoryIds((current) => Array.from(new Set([...current, ...selectedHistoryIds])));
    await Promise.all(selected.map(loadHistoryReview));
  };

  // Tanlangan savollarni o'chirish (bir tugma bilan)
  const [deletingQuestions, setDeletingQuestions] = useState(false);
  const deleteSelectedQuestions = async () => {
    if (!selectedQuestionIds.length || deletingQuestions) return;
    const ids = [...selectedQuestionIds];
    if (!confirm(`${ids.length} ta savolni butunlay o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    setDeletingQuestions(true);
    const snapshot: Question[] = test?.questions || [];
    removeQuestionsFromState(ids); // optimistik: darhol ro'yxatdan va ochilganlardan yo'qoladi
    try {
      const res = await fetch("/api/admin/questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data.ok) throw new Error(data?.error || "O'chirishda xato");
      showToast("ok", `${data.deleted ?? ids.length} ta savol o'chirildi`);
    } catch (e: any) {
      setTest((current: any) => current ? { ...current, questions: snapshot } : current); // xatoda qaytarish
      showToast("err", e?.message || "O'chirishda xato");
    } finally {
      setDeletingQuestions(false);
    }
  };

  // Tanlangan natijalarni o'chirish (bir tugma bilan)
  const [deletingHistory, setDeletingHistory] = useState(false);
  const deleteSelectedHistory = async () => {
    if (!selectedHistoryIds.length || deletingHistory) return;
    const n = selectedHistoryIds.length;
    if (!confirm(`${n} ta natijani butunlay o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    setDeletingHistory(true);
    try {
      const res = await fetch("/api/tests/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedHistoryIds }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data.ok) throw new Error(data?.error || "O'chirishda xato");
      const removed = new Set(selectedHistoryIds);
      setHistory((current) => current.filter((item: any) => !removed.has(item.id)));
      setExpandedHistoryIds((current) => current.filter((hid) => !removed.has(hid)));
      setSelectedHistoryIds([]);
      showToast("ok", `${data.deleted ?? n} ta natija o'chirildi`);
    } catch (e: any) {
      showToast("err", e?.message || "O'chirishda xato");
    } finally {
      setDeletingHistory(false);
    }
  };

  if (status !== "authenticated" || loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>;
  if (err || !test) return <div className="min-h-screen grid place-items-center p-8 text-center"><p className="text-rose-600">{err || "Test topilmadi"}</p><Link href="/admin/lms/tests" className="mt-4 inline-block rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white">Orqaga</Link></div>;

  const isActive = test.status === "active";
  const qCount = test.questions?.length ?? test._count?.questions ?? 0;

  return (
    <div className="flex min-h-screen bg-transparent">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-6 py-3 flex items-center gap-3">
          <button onClick={() => router.push("/admin/lms/tests")} className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"><ArrowLeft className="h-4 w-4" /> Testlar</button>
          <span className="text-neutral-300">/</span>
          <span className="text-sm font-bold truncate">{test.title}</span>
          <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>{isActive ? "KO'RINADI" : "YASHIRIN"}</span>
          <div className="ml-auto flex gap-2">
            <a href={`/tests/${test.id}`} className="flex items-center gap-1.5 rounded-xl border bg-white px-3 py-1.5 text-xs font-bold hover:bg-neutral-50"><Eye className="h-3.5 w-3.5" /> Talaba ko'rishi <ExternalLink className="h-3 w-3 opacity-60" /></a>
            <button onClick={toggleStatus} disabled={toggling} className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border ${isActive ? "bg-white text-amber-700 border-amber-200 hover:bg-amber-50" : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"} disabled:opacity-50`}>{toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{isActive ? "Yashirish" : "Ko'rsatish"}</button>
            <button onClick={openEdit} className="flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-black"><Settings className="h-3.5 w-3.5" /> Tahrirlash</button>
          </div>
        </div>

        {toast && <div className={`mx-6 mt-4 rounded-xl border px-4 py-2 text-sm ${toast.kind === "ok" ? "bg-indigo-50 border-indigo-200 text-indigo-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>{toast.msg}</div>}

        <div className="p-6 max-w-5xl space-y-6">
          {/* Header card — umumiy ma'lumot */}
          <div className="rounded-2xl border bg-white p-5">
            <h1 className="text-xl font-black">{test.title}</h1>
            {test.description && <p className="mt-1 text-sm text-neutral-600">{test.description}</p>}
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
              <Stat label="Tili" value={test.language?.toUpperCase()} icon={<Globe className="h-3 w-3" />} />
              <Stat label="Savol" value={`${qCount}/${test.questionCount ?? 10}`} icon={<ListChecks className="h-3 w-3" />} />
              <Stat label="Vaqt" value={test.timeLimit ? `${test.timeLimit}m` : "∞"} icon={<Clock className="h-3 w-3" />} />
              <Stat label="Ball" value={`${test.passScore}%`} icon={<Target className="h-3 w-3" />} />
              <Stat label="Urinish" value={test.maxAttempts === 0 ? "∞" : `${test.maxAttempts}x`} icon={<History className="h-3 w-3" />} />
              <Stat label="Random" value={test.shuffleQuestions ? "Ha" : "Yo'q"} icon={<Shuffle className="h-3 w-3" />} />
            </div>
            <div className="mt-3 text-xs text-neutral-500">Eski testlarni ham shu joydan ochasiz — yuqoridagi Testlar ro'yxatidan istalgan testga “Ichiga kirish” bilan kiring. Bu sahifa testning barcha savollarini ko'rish joyi.</div>
          </div>

          {/* Savollar — ko'rish joyi */}
          <div className="rounded-2xl border bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-black"><ListChecks className="h-4 w-4 text-violet-600" /> Savollar ({qCount} ta)</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-neutral-600"><input type="checkbox" checked={!!test.questions?.length && selectedQuestionIds.length === test.questions.length} onChange={(e) => setSelectedQuestionIds(e.target.checked ? test.questions.map((q: Question) => q.id) : [])} className="h-4 w-4 accent-violet-600" /> Hammasini tanlash</label>
                <button disabled={!selectedQuestionIds.length} onClick={() => setExpandedQuestionIds(Array.from(new Set([...expandedQuestionIds, ...selectedQuestionIds])))} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 disabled:opacity-40">Tanlanganlarni ochish ({selectedQuestionIds.length})</button>
                <button disabled={!expandedQuestionIds.length} onClick={() => setExpandedQuestionIds([])} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-neutral-600 disabled:opacity-40">Hammasini yopish</button>
                <button
                  type="button"
                  disabled={!selectedQuestionIds.length || deletingQuestions}
                  onClick={deleteSelectedQuestions}
                  title="Tanlangan savollarni o'chirish"
                  className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deletingQuestions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} O'chirish ({selectedQuestionIds.length})
                </button>
                <Link href="/admin/lms/tests" className="text-xs font-bold text-neutral-600 hover:text-neutral-900">← Ro'yxatga qaytish</Link>
              </div>
            </div>
            {selectedQuestionIds.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-violet-100 bg-violet-50 px-5 py-2 text-xs font-bold text-violet-800"><Check className="h-4 w-4 shrink-0" /> {selectedQuestionIds.length} ta savol tanlandi — “Ochish” bilan bir vaqtda tahrirlang yoki o'chirib tashlang.</div>}
            {(!test.questions || test.questions.length === 0) ? (
              <div className="py-10 text-center text-sm text-neutral-500">Savollar yo'q — Testlar ro'yxatidan “Savol” bilan qo'shing</div>
            ) : (
              <div className="divide-y max-h-[65vh] overflow-y-auto" data-testid="admin-questions-list">
                {test.questions.map((q: Question, idx: number) => {
                  const expanded = expandedQuestionIds.includes(q.id);
                  const selected = selectedQuestionIds.includes(q.id);
                  const editing = editingQuestionId === q.id;
                  return (
                  <div key={q.id} className={`p-4 ${selected ? "bg-violet-50/50" : ""}`} data-testid="admin-question">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selected} onChange={() => toggleQuestionSelection(q.id)} aria-label={`${idx + 1}-savolni tanlash`} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-violet-600" />
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">{idx + 1}</span>
                      <button onClick={() => toggleQuestionExpanded(q.id)} className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-bold leading-snug">{q.text}</p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-neutral-400">{q.type === "written" ? "Yozma" : "Variantli"} · {q.points} ball</p>
                      </button>
                      {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-neutral-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />}
                      <button onClick={() => startQuestionEdit(q)} title="Savolni tahrirlash" className="rounded-lg p-1.5 text-violet-600 hover:bg-violet-50"><Edit3 className="h-4 w-4" /></button>
                      <button onClick={() => deleteQuestion(q.id)} title="Savolni o'chirish" className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {expanded && (editing && questionDraft ? (
                      <div className="ml-8 mt-3 space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                        <textarea value={questionDraft.text} onChange={(e) => setQuestionDraft({ ...questionDraft, text: e.target.value })} rows={2} className="w-full rounded-xl border-2 border-neutral-200 px-3 py-2 text-sm font-semibold" />
                        {questionDraft.type === "written" ? <textarea value={questionDraft.correctAnswer} onChange={(e) => setQuestionDraft({ ...questionDraft, correctAnswer: e.target.value })} rows={2} placeholder="To'g'ri javob" className="w-full rounded-xl border-2 border-neutral-200 px-3 py-2 text-sm" /> : <div className="grid gap-2">{questionDraft.choices.map((choice, choiceIndex) => <div key={choice.id || choiceIndex} className="flex items-center gap-2"><button type="button" onClick={() => setQuestionDraft({ ...questionDraft, choices: questionDraft.choices.map((item, i) => ({ ...item, isCorrect: i === choiceIndex })) })} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-black ${choice.isCorrect ? "border-emerald-600 bg-emerald-600 text-white" : "bg-white text-neutral-500"}`}>{String.fromCharCode(65 + choiceIndex)}</button><input value={choice.text} onChange={(e) => updateDraftChoice(choiceIndex, { text: e.target.value })} className="w-full rounded-xl border-2 border-neutral-200 px-3 py-2 text-sm" /></div>)}</div>}
                        <textarea value={questionDraft.explanation} onChange={(e) => setQuestionDraft({ ...questionDraft, explanation: e.target.value })} rows={2} placeholder="Tushuntirish" className="w-full rounded-xl border-2 border-neutral-200 px-3 py-2 text-sm" />
                        <div className="flex justify-end gap-2"><button onClick={() => { setEditingQuestionId(null); setQuestionDraft(null); }} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Bekor</button><button onClick={() => saveQuestion(q.id)} disabled={savingQuestionId === q.id} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{savingQuestionId === q.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Saqlash</button></div>
                      </div>
                    ) : (
                      <div className="ml-8 mt-3">
                        {q.type === "written" ? <div className="rounded-xl bg-violet-50 border border-violet-200 p-3"><p className="text-[11px] font-bold uppercase text-violet-700">To'g'ri javob (faqat admin)</p><p className="mt-1 text-sm whitespace-pre-wrap">{q.correctAnswer || "—"}</p></div> : <div className="grid gap-1.5">{q.choices?.map((c) => <div key={c.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${c.isCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-neutral-200 bg-neutral-50"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-black border ${c.isCorrect ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-neutral-500"}`}>{String.fromCharCode(65 + c.order)}</span><span className="flex-1">{c.text}</span>{c.isCorrect && <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black text-white">To'g'ri</span>}</div>)}</div>}
                        {q.explanation && <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">{q.explanation}</p>}
                      </div>
                    ))}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <HistorySection
            testId={id}
            history={history}
            selectedIds={selectedHistoryIds}
            expandedIds={expandedHistoryIds}
            reviews={historyReviews}
            loadingIds={historyLoadingIds}
            errorIds={historyErrorIds}
            onSelect={toggleHistorySelection}
            onSelectAll={(checked) => setSelectedHistoryIds(checked ? history.map((item: any) => item.id) : [])}
            onOpenSelected={openSelectedHistory}
            onClearSelected={() => setSelectedHistoryIds([])}
            onCloseAll={() => setExpandedHistoryIds([])}
            onToggle={toggleHistoryExpanded}
            onDeleteSelected={deleteSelectedHistory}
            deleting={deletingHistory}
          />
        </div>

        {/* Edit modal */}
        {showEdit && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowEdit(false)}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-black">Testni tahrirlash</h3>
              <div className="mt-4 space-y-3">
                <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Nomi" className="w-full rounded-xl border-2 border-neutral-200 px-4 py-2.5 text-sm" />
                <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={2} placeholder="Tavsif" className="w-full rounded-xl border-2 border-neutral-200 px-4 py-2.5 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={editForm.passScore} onChange={e => setEditForm({ ...editForm, passScore: parseInt(e.target.value) || 60 })} className="rounded-xl border-2 border-neutral-200 px-3 py-2 text-sm" placeholder="Ball %" />
                  <input type="number" value={editForm.timeLimit} onChange={e => setEditForm({ ...editForm, timeLimit: parseInt(e.target.value) || 0 })} className="rounded-xl border-2 border-neutral-200 px-3 py-2 text-sm" placeholder="Vaqt min" />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setShowEdit(false)} className="rounded-xl border px-4 py-2 text-sm">Bekor</button>
                <button onClick={saveEdit} disabled={saving} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Saqlash</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, icon }: any) {
  return <div className="rounded-xl bg-neutral-50 border px-2.5 py-2 text-center"><div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-neutral-400">{icon}{label}</div><div className="mt-0.5 text-xs font-black">{value}</div></div>;
}
