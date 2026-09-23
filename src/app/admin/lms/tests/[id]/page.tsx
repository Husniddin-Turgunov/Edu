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
} from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

type Choice = { id: string; text: string; isCorrect: boolean; order: number };
type Question = { id: string; text: string; type: string; points: number; order: number; explanation?: string; correctAnswer?: string; choices: Choice[] };
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
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const showToast = (k: "ok" | "err", msg: string) => { setToast({ kind: k, msg }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") router.push("/dashboard");
  }, [status, session, router]);

  const load = useCallback(async () => {
    if (!id || status !== "authenticated") return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/tests/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) setErr(data.error || "Topilmadi");
      else setTest(data.test);
      // history
      try {
        const h = await fetch(`/api/tests/history?testId=${id}&all=1`).then(r => r.json());
        if (h?.ok) setHistory(h.results || []);
      } catch {}
    } catch { setErr("Yuklashda xato"); }
    finally { setLoading(false); }
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
      if (data.ok) { setShowEdit(false); load(); showToast("ok", "Saqlandi"); } else showToast("err", data.error || "Xato");
    } finally { setSaving(false); }
  };

  const deleteQuestion = async (qid: string) => {
    if (!confirm("Savolni o'chirish?")) return;
    await fetch(`/api/admin/questions/${qid}`, { method: "DELETE" });
    load();
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
            <a href={`/tests/${test.id}`} target="_blank" className="flex items-center gap-1.5 rounded-xl border bg-white px-3 py-1.5 text-xs font-bold hover:bg-neutral-50"><Eye className="h-3.5 w-3.5" /> Talaba ko'rishi <ExternalLink className="h-3 w-3 opacity-60" /></a>
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
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-black"><ListChecks className="h-4 w-4 text-violet-600" /> Savollar — ko'rish joyi ({qCount} ta)</h2>
              <Link href="/admin/lms/tests" className="text-xs font-bold text-neutral-600 hover:text-neutral-900">← Ro'yxatga qaytish</Link>
            </div>
            {(!test.questions || test.questions.length === 0) ? (
              <div className="py-10 text-center text-sm text-neutral-500">Savollar yo'q — Testlar ro'yxatidan “Savol” bilan qo'shing</div>
            ) : (
              <div className="divide-y max-h-[65vh] overflow-y-auto" data-testid="admin-questions-list">
                {test.questions.map((q: Question, idx: number) => (
                  <div key={q.id} className="p-4" data-testid="admin-question">
                    <div className="flex items-start gap-3">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold leading-snug">{q.text}</p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-neutral-400">{q.type === "written" ? "Yozma" : "Variantli"} · {q.points} ball</p>
                      </div>
                      <button onClick={() => deleteQuestion(q.id)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {q.type === "written" ? (
                      <div className="mt-3 rounded-xl bg-violet-50 border border-violet-200 p-3">
                        <p className="text-[11px] font-bold uppercase text-violet-700">To'g'ri javob (faqat admin)</p>
                        <p className="mt-1 text-sm whitespace-pre-wrap">{q.correctAnswer || "—"}</p>
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-1.5">
                        {q.choices?.map((c) => (
                          <div key={c.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${c.isCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-neutral-200 bg-neutral-50"}`}>
                            <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-black border ${c.isCorrect ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-neutral-500"}`}>{String.fromCharCode(65 + c.order)}</span>
                            <span className="flex-1">{c.text}</span>
                            {c.isCorrect && <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black text-white">To'g'ri</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.explanation && <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">{q.explanation}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tarix qisqacha */}
          <div className="rounded-2xl border bg-white p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4" /> Topshirganlar tarixi ({history.length})</h3>
            {history.length === 0 ? <p className="mt-2 text-xs text-neutral-500">Hozircha natija yo'q</p> : (
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {history.slice(0, 20).map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-xl border bg-neutral-50 px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${r.passed ? "bg-indigo-600" : "bg-rose-600"}`}>{r.score ?? 0}%</span>
                    <span className="text-xs truncate">{r.user?.name || r.userId.slice(0, 8)} · {r.user?.email || ""}</span>
                    <span className="ml-auto text-xs text-neutral-500">{new Date(r.completedAt || r.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
