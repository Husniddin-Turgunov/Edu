"use client";

import { useEffect, useState, useCallback } from "react";
import { cachedFetch } from "@/lib/admin-cache";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  FolderPlus,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  X,
  Loader2,
  BookOpen,
  LayoutGrid,
  List as ListIcon,
  Users,
  FileText,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { AdminSidebar, AdminHeader } from "@/components/admin/AdminSidebar";

type Course = {
  id: string;
  title: string;
  description?: string;
  language: string;
  coverColor: string;
  status: string;
  isPublic: boolean;
  createdAt: string;
  modules?: any[];
  _count?: { modules: number };
};

type Folder = {
  id: string;
  name: string;
  color: string;
  _count?: { courses: number };
};

const COLORS = [
  { name: "Qizil", value: "#ef4444", className: "bg-rose-100 text-rose-600" },
  { name: "Yorqin", value: "#fb923c", className: "bg-orange-100 text-orange-600" },
  { name: "Sariq", value: "#facc15", className: "bg-amber-100 text-amber-600" },
  { name: "Yashil", value: "#4ade80", className: "bg-indigo-100 text-indigo-600" },
  { name: "Kulrang", value: "#9ca3af", className: "bg-neutral-100 text-neutral-600" },
  { name: "Moviy", value: "#60a5fa", className: "bg-sky-100 text-sky-600" },
  { name: "Binafsha", value: "#a78bfa", className: "bg-violet-100 text-violet-600" },
];

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "QORALAMA", className: "bg-neutral-100 text-neutral-700" },
  active: { label: "FAOL", className: "bg-indigo-100 text-indigo-700" },
  archived: { label: "ARXIV", className: "bg-amber-100 text-amber-700" },
};

const LANG_LABELS: Record<string, string> = { uz: "UZB", ru: "RUS", en: "ENG" };

export default function AdminLmsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterLang, setFilterLang] = useState<string>("all");

  // Modals
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  // Escape barcha modallarni yopadi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showCreateFolder) setShowCreateFolder(false);
      else if (showCreateCourse) setShowCreateCourse(false);
      else if (actionMenu) setActionMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Form
  const [courseForm, setCourseForm] = useState({ title: "", description: "", language: "uz" });
  const [folderForm, setFolderForm] = useState({ name: "", color: COLORS[0].value });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role === "user") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, f] = await Promise.all([
        cachedFetch("/api/admin/courses", { cache: "no-store" }).then((r) => r.json()),
        cachedFetch("/api/admin/folders", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (c.ok) setCourses(c.courses);
      if (f.ok) setFolders(f.folders);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  const handleCreateCourse = async () => {
    if (!courseForm.title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(courseForm),
      });
      const data = await res.json();
      if (data.ok) {
        setShowCreateCourse(false);
        setCourseForm({ title: "", description: "", language: "uz" });
        router.push(`/admin/lms/${data.course.id}`);
      } else {
        alert("Xato: " + data.error);
      }
    } catch (e) {
      alert("Tarmoq xatosi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderForm.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(folderForm),
      });
      const data = await res.json();
      if (data.ok) {
        setShowCreateFolder(false);
        setFolderForm({ name: "", color: COLORS[0].value });
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Kursni o'chirishni xohlaysizmi?")) return;
    await fetch(`/api/admin/courses/${id}`, { method: "DELETE" });
    fetchData();
    setActionMenu(null);
  };

  const filtered = courses.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchLang = filterLang === "all" || c.language === filterLang;
    return matchSearch && matchLang;
  });

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
        <AdminHeader
          title="Kurslar"
          subtitle="Barcha kurslarni boshqaring — yarating, tahrirlang, o'chiring"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateFolder(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50"
              >
                <FolderPlus className="w-4 h-4" />
                Papka yaratish
              </button>
              <button
                onClick={() => setShowCreateCourse(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700"
              >
                <Plus className="w-4 h-4" />
                Kurs yaratish
              </button>
            </div>
          }
        />

        <div className="p-8 max-w-[1600px]">
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Qidirish"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setFilterLang("all")}
                className={`px-3 py-2 text-xs font-semibold rounded-lg ${
                  filterLang === "all" ? "bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/20" : "bg-white border border-neutral-200 text-neutral-700"
                }`}
              >
                Barchasi
              </button>
              {["uz", "ru", "en"].map((l) => (
                <button
                  key={l}
                  onClick={() => setFilterLang(l)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg ${
                    filterLang === l ? "bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/20" : "bg-white border border-neutral-200 text-neutral-700"
                  }`}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-1 p-1 bg-white border border-neutral-200 rounded-lg">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded ${viewMode === "grid" ? "bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/20" : "text-neutral-600"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded ${viewMode === "list" ? "bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/20" : "text-neutral-600"}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Folders */}
          {folders.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">Papkalar</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {folders.map((f) => (
                  <div
                    key={f.id}
                    className="group flex items-center gap-3 p-4 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-sm cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: f.color + "22" }}>
                      <BookOpen className="w-5 h-5" style={{ color: f.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-neutral-900 truncate">{f.name}</div>
                      <div className="text-xs text-neutral-500">{f._count?.courses ?? 0} kurs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Courses */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">Kurslar</h2>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-56 bg-white border border-neutral-200 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 bg-white border-2 border-dashed border-neutral-200 rounded-2xl">
                <BookOpen className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                <h3 className="text-lg font-semibold text-neutral-900 mb-1">Hozircha kurslar yo'q</h3>
                <p className="text-sm text-neutral-500 mb-5">Birinchi kursni yarating va o'quvchilarga bilim ulashing</p>
                <button
                  onClick={() => setShowCreateCourse(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  Kurs yaratish
                </button>
              </div>
            ) : (
              <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
                {/* Create new card */}
                <button
                  onClick={() => setShowCreateCourse(true)}
                  className={`group bg-white border-2 border-dashed border-neutral-300 hover:border-blue-600 hover:bg-neutral-50 transition-colors ${
                    viewMode === "grid"
                      ? "min-h-[200px] flex flex-col items-center justify-center gap-3 p-6 rounded-2xl"
                      : "flex items-center gap-3 p-4 rounded-2xl"
                  }`}
                >
                  <div className={`rounded-full border-2 border-dashed border-neutral-300 group-hover:border-blue-600 flex items-center justify-center shrink-0 ${
                    viewMode === "grid" ? "w-14 h-14" : "w-10 h-10"
                  }`}>
                    <Plus className={`text-neutral-400 group-hover:text-neutral-900 ${viewMode === "grid" ? "w-6 h-6" : "w-5 h-5"}`} />
                  </div>
                  <div className={viewMode === "grid" ? "text-center" : "text-left"}>
                    <div className="font-semibold text-base text-neutral-900">Kurs yaratish</div>
                    <div className="text-xs text-neutral-500 mt-0.5">Yangi o'quv materiali</div>
                  </div>
                </button>

                {filtered.map((course) => {
                  const status = STATUS_LABELS[course.status] || STATUS_LABELS.draft;
                  const modulesCount = course._count?.modules ?? course.modules?.length ?? 0;
                  const lessonsCount = course.modules?.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0) ?? 0;
                  return (
                    <motion.div
                      key={course.id}
                      whileHover={{ y: -2 }}
                      className={`group relative bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:shadow-xl transition-shadow ${
                        viewMode === "list" ? "flex flex-row items-stretch" : ""
                      }`}
                    >
                      {/* ticket notches */}
                      <div className={`pointer-events-none absolute left-0 top-[7.5rem] h-5 w-5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-neutral-50 border border-neutral-200 z-10 ${viewMode === "list" ? "hidden" : "hidden sm:block"}`} />
                      <div className={`pointer-events-none absolute right-0 top-[7.5rem] h-5 w-5 -translate-y-1/2 translate-x-1/2 rounded-full bg-neutral-50 border border-neutral-200 z-10 ${viewMode === "list" ? "hidden" : "hidden sm:block"}`} />
                      {/* Cover */}
                      <div
                        onClick={() => router.push(`/admin/lms/${course.id}`)}
                        className={`relative bg-gradient-to-br ${course.coverColor} cursor-pointer shrink-0 ${
                          viewMode === "grid" ? "h-28" : "w-24 sm:w-32"
                        }`}
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.2),transparent)]" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenu(actionMenu === course.id ? null : course.id);
                          }}
                          className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 text-white opacity-0 group-hover:opacity-100 hover:bg-black/40 transition-opacity"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {actionMenu === course.id && (
                          <div className="absolute top-12 right-3 z-20 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 w-44">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/admin/lms/${course.id}`);
                                setActionMenu(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Tahrirlash
                            </button>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                              <Copy className="w-3.5 h-3.5" /> Takrorlash
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(course.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> O'chirish
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div
                        onClick={() => router.push(`/admin/lms/${course.id}`)}
                        className="p-4 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <h3 className={`font-bold text-neutral-900 ${viewMode === "grid" ? "text-base mb-1.5 line-clamp-2 min-h-[3rem]" : "text-sm mb-1 line-clamp-1"}`}>
                          {course.title}
                        </h3>
                        {course.description && (
                          <p className={`text-neutral-500 ${viewMode === "grid" ? "text-xs line-clamp-2 mb-3 min-h-[2rem]" : "text-xs line-clamp-1 mb-2"}`}>
                            {course.description}
                          </p>
                        )}
                        <div className={`grid grid-cols-4 gap-2 border-t border-dashed border-neutral-200 ${viewMode === "grid" ? "mt-3 pt-3" : "mt-1 pt-2"}`}>
                          <Stat icon={<BookOpen className="w-3 h-3" />} label="TILI" value={LANG_LABELS[course.language] || course.language.toUpperCase()} />
                          <Stat icon={<Users className="w-3 h-3" />} label="STUD." value={0} />
                          <Stat icon={<FileText className="w-3 h-3" />} label="MODUL" value={modulesCount} />
                          <Stat icon={<Sparkles className="w-3 h-3" />} label="ELEMENT" value={lessonsCount} />
                        </div>
                        {/* subtle barcode */}
                        <div className={`pointer-events-none flex items-center gap-[2px] opacity-[0.06] group-hover:opacity-10 transition-opacity ${viewMode === "grid" ? "mt-3" : "hidden"}`}>
                          {Array.from({ length: 20 }).map((_, i) => (
                            <div key={i} className={`h-4 bg-neutral-900 ${i % 3 === 0 ? "w-[2px]" : i % 2 === 0 ? "w-[2.5px]" : "w-[1px]"}`} />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Course Modal */}
      <AnimatePresence>
        {showCreateCourse && (
          <Modal title="Kurs yaratish" subtitle="Yangi material haqida asosiy ma'lumotlarni to'ldiring" onClose={() => setShowCreateCourse(false)}>
            <div className="space-y-4">
              <Field label="Kurs nomi">
                <input
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  placeholder="Kurs nomi"
                  className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </Field>
              <Field label="Kurs tavsifi">
                <textarea
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  placeholder="Kurs tavsifi"
                  rows={3}
                  className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600 resize-none"
                />
              </Field>
              <Field label="Kurs tili">
                <select
                  value={courseForm.language}
                  onChange={(e) => setCourseForm({ ...courseForm, language: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                >
                  <option value="uz">O'zbek</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateCourse(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg"
              >
                Orqaga
              </button>
              <button
                onClick={handleCreateCourse}
                disabled={submitting || !courseForm.title.trim()}
                className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Kurs yaratish
              </button>
            </div>
          </Modal>
        )}

        {showCreateFolder && (
          <Modal title="Papka yaratish" onClose={() => setShowCreateFolder(false)}>
            <div className="space-y-4">
              <Field label="Papka nomi">
                <input
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  placeholder="Masalan, Dizayn va Grafika"
                  className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </Field>
              <Field label="Rangli bezak">
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setFolderForm({ ...folderForm, color: c.value })}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                        folderForm.color === c.value
                          ? "ring-2 ring-neutral-900 ring-offset-2 scale-110"
                          : "hover:scale-105"
                      }`}
                      style={{ background: c.value + "33" }}
                    >
                      <div className="w-5 h-5 rounded" style={{ background: c.value }} />
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreateFolder(false)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">
                Bekor qilish
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={submitting || !folderForm.name.trim()}
                className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700 disabled:opacity-50"
              >
                Saqlash
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">
        {icon} {label}
      </div>
      <div className="text-sm font-bold text-neutral-900">{value}</div>
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
        exit={{ scale: 0.95, opacity: 0 }}
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

