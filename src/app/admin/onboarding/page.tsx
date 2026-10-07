"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { cachedFetch } from "@/lib/admin-cache";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Navbar } from "@/components/akela/Navbar";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  BookOpen,
  GraduationCap,
  ChevronRight,
  ChevronLeft,
  Check,
  Eye,
  EyeOff,
  Pencil,
  FileText,
  List,
  LayoutGrid,
  Search,
  GripVertical,
  ListChecks,
  Clock,
  Target,
  HelpCircle,
  Globe,
} from "lucide-react";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import { parseSections, serializeSections, previewText, type Section } from "@/lib/lesson-sections";

type Lesson = {
  id: string;
  title: string;
  content: string;
  videoUrl?: string | null;
  order: number;
};
type Module = {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  lessons: Lesson[];
};
type Course = {
  id: string;
  title: string;
  modules: Module[];
};
type AdminTest = {
  id: string;
  title: string;
  description?: string | null;
  language: string;
  timeLimit: number;
  passScore: number;
  status: string;
  maxAttempts: number;
  questionCount: number;
  visibility: string;
  assignedUserIds: string;
  _count?: { questions: number };
  module?: { id: string; title: string; courseId: string } | null;
};

const SECTION_TEMPLATE = `**1. Bo'lim nomi**

Bu yerga bo'lim matnini yozing.

- Birinchi punkt
- Ikkinchi punkt

**Muhim:** qalin matn bilan ta'kidlang.`;

export default function AdminOnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const [viewMode, setViewMode] = useState<"modules" | "flat">("modules");
  const [searchQuery, setSearchQuery] = useState("");

  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [creatingModule, setCreatingModule] = useState(false);

  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState("");

  const [addingLessonTo, setAddingLessonTo] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardTitle, setWizardTitle] = useState("");
  const [wizardSections, setWizardSections] = useState<Section[]>([
    { num: "1", title: "", body: "" },
  ]);
  const [wizardVideoUrl, setWizardVideoUrl] = useState("");
  const [creatingLesson, setCreatingLesson] = useState(false);

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSections, setEditSections] = useState<Section[]>([]);
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [savingLesson, setSavingLesson] = useState(false);

  const [rules, setRules] = useState<RulesState>(rulesDefaults);

  // Tests (Darslar boshqaruvi ichida — ko'rish/yashirish boshqaruvi bilan)
  const [tests, setTests] = useState<AdminTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [togglingTestId, setTogglingTestId] = useState<string | null>(null);
  const [testSearch, setTestSearch] = useState("");
  const [showHiddenTests, setShowHiddenTests] = useState(false);

  // Escape barcha modallarni yopadi (modul qo'shish/tahrir, dars wizard, dars tahrir)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editingLessonId) setEditingLessonId(null);
      else if (addingLessonTo) setAddingLessonTo(null);
      else if (editingModuleId) setEditingModuleId(null);
      else if (addModuleOpen) setAddModuleOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const showToast = useCallback((kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await cachedFetch("/api/admin/onboarding", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok && data.course) setCourse(data.course);
      else setCourse(null);
    } catch (e) {
      showToast("err", "Ma'lumotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadTests = useCallback(async () => {
    try {
      const res = await cachedFetch("/api/admin/tests", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.tests)) setTests(data.tests);
      else setTests([]);
    } catch {
      setTests([]);
    } finally {
      setTestsLoading(false);
    }
  }, []);

  // Testni ko'rsatish/yashirish — status active <-> draft
  const toggleTestVisibility = async (test: AdminTest) => {
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
        showToast("ok", nextStatus === "active" ? "Test ko'rinadigan qilib belgilandi" : "Test yashirildi");
      } else {
        showToast("err", data.error || "Xatolik");
      }
    } catch {
      showToast("err", "Tarmoq xatosi");
    } finally {
      setTogglingTestId(null);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role === "user") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === "authenticated") {
      load();
      loadTests();
    }
  }, [status, load, loadTests]);

  const handleCreateModule = async () => {
    if (!newModuleTitle.trim()) return;
    setCreatingModule(true);
    try {
      const res = await fetch("/api/admin/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newModuleTitle.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("ok", "Yangi modul qo'shildi");
        setNewModuleTitle("");
        setAddModuleOpen(false);
        await load();
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Tarmoq xatosi");
    } finally {
      setCreatingModule(false);
    }
  };

  const handleUpdateModule = async (id: string) => {
    if (!editingModuleTitle.trim()) return;
    try {
      const res = await fetch(`/api/admin/onboarding/modules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingModuleTitle.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("ok", "Modul saqlandi");
        setEditingModuleId(null);
        await load();
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Tarmoq xatosi");
    }
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm("Bu modul va uning barcha darslari o'chiriladi. Davom etasizmi?")) return;
    try {
      const res = await fetch(`/api/admin/onboarding/modules/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        showToast("ok", "Modul o'chirildi");
        await load();
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Tarmoq xatosi");
    }
  };

  const startAddLesson = (moduleId: string) => {
    setAddingLessonTo(moduleId);
    setWizardStep(1);
    setWizardTitle("");
    setWizardSections([{ num: "1", title: "", body: "" }]);
    setWizardVideoUrl("");
  };

  const handleCreateLesson = async () => {
    if (!addingLessonTo || !wizardTitle.trim()) return;
    setCreatingLesson(true);
    try {
      const content = serializeSections(wizardSections);
      const res = await fetch("/api/admin/onboarding/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: addingLessonTo,
          title: wizardTitle.trim(),
          content,
          videoUrl: wizardVideoUrl.trim() || undefined,
          status: "active",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("ok", "Yangi dars qo'shildi");
        setAddingLessonTo(null);
        await load();
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Tarmoq xatosi");
    } finally {
      setCreatingLesson(false);
    }
  };

  const startEditLesson = (l: Lesson) => {
    setEditingLessonId(l.id);
    setEditTitle(l.title);
    setEditSections(parseSections(l.content || ""));
    setEditVideoUrl(l.videoUrl || "");
  };

  const handleUpdateLesson = async () => {
    if (!editingLessonId || !editTitle.trim()) return;
    setSavingLesson(true);
    try {
      const content = serializeSections(editSections);
      const res = await fetch(`/api/admin/onboarding/lessons/${editingLessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          content,
          videoUrl: editVideoUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("ok", "Dars saqlandi");
        setEditingLessonId(null);
        await load();
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Tarmoq xatosi");
    } finally {
      setSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm("Bu dars o'chiriladi. Davom etasizmi?")) return;
    try {
      const res = await fetch(`/api/admin/onboarding/lessons/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        showToast("ok", "Dars o'chirildi");
        await load();
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Tarmoq xatosi");
    }
  };

  const addWizardSection = () => {
    setWizardSections((s) => [...s, { num: String(s.length + 1), title: "", body: "" }]);
  };

  const removeWizardSection = (idx: number) => {
    setWizardSections((s) => s.filter((_, i) => i !== idx));
  };

  const updateWizardSection = (idx: number, patch: Partial<Section>) => {
    setWizardSections((s) => s.map((sec, i) => (i === idx ? { ...sec, ...patch } : sec)));
  };

  const addEditSection = () => {
    setEditSections((s) => [...s, { num: String(s.length + 1), title: "", body: "" }]);
  };

  const removeEditSection = (idx: number) => {
    setEditSections((s) => s.filter((_, i) => i !== idx));
  };

  const updateEditSection = (idx: number, patch: Partial<Section>) => {
    setEditSections((s) => s.map((sec, i) => (i === idx ? { ...sec, ...patch } : sec)));
  };

  const flatLessons = useMemo(() => {
    if (!course) return [];
    const out: Array<{ lesson: Lesson; module: Module; moduleIdx: number; lessonIdx: number }> = [];
    course.modules.forEach((m, mi) => {
      (m.lessons ?? []).forEach((l, li) => out.push({ lesson: l, module: m, moduleIdx: mi, lessonIdx: li }));
    });
    if (!searchQuery.trim()) return out;
    const q = searchQuery.toLowerCase();
    return out.filter(({ lesson, module: m }) =>
      lesson.title.toLowerCase().includes(q) ||
      m.title.toLowerCase().includes(q) ||
      previewText(lesson.content, 300).toLowerCase().includes(q)
    );
  }, [course, searchQuery]);

  const totalLessons = useMemo(
    () => (course?.modules ?? []).reduce((s, m) => s + (m.lessons?.length ?? 0), 0),
    [course]
  );

  if (status === "loading" || loading) {
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

  return (
    <main className="min-h-screen bg-background">
      <LiquidBackground />
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 glass-card rounded-2xl px-5 py-3 shadow-2xl border-l-4 ${
              toast.kind === "ok" ? "border-indigo-500" : "border-rose-500"
            }`}
            role="alert"
          >
            <p className={`text-sm font-bold ${toast.kind === "ok" ? "text-indigo-700" : "text-rose-700"}`}>
              {toast.msg}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-6xl px-6 pt-28 pb-12 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-lg">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">Darslar boshqaruvi</h1>
              <p className="text-sm text-[color:var(--ink-soft)]">
                Modullar va darslarni boshqaring — bo&apos;limlar alohida maydonlarda, oldindan ko&apos;rish bilan.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="glass-pill text-xs font-bold text-[color:var(--emerald-deep)]">
                {course?.modules.length ?? 0} modul · {totalLessons} dars
              </span>
              <div className="flex rounded-xl overflow-hidden border border-black/5">
                <button
                  onClick={() => setViewMode("modules")}
                  className={`px-3 py-1.5 text-xs font-bold ${viewMode === "modules" ? "bg-indigo-600 text-white" : "glass-card text-[color:var(--ink-soft)]"}`}
                  title="Modul bo'yicha"
                >
                  <LayoutGrid className="inline h-3.5 w-3.5 mr-1" /> Modullar
                </button>
                <button
                  onClick={() => setViewMode("flat")}
                  className={`px-3 py-1.5 text-xs font-bold ${viewMode === "flat" ? "bg-indigo-600 text-white" : "glass-card text-[color:var(--ink-soft)]"}`}
                  title="Barcha darslar"
                >
                  <List className="inline h-3.5 w-3.5 mr-1" /> Hammasi
                </button>
              </div>
              <Link href="/admin" className="flex items-center gap-2 rounded-xl glass-card px-4 py-2.5 text-sm font-semibold text-[color:var(--emerald-deep)] hover:-translate-y-0.5 transition-all">
                <ArrowLeft className="h-4 w-4" /> Admin
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ===== MODULE VIEW ===== */}
        {viewMode === "modules" && (
          <>
            {/* Add module */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl p-5">
              {!addModuleOpen ? (
                <button
                  onClick={() => setAddModuleOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 px-5 py-4 text-base font-bold text-white shadow-lg hover:scale-[1.01] transition-transform"
                >
                  <Plus className="h-5 w-5" /> Yangi modul qo&apos;shish
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    autoFocus
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateModule();
                      if (e.key === "Escape") { setAddModuleOpen(false); setNewModuleTitle(""); }
                    }}
                    placeholder="Masalan: Xodimlar bilan ishlash"
                    className="flex-1 glass-card rounded-xl px-4 py-3 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    onClick={handleCreateModule}
                    disabled={creatingModule || !newModuleTitle.trim()}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:scale-[1.02] transition-transform disabled:opacity-50"
                  >
                    {creatingModule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Saqlash
                  </button>
                  <button
                    onClick={() => { setAddModuleOpen(false); setNewModuleTitle(""); }}
                    className="flex items-center gap-2 rounded-xl glass-card px-4 py-3 text-sm font-semibold text-[color:var(--ink-soft)] hover:text-rose-600"
                  >
                    <X className="h-4 w-4" /> Bekor
                  </button>
                </div>
              )}
            </motion.div>

            {/* Modules + lessons */}
            {!course || course.modules.length === 0 ? (
              <div className="glass-card rounded-3xl p-10 text-center text-[color:var(--ink-soft)]">
                <BookOpen className="mx-auto mb-3 h-10 w-10" />
                Hozircha modullar yo&apos;q. Yuqoridagi tugma orqali birinchi modulni qo&apos;shing.
              </div>
            ) : (
              course.modules.map((m, mi) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(mi * 0.04, 0.2) }}
                  className="glass-card rounded-3xl p-5 sm:p-6 relative overflow-hidden group"
                >
                  {/* ticket notches */}
                  <div className="pointer-events-none absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[color:var(--background)] border border-black/5 shadow-inner hidden sm:block" />
                  <div className="pointer-events-none absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 translate-x-1/2 rounded-full bg-[color:var(--background)] border border-black/5 shadow-inner hidden sm:block" />
                  {/* Module header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 text-white font-extrabold text-sm shadow-lg">
                      {mi + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="section-eyebrow">Modul {mi + 1}</span>
                      {editingModuleId === m.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            autoFocus
                            value={editingModuleTitle}
                            onChange={(e) => setEditingModuleTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdateModule(m.id);
                              if (e.key === "Escape") setEditingModuleId(null);
                            }}
                            className="flex-1 glass-card rounded-xl px-3 py-1.5 text-sm text-[color:var(--emerald-deep)] outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <button onClick={() => handleUpdateModule(m.id)} className="rounded-lg bg-indigo-600 p-1.5 text-white" title="Saqlash">
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditingModuleId(null)} className="rounded-lg bg-rose-500 p-1.5 text-white" title="Bekor">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <h2 className="text-xl font-extrabold text-[color:var(--emerald-deep)]">{m.title}</h2>
                      )}
                    </div>
                    <span className="glass-pill text-xs font-bold text-[color:var(--emerald-deep)] shrink-0">
                      {m.lessons.length} dars
                    </span>
                    <button
                      onClick={() => { setEditingModuleId(m.id); setEditingModuleTitle(m.title); }}
                      className="rounded-lg glass-card p-2 text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]"
                      title="Modul nomini tahrirlash"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteModule(m.id)} className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-rose-700 hover:bg-rose-100" title="Modulni o'chirish">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Lessons list — ALWAYS visible, expanded by default */}
                  <div className="space-y-2">
                    {m.lessons.map((l, li) => {
                      const sections = parseSections(l.content || "");
                      const preview = previewText(l.content, 120);
                      const isEditing = editingLessonId === l.id;

                      if (isEditing) {
                        return (
                          <motion.div
                            key={l.id}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-2xl bg-white ring-2 ring-indigo-300 shadow-xl overflow-hidden"
                          >
                            {/* Edit header */}
                            <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-teal-600 px-4 py-3">
                              <Pencil className="h-4 w-4 text-white" />
                              <span className="text-sm font-bold text-white">Darsni tahrirlash</span>
                              <div className="ml-auto flex gap-1.5">
                                <button
                                  onClick={handleUpdateLesson}
                                  disabled={savingLesson || !editTitle.trim()}
                                  className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 disabled:opacity-50"
                                >
                                  {savingLesson ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                  Saqlash
                                </button>
                                <button
                                  onClick={() => setEditingLessonId(null)}
                                  className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
                                >
                                  <X className="h-3.5 w-3.5" /> Bekor
                                </button>
                              </div>
                            </div>

                            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                              {/* Title field */}
                              <div>
                                <label className="text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">
                                  Dars sarlavhasi *
                                </label>
                                <input
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="mt-1 w-full glass-card rounded-xl px-4 py-2.5 text-sm font-semibold text-[color:var(--emerald-deep)] outline-none focus:ring-2 focus:ring-amber-400"
                                />
                              </div>

                              {/* Video URL */}
                              <div>
                                <label className="text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">
                                  Video URL (ixtiyoriy)
                                </label>
                                <input
                                  value={editVideoUrl}
                                  onChange={(e) => setEditVideoUrl(e.target.value)}
                                  placeholder="https://... (HLS yoki mp4)"
                                  className="mt-1 w-full glass-card rounded-xl px-4 py-2 text-sm text-[color:var(--emerald-deep)] outline-none focus:ring-2 focus:ring-amber-400"
                                />
                              </div>

                              {/* Sections — structured rows */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">
                                    <FileText className="inline h-3.5 w-3.5 mr-1" />
                                    Bo&apos;limlar ({editSections.length})
                                  </label>
                                  <button
                                    onClick={addEditSection}
                                    className="flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Bo&apos;lim qo&apos;shish
                                  </button>
                                </div>

                                <div className="space-y-3">
                                  <AnimatePresence>
                                    {editSections.map((sec, idx) => (
                                      <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        className="rounded-xl bg-amber-50/40 ring-1 ring-amber-300/50 p-3"
                                      >
                                        <div className="flex items-center gap-2 mb-2">
                                          <GripVertical className="h-4 w-4 text-amber-400 shrink-0" />
                                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider shrink-0">
                                            Bo&apos;lim {idx + 1}
                                          </span>
                                          <input
                                            value={sec.num}
                                            onChange={(e) => updateEditSection(idx, { num: e.target.value })}
                                            placeholder="№"
                                            className="w-12 rounded-lg bg-white/70 px-2 py-1 text-xs font-bold text-amber-800 outline-none focus:ring-2 focus:ring-amber-400"
                                          />
                                          <input
                                            value={sec.title}
                                            onChange={(e) => updateEditSection(idx, { title: e.target.value })}
                                            placeholder="Bo'lim sarlavhasi (masalan: Tarix)"
                                            className="flex-1 rounded-lg bg-white/70 px-3 py-1.5 text-sm font-semibold text-amber-900 placeholder:text-amber-400 outline-none focus:ring-2 focus:ring-amber-400"
                                          />
                                          <button
                                            onClick={() => removeEditSection(idx)}
                                            disabled={editSections.length === 1}
                                            className="rounded-lg bg-rose-50 border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-100 disabled:opacity-30"
                                            title="Bo'limni o'chirish"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                        <textarea
                                          value={sec.body}
                                          onChange={(e) => updateEditSection(idx, { body: e.target.value })}
                                          placeholder="Bo'lim matni..."
                                          rows={5}
                                          className="w-full rounded-lg bg-white/80 px-3 py-2 text-xs font-mono text-[color:var(--emerald-deep)] placeholder:text-amber-400 outline-none focus:ring-2 focus:ring-amber-400"
                                        />
                                        {sec.body.trim() && (
                                          <div className="mt-2 glass-card rounded-lg p-2.5 text-xs leading-relaxed max-h-32 overflow-y-auto">
                                            <p className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] font-bold mb-1 flex items-center gap-1">
                                              <Eye className="h-3 w-3" /> Oldindan ko&apos;rish
                                            </p>
                                            <div className="prose prose-sm max-w-none">
                                              <ReactMarkdown>{sec.body}</ReactMarkdown>
                                            </div>
                                          </div>
                                        )}
                                      </motion.div>
                                    ))}
                                  </AnimatePresence>
                                </div>
                              </div>

                              {/* Full lesson preview */}
                              {editSections.some((s) => s.body.trim() || s.title) && (
                                <details className="text-xs">
                                  <summary className="cursor-pointer font-bold text-amber-800 hover:text-amber-900">
                                    <Eye className="inline h-3.5 w-3.5 mr-1" />
                                    To&apos;liq dars oldindan ko&apos;rinishi
                                  </summary>
                                  <div className="mt-2 glass-card rounded-xl p-4 max-h-80 overflow-y-auto">
                                    <h3 className="text-base font-extrabold text-[color:var(--emerald-deep)] mb-3">{editTitle}</h3>
                                    <div className="prose prose-sm max-w-none">
                                      <ReactMarkdown>{serializeSections(editSections)}</ReactMarkdown>
                                    </div>
                                  </div>
                                </details>
                              )}
                            </div>
                          </motion.div>
                        );
                      }

                      // Normal lesson row
                      return (
                        <motion.div
                          key={l.id}
                          layout
                          className="flex items-center gap-3 rounded-xl bg-white/60 ring-1 ring-black/5 px-4 py-3 hover:ring-amber-300 hover:shadow-md transition-all"
                        >
                          <GripVertical className="h-4 w-4 text-amber-300 shrink-0" />
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white text-[10px] font-bold shadow">
                            {li + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[color:var(--emerald-deep)] truncate">{l.title}</p>
                            <p className="text-[10px] text-[color:var(--ink-soft)] mt-0.5 line-clamp-1">
                              {sections.length > 0
                                ? `${sections.length} bo'lim · ${preview}`
                                : `${(l.content?.length ?? 0).toLocaleString()} belgi`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => startEditLesson(l)}
                              className="flex items-center gap-1 rounded-lg glass-card px-2.5 py-1.5 text-xs font-semibold text-[color:var(--emerald-deep)] hover:bg-indigo-50"
                              title="Bo'limlar bo'yicha tahrirlash"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Tahrirlash
                            </button>
                            <button
                              onClick={() => handleDeleteLesson(l.id)}
                              className="rounded-lg bg-rose-50 border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-100"
                              title="O'chirish"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}

                    {/* Add lesson button */}
                    {addingLessonTo === m.id ? (
                      <AddLessonWizardModal
                        moduleId={m.id}
                        step={wizardStep}
                        title={wizardTitle}
                        sections={wizardSections}
                        videoUrl={wizardVideoUrl}
                        creating={creatingLesson}
                        onTitleChange={setWizardTitle}
                        onSectionsChange={setWizardSections}
                        onVideoUrlChange={setWizardVideoUrl}
                        onAddSection={addWizardSection}
                        onRemoveSection={removeWizardSection}
                        onUpdateSection={updateWizardSection}
                        onNext={() => setWizardStep((s) => Math.min(3, (s as number) + 1) as 1 | 2 | 3)}
                        onPrev={() => setWizardStep((s) => Math.max(1, (s as number) - 1) as 1 | 2 | 3)}
                        onCreate={async () => {
                          await handleCreateLesson();
                        }}
                        onCancel={() => { setAddingLessonTo(null); }}
                      />
                    ) : (
                      <button
                        onClick={() => startAddLesson(m.id)}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-amber-300/70 bg-amber-50/30 px-4 py-3 text-sm font-bold text-amber-800 hover:bg-amber-50 hover:border-amber-400 transition-colors"
                      >
                        <Plus className="h-4 w-4" /> Shu modulga yangi dars qo'shish
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </>
        )}

        {/* ===== TESTS SECTION (Darslar boshqaruvi ichida) ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card rounded-3xl p-5 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-lg">
                <ListChecks className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold text-[color:var(--emerald-deep)]">Testlar</h2>
                <p className="text-xs text-[color:var(--ink-soft)]">
                  Testlarni shu yerda boshqaring — ko'rish/yashirish (ko'z tugmasi) orqali foydalanuvchilarga ko'rsatish yoki yashirish.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="glass-pill text-xs font-bold text-[color:var(--emerald-deep)]">
                {tests.filter((t) => t.status === "active").length} ko'rinadi · {tests.length} jami
              </span>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--emerald-deep)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showHiddenTests}
                  onChange={(e) => setShowHiddenTests(e.target.checked)}
                  data-testid="show-hidden-toggle"
                  className="h-3.5 w-3.5 rounded border-neutral-300"
                />
                Yashirinlarni ko'rsatish
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--ink-soft)]" />
                <input
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  placeholder="Test qidirish..."
                  className="glass-card rounded-xl pl-8 pr-3 py-2 text-xs text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-amber-400 w-40"
                />
              </div>
              <Link
                href="/admin/lms/tests"
                className="flex items-center gap-1.5 rounded-xl glass-card px-3 py-2 text-xs font-semibold text-[color:var(--emerald-deep)] hover:-translate-y-0.5 transition-all"
                title="Barcha testlar sahifasi"
              >
                Boshqarish <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {testsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-2xl bg-white/50 ring-1 ring-black/5 animate-pulse" />
              ))}
            </div>
          ) : (() => {
            const q = testSearch.trim().toLowerCase();
            let visibleTests = q
              ? tests.filter((t) => t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q))
              : tests;
            // ko'z yopilganda (draft/archived) Darslar sahifasida korinmay qoladi — faqat ko'rinadiganlar
            if (!showHiddenTests) {
              visibleTests = visibleTests.filter((t) => t.status === "active");
            }
            if (visibleTests.length === 0) {
              const hiddenCount = tests.filter((t) => t.status !== "active").length;
              const hasHiddenFiltered = !showHiddenTests && hiddenCount > 0 && !q;
              return (
                <div className="rounded-2xl border-2 border-dashed border-amber-300/70 bg-amber-50/30 p-8 text-center text-[color:var(--ink-soft)]">
                  <ListChecks className="mx-auto mb-2 h-8 w-8 text-amber-400" />
                  <p className="text-sm font-semibold">
                    {q ? "Hech qanday test topilmadi" : hasHiddenFiltered ? `${hiddenCount} ta test yashirin — "Yashirinlarni ko'rsatish" ni yoqing` : "Hozircha testlar yo'q"}
                  </p>
                  {!q && (
                    <Link href="/admin/lms/tests" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:scale-[1.02] transition-transform">
                      <Plus className="h-3.5 w-3.5" /> Test yaratish
                    </Link>
                  )}
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibleTests.map((t) => {
                  const isActive = t.status === "active";
                  const statusMeta = isActive
                    ? { label: "KO'RINADI", className: "bg-emerald-100 text-emerald-700" }
                    : t.status === "archived"
                      ? { label: "ARXIV", className: "bg-amber-100 text-amber-700" }
                      : { label: "YASHIRIN", className: "bg-neutral-100 text-neutral-600" };
                  let assignedCount = 0;
                  try { assignedCount = JSON.parse(t.assignedUserIds || "[]").length; } catch {}
                  const isLimited = t.visibility === "selected";
                  const busy = togglingTestId === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`rounded-2xl bg-white/70 ring-1 p-4 flex flex-col gap-2.5 transition-all ${
                        isActive ? "ring-emerald-300/70 shadow-sm" : "ring-black/5 opacity-80"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded shrink-0 ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                        {isLimited && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 shrink-0">
                            {assignedCount} odam
                          </span>
                        )}
                        <button
                          onClick={() => toggleTestVisibility(t)}
                          disabled={busy}
                          className={`ml-auto shrink-0 rounded-lg p-2 transition-all disabled:opacity-50 ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                              : "bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200 hover:bg-neutral-200"
                          }`}
                          title={isActive ? "Yashirish — foydalanuvchilardan berkitish" : "Ko'rsatish — foydalanuvchilarga ochish"}
                          aria-label={isActive ? "Testni yashirish" : "Testni ko'rsatish"}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isActive ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[color:var(--emerald-deep)] line-clamp-2">{t.title}</p>
                        {t.description && (
                          <p className="text-[10px] text-[color:var(--ink-soft)] mt-0.5 line-clamp-1">{t.description}</p>
                        )}
                      </div>
                      <div className="mt-auto grid grid-cols-4 gap-1.5 text-center pt-2 border-t border-black/5">
                        <div>
                          <div className="flex items-center justify-center gap-0.5 text-[9px] font-bold text-[color:var(--ink-soft)] uppercase">
                            <Globe className="h-2.5 w-2.5" /> Tili
                          </div>
                          <div className="text-[11px] font-bold text-[color:var(--emerald-deep)]">{(t.language || "uz").toUpperCase()}</div>
                        </div>
                        <div>
                          <div className="flex items-center justify-center gap-0.5 text-[9px] font-bold text-[color:var(--ink-soft)] uppercase">
                            <HelpCircle className="h-2.5 w-2.5" /> Savol
                          </div>
                          <div className="text-[11px] font-bold text-[color:var(--emerald-deep)]">{t._count?.questions ?? 0}/{t.questionCount ?? 10}</div>
                        </div>
                        <div>
                          <div className="flex items-center justify-center gap-0.5 text-[9px] font-bold text-[color:var(--ink-soft)] uppercase">
                            <Clock className="h-2.5 w-2.5" /> Vaqt
                          </div>
                          <div className="text-[11px] font-bold text-[color:var(--emerald-deep)]">{t.timeLimit ? `${t.timeLimit}m` : "—"}</div>
                        </div>
                        <div>
                          <div className="flex items-center justify-center gap-0.5 text-[9px] font-bold text-[color:var(--ink-soft)] uppercase">
                            <Target className="h-2.5 w-2.5" /> Ball
                          </div>
                          <div className="text-[11px] font-bold text-[color:var(--emerald-deep)]">{t.passScore}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </motion.div>

        {/* Rules/Terms section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-3xl p-6 mt-6"
        >
          <h2 className="text-xl font-extrabold text-[color:var(--emerald-deep)] mb-4">Odob-axloq qoidalari</h2>
          <p className="text-sm text-[color:var(--ink-soft)] mb-6">
            Talabachilar uchun majburiy qoidalar. Har bir qoida raqami bilan belgilangan.
          </p>
          <div className="space-y-4">
            {rules.map((rule) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl bg-amber-50/40 ring-1 ring-amber-300/50 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <GripVertical className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider shrink-0">
                    {rule.num} - qoidasi
                  </span>
                  <button
                    onClick={() => setRules((s) => s.filter((r) => r.id !== rule.id))}
                    className="rounded-lg bg-rose-50 border border-rose-200 p-1 text-rose-700 hover:bg-rose-100 text-xs"
                    title="O'chirish"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">
                      Sarlavha *
                    </label>
                    <input
                      value={rule.title}
                      onChange={(e) =>
                        setRules((s) =>
                          s.map((r) => (r.id === rule.id ? { ...r, title: e.target.value } : r))
                        )
                      }
                      placeholder="Qoidaning sarlavhasi"
                      className="mt-1 w-full glass-card rounded-xl px-4 py-2.5 text-sm font-semibold text-[color:var(--emerald-deep)] outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">
                      Matn *
                    </label>
                    <textarea
                      value={rule.body}
                      onChange={(e) =>
                        setRules((s) =>
                          s.map((r) => (r.id === rule.id ? { ...r, body: e.target.value } : r))
                        )
                      }
                      placeholder="Qoidaning matni..."
                      rows={4}
                      className="w-full rounded-lg bg-white/80 px-3 py-2 text-xs font-mono text-[color:var(--emerald-deep)] placeholder:text-amber-400 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ===== FLAT VIEW ===== */}
        {viewMode === "flat" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl overflow-hidden">
            <div className="p-4 border-b border-white/20 flex items-center gap-3">
              <Search className="h-4 w-4 text-[color:var(--ink-soft)]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Dars yoki modul bo'yicha qidirish..."
                className="flex-1 bg-transparent text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none"
              />
              <span className="text-xs text-[color:var(--ink-soft)] shrink-0">
                {flatLessons.length} ta dars
              </span>
            </div>
            {flatLessons.length === 0 ? (
              <div className="p-10 text-center text-[color:var(--ink-soft)]">
                {searchQuery ? "Hech narsa topilmadi" : "Hozircha darslar yo'q"}
              </div>
            ) : (
              <div className="divide-y divide-white/10 max-h-[70vh] overflow-y-auto">
                {flatLessons.map(({ lesson: l, module: m, moduleIdx, lessonIdx }) => {
                  const sections = parseSections(l.content || "");
                  const preview = previewText(l.content, 160);
                  return (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[color:var(--emerald-deep)] truncate">{l.title}</p>
                        <p className="text-[10px] text-[color:var(--ink-soft)] mt-0.5">
                          <span className="font-semibold">{m.title}</span>
                          <span className="mx-1.5 text-amber-500">·</span>
                          {sections.length > 0 ? `${sections.length} bo'lim` : `${(l.content?.length ?? 0).toLocaleString()} belgi`}
                          <span className="mx-1.5 text-amber-500">·</span>
                          <span className="line-clamp-1">{preview}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => startEditLesson(l)}
                          className="flex items-center gap-1 rounded-lg glass-card px-2.5 py-1.5 text-xs font-semibold text-[color:var(--emerald-deep)] hover:bg-indigo-50"
                          title="Tahrirlash"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLesson(l.id)}
                          className="rounded-lg bg-rose-50 border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-100"
                          title="O'chirish"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Lesson edit modal */}
        <AnimatePresence>
          {editingLessonId && (
            <EditLessonModal
              title={editTitle}
              sections={editSections}
              videoUrl={editVideoUrl}
              saving={savingLesson}
              onTitleChange={setEditTitle}
              onSectionsChange={setEditSections}
              onVideoUrlChange={setEditVideoUrl}
              onAddSection={addEditSection}
              onRemoveSection={removeEditSection}
              onUpdateSection={updateEditSection}
              onSave={handleUpdateLesson}
              onClose={() => setEditingLessonId(null)}
            />
          )}
        </AnimatePresence>

        {/* Add lesson wizard modal */}
        <AnimatePresence>
          {addingLessonTo && (
            <AddLessonWizardModal
              moduleId={addingLessonTo}
              step={wizardStep}
              title={wizardTitle}
              sections={wizardSections}
              videoUrl={wizardVideoUrl}
              creating={creatingLesson}
              onTitleChange={setWizardTitle}
              onSectionsChange={setWizardSections}
              onVideoUrlChange={setWizardVideoUrl}
              onAddSection={addWizardSection}
              onRemoveSection={removeWizardSection}
              onUpdateSection={updateWizardSection}
              onNext={() => setWizardStep((s) => Math.min(3, (s as number) + 1) as 1 | 2 | 3)}
              onPrev={() => setWizardStep((s) => Math.max(1, (s as number) - 1) as 1 | 2 | 3)}
              onCreate={handleCreateLesson}
                        onCancel={() => { setAddingLessonTo(null); }}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

/* ===== Qoidalar (Rules/Terms) management ===== */

type Rule = {
  id: string;
  num: string;
  title: string;
  body: string;
};

type RulesState = Rule[];

const RULES_TEMPLATE: RulesState = [
  { id: crypto.randomUUID(), num: "26", title: "", body: "" },
];

const rulesDefaults = (): RulesState => [
  { id: crypto.randomUUID(), num: "26", title: "", body: "" },
  { id: crypto.randomUUID(), num: "27", title: "", body: "" },
  { id: crypto.randomUUID(), num: "28", title: "", body: "" },
];

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */

function EditLessonModal({
  title,
  sections,
  videoUrl,
  saving,
  onTitleChange,
  onSectionsChange,
  onVideoUrlChange,
  onAddSection,
  onRemoveSection,
  onUpdateSection,
  onSave,
  onClose,
}: {
  title: string;
  sections: Section[];
  videoUrl: string;
  saving: boolean;
  onTitleChange: (v: string) => void;
  onSectionsChange: (s: Section[]) => void;
  onVideoUrlChange: (v: string) => void;
  onAddSection: () => void;
  onRemoveSection: (idx: number) => void;
  onUpdateSection: (idx: number, patch: Partial<Section>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const fullContent = serializeSections(sections);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-5xl max-h-[90vh] overflow-y-auto glass-card rounded-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-black/5 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-extrabold text-[color:var(--emerald-deep)] flex items-center gap-2">
            <Pencil className="h-5 w-5" /> Darsni tahrirlash
          </h3>
          <button onClick={onClose} className="rounded-lg glass-card p-2 text-[color:var(--ink-soft)] hover:text-rose-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            {/* Left: edit fields */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">Sarlavha *</label>
                <input
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  className="mt-1 w-full glass-card rounded-xl px-4 py-2.5 text-sm font-semibold text-[color:var(--emerald-deep)] outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">Video URL (ixtiyoriy)</label>
                <input
                  value={videoUrl}
                  onChange={(e) => onVideoUrlChange(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full glass-card rounded-xl px-4 py-2 text-sm text-[color:var(--emerald-deep)] outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">
                    <FileText className="inline h-3.5 w-3.5 mr-1" /> Bo&apos;limlar ({sections.length})
                  </label>
                  <button
                    onClick={onAddSection}
                    className="flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                  >
                    <Plus className="h-3.5 w-3.5" /> Qo&apos;shish
                  </button>
                </div>
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  <AnimatePresence>
                    {sections.map((sec, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="rounded-xl bg-amber-50/40 ring-1 ring-amber-300/50 p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <GripVertical className="h-4 w-4 text-amber-400 shrink-0" />
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider shrink-0">
                            Bo&apos;lim {idx + 1}
                          </span>
                          <input
                            value={sec.num}
                            onChange={(e) => onUpdateSection(idx, { num: e.target.value })}
                            placeholder="№"
                            className="w-12 rounded-lg bg-white/70 px-2 py-1 text-xs font-bold text-amber-800 outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <input
                            value={sec.title}
                            onChange={(e) => onUpdateSection(idx, { title: e.target.value })}
                            placeholder="Sarlavha"
                            className="flex-1 rounded-lg bg-white/70 px-3 py-1.5 text-sm font-semibold text-amber-900 placeholder:text-amber-400 outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <button
                            onClick={() => onRemoveSection(idx)}
                            disabled={sections.length === 1}
                            className="rounded-lg bg-rose-50 border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-100 disabled:opacity-30"
                            title="O'chirish"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <textarea
                          value={sec.body}
                          onChange={(e) => onUpdateSection(idx, { body: e.target.value })}
                          placeholder="Matn..."
                          rows={6}
                          className="w-full rounded-lg bg-white/80 px-3 py-2 text-xs font-mono text-[color:var(--emerald-deep)] placeholder:text-amber-400 outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        {sec.body.trim() && (
                          <div className="mt-2 rounded-lg bg-white/60 p-2.5 text-xs leading-relaxed max-h-24 overflow-y-auto">
                            <ReactMarkdown>{sec.body}</ReactMarkdown>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Right: live preview */}
            <div className="glass-card rounded-2xl p-4 sticky top-20 self-start max-h-[calc(90vh-8rem)] overflow-y-auto">
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] font-bold mb-3 flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> Oldindan ko&apos;rish
              </p>
              {title.trim() ? (
                <>
                  <h3 className="text-lg font-extrabold text-[color:var(--emerald-deep)] mb-4">{title}</h3>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{fullContent || "*Bo'sh dars*"}</ReactMarkdown>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[color:var(--ink-soft)] italic">Sarlavha kiriting — oldindan ko&apos;rish shu yerda bo&apos;ladi.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-black/5 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="rounded-xl glass-card px-5 py-2.5 text-sm font-semibold text-[color:var(--ink-soft)]"
          >
            Bekor
          </button>
          <button
            onClick={onSave}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            O&apos;zgarishlarni saqlash
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AddLessonWizardModal({
  moduleId,
  step,
  title,
  sections,
  videoUrl,
  creating,
  onTitleChange,
  onSectionsChange,
  onVideoUrlChange,
  onAddSection,
  onRemoveSection,
  onUpdateSection,
  onNext,
  onPrev,
  onCreate,
  onCancel,
}: {
  moduleId: string;
  step: 1 | 2 | 3;
  title: string;
  sections: Section[];
  videoUrl: string;
  creating: boolean;
  onTitleChange: (v: string) => void;
  onSectionsChange: (s: Section[]) => void;
  onVideoUrlChange: (v: string) => void;
  onAddSection: () => void;
  onRemoveSection: (idx: number) => void;
  onUpdateSection: (idx: number, patch: Partial<Section>) => void;
  onNext: () => void;
  onPrev: () => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  const fullPreview = serializeSections(sections);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-card rounded-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-black/5 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-extrabold text-[color:var(--emerald-deep)]">Yangi dars qo&apos;shish</h3>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3].map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-white ${step >= s ? "bg-amber-600" : "bg-amber-300"}`}>
                    {step > s ? <Check className="h-3 w-3" /> : s}
                  </span>
                  {s === 1 && "Sarlavha"}
                  {s === 2 && "Bo'limlar"}
                  {s === 3 && "Tasdiqlash"}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onCancel} className="rounded-lg glass-card p-2 text-[color:var(--ink-soft)] hover:text-rose-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 1 && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-amber-900">Dars sarlavhasi *</label>
              <input
                autoFocus
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) onNext();
                }}
                placeholder="Masalan: 1-BOB. UMUMIY QOIDALAR"
                className="w-full glass-card rounded-xl px-4 py-3 text-sm text-[color:var(--emerald-deep)] placeholder:text-amber-400 outline-none focus:ring-2 focus:ring-amber-400"
              />
              {title.trim() && (
                <div className="glass-card rounded-xl p-3">
                  <p className="text-xs text-[color:var(--ink-soft)] mb-1">Oldindan ko&apos;rish:</p>
                  <p className="text-sm font-bold text-[color:var(--emerald-deep)]">{title}</p>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={onNext}
                  disabled={!title.trim()}
                  className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Keyingi <ChevronRight className="inline h-4 w-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-900">Bo&apos;limlar</label>
                <button
                  onClick={onAddSection}
                  className="flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Bo&apos;lim qo&apos;shish
                </button>
              </div>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                <AnimatePresence>
                  {sections.map((sec, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-xl bg-amber-50/40 ring-1 ring-amber-300/50 p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <GripVertical className="h-4 w-4 text-amber-400 shrink-0" />
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider shrink-0">
                          Bo&apos;lim {idx + 1}
                        </span>
                        <input
                          value={sec.num}
                          onChange={(e) => onUpdateSection(idx, { num: e.target.value })}
                          placeholder="№"
                          className="w-12 rounded-lg bg-white/70 px-2 py-1 text-xs font-bold text-amber-800 outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <input
                          value={sec.title}
                          onChange={(e) => onUpdateSection(idx, { title: e.target.value })}
                          placeholder="Sarlavha (masalan: Tarix)"
                          className="flex-1 rounded-lg bg-white/70 px-3 py-1.5 text-sm font-semibold text-amber-900 placeholder:text-amber-400 outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <button
                          onClick={() => onRemoveSection(idx)}
                          disabled={sections.length === 1}
                          className="rounded-lg bg-rose-50 border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-100 disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <textarea
                        value={sec.body}
                        onChange={(e) => onUpdateSection(idx, { body: e.target.value })}
                        placeholder="Bo'lim matni..."
                        rows={5}
                        className="w-full rounded-lg bg-white/80 px-3 py-2 text-xs font-mono text-[color:var(--emerald-deep)] placeholder:text-amber-400 outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      {sec.body.trim() && (
                        <div className="mt-2 rounded-lg bg-white/60 p-2.5 text-xs leading-relaxed max-h-28 overflow-y-auto">
                          <ReactMarkdown>{sec.body}</ReactMarkdown>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="flex justify-between">
                <button onClick={onPrev} className="rounded-xl glass-card px-4 py-2.5 text-sm font-semibold text-[color:var(--ink-soft)]">
                  <ChevronLeft className="inline h-4 w-4 mr-1" /> Orqaga
                </button>
                <button
                  onClick={onNext}
                  disabled={sections.length === 0 || sections.every((s) => !s.body.trim() && !(s.title ?? "").trim())}
                  className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Keyingi <ChevronRight className="inline h-4 w-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-amber-900">Video havolasi (ixtiyoriy)</label>
                <input
                  value={videoUrl}
                  onChange={(e) => onVideoUrlChange(e.target.value)}
                  placeholder="https://... (HLS yoki mp4)"
                  className="mt-1 w-full glass-card rounded-xl px-4 py-2.5 text-sm text-[color:var(--emerald-deep)] outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="glass-card rounded-xl p-4 space-y-1">
                <p><span className="font-bold">Sarlavha:</span> {title}</p>
                <p><span className="font-bold">Bo&apos;limlar:</span> {sections.length}</p>
                {videoUrl && <p className="truncate"><span className="font-bold">Video:</span> {videoUrl}</p>}
              </div>
              <div className="glass-card rounded-2xl p-4 max-h-80 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] font-bold mb-3">To&apos;liq ko&apos;rinish</p>
                <h3 className="text-base font-extrabold text-[color:var(--emerald-deep)] mb-3">{title}</h3>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{fullPreview || "*Bo'sh dars*"}</ReactMarkdown>
                </div>
              </div>
              <div className="flex justify-between">
                <button onClick={onPrev} className="rounded-xl glass-card px-4 py-2.5 text-sm font-semibold text-[color:var(--ink-soft)]">
                  <ChevronLeft className="inline h-4 w-4 mr-1" /> Orqaga
                </button>
                <button
                  onClick={onCreate}
                  disabled={creating || !title.trim()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Yaratish
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}