"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  BookOpen,
  FileText,
  HelpCircle,
  X,
  Save,
  Eye,
  Layers,
  GraduationCap,
  Pencil,
  Edit3,
  Check,
  GripVertical,
  AlertCircle,
  Upload,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { parseExcelFileToQuestions, downloadTestTemplate } from "@/lib/job-test-excel";

type Job = {
  id: string;
  folder: string;
  title: string;
  slug: string;
  hasNormative: boolean;
  parts: { title: string; type: string; days: any[] }[];
};

type QuizItem = { question: string; options: string[]; correct: number };

function parseJobTest(content: string): QuizItem[] {
  const lines = content.split("\n");
  const items: QuizItem[] = [];
  let curQ: string | null = null;
  let curOpts: string[] = [];
  let curCorrect = 0;
  const save = () => {
    if (curQ && curOpts.length > 0) {
      items.push({ question: curQ, options: curOpts, correct: curCorrect });
    }
    curQ = null; curOpts = []; curCorrect = 0;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const qm = line.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (qm) { save(); curQ = qm[2].trim(); continue; }
    const om = line.match(/^([A-Da-d])[\.\)]\s*(.+)$/);
    if (om && curQ) {
      let txt = om[2].trim();
      const isCorr = txt.includes("✓") || txt.toLowerCase().includes("to'g'ri") || txt.toLowerCase().includes("tГІg'ri");
      txt = txt.replace(/✓\s*to[‘'Кј`]g[‘'Кј`]ri\s*javob/gi, "").replace(/✓/g, "").trim();
      if (isCorr) curCorrect = curOpts.length;
      curOpts.push(txt);
    }
  }
  save();
  return items;
}
function serializeJobTest(items: QuizItem[]): string {
  return items.map((q, qi) => {
    const opts = q.options.map((o, oi) => `${String.fromCharCode(65 + oi)}) ${o}${oi === q.correct ? "   ✓ to'g'ri javob" : ""}`).join("\n");
    return `${qi + 1}. ${q.question}\n${opts}`;
  }).join("\n\n");
}
function isContentTestLike(content: string) {
  return /^\s*\d+[\.\)]\s+.+$/m.test(content) && /^\s*[A-D][\.\)]\s+/m.test(content);
}

export default function AdminJobDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const router = useRouter();
  const { data: session, status } = useSession();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePart, setActivePart] = useState(0);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // showToast eng boshida e'lon qilinadi — keyin ishlatiladigan handlerlardan oldin
  // (React Compiler manual memoization'ni saqlay olsin).
  const showToast = useCallback((kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  }, []);
  // Dars modallari
  const [showAddDay, setShowAddDay] = useState(false);
  const [dayForm, setDayForm] = useState({ title: "", kind: "kun" as string, num: 1, content: "", videoUrl: "" });
  const [submitting, setSubmitting] = useState(false);

  const [editingDay, setEditingDay] = useState<{ partIdx: number; dayIdx: number } | null>(null);

  // Test modallari
  const [showAddTest, setShowAddTest] = useState(false);
  const [testForm, setTestForm] = useState({ title: "", description: "" });
  const [testQuestions, setTestQuestions] = useState<QuizItem[]>([{ question: "", options: ["", "", "", ""], correct: 0 }]);
  const [editingTest, setEditingTest] = useState<{ partIdx: number; dayIdx: number } | null>(null);
  const [editTestForm, setEditTestForm] = useState({ title: "", description: "" });
  const [editTestQuestions, setEditTestQuestions] = useState<QuizItem[]>([]);

  // Escape barcha modallarni yopadi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editingDay) setEditingDay(null);
      else if (editingTest) setEditingTest(null);
      else if (showAddDay) setShowAddDay(false);
      else if (showAddTest) setShowAddTest(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const [editForm, setEditForm] = useState({ title: "", kind: "kun" as string, num: 1, content: "", videoUrl: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      await downloadTestTemplate();
      showToast("ok", "Shablon yuklab olindi: test-shablon.xlsx");
    } catch (e: any) {
      showToast("err", "Shablon yuklab bo'lmadi: " + (e.message || "xato"));
    }
  };
  const handleAddExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const items = await parseExcelFileToQuestions(file);
      setTestQuestions(items);
      showToast("ok", `${items.length} ta savol import qilindi`);
    } catch (err: any) {
      showToast("err", err.message || "Excel import xatosi");
    } finally {
      if (addFileRef.current) addFileRef.current.value = "";
    }
  };
  const handleEditExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const items = await parseExcelFileToQuestions(file);
      setEditTestQuestions(items);
      showToast("ok", `${items.length} ta savol import qilindi`);
    } catch (err: any) {
      showToast("err", err.message || "Excel import xatosi");
    } finally {
      if (editFileRef.current) editFileRef.current.value = "";
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") router.push("/dashboard");
  }, [status, session, router]);

  const fetchJob = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/jobs/${slug}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setJob(data.job);
      else showToast("err", data.error || "Topilmadi");
    } catch {
      showToast("err", "Tarmoq xatosi");
    } finally {
      setLoading(false);
    }
  }, [slug, showToast]);

  useEffect(() => {
    if (status === "authenticated" && slug) fetchJob();
  }, [status, slug, fetchJob]);

  const handleAddDay = async () => {
    if (!job || !dayForm.title.trim()) {
      showToast("err", "Sarlavha kiriting");
      return;
    }
    setSubmitting(true);
    try {
      const newDay = {
        title: dayForm.title.trim(),
        num: Number(dayForm.num) || 1,
        kind: dayForm.kind,
        content: dayForm.content.trim(),
        videoUrl: dayForm.videoUrl,
      };
      const parts = [...job.parts];
      const p = parts[activePart];
      if (!p) throw new Error("Part not found");
      const days = [...(p.days || []), newDay];
      parts[activePart] = { ...p, days };
      const res = await fetch(`/api/admin/jobs/${job.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      const data = await res.json();
      if (data.ok) {
setJob(data.job);
        setShowAddDay(false);
        setDayForm({ title: "", kind: "kun" as string, num: (days.length % 30) + 1, content: "", videoUrl: "" });
        showToast("ok", "Dars qo'shildi");
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Xatolik");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTest = async () => {
    if (!job || !testForm.title.trim()) {
      showToast("err", "Test nomini kiriting");
      return;
    }
    const filled = testQuestions.filter(q => q.question.trim() && q.options.some(o => o.trim()));
    if (filled.length === 0) {
      showToast("err", "Kamida bitta savol to'ldiring");
      return;
    }
    for (const q of filled) {
      const opts = q.options.filter(o => o.trim());
      if (opts.length < 2) {
        showToast("err", "Har savolda kamida 2 ta variant bo'lsin");
        return;
      }
    }
    setSubmitting(true);
    try {
      const content = serializeJobTest(filled);
      const newDay = {
        title: testForm.title.trim(),
        num: 1,
        kind: "kun",
        content,
      };
      const parts = [...job.parts];
      const p = parts[activePart];
      if (!p) throw new Error("Part not found");
      const days = [...(p.days || []), newDay];
      parts[activePart] = { ...p, days };
      const res = await fetch(`/api/admin/jobs/${job.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      const data = await res.json();
      if (data.ok) {
        setJob(data.job);
        setShowAddTest(false);
        setTestForm({ title: "", description: "" });
        setTestQuestions([{ question: "", options: ["", "", "", ""], correct: 0 }]);
        showToast("ok", "Test qo'shildi");
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Xatolik");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDay = async (partIdx: number, dayIdx: number) => {
    if (!job) return;
    if (!confirm("Bu dars o'chirilsinmi?")) return;
    const parts = [...job.parts];
    const days = [...parts[partIdx].days];
    days.splice(dayIdx, 1);
    parts[partIdx] = { ...parts[partIdx], days };
    try {
      const res = await fetch(`/api/admin/jobs/${job.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      const data = await res.json();
      if (data.ok) {
        setJob(data.job);
        showToast("ok", "O'chirildi");
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Tarmoq xatosi");
    }
  };

  const handleDaysDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !job) return;
    const oldIndex = currentPart.days.findIndex((_: any, i: number) => `day-${i}` === active.id);
    const newIndex = currentPart.days.findIndex((_: any, i: number) => `day-${i}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const moved = arrayMove(currentPart.days, oldIndex, newIndex);
    // Yangi tartibda order ni yangilash — API d.order ?? di ishlatadi
    const newDays = moved.map((d: any, i: number) => ({ ...d, order: i }));
    const parts = [...job.parts];
    parts[activePart] = { ...parts[activePart], days: newDays };
    // Optimistic update — darhol UI ni yangilash
    setJob({ ...job, parts });
    try {
      const res = await fetch(`/api/admin/jobs/${job.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      const data = await res.json();
      if (data.ok) {
        setJob(data.job);
        showToast("ok", "Tartib yangilandi");
      } else {
        // Xato bo'lsa — eski holatga qaytarish
        fetchJob();
        showToast("err", data.error || "Xatolik");
      }
    } catch {
      fetchJob();
      showToast("err", "Tarmoq xatosi");
    }
  };

  const startEditDay = (partIdx: number, dayIdx: number) => {
    if (!job) return;
    const day = job.parts[partIdx]?.days?.[dayIdx];
    if (!day) return;
    const isTest = String(day.title).toLowerCase().includes("test") || String(day.title).toLowerCase().includes("nazorat") || isContentTestLike(day.content || "");
    if (isTest) {
      // Test tahrirlash
      setEditingTest({ partIdx, dayIdx });
      setEditTestForm({ title: day.title || "", description: "" });
      const parsed = parseJobTest(day.content || "");
      setEditTestQuestions(parsed.length ? parsed : [{ question: "", options: ["", "", "", ""], correct: 0 }]);
    } else {
      // Dars tahrirlash
      setEditingDay({ partIdx, dayIdx });
      setEditForm({
        title: day.title || "",
        kind: day.kind || "kun",
        num: day.num ?? dayIdx + 1,
        content: day.content || "",
        videoUrl: day.videoUrl || "",
      });
    }
  };

  const handleUpdateDay = async () => {
    if (!job || !editingDay) return;
    if (!editForm.title.trim()) {
      showToast("err", "Sarlavha kiriting");
      return;
    }
    setSavingEdit(true);
    try {
      const parts = [...job.parts];
      const p = parts[editingDay.partIdx];
      const days = [...p.days];
      days[editingDay.dayIdx] = {
        ...days[editingDay.dayIdx],
        title: editForm.title.trim(),
        num: Number(editForm.num) || 1,
        kind: editForm.kind,
        content: editForm.content,
        videoUrl: editForm.videoUrl,
      };
      parts[editingDay.partIdx] = { ...p, days };
      const res = await fetch(`/api/admin/jobs/${job.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      const data = await res.json();
      if (data.ok) {
        setJob(data.job);
        setEditingDay(null);
        showToast("ok", "Dars yangilandi");
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Xatolik");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleUpdateTest = async () => {
    if (!job || !editingTest) return;
    if (!editTestForm.title.trim()) {
      showToast("err", "Test nomini kiriting");
      return;
    }
    const filled = editTestQuestions.filter(q => q.question.trim());
    if (filled.length === 0) {
      showToast("err", "Kamida bitta savol");
      return;
    }
    setSavingEdit(true);
    try {
      const content = serializeJobTest(filled);
      const parts = [...job.parts];
      const p = parts[editingTest.partIdx];
      const days = [...p.days];
      days[editingTest.dayIdx] = {
        ...days[editingTest.dayIdx],
        title: editTestForm.title.trim(),
        content,
      };
      parts[editingTest.partIdx] = { ...p, days };
      const res = await fetch(`/api/admin/jobs/${job.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      const data = await res.json();
      if (data.ok) {
        setJob(data.job);
        setEditingTest(null);
        showToast("ok", "Test yangilandi");
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Xatolik");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePart = async (idx: number) => {
    if (!job) return;
    const part = job.parts[idx];
    const isEmpty = (part.days?.length || 0) === 0;
    const msg = isEmpty
      ? `"${part.title.slice(0, 60)}..." — 0 ta darsli bo'sh qism. O'chirilsinmi?`
      : `"${part.title.slice(0, 60)}..." qismi va ichidagi ${part.days.length} ta dars ham o'chadi. Davom etasizmi?`;
    if (!confirm(msg)) return;
    const parts = job.parts.filter((_, i) => i !== idx);
    try {
      const res = await fetch(`/api/admin/jobs/${job.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      const data = await res.json();
      if (data.ok) {
        setJob(data.job);
        if (activePart >= parts.length) setActivePart(Math.max(0, parts.length - 1));
        else if (activePart === idx && parts.length > 0) setActivePart(Math.min(idx, parts.length - 1));
        showToast("ok", isEmpty ? "Bo'sh qism o'chirildi" : "Qism o'chirildi");
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Tarmoq xatosi");
    }
  };

  if (status !== "authenticated" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }
  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-500">Kasb topilmadi</p>
      </div>
    );
  }

  const currentPart = job.parts[activePart];
  const totalDays = job.parts.reduce((s, p) => s + (p.days?.length || 0), 0);
  const allDays = currentPart?.days || [];
  const lessons = allDays.filter((d: any) => !(String(d.title).toLowerCase().includes("test") || String(d.title).toLowerCase().includes("nazorat") || isContentTestLike(d.content || "")));
  const tests = allDays.filter((d: any) => String(d.title).toLowerCase().includes("test") || String(d.title).toLowerCase().includes("nazorat") || isContentTestLike(d.content || ""));

  return (
    <div className="flex bg-transparent min-h-screen">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-neutral-200">
          <div className="px-8 py-3 flex items-center gap-2 text-sm">
            <button onClick={() => router.push("/admin/jobs")} className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900">
              <ArrowLeft className="w-4 h-4" /> Kasbiy kurslar
            </button>
            <span className="text-neutral-400">/</span>
            <span className="font-semibold text-neutral-900 truncate">{job.title}</span>
            <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 text-xs font-bold bg-white border border-neutral-200 rounded-full px-3 py-1">
              <Layers className="w-3.5 h-3.5" /> {totalDays} dars
            </span>
          </div>
        </div>

        <div className="relative h-32 bg-gradient-to-br from-blue-600/20 via-indigo-500/20 to-teal-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(99,102,241,0.08),transparent)]" />
        </div>

        <div className="px-8 -mt-12 relative">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 max-w-4xl">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/20 flex items-center justify-center shrink-0">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/20">#{job.id}</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-neutral-100 text-neutral-700">{job.slug}</span>
                  {job.hasNormative && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">📊 Normativ</span>}
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 mt-2">{job.title}</h1>
                <p className="text-xs text-neutral-500 mt-1">{job.folder}</p>
                <div className="flex gap-4 mt-3 text-xs">
                  <span className="font-bold text-neutral-900">{job.parts.length} qism</span>
                  <span className="text-neutral-500">·</span>
                  <span className="font-bold text-neutral-900">{totalDays} dars</span>
                </div>
              </div>
              <Link href={`/courses/job/${job.slug}`} target="_blank" className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50">
                <Eye className="w-4 h-4" /> Saytda ko'rish
              </Link>
            </div>

            {/* Parts tabs */}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
              {job.parts.map((p, idx) => {
                const isEmpty = (p.days?.length || 0) === 0;
                const isActive = activePart === idx;
                return (
                  <div key={idx} className={`group flex items-center gap-1 rounded-xl p-1 transition-all ${isActive ? "bg-neutral-900 shadow" : isEmpty ? "bg-rose-50 border border-rose-200" : "bg-white border border-neutral-200"}`}>
                    <button
                      onClick={() => setActivePart(idx)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${isActive ? "text-white" : isEmpty ? "text-rose-700 hover:text-rose-800" : "text-neutral-700 hover:text-neutral-900"}`}
                      title={p.title}
                    >
                      <Layers className={`w-4 h-4 ${isActive ? "text-white" : isEmpty ? "text-rose-500" : "text-neutral-500"}`} />
                      <span className="truncate max-w-[220px]">{p.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isActive ? "bg-white/20 text-white" : isEmpty ? "bg-rose-100 text-rose-700 border border-rose-200" : "bg-neutral-100 text-neutral-600"}`}>{p.days?.length || 0}</span>
                      {isEmpty && <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-600 ml-1"><AlertCircle className="w-3 h-3" /> Bo'sh</span>}
                    </button>
                    <button
                      onClick={() => handleDeletePart(idx)}
                      className={`grid h-7 w-7 place-items-center rounded-lg transition-colors ${isActive ? "text-white/70 hover:text-white hover:bg-white/15" : isEmpty ? "text-rose-500 hover:text-white hover:bg-rose-500 bg-white" : "text-neutral-400 hover:text-rose-600 hover:bg-rose-50 bg-neutral-50"}`}
                      title={isEmpty ? "Bo'sh qismni o'chirish" : "Qismni o'chirish (darslari bilan)"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            {job.parts.some(p => (p.days?.length||0)===0) && (
              <p className="mt-2 text-xs text-rose-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> 0 ta darsli bo'sh qismlar — xato qo'shilgan. O'ngdagi <Trash2 className="w-3 h-3 inline" /> bilan o'chiring.</p>
            )}
          </div>
        </div>

        <div className="px-8 py-6 max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-neutral-900">{currentPart?.title}</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                {allDays.length} ta element · {lessons.length} dars · {tests.length} test
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAddDay(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800">
                <Plus className="w-4 h-4" /> Dars qo'shish
              </button>
              <button onClick={() => setShowAddTest(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700">
                <Plus className="w-4 h-4" /> Test qo'shish
              </button>
            </div>
          </div>

          {/* Barcha elementlar aralash ketma-ketlikda */}
          {allDays.length === 0 ? (
            <div className="text-center py-12 bg-white border-2 border-dashed border-neutral-200 rounded-2xl">
              <FileText className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
              <p className="text-sm font-semibold text-neutral-700">Hozircha hech narsa yo'q</p>
              <p className="text-xs text-neutral-500 mt-1">Dars yoki test qo'shing</p>
              <div className="mt-4 flex justify-center gap-2">
                <button onClick={() => setShowAddDay(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg">
                  <Plus className="w-4 h-4" /> Dars qo'shish
                </button>
                <button onClick={() => setShowAddTest(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg">
                  <Plus className="w-4 h-4" /> Test qo'shish
                </button>
              </div>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDaysDragEnd}>
              <SortableContext items={allDays.map((_: any, i: number) => `day-${i}`)} strategy={rectSortingStrategy}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {allDays.map((d: any, i: number) => (
                    <SortableDayCard
                      key={i}
                      id={`day-${i}`}
                      day={d}
                      idx={i}
                      onEdit={() => startEditDay(activePart, i)}
                      onDelete={() => handleDeleteDay(activePart, i)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm">
            <p className="font-bold text-indigo-900 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Ticket izohi</p>
            <p className="text-indigo-800/80 mt-1 leading-relaxed">Har bir dars ham ticket ko'rinishida — perforatsiya (yon doiralar), dashed chiziq va rangli gradient bilan. /courses dagi talabalar ko'radi — admin shu yerda boshqaradi. Barcha bo'limlar bir xil ticket stilida.</p>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-5 py-3 shadow-2xl border-l-4 bg-white ${toast.kind === "ok" ? "border-indigo-500" : "border-rose-500"}`}>
            <p className={`text-sm font-bold ${toast.kind === "ok" ? "text-indigo-700" : "text-rose-700"}`}>{toast.msg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddDay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddDay(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden">
              <div className="px-6 py-5 border-b border-neutral-100 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">Yangi dars</h2>
                  <p className="text-sm text-neutral-500 mt-1">{currentPart?.title}</p>
                </div>
                <button onClick={() => setShowAddDay(false)} className="p-1 rounded-lg hover:bg-neutral-100">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                <Field label="Sarlavha *">
                  <input value={dayForm.title} onChange={(e) => setDayForm({ ...dayForm, title: e.target.value })} placeholder="Masalan: STAJIROVKA 6-KUN: CRM asoslari" className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Turi">
                    <select value={dayForm.kind} onChange={(e) => setDayForm({ ...dayForm, kind: e.target.value })} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white">
                      <option value="kun">kun</option>
                      <option value="dars">dars</option>
                      <option value="hafta">hafta</option>
                    </select>
                  </Field>
                  <Field label="Raqam">
                    <input type="number" value={dayForm.num} onChange={(e) => setDayForm({ ...dayForm, num: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg" />
                  </Field>
                </div>

                <Field label="Matn">
                  <textarea value={dayForm.content} onChange={(e) => setDayForm({ ...dayForm, content: e.target.value })} rows={6} placeholder="Dars matni, chek-list..." className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono resize-none" />
                </Field>
                <Field label="Video havolasi (ixtiyoriy)">
                  <input value={dayForm.videoUrl} onChange={(e) => setDayForm({ ...dayForm, videoUrl: e.target.value })} placeholder="YouTube, Vimeo yoki mp4 havolasi" className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600" />
                </Field>
              </div>
              <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
                <button onClick={() => setShowAddDay(false)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">
                  Bekor
                </button>
                <button onClick={handleAddDay} disabled={submitting || !dayForm.title.trim()} className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg disabled:opacity-50 flex items-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Saqlash
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingDay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingDay(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden">
              <div className="px-6 py-5 border-b border-neutral-100 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-teal-600 text-white">
                    <Edit3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900">Darsni tahrirlash</h2>
                    <p className="text-sm text-neutral-500 mt-0.5">
                      {job?.parts[editingDay.partIdx]?.title} — {editForm.title || "Sarlavha"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setEditingDay(null)} className="p-1 rounded-lg hover:bg-neutral-100">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                <Field label="Sarlavha *">
                  <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Dars sarlavhasi" className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-amber-400" autoFocus />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Turi">
                    <select value={editForm.kind} onChange={(e) => setEditForm({ ...editForm, kind: e.target.value })} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:border-amber-400">
                      <option value="kun">kun</option>
                      <option value="dars">dars</option>
                      <option value="hafta">hafta</option>
                    </select>
                  </Field>
                  <Field label="Raqam">
                    <input type="number" value={editForm.num} onChange={(e) => setEditForm({ ...editForm, num: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-amber-400" />
                  </Field>
                </div>

                <Field label="Matn">
                  <textarea value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} rows={8} placeholder="Dars matni, chek-list..." className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono resize-none focus:outline-none focus:border-amber-400" />
                </Field>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  <span className="font-bold">Ticket oldindan ko'rish:</span> <span className="font-mono">{editForm.title || "(sarlavha yo'q)"}</span> — {editForm.content ? `${editForm.content.length} belgi · ${Math.ceil(editForm.content.length/500)} daq` : "matn yo'q"}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
                <button onClick={() => setEditingDay(null)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">
                  Bekor
                </button>
                <button onClick={handleUpdateDay} disabled={savingEdit || !editForm.title.trim()} className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg disabled:opacity-50 flex items-center gap-2">
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Saqlash
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Yangi test qo'shish modali */}
      <AnimatePresence>
        {showAddTest && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddTest(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[85vh] flex flex-col">
              <div className="px-6 py-5 border-b border-neutral-100 flex items-start justify-between shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">Yangi test</h2>
                  <p className="text-sm text-neutral-500 mt-1">Test nomini kiriting va savollarni qo'shing</p>
                </div>
                <button onClick={() => setShowAddTest(false)} className="p-1 rounded-lg hover:bg-neutral-100">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <Field label="Test nomi *">
                  <input value={testForm.title} onChange={(e) => setTestForm({ ...testForm, title: e.target.value })} placeholder="Masalan: 1-kun yakuni — nazorat testi" className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg" />
                </Field>

                {/* Excel import */}
                <div className="border border-dashed border-neutral-300 rounded-xl p-4 bg-neutral-50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-neutral-900">Excel fayldan import</p>
                      <p className="text-xs text-neutral-500">Savollarni avtomatik yuklash</p>
                    </div>
                    <button onClick={handleDownloadTemplate} type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                      <Download className="w-3.5 h-3.5" /> Shablon
                    </button>
                  </div>
                  <label className="block">
                    <span className="text-xs text-neutral-600 mb-1 block">Format: Savol, A, B, C, D, E, Javob</span>
                    <input ref={addFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleAddExcelImport} className="block w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neutral-900 file:text-white hover:file:bg-neutral-800 cursor-pointer" />
                  </label>
                </div>

                {/* Savollar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-900">Savollar ({testQuestions.length})</span>
                    <button onClick={() => setTestQuestions(a => [...a, { question: "", options: ["", "", "", ""], correct: 0 }])} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md">
                      <Plus className="w-3.5 h-3.5" /> Savol qo'shish
                    </button>
                  </div>
                  {testQuestions.map((q, qi) => (
                    <div key={qi} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-700 to-indigo-600 text-white text-xs font-bold">{qi + 1}</span>
                        <span className="text-xs font-bold text-neutral-700">Savol {qi + 1}</span>
                        <button onClick={() => setTestQuestions(a => a.length === 1 ? a : a.filter((_, i) => i !== qi))} disabled={testQuestions.length === 1} className="ml-auto p-1 rounded hover:bg-rose-50 text-rose-600 disabled:opacity-30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input value={q.question} onChange={(e) => setTestQuestions(a => a.map((x, i) => i === qi ? { ...x, question: e.target.value } : x))} placeholder={`${qi + 1}-savol matni...`} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white" />
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors ${q.correct === oi ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200" : "bg-white border-neutral-200 hover:border-neutral-300"}`}>
                            <input type="radio" name={`add-q-${qi}`} checked={q.correct === oi} onChange={() => setTestQuestions(a => a.map((x, i) => i === qi ? { ...x, correct: oi } : x))} className="text-indigo-600 focus:ring-indigo-500" />
                            <span className={`grid h-6 w-6 place-items-center rounded text-xs font-bold shrink-0 ${q.correct === oi ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600"}`}>{String.fromCharCode(65 + oi)}</span>
                            <input value={opt} onChange={(e) => setTestQuestions(a => a.map((x, i) => i === qi ? { ...x, options: x.options.map((o, idx) => idx === oi ? e.target.value : o) } : x))} placeholder={`${String.fromCharCode(65 + oi)} variant...`} className="flex-1 py-1 text-sm bg-transparent outline-none" />
                            {q.correct === oi && <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Check className="w-3 h-3" /> To'g'ri</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2 shrink-0">
                <button onClick={() => setShowAddTest(false)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">
                  Bekor
                </button>
                <button onClick={handleAddTest} disabled={submitting || !testForm.title.trim()} className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg disabled:opacity-50 flex items-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Test yaratish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test tahrirlash modali */}
      <AnimatePresence>
        {editingTest && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingTest(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[85vh] flex flex-col">
              <div className="px-6 py-5 border-b border-neutral-100 flex items-start justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900">Testni tahrirlash</h2>
                    <p className="text-sm text-neutral-500 mt-0.5">{editTestForm.title || "Sarlavha"}</p>
                  </div>
                </div>
                <button onClick={() => setEditingTest(null)} className="p-1 rounded-lg hover:bg-neutral-100">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <Field label="Test nomi *">
                  <input value={editTestForm.title} onChange={(e) => setEditTestForm({ ...editTestForm, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg" autoFocus />
                </Field>

                {/* Excel import */}
                <div className="border border-dashed border-neutral-300 rounded-xl p-4 bg-neutral-50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-neutral-900">Excel fayldan import</p>
                      <p className="text-xs text-neutral-500">Savollarni yangilash</p>
                    </div>
                    <button onClick={handleDownloadTemplate} type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                      <Download className="w-3.5 h-3.5" /> Shablon
                    </button>
                  </div>
                  <label className="block">
                    <input ref={editFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleEditExcelImport} className="block w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neutral-900 file:text-white hover:file:bg-neutral-800 cursor-pointer" />
                  </label>
                </div>

                {/* Savollar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-900">Savollar ({editTestQuestions.length})</span>
                    <button onClick={() => setEditTestQuestions(a => [...a, { question: "", options: ["", "", "", ""], correct: 0 }])} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md">
                      <Plus className="w-3.5 h-3.5" /> Savol qo'shish
                    </button>
                  </div>
                  {editTestQuestions.map((q, qi) => (
                    <div key={qi} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-700 to-indigo-600 text-white text-xs font-bold">{qi + 1}</span>
                        <span className="text-xs font-bold text-neutral-700">Savol {qi + 1}</span>
                        <button onClick={() => setEditTestQuestions(a => a.length === 1 ? a : a.filter((_, i) => i !== qi))} disabled={editTestQuestions.length === 1} className="ml-auto p-1 rounded hover:bg-rose-50 text-rose-600 disabled:opacity-30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input value={q.question} onChange={(e) => setEditTestQuestions(a => a.map((x, i) => i === qi ? { ...x, question: e.target.value } : x))} placeholder={`${qi + 1}-savol matni...`} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white" />
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors ${q.correct === oi ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200" : "bg-white border-neutral-200 hover:border-neutral-300"}`}>
                            <input type="radio" name={`edit-q-${qi}`} checked={q.correct === oi} onChange={() => setEditTestQuestions(a => a.map((x, i) => i === qi ? { ...x, correct: oi } : x))} className="text-indigo-600 focus:ring-indigo-500" />
                            <span className={`grid h-6 w-6 place-items-center rounded text-xs font-bold shrink-0 ${q.correct === oi ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600"}`}>{String.fromCharCode(65 + oi)}</span>
                            <input value={opt} onChange={(e) => setEditTestQuestions(a => a.map((x, i) => i === qi ? { ...x, options: x.options.map((o, idx) => idx === oi ? e.target.value : o) } : x))} placeholder={`${String.fromCharCode(65 + oi)} variant...`} className="flex-1 py-1 text-sm bg-transparent outline-none" />
                            {q.correct === oi && <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Check className="w-3 h-3" /> To'g'ri</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2 shrink-0">
                <button onClick={() => setEditingTest(null)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">
                  Bekor
                </button>
                <button onClick={handleUpdateTest} disabled={savingEdit || !editTestForm.title.trim()} className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg disabled:opacity-50 flex items-center gap-2">
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Saqlash
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3">
      <label className="text-sm font-medium text-neutral-700 text-right">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function SortableDayCard({ id, day, idx, onEdit, onDelete }: { id: string; day: any; idx: number; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };
  const isTest = String(day.title).toLowerCase().includes("test") || String(day.title).toLowerCase().includes("nazorat");
  const isWeek = day.kind === "hafta";
  const hasVideo = Boolean(day.videoUrl);
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 border transition-all hover:shadow-lg ${isDragging ? "shadow-2xl" : "cursor-pointer"} ${isWeek ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-purple-300" : isTest ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white border-amber-300" : hasVideo ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-300" : "bg-white border-neutral-200 hover:border-indigo-200 hover:shadow-md"}`}
      title="Tahrirlash uchun bosing"
    >
      {/* notch */}
      <div className="pointer-events-none absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-neutral-50 border border-neutral-200 hidden sm:block" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 translate-x-1/2 rounded-full bg-neutral-50 border border-neutral-200 hidden sm:block" />

      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button {...attributes} {...listeners} className={`p-1 rounded cursor-grab active:cursor-grabbing touch-none ${isWeek || isTest || hasVideo ? "text-white/70 hover:text-white" : "text-neutral-400 hover:text-neutral-600"}`}>
              <GripVertical className="w-4 h-4" />
            </button>
            <span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${isWeek || isTest || hasVideo ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-700"}`}>{isWeek ? "Haftalik" : isTest ? "✏️ Test" : hasVideo ? "📹 Video" : `Kun #${day.num || idx + 1}`}</span>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className={`rounded-md p-1.5 border transition-colors ${isWeek || isTest ? "bg-white/20 border-white/20 text-white hover:bg-white/30" : "bg-white border-neutral-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-800 shadow-sm"}`}
              title="Tahrirlash"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className={`rounded-md p-1.5 border transition-colors ${isWeek || isTest ? "bg-white/20 border-white/20 text-white hover:bg-white/30" : "bg-white border-neutral-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 shadow-sm"}`}
              title="O'chirish"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <h3 className={`mt-3 text-sm font-bold leading-snug line-clamp-2 ${isWeek || isTest ? "text-white" : "text-neutral-900"}`}>{day.title}</h3>
        {isTest ? (
          <p className={`mt-2 text-xs leading-relaxed line-clamp-3 ${isWeek || isTest ? "text-white/80" : "text-neutral-600"}`}>
            {(() => { const parsed = parseJobTest(day.content || ""); return parsed.length > 0 ? `${parsed.length} ta savol` : "Test kontenti"; })()}
          </p>
        ) : (
          <p className={`mt-2 text-xs leading-relaxed line-clamp-3 ${isWeek || isTest ? "text-white/80" : "text-neutral-600"}`}>{day.content ? day.content.slice(0, 160) + (day.content.length > 160 ? "…" : "") : "Dars matni — tahrirlash uchun bosing."}</p>
        )}
      </div>
      <div className={`mt-4 flex items-center justify-between border-t pt-3 text-xs font-bold ${isWeek || isTest ? "border-white/20 text-white" : "border-neutral-100 text-neutral-600"}`}>
        <span className="flex items-center gap-1">{isTest ? <HelpCircle className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}{isTest ? "Test" : "Dars"}</span>
        <span>{isTest ? (() => { const p = parseJobTest(day.content || ""); return `${p.length} savol`; })() : day.content ? `${Math.ceil(day.content.length / 500)} daq` : "—"}</span>
      </div>
    </div>
  );
}
