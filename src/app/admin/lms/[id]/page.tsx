"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  Copy,
  MoreVertical,
  X,
  Loader2,
  FileText,
  HelpCircle,
  BookOpen,
  Lock,
  ChevronDown,
  ChevronRight,
  Users,
  Settings,
  ListChecks,
  Save,
  Eye,
  GripVertical,
} from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

type Module = {
  id: string;
  title: string;
  description?: string;
  viewOrder: string;
  order: number;
  lessons: Lesson[];
  tests: Test[];
};

type Lesson = {
  id: string;
  title: string;
  content: string;
  videoUrl?: string;
  pdfUrl?: string;
  duration: number;
  order: number;
  language: string;
  isHomework: boolean;
};

type Test = {
  id: string;
  title: string;
  description?: string;
  timeLimit: number;
  passScore: number;
  courseStatus: string;
  _count?: { questions: number };
};

type Course = {
  id: string;
  title: string;
  description?: string;
  language: string;
  coverColor: string;
  courseStatus: string;
  modules: Module[];
};

type Tab = "content" | "participants" | "settings";

const VIEW_ORDER_OPTIONS = [
  { value: "open", label: "Ochiq", desc: "Foydalanuvchilar darslarni istalgan tartibda ko'rishlari mumkin" },
  { value: "closed", label: "Yopiq", desc: "Darslar oldingilari tugatilgandan so'ng ketma-ket ochiladi" },
  { value: "scheduled", label: "Jadval bo'yicha", desc: "Darslar belgilangan sana va vaqtda qat'iy ochiladi" },
  { value: "limited", label: "Cheklangan", desc: "Darslarga kirish ochilgandan so'ng vaqt bo'yicha cheklangan" },
];

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "QORALAMA", className: "bg-neutral-100 text-neutral-700" },
  active: { label: "FAOL", className: "bg-indigo-100 text-indigo-700" },
  archived: { label: "ARXIV", className: "bg-amber-100 text-amber-700" },
};

export default function AdminCourseDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { data: session, status } = useSession();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("content");
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Modals
  const [showAddModule, setShowAddModule] = useState(false);
  const [showAddLesson, setShowAddLesson] = useState<string | null>(null);
  const [showAddTest, setShowAddTest] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  // Escape barcha modallarni yopadi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showAddTest) setShowAddTest(null);
      else if (showAddLesson) setShowAddLesson(null);
      else if (showAddModule) setShowAddModule(false);
      else if (actionMenu) setActionMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Forms
  const [submitting, setSubmitting] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: "", viewOrder: "open" });
  const [lessonForm, setLessonForm] = useState({ title: "", content: "", isHomework: false });
  const [testForm, setTestForm] = useState({ title: "", description: "", timeLimit: 0, passScore: 60 });
  // Test import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors?: string[]; total: number } | null>(null);

  // Reorder state
  const [reordering, setReordering] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    title: "",
    description: "",
    language: "",
    coverColor: "",
    status: "",
  });

  useEffect(() => {
    if (course) {
      setSettingsForm({
        title: course.title,
        description: course.description || "",
        language: course.language,
        coverColor: course.coverColor,
        status: course.courseStatus,
      });
    }
  }, [course]);

  const handleSaveSettings = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/admin/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      fetchCourse();
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcelImport = async (testId: string, file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("testId", testId);
      const res = await fetch("/api/admin/questions/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.ok) {
        setImportResult({ created: data.created, errors: data.errors, total: data.total });
        fetchCourse();
      }
    } finally {
      setImporting(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const fetchCourse = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/courses/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setCourse(data.course);
        // Auto-expand all modules
        setExpandedModules(new Set(data.course.modules.map((m: Module) => m.id)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id && status === "authenticated") fetchCourse();
  }, [id, status, fetchCourse]);

  const handleAddModule = async () => {
    if (!moduleForm.title.trim()) return;
    setSubmitting(true);
    try {
      const order = course?.modules.length ?? 0;
      const res = await fetch("/api/admin/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: id, ...moduleForm, order }),
      });
      if (res.ok) {
        setShowAddModule(false);
        setModuleForm({ title: "", viewOrder: "open" });
        fetchCourse();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLesson = async () => {
    if (!lessonForm.title.trim() || !showAddLesson) return;
    setSubmitting(true);
    try {
      const mod = course?.modules.find((m) => m.id === showAddLesson);
      const order = mod?.lessons.length ?? 0;
      const res = await fetch("/api/admin/lessons-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: showAddLesson,
          ...lessonForm,
          order,
          language: course?.language || "uz",
        }),
      });
      if (res.ok) {
        setShowAddLesson(null);
        setLessonForm({ title: "", content: "", isHomework: false });
        fetchCourse();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTest = async () => {
    if (!testForm.title.trim() || !showAddTest) return;
    setSubmitting(true);
    try {
      const mod = course?.modules.find((m) => m.id === showAddTest);
      const order = mod?.tests.length ?? 0;
      const res = await fetch("/api/admin/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...testForm,
          moduleId: showAddTest,
          courseId: id,
          order,
          language: course?.language || "uz",
        }),
      });
      if (res.ok) {
        setShowAddTest(null);
        setTestForm({ title: "", description: "", timeLimit: 0, passScore: 60 });
        fetchCourse();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm("Modulni o'chirishni xohlaysizmi? Ichidagi darslar ham o'chiriladi.")) return;
    await fetch(`/api/admin/modules/${moduleId}`, { method: "DELETE" });
    fetchCourse();
    setActionMenu(null);
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm("Darsni o'chirishni xohlaysizmi?")) return;
    await fetch(`/api/admin/lessons-v2/${lessonId}`, { method: "DELETE" });
    fetchCourse();
    setActionMenu(null);
  };

  const handleDeleteTest = async (testId: string) => {
    if (!confirm("Testni o'chirishni xohlaysizmi?")) return;
    await fetch(`/api/admin/tests/${testId}`, { method: "DELETE" });
    fetchCourse();
    setActionMenu(null);
  };

  const handleModulesDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !course) return;
    const oldIndex = course.modules.findIndex((m) => m.id === active.id);
    const newIndex = course.modules.findIndex((m) => m.id === over.id);
    const newModules = arrayMove(course.modules, oldIndex, newIndex);
    setCourse({ ...course, modules: newModules });
    setReordering(true);
    try {
      await fetch("/api/admin/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: id,
          orderedIds: newModules.map((m) => m.id),
        }),
      });
    } finally {
      setReordering(false);
    }
  };

  const handleLessonsDragEnd = async (moduleId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !course) return;
    const mod = course.modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const oldIndex = mod.lessons.findIndex((l) => l.id === active.id);
    const newIndex = mod.lessons.findIndex((l) => l.id === over.id);
    const newLessons = arrayMove(mod.lessons, oldIndex, newIndex);
    const newModules = course.modules.map((m) =>
      m.id === moduleId ? { ...m, lessons: newLessons } : m
    );
    setCourse({ ...course, modules: newModules });
    setReordering(true);
    try {
      await fetch("/api/admin/lessons/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          orderedIds: newLessons.map((l) => l.id),
        }),
      });
    } finally {
      setReordering(false);
    }
  };

  if (status !== "authenticated" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-500">Kurs topilmadi</p>
      </div>
    );
  }

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const totalTests = course.modules.reduce((acc, m) => acc + m.tests.length, 0);
  const courseStatus = STATUS_LABELS[course.courseStatus] || STATUS_LABELS.draft;

  return (
    <div className="flex bg-transparent min-h-screen">
      <AdminSidebar />

      <main className="flex-1 min-w-0">
        {/* Breadcrumb + Title */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-neutral-200">
          <div className="px-8 py-3 flex items-center gap-2 text-sm">
            <button onClick={() => router.push("/admin/lms")} className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900">
              <ArrowLeft className="w-4 h-4" />
              Kurslar
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-semibold text-neutral-900">{course.title}</span>
          </div>
        </div>

        {/* Cover */}
        <div className={`relative h-40 bg-gradient-to-br ${course.coverColor}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent)]" />
        </div>

        {/* Course Info Card */}
        <div className="px-8 -mt-16 relative">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 max-w-4xl">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/20 flex items-center justify-center shrink-0 shadow-lg">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded mb-2 ${courseStatus.className}`}>
                  {courseStatus.label}
                </span>
                <h1 className="text-2xl font-bold text-neutral-900 mb-1.5">{course.title}</h1>
                {course.description && (
                  <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{course.description}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-3">
                  <InfoStat label="TILI" value={course.language.toUpperCase()} />
                  <InfoStat label="VAQT" value="0 h 0 min" />
                  <InfoStat label="MODULLAR" value={course.modules.length} />
                  <InfoStat label="ELEMENTLAR" value={totalLessons + totalTests} />
                  <InfoStat label="TALABALAR" value={0} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8 mt-6">
          <div className="flex gap-1 border-b border-neutral-200">
            {[
              { key: "content", label: "Mundarija", icon: ListChecks },
              { key: "participants", label: "Qatnashchilar", icon: Users },
              { key: "settings", label: "Sozlamalar", icon: Settings },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as Tab)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    tab === t.key ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {tab === t.key && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Tab */}
        {tab === "content" && (
          <div className="px-8 py-6 max-w-5xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Kurs tuzilishi</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {course.modules.length} modullar · {totalLessons} darslar · {totalTests} testlar
                </p>
              </div>
              <button
                onClick={() => setShowAddModule(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700"
              >
                <Plus className="w-4 h-4" />
                Modul qo'shish
              </button>
            </div>

            {course.modules.length === 0 ? (
              <div className="text-center py-16 bg-white border-2 border-dashed border-neutral-200 rounded-2xl">
                <BookOpen className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                <h3 className="font-semibold text-neutral-900 mb-1">Birinchi modulni qo'shing</h3>
                <p className="text-sm text-neutral-500 mb-4">Kursni modullarga bo'lib, har biriga darslar qo'shing</p>
                <button
                  onClick={() => setShowAddModule(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Modul yaratish
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModulesDragEnd}>
                  <SortableContext items={course.modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                    {course.modules.map((mod, idx) => {
                      const isExpanded = expandedModules.has(mod.id);
                      return (
                        <SortableItem key={mod.id} id={mod.id}>
                          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                            <div
                              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-neutral-50"
                              onClick={() => {
                                const next = new Set(expandedModules);
                                if (isExpanded) next.delete(mod.id);
                                else next.add(mod.id);
                                setExpandedModules(next);
                              }}
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-neutral-500" /> : <ChevronRight className="w-4 h-4 text-neutral-500" />}
                              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                {String(idx + 1).padStart(2, "0")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-neutral-900">{mod.title}</div>
                                <div className="text-xs text-neutral-500 mt-0.5">
                                  {mod.lessons.length + mod.tests.length} element ·{" "}
                                  {VIEW_ORDER_OPTIONS.find((o) => o.value === mod.viewOrder)?.label}
                                </div>
                              </div>
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenu(actionMenu === mod.id ? null : mod.id);
                                  }}
                                  className="p-1.5 rounded-md hover:bg-neutral-100"
                                >
                                  <MoreVertical className="w-4 h-4 text-neutral-500" />
                                </button>
                                {actionMenu === mod.id && (
                                  <div className="absolute right-0 top-9 z-20 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 w-44">
                                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50">
                                      <Edit3 className="w-3.5 h-3.5" /> Tahrirlash
                                    </button>
                                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50">
                                      <Copy className="w-3.5 h-3.5" /> Takrorlash
                                    </button>
                                    <button
                                      onClick={() => handleDeleteModule(mod.id)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Modulni o'chirish
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="border-t border-neutral-100 p-2 space-y-1">
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleLessonsDragEnd(mod.id, e)}>
                                  <SortableContext items={mod.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                                    {mod.lessons.map((l, lidx) => (
                                      <SortableItem key={l.id} id={l.id}>
                                        <div className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-neutral-50">
                                          <div className="w-8 h-8 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center">
                                            <FileText className="w-4 h-4" />
                                          </div>
                                          <span className="text-xs font-mono text-neutral-400 w-6">
                                            {String(lidx + 1).padStart(2, "0")}
                                          </span>
                                          <span className="text-sm font-medium text-neutral-800 flex-1">{l.title}</span>
                                          {l.isHomework && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">UY VAZIFA</span>}
                                          <Lock className="w-3.5 h-3.5 text-indigo-500" />
                                        </div>
                                      </SortableItem>
                                    ))}
                                  </SortableContext>
                                </DndContext>
                                {mod.tests.map((t, tidx) => (
                                  <div key={t.id} className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-neutral-50">
                                    <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                                      <HelpCircle className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-mono text-neutral-400 w-6">
                                      {String(mod.lessons.length + tidx + 1).padStart(2, "0")}
                                    </span>
                                    <span className="text-sm font-medium text-neutral-800 flex-1">{t.title}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                                      TEST · {t._count?.questions ?? 0} savol
                                    </span>
                                    <button
                                      onClick={() => handleDeleteTest(t.id)}
                                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 text-rose-600"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                                <div className="flex items-center gap-1 pt-2">
                                  <button
                                    onClick={() => setShowAddLesson(mod.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Dars qo'shish
                                  </button>
                                  <button
                                    onClick={() => setShowAddTest(mod.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Test qo'shish
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </SortableItem>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        )}

        {/* Participants Tab */}
        {tab === "participants" && (
          <div className="px-8 py-6 max-w-5xl">
            <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-1">Qatnashchilar yo'q</h3>
              <p className="text-sm text-neutral-500">Bu kursga hali hech kim tayinlanmagan</p>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === "settings" && (
          <div className="px-8 py-6 max-w-3xl space-y-4">
            <SettingsCard title="Kurs ma'lumotlari">
              <Field label="Kurs nomi">
                <input
                  value={settingsForm.title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
                />
              </Field>
              <Field label="Tavsif">
                <textarea
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg resize-none"
                />
              </Field>
              <Field label="Kurs tili">
                <select
                  value={settingsForm.language}
                  onChange={(e) => setSettingsForm({ ...settingsForm, language: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
                >
                  <option value="uz">O'zbek</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="Holat">
                <select
                  value={settingsForm.status}
                  onChange={(e) => setSettingsForm({ ...settingsForm, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
                >
                  <option value="draft">Qoralama</option>
                  <option value="active">Faol</option>
                  <option value="archived">Arxiv</option>
                </select>
              </Field>
            </SettingsCard>

            <SettingsCard title="Rang">
              <div className="flex flex-wrap gap-2">
                {[
                  "from-indigo-900 to-teal-950",
                  "from-rose-900 to-pink-950",
                  "from-blue-900 to-indigo-950",
                  "from-violet-900 to-purple-950",
                  "from-orange-900 to-red-950",
                ].map((c) => (
                  <button
                    key={c}
                    onClick={() => setSettingsForm({ ...settingsForm, coverColor: c })}
                    className={`h-12 w-20 rounded-lg bg-gradient-to-br ${c} ${
                      settingsForm.coverColor === c ? "ring-2 ring-neutral-900 ring-offset-2" : ""
                    }`}
                  />
                ))}
              </div>
            </SettingsCard>

            <div className="flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {submitting ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showAddModule && (
          <Modal title="Yangi modul" subtitle="Yangi o'quv kursi modulining parametrlarini kiriting" onClose={() => setShowAddModule(false)}>
            <div className="space-y-4">
              <Field label="Nomi">
                <input
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  placeholder="Nomi"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </Field>
              <Field label="Ko'rish tartibi">
                <select
                  value={moduleForm.viewOrder}
                  onChange={(e) => setModuleForm({ ...moduleForm, viewOrder: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
                >
                  {VIEW_ORDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} — {o.desc}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowAddModule(false)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">
                Bekor qilish
              </button>
              <button
                onClick={handleAddModule}
                disabled={submitting || !moduleForm.title.trim()}
                className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700 disabled:opacity-50"
              >
                Modul yaratish
              </button>
            </div>
          </Modal>
        )}

        {showAddLesson && (
          <Modal title="Yangi dars" subtitle="Modulga yangi dars qo'shing" onClose={() => setShowAddLesson(null)}>
            <div className="space-y-4">
              <Field label="Dars nomi">
                <input
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  placeholder="Masalan: 01. Kirish"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
                />
              </Field>
              <Field label="Kontent (Markdown)">
                <textarea
                  value={lessonForm.content}
                  onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                  placeholder="# Dars matni&#10;&#10;Bu yerda darsning asosiy mazmuni bo'ladi..."
                  rows={6}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono resize-none"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={lessonForm.isHomework}
                  onChange={(e) => setLessonForm({ ...lessonForm, isHomework: e.target.checked })}
                  className="rounded"
                />
                <span>Bu uy vazifasi</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowAddLesson(null)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">
                Bekor qilish
              </button>
              <button
                onClick={handleAddLesson}
                disabled={submitting || !lessonForm.title.trim()}
                className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700 disabled:opacity-50"
              >
                Dars yaratish
              </button>
            </div>
          </Modal>
        )}

        {showAddTest && (
          <Modal title="Yangi test" subtitle="Modulga yangi test qo'shing" onClose={() => { setShowAddTest(null); setImportResult(null); }}>
            <div className="space-y-4">
              <Field label="Test nomi">
                <input
                  value={testForm.title}
                  onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                  placeholder="Masalan: TEST-01"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
                />
              </Field>
              <Field label="Tavsif">
                <textarea
                  value={testForm.description}
                  onChange={(e) => setTestForm({ ...testForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg resize-none"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vaqt (min)">
                  <input
                    type="number"
                    value={testForm.timeLimit}
                    onChange={(e) => setTestForm({ ...testForm, timeLimit: parseInt(e.target.value) || 0 })}
                    placeholder="0 = cheksiz"
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
                  />
                </Field>
                <Field label="O'tish bali (%)">
                  <input
                    type="number"
                    value={testForm.passScore}
                    onChange={(e) => setTestForm({ ...testForm, passScore: parseInt(e.target.value) || 60 })}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
                  />
                </Field>
              </div>

              {/* Excel Import */}
              <div className="border border-dashed border-neutral-300 rounded-xl p-4 bg-neutral-50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">Excel fayldan import</p>
                    <p className="text-xs text-neutral-500">Test savollarini avtomatik yuklash</p>
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs text-neutral-600 mb-1 block">Fayl formati: Savol, A, B, C, D, E, Javob</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      // Avval testni yaratish kerak
                      if (!testForm.title.trim()) {
                        alert("Avval test nomini kiriting!");
                        return;
                      }
                      setSubmitting(true);
                      try {
                        const mod = course?.modules.find((m) => m.id === showAddTest);
                        const order = mod?.tests.length ?? 0;
                        const res = await fetch("/api/admin/tests", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            ...testForm,
                            moduleId: showAddTest,
                            courseId: id,
                            order,
                            language: course?.language || "uz",
                          }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setShowAddTest(null);
                          setTestForm({ title: "", description: "", timeLimit: 0, passScore: 60 });
                          // Import qilish
                          await handleExcelImport(data.test.id, file);
                        }
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    className="block w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neutral-900 file:text-white hover:file:bg-neutral-800 cursor-pointer"
                  />
                </label>
              </div>

              {/* Import natijasi */}
              {importResult && (
                <div className={`rounded-lg p-3 text-sm ${importResult.errors ? "bg-amber-50 border border-amber-200" : "bg-emerald-50 border border-emerald-200"}`}>
                  <p className="font-semibold">{importResult.created}/{importResult.total} savol import qilindi</p>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <ul className="mt-2 text-xs text-amber-700 space-y-0.5">
                      {importResult.errors.slice(0, 5).map((err, i) => <li key={i}>• {err}</li>)}
                      {importResult.errors.length > 5 && <li>...va {importResult.errors.length - 5} ta xato</li>}
                    </ul>
                  )}
                </div>
              )}

              <p className="text-xs text-neutral-500">Excel ustunlari: Savol (question), A, B, C, D, E, Javob (A/B/C/D)</p>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowAddTest(null); setImportResult(null); }} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">
                Bekor qilish
              </button>
              <button
                onClick={handleAddTest}
                disabled={submitting || !testForm.title.trim()}
                className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700 disabled:opacity-50"
              >
                Test yaratish
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold text-neutral-900 mt-0.5">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
      <label className="text-sm font-medium text-neutral-700 text-right">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <h3 className="font-semibold text-sm text-neutral-900 mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-neutral-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
            {subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-center">
        <button {...listeners} className="p-1 cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="w-4 h-4 text-neutral-300 hover:text-neutral-500" />
        </button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

