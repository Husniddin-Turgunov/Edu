"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { AdminSidebar, AdminHeader } from "@/components/admin/AdminSidebar";
import { videoThumb } from "@/lib/video-thumb";
import {
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  X,
  Play,
  Clock,
  Tag,
  LayoutDashboard,
  Eye,
  EyeOff,
  Home,
  Check,
  Upload,
} from "lucide-react";

type Video = {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  size: string;
  url: string;
  poster?: string | null;
  isActive: boolean;
  showOnHome: boolean;
  homeOrder: number;
  createdAt: string;
};

// Sahifalar sxemasi: har bir sahifada slotlar, click-to-place
const PLACE_PAGES = [
  {
    key: "home", label: "Bosh sahifa", show: "showOnHome" as const, order: "homeOrder" as const,
    hint: "0 = katta pleer (Featured), 1-3 = kichik kartalar",
    slots: [
      { order: 0, label: "Featured (katta pleer)", className: "col-span-3 aspect-video" },
      { order: 1, label: "O'rin 1", className: "col-span-1 aspect-video" },
      { order: 2, label: "O'rin 2", className: "col-span-1 aspect-video" },
      { order: 3, label: "O'rin 3", className: "col-span-1 aspect-video" },
    ],
  },
  {
    key: "courses", label: "Kurslar", show: "showOnCourses" as const, order: "coursesOrder" as const,
    hint: "Kurslar sahifasidagi video polosa (ketma-ketlik bo'yicha)",
    slots: [
      { order: 0, label: "O'rin 1", className: "col-span-1 aspect-video" },
      { order: 1, label: "O'rin 2", className: "col-span-1 aspect-video" },
      { order: 2, label: "O'rin 3", className: "col-span-1 aspect-video" },
    ],
  },
  {
    key: "dashboard", label: "Dashboard", show: "showOnDashboard" as const, order: "dashboardOrder" as const,
    hint: "O'quvchi dashboardidagi tavsiya kartasi",
    slots: [
      { order: 0, label: "Tavsiya 1", className: "col-span-1 aspect-video" },
      { order: 1, label: "Tavsiya 2", className: "col-span-1 aspect-video" },
    ],
  },
  {
    key: "lessons", label: "Dars ichida", show: "showInLessons" as const, order: "lessonsOrder" as const,
    hint: "Dars oynalari oxiridagi tegishli videolar bloki",
    slots: [
      { order: 0, label: "O'rin 1", className: "col-span-1 aspect-video" },
      { order: 1, label: "O'rin 2", className: "col-span-1 aspect-video" },
      { order: 2, label: "O'rin 3", className: "col-span-1 aspect-video" },
    ],
  },
];

const EMPTY = { title: "", description: "", category: "Tizim", duration: "", size: "", url: "", poster: "" };

export default function AdminVideosPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Video | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  // Kompyuterdan video yuklash (XHR — foiz ko'rsatkichi bilan)
  const uploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    setUploadPct(0);
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload-video");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      setUploading(false);
      try {
        const data = JSON.parse(xhr.responseText);
        if (!data?.ok) throw new Error(data?.error || "Yuklab bo'lmadi");
        setForm((f) => ({
          ...f,
          url: data.url,
          size: f.size || data.sizeLabel || "",
          title: f.title || (data.fileName || "").replace(/\.[^/.]+$/, ""),
        }));
        setUploadPct(100);
      } catch (err: any) {
        setError(err.message || "Yuklashda xatolik");
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setError("Tarmoq xatosi — qayta urining");
    };
    xhr.send(fd);
  };

  // Placement editor
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeVideo, setPlaceVideo] = useState<Video | null>(null);
  const [placePage, setPlacePage] = useState<string>("home");
  const [placeSlot, setPlaceSlot] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") router.push("/dashboard");
  }, [status, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/videos", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) setVideos(data.videos);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (v: Video) => {
    setEditing(v);
    setForm({
      title: v.title,
      description: v.description || "",
      category: v.category || "Tizim",
      duration: v.duration || "",
      size: v.size || "",
      url: v.url,
      poster: v.poster || "",
    });
    setError(null);
    setModalOpen(true);
  };

  const save = async () => {
    setError(null);
    if (!form.title.trim() || !form.url.trim()) {
      setError("Sarlavha va video URL shart");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/videos", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Saqlab bo'lmadi");
      setModalOpen(false);
      load();
    } catch (e: any) {
      setError(e.message || "Xatolik");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v: Video) => {
    if (!confirm(`"${v.title}" o'chirilsinmi?`)) return;
    await fetch(`/api/admin/videos?id=${v.id}`, { method: "DELETE" });
    load();
  };

  const toggleActive = async (v: Video) => {
    await fetch("/api/admin/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, isActive: !v.isActive }),
    });
    load();
  };

  const toggleHome = async (v: Video) => {
    await fetch("/api/admin/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, showOnHome: !v.showOnHome }),
    });
    load();
  };

  const placeCfg = PLACE_PAGES.find((p) => p.key === placePage)!;

  const openPlace = (v: Video) => {
    setPlaceVideo(v);
    setPlacePage("home");
    setPlaceSlot(v.showOnHome ? v.homeOrder : null);
    setGhost(null);
    setPlaceOpen(true);
  };

  const switchPlacePage = (key: string) => {
    const cfg = PLACE_PAGES.find((p) => p.key === key)!;
    setPlacePage(key);
    setPlaceSlot(placeVideo && (placeVideo as any)[cfg.show] ? (placeVideo as any)[cfg.order] : null);
    setGhost(null);
  };

  const confirmPlace = async (remove = false) => {
    if (!placeVideo || (!remove && placeSlot === null)) return;
    setPlacing(true);
    try {
      await fetch("/api/admin/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          remove
            ? { id: placeVideo.id, [placeCfg.show]: false }
            : { id: placeVideo.id, [placeCfg.show]: true, [placeCfg.order]: placeSlot }
        ),
      });
      setPlaceOpen(false);
      load();
    } finally {
      setPlacing(false);
    }
  };

  const pageVideos = (cfg: (typeof PLACE_PAGES)[number]) =>
    videos
      .filter((v) => (v as any)[cfg.show])
      .sort((a, b) => (a as any)[cfg.order] - (b as any)[cfg.order] || +new Date(b.createdAt) - +new Date(a.createdAt));
  const occupantOf = (order: number) =>
    pageVideos(placeCfg).find((v) => (v as any)[placeCfg.order] === order && v.id !== placeVideo?.id);

  const placeBadge = (v: Video) => {
    const parts: string[] = [];
    if (v.showOnHome) parts.push(v.homeOrder === 0 ? "🏠 Featured" : `🏠 ${v.homeOrder}`);
    if ((v as any).showOnCourses) parts.push(`📚 ${(v as any).coursesOrder}`);
    if ((v as any).showOnDashboard) parts.push(`📊 ${(v as any).dashboardOrder}`);
    if ((v as any).showInLessons) parts.push(`📖 ${(v as any).lessonsOrder}`);
    return parts;
  };

  const filtered = videos.filter(
    (v) =>
      !search ||
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      (v.category || "").toLowerCase().includes(search.toLowerCase())
  );

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
          title="Videolar"
          subtitle="Yangi video qo'shing — ro'yxatda va bosh sahifada eng birinchi chiqadi"
          action={
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 hover:scale-105 transition-transform"
            >
              <Plus className="w-4 h-4" /> Video qo'shish
            </button>
          }
        />

        <div className="p-8 max-w-[1600px]">
          <div className="mb-5 relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Video qidirish..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-blue-200/60 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="w-5 h-5 animate-spin" /> Yuklanmoqda...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white border-2 border-dashed border-neutral-200 rounded-2xl">
              <Play className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-1">Hozircha video yo'q</h3>
              <p className="text-sm text-neutral-500 mb-5">Birinchi videoni qo'shing — u bosh sahifada chiqadi</p>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-br from-blue-700 to-indigo-600 rounded-xl shadow-lg shadow-blue-900/20"
              >
                <Plus className="w-4 h-4" /> Video qo'shish
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((v, i) => (
                <div key={v.id} className="liquid-video-card rounded-2xl bg-white border border-blue-200/60 overflow-hidden hover:shadow-lg transition-shadow backdrop-blur-xl">
                  <div className="relative aspect-video bg-gradient-to-br from-[#0e1e3a] to-[#1a2855] grid place-items-center overflow-hidden">
                    {videoThumb(v) && (
                      <img src={videoThumb(v)!} alt={v.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    )}
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--background)] border border-black/5 shadow-inner">
                      <Play className="h-6 w-6 fill-white text-white ml-0.5" />
                    </div>
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 max-w-[90%]">
                      {placeBadge(v).map((b) => (
                        <span key={b} className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
                          {b}
                        </span>
                      ))}
                      {!v.isActive && (
                        <span className="rounded-full bg-neutral-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
                          Yashirin
                        </span>
                      )}
                    </div>
                    {v.duration && (
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-0.5 text-xs font-bold text-white">
                        {v.duration}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-extrabold text-neutral-900 leading-snug">{v.title}</h3>
                    {v.description && <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{v.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                      {v.category && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 font-bold text-blue-700">
                          <Tag className="w-3 h-3" /> {v.category}
                        </span>
                      )}
                      {v.duration && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5">
                          <Clock className="w-3 h-3" /> {v.duration}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => openPlace(v)}
                        title="Bosh sahifada joylashtirish"
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-blue-700 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:scale-[1.02] transition-transform"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5" /> Joylashtirish
                      </button>
                      <button
                        onClick={() => toggleActive(v)}
                        title={v.isActive ? "Yashirish" : "Ko'rsatish"}
                        className="inline-flex items-center justify-center rounded-lg border border-neutral-200 px-2.5 py-1.5 text-neutral-500 hover:bg-neutral-50"
                      >
                        {v.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => openEdit(v)}
                        title="Tahrirlash"
                        className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-2.5 py-1.5 text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(v)}
                        title="O'chirish"
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !saving && setModalOpen(false)}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-neutral-900">{editing ? "Videoni tahrirlash" : "Yangi video"}</h3>
                <button onClick={() => !saving && setModalOpen(false)} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100" aria-label="Yopish">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {error && <p className="mb-3 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700">{error}</p>}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Sarlavha *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Masalan: Bitrix24 — CRM bilan ishlash" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Video URL *</label>
                  <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="YouTube havola, mp4 / m3u8 yoki pastdan fayl yuklang" dir="ltr" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                  <p className="mt-1 text-[11px] text-neutral-400">YouTube / Vimeo / TikTok sahifa-havolasi ham bo'ladi — avtomatik pleerda ochiladi.</p>
                  <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 px-3 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? `Yuklanmoqda... ${uploadPct}%` : "Kompyuterdan video yuklash (maks 500 MB)"}
                    <input type="file" accept="video/*,.m3u8" className="hidden" disabled={uploading || saving} onChange={uploadFile} />
                  </label>
                  {uploading && (
                    <div className="mt-2 h-2 rounded-full bg-blue-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all" style={{ width: `${uploadPct}%` }} />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Tavsif</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Dars haqida qisqacha..." className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Kategoriya</label>
                    <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Tizim" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Davomiylik</label>
                    <input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="07:42" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Hajm</label>
                    <input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="495 MB" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Poster URL (ixtiyoriy)</label>
                  <input value={form.poster} onChange={(e) => setForm({ ...form, poster: e.target.value })} placeholder="https://..." dir="ltr" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setModalOpen(false)} disabled={saving} className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
                  Bekor qilish
                </button>
                <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== Placement editor: bosh sahifa preview + click-to-place ===== */}
        {placeOpen && placeVideo && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !placing && setPlaceOpen(false)}>
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
                  <Home className="w-5 h-5 text-blue-600" /> Joylashtirish
                </h3>
                <button onClick={() => !placing && setPlaceOpen(false)} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100" aria-label="Yopish">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-neutral-500 mb-4">
                <span className="font-bold text-neutral-800">“{placeVideo.title}”</span> — qaysi sahifada,
                qaysi o'rinda chiqishini tanlang. Sichqonchani olib boring — video o'lchami ko'rinadi, kerakli
                joyga <span className="font-bold">bosing</span>.
              </p>

              {/* Sahifa tablari */}
              <div className="mb-3 flex gap-1.5 p-1 rounded-xl bg-neutral-100">
                {PLACE_PAGES.map((pg) => (
                  <button
                    key={pg.key}
                    onClick={() => switchPlacePage(pg.key)}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                      placePage === pg.key ? "bg-white text-blue-700 shadow" : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {pg.label}
                  </button>
                ))}
              </div>

              <div
                className="relative rounded-2xl border-2 border-dashed border-blue-200 bg-[#EFF4FF]/60 p-4"
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setGhost({ x: e.clientX - r.left, y: e.clientY - r.top });
                }}
                onMouseLeave={() => setGhost(null)}
              >
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  {placeCfg.label} · sxema
                </p>
                <p className="mb-3 text-[11px] text-neutral-400">{placeCfg.hint}</p>
                <div className="grid grid-cols-3 gap-3">
                  {placeCfg.slots.map((s) => {
                    const occ = occupantOf(s.order);
                    const sel = placeSlot === s.order;
                    return (
                      <button
                        key={s.order}
                        onClick={() => setPlaceSlot(s.order)}
                        className={`${s.className} relative rounded-xl border-2 overflow-hidden text-left transition-all ${
                          sel
                            ? "border-blue-600 ring-4 ring-blue-500/25 shadow-lg"
                            : "border-neutral-200 bg-white hover:border-blue-400"
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-[#0e1e3a] to-[#1a2855] grid place-items-center">
                          <Play className="h-6 w-6 fill-white/70 text-white/70" />
                        </div>
                        <span className="absolute top-1.5 left-1.5 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                          {s.label}
                        </span>
                        {occ && (
                          <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate rounded-md bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                            {occ.title}
                          </span>
                        )}
                        {sel && (
                          <span className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-white shadow">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Ghost — sichqoncha orqasidan yuruvchi real o'lcham (16:9) */}
                {ghost && (
                  <div
                    className="pointer-events-none absolute z-10 rounded-lg border-2 border-blue-500 bg-blue-600/25 backdrop-blur-[1px] shadow-xl"
                    style={{
                      width: 168,
                      height: 94,
                      left: Math.max(0, ghost.x - 84),
                      top: Math.max(0, ghost.y - 47),
                    }}
                  >
                    <span className="absolute inset-0 grid place-items-center text-[10px] font-black text-blue-900">
                      16:9 · {placeVideo.title.slice(0, 18)}
                    </span>
                  </div>
                )}

                <p className="mt-3 text-xs text-neutral-500">
                  {placeCfg.label} · Tanlangan o'rin:{" "}
                  <span className="font-black text-blue-700">
                    {placeSlot === null ? "—" : placeSlot === 0 ? "1-o'rin" : `O'rin ${placeSlot}`}
                  </span>
                </p>
              </div>

              <div className="mt-5 flex flex-wrap justify-between gap-2">
                <button
                  onClick={() => confirmPlace(true)}
                  disabled={placing || !(placeVideo as any)[placeCfg.show]}
                  className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-500 hover:bg-neutral-50 disabled:opacity-40"
                >
                  {placeCfg.label}dan olib tashlash
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setPlaceOpen(false)} disabled={placing} className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
                    Bekor qilish
                  </button>
                  <button
                    onClick={() => confirmPlace(false)}
                    disabled={placing || placeSlot === null}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow disabled:opacity-50"
                  >
                    {placing && <Loader2 className="w-4 h-4 animate-spin" />} Shu joyga qo'yish
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
