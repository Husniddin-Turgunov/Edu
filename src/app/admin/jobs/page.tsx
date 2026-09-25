"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  BookOpen,
  GraduationCap,
  Trash2,
  Edit3,
  Eye,
  Layers,
  X,
  Loader2,
  Save,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { AdminSidebar, AdminHeader } from "@/components/admin/AdminSidebar";
import { TicketCard, TicketBadge } from "@/components/akela/TicketCard";
import Link from "next/link";

const COLOR_GRADIENTS = [
  "from-indigo-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-lime-500 to-indigo-600",
  "from-fuchsia-500 to-pink-600",
  "from-cyan-500 to-blue-600",
];
function pickColor(i: number) {
  return COLOR_GRADIENTS[i % COLOR_GRADIENTS.length];
}

type Job = {
  id: string;
  folder: string;
  title: string;
  slug: string;
  hasNormative: boolean;
  parts: { title: string; type: string; days: any[] }[];
};

export default function AdminJobsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", slug: "", hasNormative: true });
  const [creating, setCreating] = useState(false);

  // edit modal
  const [editing, setEditing] = useState<Job | null>(null);
  const [editForm, setEditForm] = useState({ title: "", slug: "", folder: "", hasNormative: true });
  const [saving, setSaving] = useState(false);

  const showToast = useCallback((kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") router.push("/dashboard");
  }, [status, session, router]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/jobs", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setJobs(data.jobs);
      else showToast("err", data.error || "Yuklab bo'lmadi");
    } catch (e) {
      showToast("err", "Tarmoq xatosi");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (status === "authenticated") fetchJobs();
  }, [status, fetchJobs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter((j) => j.title.toLowerCase().includes(q) || j.slug.toLowerCase().includes(q) || j.folder.toLowerCase().includes(q));
  }, [jobs, search]);

  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      showToast("err", "Nom kiriting");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("ok", "Yangi kasb qo'shildi");
        setShowCreate(false);
        setCreateForm({ title: "", slug: "", hasNormative: true });
        fetchJobs();
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Tarmoq xatosi");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (job: Job) => {
    setEditing(job);
    setEditForm({ title: job.title, slug: job.slug, folder: job.folder, hasNormative: job.hasNormative });
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (!editForm.title.trim()) {
      showToast("err", "Nom kiriting");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/jobs/${editing.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("ok", "Saqlab qoldi");
        setEditing(null);
        fetchJobs();
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Tarmoq xatosi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (job: Job) => {
    if (!confirm(`"${job.title}" o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    try {
      const res = await fetch(`/api/admin/jobs/${job.slug}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        showToast("ok", "O'chirildi");
        fetchJobs();
      } else showToast("err", data.error || "Xatolik");
    } catch {
      showToast("err", "Tarmoq xatosi");
    }
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
        <AdminHeader
          title="Kasbiy kurslar"
          subtitle="30 ta kasb — /courses dagi ticket ko'rinishidagi barcha kurslarni shu yerdan boshqaring"
          action={
            <div className="flex items-center gap-2">
              <Link href="/courses" target="_blank" className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50">
                <Eye className="w-4 h-4" /> Saytda ko'rish
              </Link>
              <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700">
                <Plus className="w-4 h-4" /> Kasb qo'shish
              </button>
            </div>
          }
        />

        <div className="p-6 sm:p-8 max-w-[1600px]">
          {/* Stats + toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-neutral-900">{jobs.length} ta kasb</div>
                <div className="text-xs text-neutral-500">Jami kasbiy kurslar — ticket ko'rinishida</div>
              </div>
              <span className="ml-2 hidden sm:inline-flex rounded-full bg-white border border-neutral-200 px-3 py-1 text-xs font-bold text-neutral-700">
                {filtered.length} ko'rsatilmoqda
              </span>
            </div>

            <div className="flex-1 lg:ml-6 flex items-center gap-2">
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Kasb qidirish (masalan: Buxgalter, Sotuv...)"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>
              <Link href="/admin/onboarding" className="hidden md:flex items-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50">
                <BookOpen className="w-4 h-4" /> Tanishtiruv
              </Link>
              <Link href="/admin/lms" className="hidden md:flex items-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50">
                <Layers className="w-4 h-4" /> LMS
              </Link>
            </div>
          </div>

          {/* Info banner about ticket UI */}
          <div className="mb-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-4 flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white border border-violet-200 text-violet-600 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-sm">
              <p className="font-bold text-violet-900">Ticket ko'rinishi</p>
              <p className="text-violet-700/80 mt-0.5 leading-relaxed">
                Bu sahifadagi kartalar <span className="font-semibold">/courses</span> dagi kabi ticket (chipta) dizaynida — perforatsiya, dashed chiziq va shtrix-kod bilan. Foydalanuvchi ko'radi — admin shu yerda boshqaradi. Qolgan bo'limlar ham shu ticket uslubiga o'tkazildi.
              </p>
            </div>
            <Link href="/courses" className="ml-auto hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white border border-violet-200 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50">
              Kurslarni ko'rish <ArrowLeft className="h-3 w-3 rotate-180" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-56 bg-white border border-neutral-200 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white border-2 border-dashed border-neutral-200 rounded-3xl">
              <GraduationCap className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
              <h3 className="font-semibold text-neutral-900">Hech narsa topilmadi</h3>
              <p className="text-sm text-neutral-500 mt-1">Qidiruvni o'zgartiring yoki yangi kasb qo'shing</p>
              <button onClick={() => setShowCreate(true)} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 rounded-lg">
                <Plus className="w-4 h-4" /> Yangi kasb
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((job, i) => {
                const totalDays = job.parts.reduce((s, p) => s + (p.days?.length || 0), 0);
                const originalIndex = jobs.findIndex((j) => j.id === job.id);
                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  >
                    <TicketCard
                      gradient={pickColor(originalIndex + 2)}
                      icon={<BookOpen className="h-6 w-6" />}
                      numberLabel={String(originalIndex + 1).padStart(2, "0")}
                      topLeftBadge={<span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold text-neutral-600">#{job.id}</span>}
                      topRightLabel={`${totalDays} kun`}
                      title={job.title}
                      footer={
                        <>
                          <TicketBadge variant="emerald">5 kunlik</TicketBadge>
                          <TicketBadge variant="violet">30 kunlik</TicketBadge>
                          {job.hasNormative && <TicketBadge variant="amber">📊 Normativ</TicketBadge>}
                        </>
                      }
                      adminActions={
                        <>
                          <Link
                            href={`/courses/job/${job.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-lg bg-white border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                          >
                            <Eye className="h-3.5 w-3.5" /> Ko'rish
                          </Link>
                          <Link
                            href={`/admin/jobs/${job.slug}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                          >
                            <Layers className="h-3.5 w-3.5" /> Darslar
                          </Link>
                          <div
                            onClick={(e) => { e.stopPropagation(); startEdit(job); }}
                            className="inline-flex items-center gap-1 rounded-lg bg-white border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Tahrir
                          </div>
                          <div
                            onClick={(e) => { e.stopPropagation(); handleDelete(job); }}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </div>
                        </>
                      }
                      onClick={() => startEdit(job)}
                    />
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-500 px-1">
                      <span className="truncate">{job.folder}</span>
                      <span className="ml-auto font-mono text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded">{job.slug}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-5 py-3 shadow-2xl border-l-4 bg-white ${toast.kind === "ok" ? "border-indigo-500" : "border-rose-500"}`}
          >
            <p className={`text-sm font-bold ${toast.kind === "ok" ? "text-indigo-700" : "text-rose-700"}`}>{toast.msg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <Modal title="Yangi kasb qo'shish" subtitle="Kasbiy kurs — ticket ko'rinishida chiqadi" onClose={() => setShowCreate(false)}>
            <div className="space-y-4">
              <Field label="Kasb nomi *">
                <input
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Masalan: Buxgalter"
                  className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600"
                  autoFocus
                />
              </Field>
              <Field label="Slug (ixtiyoriy)">
                <input
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                  placeholder="buxgalter — bo'sh qolsa avto yaratiladi"
                  className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={createForm.hasNormative} onChange={(e) => setCreateForm({ ...createForm, hasNormative: e.target.checked })} className="rounded" />
                Normativ bor (📊)
              </label>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                Ticket oldindan ko'rinishi: <span className="font-bold">{createForm.title || "Yangi kasb"}</span> — 5 kunlik + 30 kunlik darslar avtomatik yaratiladi, keyin ichiga dars qo'shishingiz mumkin.
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">
                Bekor
              </button>
              <button onClick={handleCreate} disabled={creating || !createForm.title.trim()} className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />} Yaratish
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editing && (
          <Modal title="Kasbni tahrirlash" subtitle={`#${editing.id} — ${editing.title}`} onClose={() => setEditing(null)}>
            <div className="space-y-4">
              <Field label="Kasb nomi *">
                <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600" />
              </Field>
              <Field label="Slug">
                <input value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600" />
              </Field>
              <Field label="Folder">
                <input value={editForm.folder} onChange={(e) => setEditForm({ ...editForm, folder: e.target.value })} className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.hasNormative} onChange={(e) => setEditForm({ ...editForm, hasNormative: e.target.checked })} className="rounded" />
                Normativ bor
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg">
                Bekor
              </button>
              <button onClick={handleUpdate} disabled={saving || !editForm.title.trim()} className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:from-blue-800 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Saqlash
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3">
      <label className="text-sm font-medium text-neutral-700 text-right">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden">
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

