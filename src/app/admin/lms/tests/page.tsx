"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { cachedFetch } from "@/lib/admin-cache";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Trash2,
  X,
  Loader2,
  ListChecks,
  Globe,
  Clock,
  Target,
  HelpCircle,
  Plus as PlusIcon,
  CheckCircle2,
  XCircle,
  Save,
  Users,
  Shield,
  Shuffle,
  History,
  Settings,
  UserCheck,
  AlertCircle,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  Eye,
  EyeOff,
} from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { api } from "@/lib/api";
import { parseExcelFileToQuestions, downloadTestTemplate } from "@/lib/job-test-excel";

type Test = {
  id: string;
  title: string;
  description?: string;
  language: string;
  timeLimit: number;
  passScore: number;
  status: string;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  visibility: string;
  assignedUserIds: string;
  _count?: { questions: number };
  questionCount: number;
  module?: { id: string; title: string; courseId: string };
};

type UserBrief = { id: string; email: string; name: string; surname: string; department?: string };

const LANG_LABELS: Record<string, string> = { uz: "UZB", ru: "RUS", en: "ENG" };
const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "QORALAMA", className: "bg-neutral-100 text-neutral-700" },
  active: { label: "FAOL", className: "bg-indigo-100 text-indigo-700" },
  archived: { label: "ARXIV", className: "bg-amber-100 text-amber-700" },
};

/**
 * Ticket (chek) dizayni — /admin/lms va TicketCard uslubidagi perforatsiya.
 * Rang o'zgar maydi: band bitta rang (bg-violet-900), gradient emas.
 * Teshiklar band (h-28 = 112px) va tananing chegarasida joylashadi.
 */
const TICKET_NOTCH_Y = "112px";
const TICKET_NOTCHES = [
  `radial-gradient(circle 10px at 0 ${TICKET_NOTCH_Y}, transparent 10px, #000 10.5px)`,
  `radial-gradient(circle 10px at 100% ${TICKET_NOTCH_Y}, transparent 10px, #000 10.5px)`,
].join(", ");
/**
 * Chetlardagi teshik — shaffof cut-out, sahifa foniga bog'liq emas.
 * `mask-composite: intersect` MUHIM: aks holda (add) har bir layer'ning opak
 * qismi ikkinchisining teshigini to'ldirib yopadi — teshik umuman chiqmaydi.
 */
const TICKET_CARD_MASK = {
  maskImage: TICKET_NOTCHES,
  WebkitMaskImage: TICKET_NOTCHES,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
} as unknown as React.CSSProperties;

export default function AdminTestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLang, setFilterLang] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "draft" | "archived">("all");

  const [showCreate, setShowCreate] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [addingQuestionTo, setAddingQuestionTo] = useState<string | null>(null);
  const [viewHistory, setViewHistory] = useState<Test | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [testForm, setTestForm] = useState({
    title: "",
    description: "",
    language: "uz",
    timeLimit: 0,
    passScore: 60,
    maxAttempts: 1,
    questionCount: 10,
    shuffleQuestions: true,
    shuffleChoices: true,
    visibility: "all",
    assignedUserIds: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);

  const [qForm, setQForm] = useState({
    text: "",
    type: "single" as "single" | "written",
    points: 1,
    explanation: "",
    correctAnswer: "",
    choices: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
  });

  const excelInputRef = useRef<HTMLInputElement>(null);
  const testExcelInputRef = useRef<HTMLInputElement>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  // Jonli import hisobi: qancha yuklandi / qancha kiritib bo'lmadi
  const [importProgress, setImportProgress] = useState<{
    total: number;
    done: number;
    failed: number;
    failures: { row: number; reason: string }[];
    finished: boolean;
  } | null>(null);
  const [pendingTestQuestions, setPendingTestQuestions] = useState<import("@/lib/job-test-excel").QuizItem[]>([]);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [togglingTestId, setTogglingTestId] = useState<string | null>(null);
  // Ko'pchilikdan himoya: kartochkada alohida 🗑 yo'q — faqat "Tanlab" bitta bosishda o'chirish
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const showToast = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // Testni ko'rsatish/yashirish — Darslar → Testlar bo'limida status active <-> draft
  const toggleTestVisibility = async (test: Test) => {
    if (togglingTestId) return;
    setTogglingTestId(test.id);
    const nextStatus = test.status === "active" ? "draft" : "active";
    try {
      const res = await fetch(`/api/admin/tests/${test.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        setTests((prev) => prev.map((t) => (t.id === test.id ? { ...t, status: nextStatus } : t)));
        showToast("ok", nextStatus === "active" ? "Test Darslar → Testlar bo'limida KO'RINADI" : "Test yashirildi — Darslar bo'limida ko'rinmaydi");
      } else {
        showToast("err", data.error || "Xatolik");
      }
    } catch {
      showToast("err", "Tarmoq xatosi");
    } finally {
      setTogglingTestId(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadTestTemplate();
      showToast("ok", "Shablon yuklab olindi: test-shablon.xlsx");
    } catch (e: any) {
      showToast("err", "Shablon xatosi: " + (e.message || "xato"));
    }
  };

  const handleTestExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingExcel(true);
    try {
      const items = await parseExcelFileToQuestions(file);
      setPendingTestQuestions(items);
      setImportProgress({ total: items.length, done: items.length, failed: 0, failures: [], finished: true });
      showToast("ok", `${items.length} ta savol shablondan o'qildi — Test yaratilganda avto qo'shiladi, variantlar random`);
    } catch (err: any) {
      setImportProgress(null);
      showToast("err", err.message || "Excel import xatosi");
    } finally {
      setImportingExcel(false);
      if (testExcelInputRef.current) testExcelInputRef.current.value = "";
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !addingQuestionTo) return;
    setImportingExcel(true);
    try {
      const items = await parseExcelFileToQuestions(file);
      setImportProgress({ total: items.length, done: 0, failed: 0, failures: [], finished: false });
      // har bir savolni ketma-ket yaratish — variantlar allaqachon random aralashtirilgan
      let ok = 0;
      const failures: { row: number; reason: string }[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const choices = it.options.map((t, idx) => ({ text: t, isCorrect: idx === it.correct }));
        try {
          const res = await fetch("/api/admin/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ testId: addingQuestionTo, text: it.question, type: "single", points: 1, choices }),
          });
          if (res.ok) {
            ok++;
          } else {
            const data = await res.json().catch(() => ({}));
            failures.push({ row: i + 1, reason: data.error || `HTTP ${res.status}` });
          }
        } catch (err: any) {
          failures.push({ row: i + 1, reason: err?.message || "Tarmoq xatosi" });
        }
        // har bir savoldan keyin holatni yangila — foydalanuvchi progressni ko'radi
        setImportProgress({
          total: items.length,
          done: ok,
          failed: failures.length,
          failures: [...failures],
          finished: i === items.length - 1,
        });
      }
      showToast(
        failures.length ? "err" : "ok",
        `${ok}/${items.length} ta savol import qilindi` +
          (failures.length ? ` — ${failures.length} tasi kiritib bo'lmadi` : " — variantlar random aralashtirildi")
      );
      fetchTests();
    } catch (err: any) {
      showToast("err", err.message || "Excel import xatosi");
      setImportProgress(null);
    } finally {
      setImportingExcel(false);
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role === "user") router.push("/dashboard");
  }, [status, session, router]);

  const fetchTests = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background === true;
    if (!background) setLoading(true);
    try {
      const res = await cachedFetch("/api/admin/tests", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setTests(data.tests);
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await cachedFetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setUsers(data.users.map((u: any) => ({ id: u.id, email: u.email, name: u.name, surname: u.surname, department: u.department })));
    } catch {}
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchTests();
      fetchUsers();
    }
  }, [status, fetchTests, fetchUsers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (addingQuestionTo) setAddingQuestionTo(null);
      else if (viewHistory) setViewHistory(null);
      else if (editingTest) setEditingTest(null);
      else if (showCreate) setShowCreate(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleCreate = async () => {
    if (!testForm.title.trim()) return;
    setSubmitting(true);
    try {
      const payload: any = { ...testForm };
      if (payload.visibility === "all") payload.assignedUserIds = [];
      const res = await fetch("/api/admin/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        const newTestId = data.test.id;
        // agar shablon bilan savollar pending bo'lsa, avto qo'shish
        if (pendingTestQuestions.length > 0) {
          let ok = 0;
          for (const it of pendingTestQuestions) {
            const choices = it.options.map((t, idx) => ({ text: t, isCorrect: idx === it.correct }));
            const r = await fetch("/api/admin/questions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ testId: newTestId, text: it.question, type: "single", points: 1, choices }),
            });
            if (r.ok) ok++;
          }
          showToast("ok", `Test yaratildi + ${ok}/${pendingTestQuestions.length} ta savol shablondan avto qo'shildi`);
          setPendingTestQuestions([]);
        } else {
          setAddingQuestionTo(newTestId);
        }
        setShowCreate(false);
        setTestForm({ title: "", description: "", language: "uz", timeLimit: 0, passScore: 60, maxAttempts: 1, questionCount: 10, shuffleQuestions: true, shuffleChoices: true, visibility: "all", assignedUserIds: [] });
        fetchTests({ background: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingTest) return;
    setSubmitting(true);
    try {
      const payload: any = { ...testForm };
      if (payload.visibility === "all") payload.assignedUserIds = [];
      const res = await fetch(`/api/admin/tests/${editingTest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        if (pendingTestQuestions.length > 0) {
          let ok = 0;
          for (const it of pendingTestQuestions) {
            const choices = it.options.map((t, idx) => ({ text: t, isCorrect: idx === it.correct }));
            const r = await fetch("/api/admin/questions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ testId: editingTest.id, text: it.question, type: "single", points: 1, choices }),
            });
            if (r.ok) ok++;
          }
          showToast("ok", `Test yangilandi + ${ok}/${pendingTestQuestions.length} ta savol shablondan avto qo'shildi`);
          setPendingTestQuestions([]);
        }
        setEditingTest(null);
        fetchTests({ background: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (test: Test) => {
    setEditingTest(test);
    setPendingTestQuestions([]);
    let assigned: string[] = [];
    try { assigned = JSON.parse(test.assignedUserIds || "[]"); } catch {}
setTestForm({
      title: test.title,
      description: test.description || "",
      language: test.language,
      timeLimit: test.timeLimit,
      passScore: test.passScore,
      maxAttempts: (test as any).maxAttempts ?? 1,
      shuffleQuestions: (test as any).shuffleQuestions ?? true,
      shuffleChoices: (test as any).shuffleChoices ?? true,
      visibility: (test as any).visibility || "all",
      assignedUserIds: assigned,
      questionCount: test.questionCount ?? 10,
    });
  };

  const handleAddQuestion = async () => {
    if (!addingQuestionTo) return;
    if (!qForm.text.trim()) {
      alert("Savol matni to'ldirilishi kerak");
      return;
    }
    if (qForm.type === "single" && qForm.choices.some((c) => !c.text.trim())) {
      alert("Barcha variantlar to'ldirilishi kerak");
      return;
    }
    if (qForm.type === "written" && !qForm.correctAnswer.trim()) {
      alert("To'g'ri javob matnini kiriting");
      return;
    }
    // Savollar sonini tekshirish
    const currentTest = tests.find(t => t.id === addingQuestionTo);
    if (currentTest && currentTest._count?.questions && currentTest._count.questions >= currentTest.questionCount) {
      if (!confirm(`Testda allaqachon ${currentTest.questionCount} ta savol bor. Yana qo'shishni xohlaysizmi?`)) return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        testId: addingQuestionTo,
        text: qForm.text,
        type: qForm.type,
        points: qForm.points,
        explanation: qForm.explanation,
      };
      if (qForm.type === "single") {
        payload.choices = qForm.choices;
      } else {
        payload.correctAnswer = qForm.correctAnswer;
      }
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setQForm({
          text: "",
          type: "single",
          points: 1,
          explanation: "",
          correctAnswer: "",
          choices: [
            { text: "", isCorrect: true },
            { text: "", isCorrect: false },
            { text: "", isCorrect: false },
            { text: "", isCorrect: false },
          ],
        });
        fetchTests({ background: true });
      } else {
        const err = await res.json();
        alert("Xato: " + err.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Bitta bosishda tanlanganlarni o'chirish (bitta confirm — tez rejim)
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || bulkDeleting) return;
    if (!confirm(`Tanlangan ${selectedIds.length} ta test o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    setBulkDeleting(true);
    const ids = selectedIds;
    const prev = tests;
    setTests((t) => t.filter((x) => !ids.includes(x.id))); // optimistic — UI darhol toza
    let failed = 0;
    for (const id of ids) {
      const r = await api(`/api/admin/tests/${id}`, { method: "DELETE" });
      if (!r.ok) failed++;
    }
    setBulkDeleting(false);
    setSelectedIds([]);
    setSelectMode(false);
    if (failed > 0) {
      setTests(prev);
      showToast("err", `${failed} ta testni o'chirib bo'lmadi — qayta urinib ko'ring`);
      return;
    }
    showToast("ok", `${ids.length} ta test o'chirildi`);
    await fetchTests({ background: true });
  };

  const openHistory = async (test: Test) => {
    setViewHistory(test);
    setLoadingHistory(true);
    try {
      const res = await cachedFetch(`/api/tests/history?testId=${test.id}&all=1`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setHistory(data.results);
      else setHistory([]);
    } catch { setHistory([]); }
    finally { setLoadingHistory(false); }
  };

  const filtered = tests.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchLang = filterLang === "all" || t.language === filterLang;
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    return matchSearch && matchLang && matchStatus;
  });
  const counts = {
    all: tests.length,
    active: tests.filter((t) => t.status === "active").length,
    draft: tests.filter((t) => t.status === "draft").length,
    archived: tests.filter((t) => t.status === "archived").length,
  };

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="flex bg-transparent min-h-screen">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Testlar</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Barcha testlar — kimga ko'rinishi, necha urinish, randomizer va tarix bilan</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectMode((v) => !v); setSelectedIds([]); }}
              data-testid="toggle-select-mode"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition ${selectMode ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}
            >
              <Trash2 className="w-4 h-4" /> {selectMode ? "Tanlovni bekor qilish" : "Tanlab o'chirish"}
            </button>
            <button onClick={() => { setPendingTestQuestions([]); setShowCreate(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700">
              <Plus className="w-4 h-4" /> Test yaratish
            </button>
          </div>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`mx-8 mt-4 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${toast.kind === "ok" ? "bg-indigo-50 border-indigo-200 text-indigo-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
              {toast.kind === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8 max-w-[1600px]">
          {/* Tanlab o'chirish bar — bitta bosishda ko'p testni o'chirish */}
          {selectMode && (
            <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200" data-testid="bulk-delete-bar">
              <span className="text-sm font-bold text-rose-800">{selectedIds.length} ta tanlandi</span>
              <button
                onClick={() => setSelectedIds(filtered.map((t) => t.id))}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-100"
              >
                Ko'rsatilganlarini hammasini tanlash
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50"
              >
                Tozalash
              </button>
              <button
                onClick={() => void handleBulkDelete()}
                disabled={selectedIds.length === 0 || bulkDeleting}
                data-testid="bulk-delete-btn"
                className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {bulkDeleting ? "O'chirilmoqda..." : `Tanlanganlarni o'chirish (${selectedIds.length})`}
              </button>
            </div>
          )}
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish" className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600" />
              </div>
              <div className="flex gap-1.5">
                {["all", "uz", "ru", "en"].map((l) => (
                  <button key={l} onClick={() => setFilterLang(l)} className={`px-3 py-2 text-xs font-semibold rounded-lg ${filterLang === l ? "bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/20" : "bg-white border border-neutral-200 text-neutral-700"}`}>{l === "all" ? "Barchasi" : LANG_LABELS[l]}</button>
                ))}
              </div>
            </div>
            {/* Status filter — eski testlarni ham ko'rish */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-bold text-neutral-500 mr-1">Holat:</span>
              {([
                ["all", `Hammasi (${counts.all})`],
                ["active", `Faol (${counts.active})`],
                ["draft", `Yashirin (${counts.draft})`],
                ["archived", `Eski/Arxiv (${counts.archived})`],
              ] as const).map(([v, label]) => (
                <button key={v} onClick={() => setFilterStatus(v)} className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${filterStatus === v ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}>
                  {label}
                </button>
              ))}
              <span className="ml-2 text-[11px] text-neutral-400">← Eski testlarni ko'rish uchun Arxiv ni bosing, kartadagi “Ichiga kirish” bilan savollarni ochasiz</span>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2 text-xs text-neutral-600">
            <span className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-full px-3 py-1.5"><Shuffle className="w-3.5 h-3.5 text-violet-600" /> Har urinishda savollar & variantlar random</span>
            <span className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-full px-3 py-1.5"><History className="w-3.5 h-3.5 text-indigo-600" /> Natija tarixda saqlanadi</span>
            <span className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-full px-3 py-1.5"><Users className="w-3.5 h-3.5 text-sky-600" /> Ko'rinish tanlanadi</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-56 bg-white border border-neutral-200 rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white border-2 border-dashed border-neutral-200 rounded-2xl">
              <ListChecks className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-1">Hozircha testlar yo'q</h3>
              <p className="text-sm text-neutral-500 mb-5">Birinchi testni yarating va savollar qo'shing</p>
              <button onClick={() => { setPendingTestQuestions([]); setShowCreate(true); }} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 rounded-lg"><Plus className="w-4 h-4" /> Test yaratish</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((test) => {
                const isActive = test.status === "active";
                const status = STATUS_LABELS[test.status] || STATUS_LABELS.draft;
                let assignedCount = 0;
                try { assignedCount = JSON.parse((test as any).assignedUserIds || "[]").length; } catch {}
                const isLimited = (test as any).visibility === "selected";
                const busy = togglingTestId === test.id;
                return (
                  <div
                    key={test.id}
                    style={TICKET_CARD_MASK}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                    data-testid="admin-test-card"
                    data-visible={isActive ? "1" : "0"}
                  >
                    {/* ── Ticket bandi: bitta rang (violet-900), gradient emas ── */}
                    <div className="relative h-28 shrink-0 bg-violet-900">
                      <div className="absolute top-3 left-3 flex gap-1.5 items-center">
                        {selectMode && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(test.id)}
                            onChange={() => toggleSelect(test.id)}
                            data-testid="test-select-checkbox"
                            aria-label={`${test.title} — tanlash`}
                            className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-400 cursor-pointer"
                          />
                        )}
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${isActive ? "bg-emerald-100 text-emerald-700" : status.className}`}>{isActive ? "KO'RINADI" : test.status === "archived" ? "ARXIV" : "YASHIRIN"}</span>
                        {isLimited && <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Tanlangan</span>}
                      </div>
                      <div className="absolute top-3 right-3 flex gap-1.5 items-center">
                        <button
                          type="button"
                          onClick={() => toggleTestVisibility(test)}
                          disabled={busy}
                          data-testid="test-visibility-toggle"
                          data-active={isActive ? "1" : "0"}
                          className={`rounded-lg p-2 transition-all disabled:opacity-50 ${
                            isActive
                              ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/50 hover:bg-emerald-500/30"
                              : "bg-white/15 text-white/70 ring-1 ring-white/25 hover:bg-white/25"
                          }`}
                          title={isActive ? "Yashirish — Darslar bo'limidan berkitish" : "Ko'rsatish — Darslar bo'limiga ochish"}
                          aria-label={isActive ? "Testni yashirish" : "Testni ko'rsatish"}
                        >
                          {busy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isActive ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>
                        {(test as any).shuffleQuestions && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-white/20 text-white flex items-center gap-1"><Shuffle className="w-3 h-3" /> Q</span>}
                        {(test as any).shuffleChoices && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-white/20 text-white">V</span>}
                      </div>

                      {/* Chipta kuponi: seriya raqami + shtrix-kod (TicketCard uslubida) */}
                      <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between">
                        <div className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-violet-200/70">
                          {LANG_LABELS[test.language] || test.language.toUpperCase()} · {test._count?.questions ?? 0} savol · {test.timeLimit ? `${test.timeLimit} min` : "cheklovsiz"} · ball {test.passScore}%
                        </div>
                        <div className="font-mono text-[15px] font-black leading-none tracking-tight text-white/20">№{test.id.slice(-6).toUpperCase()}</div>
                      </div>
                      <div className="pointer-events-none absolute inset-x-3 bottom-0 flex h-3.5 items-end gap-[2px] overflow-hidden">
                        {Array.from({ length: 34 }).map((_, i) => (
                          <div key={i} className={`bg-white/15 ${i % 5 === 0 ? "w-[3px]" : i % 3 === 0 ? "w-[2px]" : "w-px"}`} />
                        ))}
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <button onClick={() => router.push(`/admin/lms/tests/${test.id}`)} className="text-left group/title">
                        <h3 className="font-bold text-base text-neutral-900 mb-1.5 line-clamp-2 min-h-[3rem] group-hover/title:text-indigo-700 group-hover/title:underline decoration-2 underline-offset-2">{test.title}</h3>
                      </button>
                      {test.description && <p className="text-xs text-neutral-500 line-clamp-2 mb-3">{test.description}</p>}
                      <div className="grid grid-cols-4 gap-2 mt-auto pt-3 border-t border-neutral-100">
                        <Stat icon={<Globe className="w-3 h-3" />} label="TILI" value={LANG_LABELS[test.language] || test.language.toUpperCase()} />
                        <Stat icon={<HelpCircle className="w-3 h-3" />} label="SAVOL" value={`${test._count?.questions ?? 0}/${test.questionCount ?? 10}`} />
                        <Stat icon={<Clock className="w-3 h-3" />} label="VAQT" value={test.timeLimit ? `${test.timeLimit}m` : "∞"} />
                        <Stat icon={<Target className="w-3 h-3" />} label="BALL" value={`${test.passScore}%`} />
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mt-3">
                        <div className="rounded-lg bg-neutral-50 border border-neutral-200 px-2 py-1.5 text-center">
                          <div className="text-[9px] font-bold text-neutral-400 uppercase">Urinish</div>
                          <div className="text-xs font-bold text-neutral-900">{(test as any).maxAttempts === 0 ? "∞" : (test as any).maxAttempts ?? 1}x</div>
                        </div>
                        <div className="rounded-lg bg-neutral-50 border border-neutral-200 px-2 py-1.5 text-center">
                          <div className="text-[9px] font-bold text-neutral-400 uppercase">Ko'rinish</div>
                          <div className="text-xs font-bold text-neutral-900 truncate">{isLimited ? `${assignedCount} odam` : "Hammaga"}</div>
                        </div>
                        <div className="rounded-lg bg-neutral-50 border border-neutral-200 px-2 py-1.5 text-center">
                          <div className="text-[9px] font-bold text-neutral-400 uppercase">Random</div>
                          <div className="text-xs font-bold text-violet-700">{(test as any).shuffleQuestions ? "Ha" : "Yo'q"}</div>
                        </div>
                      </div>
                      {/* ── Ticket "stub": dashed chiziq bilan ajratilgan amallar qismi ── */}
                      <div className="mt-4 pt-3.5 border-t border-dashed border-neutral-300">
                        <div className="flex gap-1.5">
                          <button onClick={() => router.push(`/admin/lms/tests/${test.id}`)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-neutral-900 rounded-md hover:bg-black">Ichiga kirish →</button>
                          <button onClick={() => router.push(`/admin/preview?path=${encodeURIComponent(`/tests/${test.id}`)}`)} className="px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 flex items-center gap-1" title="Talaba qanday ko'radi — ko'rish joyi"><Eye className="w-3.5 h-3.5" /> Ko'rish</button>
                        </div>
                        <div className="flex gap-1.5 mt-1.5">
                          <button onClick={() => setAddingQuestionTo(test.id)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium text-neutral-600 bg-neutral-100 rounded-md hover:bg-neutral-200"><PlusIcon className="w-3 h-3" /> Savol</button>
                          <button onClick={() => openHistory(test)} className="px-2 py-1 text-[11px] font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-md hover:bg-violet-100 flex items-center gap-1"><History className="w-3 h-3" /> Tarix</button>
                          <button onClick={() => openEdit(test)} title="Tahrirlash" aria-label="Testni tahrirlash" className="p-1 text-neutral-600 hover:bg-neutral-100 rounded-md"><Settings className="w-3 h-3" /></button>
                          {/* O'chirish kartochkadan olib tashlandi — faqat sarlavhadagi "Tanlab o'chirish" orqali */}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showCreate && (
          <Modal title="Test yaratish" subtitle="Kimga ko'rinishi, necha urinish, randomizer — shablon bilan avto" onClose={() => setShowCreate(false)} wide>
            <TestForm testForm={testForm} setTestForm={setTestForm} users={users} />
            <div className="mt-6 pt-4 border-t border-neutral-200">
              <div className="flex items-center gap-2 mb-3">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-bold text-neutral-800">Shablon bilan avto qo'shish</span>
                <span className="text-xs text-neutral-500">Excel orqali — boyagidek</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleDownloadTemplate} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Shablonni yuklab olish
                </button>
                <button type="button" onClick={() => testExcelInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-bold text-violet-800 hover:bg-violet-100 transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Excel dan import
                </button>
                <input ref={testExcelInputRef} type="file" accept=".xlsx,.xls" onChange={handleTestExcelImport} className="hidden" />
              </div>
              {pendingTestQuestions.length > 0 && (
                <div className="mt-3 rounded-xl bg-violet-50 border border-violet-200 p-3">
                  <div className="text-xs font-bold text-violet-800 flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> {pendingTestQuestions.length} ta savol shablondan o'qildi — Test yaratilganda avto qo'shiladi</div>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1 pr-1">
                    {pendingTestQuestions.slice(0, 4).map((q, i) => (
                      <div key={i} className="text-xs truncate">• {q.question} — {q.options.length} variant, to'g'ri: {String.fromCharCode(65 + q.correct)}</div>
                    ))}
                    {pendingTestQuestions.length > 4 && <div className="text-xs text-violet-600">+ yana {pendingTestQuestions.length - 4} ta</div>}
                  </div>
                  <button onClick={() => setPendingTestQuestions([])} className="mt-2 text-xs text-rose-600 hover:text-rose-700 underline">Tozalash</button>
                </div>
              )}
              <p className="text-[11px] text-neutral-500 mt-2">Shablonda <b>To'g'ri javob</b> ga <b>A/B/C/D</b> yozing (bitta joyda bo'lsa yetarli) — sayt avtomatik taniydi va variantlarni <b>random</b> aralashtiradi. {importingExcel && <span className="inline-flex items-center gap-1 text-violet-600"><Loader2 className="w-3 h-3 animate-spin" /> Import qilinmoqda...</span>}</p>
              <ImportProgress data={importProgress} />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">Bekor qilish</button>
              <button onClick={handleCreate} disabled={submitting || !testForm.title.trim()} className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700 disabled:opacity-50">Test yaratish</button>
            </div>
          </Modal>
        )}
        {editingTest && (
          <Modal title="Testni tahrirlash" subtitle={editingTest.title} onClose={() => setEditingTest(null)} wide>
            <TestForm testForm={testForm} setTestForm={setTestForm} users={users} />
            <div className="mt-6 pt-4 border-t border-neutral-200">
              <div className="flex items-center gap-2 mb-3">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-bold text-neutral-800">Shablon bilan avto qo'shish</span>
                <span className="text-xs text-neutral-500">Excel orqali — boyagidek</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleDownloadTemplate} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Shablonni yuklab olish
                </button>
                <button type="button" onClick={() => testExcelInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-bold text-violet-800 hover:bg-violet-100 transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Excel dan import
                </button>
                <input ref={testExcelInputRef} type="file" accept=".xlsx,.xls" onChange={handleTestExcelImport} className="hidden" />
              </div>
              {pendingTestQuestions.length > 0 && (
                <div className="mt-3 rounded-xl bg-violet-50 border border-violet-200 p-3">
                  <div className="text-xs font-bold text-violet-800 flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> {pendingTestQuestions.length} ta savol shablondan o'qildi — Saqlashda avto qo'shiladi</div>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1 pr-1">
                    {pendingTestQuestions.slice(0, 4).map((q, i) => (
                      <div key={i} className="text-xs truncate">• {q.question} — {q.options.length} variant, to'g'ri: {String.fromCharCode(65 + q.correct)}</div>
                    ))}
                    {pendingTestQuestions.length > 4 && <div className="text-xs text-violet-600">+ yana {pendingTestQuestions.length - 4} ta</div>}
                  </div>
                  <button onClick={() => setPendingTestQuestions([])} className="mt-2 text-xs text-rose-600 hover:text-rose-700 underline">Tozalash</button>
                </div>
              )}
              <p className="text-[11px] text-neutral-500 mt-2">Shablonda <b>To'g'ri javob</b> ga <b>A/B/C/D</b> yozing — sayt taniydi va <b>random</b> aralashtiradi. {importingExcel && <span className="inline-flex items-center gap-1 text-violet-600"><Loader2 className="w-3 h-3 animate-spin" /> Import qilinmoqda...</span>}</p>
              <ImportProgress data={importProgress} />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditingTest(null)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">Bekor</button>
              <button onClick={handleUpdate} disabled={submitting} className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg disabled:opacity-50 flex items-center gap-2">{submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Saqlash</button>
            </div>
          </Modal>
        )}
        {addingQuestionTo && (
          <Modal title="Savol qo'shish" subtitle="Yangi savol matni va variantlarini kiriting — yoki Excel shablon bilan avto" onClose={() => setAddingQuestionTo(null)}>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button onClick={handleDownloadTemplate} type="button" className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Shablonni yuklab olish
                </button>
                <button onClick={() => excelInputRef.current?.click()} type="button" className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-bold text-violet-800 hover:bg-violet-100 transition-colors">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel dan import
                </button>
                <input ref={excelInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelImport} className="hidden" />
              </div>
              <p className="text-[11px] text-neutral-500 px-1">Shablonda <b>To'g'ri javob</b> ga <b>A/B/C/D</b> yozing (bitta joyda bo'lsa yetarli) — sayt avtomatik taniydi va variantlarni <b>random</b> aralashtiradi. {importingExcel && <span className="inline-flex items-center gap-1 text-violet-600 ml-1"><Loader2 className="w-3 h-3 animate-spin" /> Import qilinmoqda...</span>}</p>
              <ImportProgress data={importProgress} />
              <Field label="Savol matni">
                <textarea value={qForm.text} onChange={(e) => setQForm({ ...qForm, text: e.target.value })} rows={2} placeholder="Masalan: HTML nima?" className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg resize-none" />
              </Field>
              <Field label="Savol turi">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setQForm({ ...qForm, type: "single" })} className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg border-2 transition-all ${qForm.type === "single" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-neutral-200 text-neutral-500 hover:border-neutral-300"}`}>
                    Variantlar (tanlash)
                  </button>
                  <button type="button" onClick={() => setQForm({ ...qForm, type: "written" })} className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg border-2 transition-all ${qForm.type === "written" ? "border-violet-500 bg-violet-50 text-violet-700" : "border-neutral-200 text-neutral-500 hover:border-neutral-300"}`}>
                    Yozma javob
                  </button>
                </div>
              </Field>
              {qForm.type === "single" ? (
                <Field label="Variantlar">
                  <div className="space-y-2">
                    {qForm.choices.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <button onClick={() => { const nc = qForm.choices.map((ch, idx) => ({ ...ch, isCorrect: idx === i })); setQForm({ ...qForm, choices: nc }); }} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${c.isCorrect ? "bg-indigo-500 border-indigo-500 text-white" : "border-neutral-300 hover:border-neutral-500"}`}>{c.isCorrect && <CheckCircle2 className="w-4 h-4" />}</button>
                        <input value={c.text} onChange={(e) => { const nc = [...qForm.choices]; nc[i] = { ...nc[i], text: e.target.value }; setQForm({ ...qForm, choices: nc }); }} placeholder={`Variant ${i + 1}`} className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-lg" />
                        {qForm.choices.length > 2 && <button onClick={() => setQForm({ ...qForm, choices: qForm.choices.filter((_, idx) => idx !== i) })} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"><X className="w-3.5 h-3.5" /></button>}
                      </div>
                    ))}
                    <button onClick={() => setQForm({ ...qForm, choices: [...qForm.choices, { text: "", isCorrect: false }] })} className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900"><Plus className="w-3.5 h-3.5" /> Variant qo'shish</button>
                  </div>
                </Field>
              ) : (
                <Field label="Nazoratchi tekshiruvi">
                  <textarea value={qForm.correctAnswer} onChange={(e) => setQForm({ ...qForm, correctAnswer: e.target.value })} rows={3} placeholder="To'g'ri javob matnini kiriting — nazoratchi foydalanuvchi javobini shu bilan solishtiradi" className="w-full px-3 py-2 text-sm border border-violet-200 bg-violet-50/50 rounded-lg resize-none focus:border-violet-400 focus:outline-none" />
                  <p className="text-[11px] text-violet-500 mt-1 flex items-center gap-1"><Shield className="w-3 h-3" /> Faqat nazoratchi ko'radi. Foydalanuvchiga ko'rinmaydi.</p>
                </Field>
              )}
              <Field label="Ball"><input type="number" value={qForm.points} onChange={(e) => setQForm({ ...qForm, points: parseInt(e.target.value) || 1 })} className="w-32 px-3 py-2 text-sm border border-neutral-200 rounded-lg" /></Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setAddingQuestionTo(null)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">Tugatish</button>
              <button onClick={handleAddQuestion} disabled={submitting} className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg disabled:opacity-50 flex items-center gap-2">{submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}<Plus className="w-3.5 h-3.5" /> Savol qo'shish</button>
            </div>
          </Modal>
        )}
        {viewHistory && (
          <Modal title="Test tarixi" subtitle={`${viewHistory.title} — barcha urinishlar`} onClose={() => setViewHistory(null)} wide>
            {loadingHistory ? <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" /></div> : history.length === 0 ? <div className="py-10 text-center text-sm text-neutral-500 flex flex-col items-center gap-2"><AlertCircle className="w-8 h-8 text-neutral-300" /> Hozircha natija yo'q</div> : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {history.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 bg-white">
                    <div className={`grid h-10 w-10 place-items-center rounded-full text-white font-bold text-sm ${r.passed ? "bg-indigo-500" : "bg-rose-500"}`}>{r.score}%</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-neutral-900 truncate">{r.user?.name || r.user?.email || r.userId.slice(0,6)}</div>
                      <div className="text-xs text-neutral-500">{new Date(r.completedAt || r.createdAt).toLocaleString()} · {r.user?.email || ""}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${r.passed ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>{r.passed ? "O'tdi" : "Yiqildi"}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4"><button onClick={() => setViewHistory(null)} className="px-4 py-2 text-sm bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/20 rounded-lg">Yopish</button></div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function TestForm({ testForm, setTestForm, users }: any) {
  return (
    <div className="space-y-5">
      {/* Asosiy */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
          <FileText className="w-3.5 h-3.5" /> Asosiy ma'lumotlar
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-neutral-700 mb-1.5 block">Test nomi <span className="text-rose-500">*</span></label>
            <input value={testForm.title} onChange={(e) => setTestForm({ ...testForm, title: e.target.value })} placeholder="Masalan: Yakuniy imtihon — Sotuv asoslari" className="w-full px-4 py-3 text-sm font-medium border-2 border-neutral-200 rounded-xl bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none transition placeholder:text-neutral-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-700 mb-1.5 block">Tavsif <span className="text-neutral-400 font-normal">(ixtiyoriy)</span></label>
            <textarea value={testForm.description} onChange={(e) => setTestForm({ ...testForm, description: e.target.value })} rows={2} placeholder="Test haqida qisqacha izoh..." className="w-full px-4 py-3 text-sm border-2 border-neutral-200 rounded-xl bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none resize-none transition placeholder:text-neutral-400" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-700 mb-1.5 block flex items-center gap-1.5"><Globe className="w-3 h-3 text-neutral-500" /> Tili</label>
              <select value={testForm.language} onChange={(e) => setTestForm({ ...testForm, language: e.target.value })} className="w-full px-4 py-3 text-sm font-medium border-2 border-neutral-200 rounded-xl bg-white focus:border-violet-500 focus:outline-none">
                <option value="uz">🇺🇿 O'zbek</option>
                <option value="ru">🇷🇺 Русский</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700 mb-1.5 block flex items-center gap-1.5"><Clock className="w-3 h-3 text-neutral-500" /> Vaqt (min)</label>
              <input type="number" value={testForm.timeLimit} onChange={(e) => setTestForm({ ...testForm, timeLimit: parseInt(e.target.value) || 0 })} placeholder="0 = cheksiz" className="w-full px-4 py-3 text-sm border-2 border-neutral-200 rounded-xl bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none placeholder:text-neutral-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-700 mb-1.5 block flex items-center gap-1.5"><HelpCircle className="w-3 h-3 text-neutral-500" /> Savollar soni</label>
            <input type="number" min={1} max={100} value={testForm.questionCount} onChange={(e) => setTestForm({ ...testForm, questionCount: parseInt(e.target.value) || 10 })} className="w-full px-4 py-3 text-sm border-2 border-neutral-200 rounded-xl bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none" />
            <p className="text-[11px] text-neutral-500 mt-1">Testda nechta savol bo'lishi kerak — yetarli savol qo'shilmagan bo'lsa xato beradi</p>
          </div>
        </div>
      </div>

      {/* Sozlamalar */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
          <Target className="w-3.5 h-3.5" /> Sozlamalar
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
            <label className="text-xs font-bold text-neutral-600 mb-1.5 block flex items-center gap-1"><Target className="w-3 h-3" /> O'tish bali %</label>
            <input type="number" value={testForm.passScore} onChange={(e) => setTestForm({ ...testForm, passScore: parseInt(e.target.value) || 60 })} className="w-full px-3 py-2.5 text-sm font-black text-center border-2 border-neutral-200 rounded-xl bg-white focus:border-violet-500 focus:outline-none" />
            <p className="text-[10px] text-neutral-500 text-center mt-1">Kamida {testForm.passScore}%</p>
          </div>
          <div className="rounded-xl bg-violet-50 border-2 border-violet-200 p-3">
            <label className="text-xs font-bold text-violet-700 mb-1.5 block flex items-center gap-1"><History className="w-3 h-3" /> Urinish soni</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} value={testForm.maxAttempts} onChange={(e) => setTestForm({ ...testForm, maxAttempts: parseInt(e.target.value) || 0 })} className="flex-1 min-w-0 px-3 py-2.5 text-sm font-black text-center border-2 border-violet-300 rounded-xl bg-white focus:border-violet-500 focus:outline-none text-neutral-900 shadow-sm" />
              <span className="shrink-0 text-xs font-bold text-violet-700 bg-white border-2 border-violet-200 rounded-full px-2.5 py-1.5 whitespace-nowrap">0 = ∞</span>
            </div>
          </div>
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
            <label className="text-xs font-bold text-neutral-600 mb-1.5 block flex items-center gap-1"><Shield className="w-3 h-3" /> Ko'rinish</label>
            <select value={testForm.visibility} onChange={(e) => setTestForm({ ...testForm, visibility: e.target.value })} className="w-full px-3 py-2.5 text-sm font-medium border-2 border-neutral-200 rounded-xl bg-white focus:border-violet-500 focus:outline-none">
              <option value="all">Hammaga</option>
              <option value="selected">Tanlanganlarga</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200">
          <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer bg-white rounded-xl px-3 py-2.5 border border-violet-200 hover:border-violet-300 transition shadow-sm">
            <input type="checkbox" checked={testForm.shuffleQuestions} onChange={(e) => setTestForm({ ...testForm, shuffleQuestions: e.target.checked })} className="rounded text-violet-600 w-4 h-4" />
            <Shuffle className="w-4 h-4 text-violet-700" />
            <span className="font-semibold text-neutral-800">Savollar random</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer bg-white rounded-xl px-3 py-2.5 border border-violet-200 hover:border-violet-300 transition shadow-sm">
            <input type="checkbox" checked={testForm.shuffleChoices} onChange={(e) => setTestForm({ ...testForm, shuffleChoices: e.target.checked })} className="rounded text-violet-600 w-4 h-4" />
            <Shuffle className="w-4 h-4 text-violet-700" />
            <span className="font-semibold text-neutral-800">Variantlar random</span>
          </label>
          <p className="col-span-1 sm:col-span-2 text-xs text-violet-700 bg-white/70 rounded-lg px-3 py-2 border border-violet-100">Har urinishda savollar va variantlar aralashtirib beriladi — <b>hamma joyda randomizer</b>.</p>
        </div>
      </div>

      {/* Ko'rinish tanlash */}
      {testForm.visibility === "selected" && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <Users className="w-4 h-4" /> Foydalanuvchilarni tanlang
            <span className="ml-auto text-xs font-normal bg-white border border-amber-200 rounded-full px-2.5 py-1">{testForm.assignedUserIds.length} tanlangan</span>
          </div>
          <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl border-2 border-dashed border-amber-200 bg-white min-h-[48px]">
            {testForm.assignedUserIds.length === 0 ? <span className="text-xs text-neutral-400 py-1.5">Hech kim tanlanmagan — test hech kimga ko'rinmaydi</span> : testForm.assignedUserIds.map((id: string) => {
              const u = users.find((x: any) => x.id === id);
              return <span key={id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/20 text-xs font-medium shadow-sm">{u ? `${u.name} ${u.surname}` : id}<button onClick={() => setTestForm({ ...testForm, assignedUserIds: testForm.assignedUserIds.filter((x: string) => x !== id) })} className="grid h-5 w-5 place-items-center rounded-full hover:bg-white/20 transition"><X className="w-3 h-3" /></button></span>;
            })}
          </div>
          <div className="max-h-48 overflow-y-auto border-2 border-neutral-200 rounded-xl divide-y divide-neutral-100 bg-white shadow-sm">
            {users.map((u: any) => {
              const selected = testForm.assignedUserIds.includes(u.id);
              return (
                <label key={u.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 cursor-pointer transition ${selected ? "bg-indigo-50/70" : ""}`}>
                  <input type="checkbox" checked={selected} onChange={(e) => {
                    if (e.target.checked) setTestForm({ ...testForm, assignedUserIds: [...testForm.assignedUserIds, u.id] });
                    else setTestForm({ ...testForm, assignedUserIds: testForm.assignedUserIds.filter((x: string) => x !== u.id) });
                  }} className="rounded text-indigo-600 w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">{u.name} {u.surname}</div>
                    <div className="text-xs text-neutral-500 truncate">{u.email} {u.department ? `· ${u.department}` : ""}</div>
                  </div>
                  {selected && <UserCheck className="w-5 h-5 text-indigo-600" />}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-amber-700 flex items-center gap-1.5 bg-white rounded-lg px-3 py-2 border border-amber-200"><Shield className="w-3.5 h-3.5" /> Faqat tanlanganlar testni ko'radi, qolganlarga ko'rinmaydi</p>
        </div>
      )}
    </div>
  );
}

// Excel import jonli progressi: yuklangan / kiritib bo'lmagan savollar
function ImportProgress({ data }: { data: { total: number; done: number; failed: number; failures: { row: number; reason: string }[]; finished: boolean } | null }) {
  if (!data) return null;
  const pct = data.total ? Math.round((data.done / data.total) * 100) : 0;
  return (
    <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/70 p-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
        <span className="inline-flex items-center gap-1.5 text-violet-700">
          {data.finished ? (
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          )}
          {data.finished ? "Import yakunlandi" : "Import qilinmoqda..."}
        </span>
        <span className="tabular-nums text-violet-900">
          {data.done}/{data.total}
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-violet-200" aria-hidden="true">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
          <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Yuklandi: {data.done}
        </span>
        <span className={`inline-flex items-center gap-1 font-bold ${data.failed ? "text-rose-600" : "text-neutral-500"}`}>
          <XCircle className="w-3 h-3" aria-hidden="true" /> Kiritib bo'lmadi: {data.failed}
        </span>
      </div>

      {data.failures.length > 0 && (
        <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-[11px] text-rose-700" aria-label="Kiritib bo'lmagan savollar">
          {data.failures.map((f) => (
            <li key={f.row} className="flex gap-1.5">
              <span className="shrink-0 font-bold tabular-nums">Qator {f.row}:</span>
              <span className="truncate">{f.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">{icon} {label}</div>
      <div className="text-sm font-bold text-neutral-900">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-4">
      <label className="text-sm font-medium text-neutral-700 text-right pt-2">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function Modal({ title, subtitle, children, onClose, wide }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto ${wide ? "max-w-3xl" : "max-w-2xl"}`}>
        <div className="px-6 py-5 border-b border-neutral-100 flex items-start justify-between">
          <div><h2 className="text-lg font-bold text-neutral-900">{title}</h2>{subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}</div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100"><X className="w-5 h-5 text-neutral-500" /></button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

