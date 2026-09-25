"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AdminSidebar, AdminHeader } from "@/components/admin/AdminSidebar";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Users,
  XCircle,
  Loader2,
  ChevronRight,
  Upload,
  FileText,
  GripVertical,
  ArrowRightLeft,
  Check,
  Search,
  Briefcase,
  UserMinus,
  UserPlus,
} from "lucide-react";

/* ─── Types ─── */
type Position = {
  id: string;
  name: string;
  description?: string | null;
  normativeUrl?: string | null;
  normativeDesc?: string | null;
  order: number;
  userCount: number;
  users: { id: string; name: string; surname: string; email: string; isActive: boolean }[];
  isVacant: boolean;
};

type Department = {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  icon?: string | null;
  order: number;
  positions: Position[];
  totalUsers: number;
};

type User = {
  id: string;
  email: string;
  name: string;
  surname: string;
  department?: string;
  position?: string;
  isActive: boolean;
  status: string;
};

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

import {
  BriefcaseBusiness,
  Headphones,
  Wrench,
  Cpu,
  BarChart3,
  ShieldCheck,
  Megaphone,
  Stethoscope,
  Truck,
  PenTool,
  GraduationCap,
  Globe,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  "briefcase": BriefcaseBusiness,
  "headphones": Headphones,
  "wrench": Wrench,
  "cpu": Cpu,
  "chart": BarChart3,
  "shield": ShieldCheck,
  "megaphone": Megaphone,
  "stethoscope": Stethoscope,
  "truck": Truck,
  "pen": PenTool,
  "graduation": GraduationCap,
  "globe": Globe,
};
const ICON_KEYS = Object.keys(ICON_MAP);

function DeptIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const IconComp = ICON_MAP[icon || "briefcase"] || BriefcaseBusiness;
  return <IconComp className={className || "h-6 w-6"} />;
}

/* ─── Main Page ─── */
export default function DepartmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [showPosModal, setShowPosModal] = useState(false);
  const [editingPos, setEditingPos] = useState<(Position & { departmentId: string }) | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferUsers, setTransferUsers] = useState<string[]>([]);
  const [transferTarget, setTransferTarget] = useState({ department: "", position: "" });
  const [showNormativeInfo, setShowNormativeInfo] = useState<{ url: string; desc: string } | null>(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: "", description: "", color: "#6366f1", icon: "briefcase" });
  const [posForm, setPosForm] = useState({ name: "", description: "", normativeUrl: "", normativeDesc: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Auth check
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") router.push("/dashboard");
  }, [status, session, router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptRes, userRes] = await Promise.all([
        fetch("/api/admin/departments", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
      ]);
      const deptData = await deptRes.json();
      const userData = await userRes.json();
      if (deptData.ok) setDepartments(deptData.departments);
      if (userData.ok) setUsers(userData.users.filter((u: User) => u.status === "approved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.role === "admin") {
      fetchData();
    }
  }, [status, session, fetchData]);

  const showSuccess = useCallback((msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }, []);

  /* ─── Department CRUD ─── */
  const handleSaveDept = useCallback(async () => {
    if (!deptForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = editingDept
        ? { id: editingDept.id, ...deptForm }
        : { ...deptForm };
      const res = await fetch("/api/admin/departments", {
        method: editingDept ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setShowDeptModal(false);
      setEditingDept(null);
      setDeptForm({ name: "", description: "", color: "#6366f1", icon: "briefcase" });
      await fetchData();
      showSuccess(editingDept ? "Bo'lim yangilandi" : "Bo'lim yaratildi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlash amalga oshmadi");
    } finally {
      setSaving(false);
    }
  }, [deptForm, editingDept, fetchData, showSuccess]);

  const handleDeleteDept = useCallback(async (dept: Department) => {
    if (!confirm(`"${dept.name}" bo'limini o'chirmoqchimisiz? Ichidagi foydalanuvchilar bo'shatiladi.`)) return;
    try {
      const res = await fetch(`/api/admin/departments?id=${dept.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      await fetchData();
      showSuccess("Bo'lim o'chirildi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirish amalga oshmadi");
    }
  }, [fetchData, showSuccess]);

  /* ─── Position CRUD ─── */
  const handleSavePos = useCallback(async () => {
    if (!posForm.name.trim() || !selectedDept) return;
    setSaving(true);
    try {
      const payload = editingPos
        ? { id: editingPos.id, ...posForm }
        : { departmentId: selectedDept.id, ...posForm };
      const res = await fetch("/api/admin/positions", {
        method: editingPos ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setShowPosModal(false);
      setEditingPos(null);
      setPosForm({ name: "", description: "", normativeUrl: "", normativeDesc: "" });
      await fetchData();
      showSuccess(editingPos ? "Lavozim yangilandi" : "Lavozim yaratildi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlash amalga oshmadi");
    } finally {
      setSaving(false);
    }
  }, [posForm, editingPos, selectedDept, fetchData, showSuccess]);

  const handleDeletePos = useCallback(async (pos: Position) => {
    if (!confirm(`"${pos.name}" lavozimini o'chirmoqchimisiz?`)) return;
    try {
      const res = await fetch(`/api/admin/positions?id=${pos.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      await fetchData();
      showSuccess("Lavozim o'chirildi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirish amalga oshmadi");
    }
  }, [fetchData, showSuccess]);

  /* ─── Foydalanuvchini lavozimdan chiqarish ─── */
  const handleRemoveUser = useCallback(async (userId: string, name: string, surname: string) => {
    if (!confirm(`${name} ${surname} ni lavozimdan chiqarmoqchimisiz?`)) return;
    try {
      const res = await fetch("/api/admin/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [userId], department: "", position: "" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      await fetchData();
      showSuccess(`${name} ${surname} lavozimdan chiqarildi`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Amalga oshmadi");
    }
  }, [fetchData, showSuccess]);

  /* ─── Normative PDF upload ─── */
  const handleUploadNormative = useCallback(async (file: File, posId: string) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-normative", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      // Position ni yangilash
      const patchRes = await fetch("/api/admin/positions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: posId, normativeUrl: data.url }),
      });
      const patchData = await patchRes.json();
      if (!patchData.ok) throw new Error(patchData.error);
      await fetchData();
      showSuccess("Normativ fayl yuklandi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklash amalga oshmadi");
    } finally {
      setUploading(false);
    }
  }, [fetchData, showSuccess]);

  /* ─── Transfer users ─── */
  const handleTransfer = useCallback(async () => {
    if (transferUsers.length === 0 || !transferTarget.department) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: transferUsers,
          department: transferTarget.department,
          position: transferTarget.position,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setShowTransferModal(false);
      setTransferUsers([]);
      setTransferTarget({ department: "", position: "" });
      await fetchData();
      showSuccess(`${transferUsers.length} ta foydalanuvchi ko'chirildi`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ko'chirish amalga oshmadi");
    } finally {
      setSaving(false);
    }
  }, [transferUsers, transferTarget, fetchData, showSuccess]);

  /* ─── Available positions for transfer target ─── */
  const transferPositions = useMemo(() => {
    if (!transferTarget.department) return [];
    const dept = departments.find((d) => d.name === transferTarget.department);
    return dept?.positions || [];
  }, [transferTarget.department, departments]);

  if (status === "loading" || loading) {
    return (
      <div className="flex h-screen bg-[#EAF1FE]">
        <AdminSidebar />
        <div className="flex-1 grid place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#EAF1FE] overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <AdminHeader
          title="Bo'limlar"
          subtitle="Tashkilot tuzilmasini boshqarish"
          action={
            <button
              onClick={() => { setEditingDept(null); setDeptForm({ name: "", description: "", color: "#6366f1", icon: "briefcase" }); setShowDeptModal(true); }}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" /> Yangi bo'lim
            </button>
          }
        />

        <div className="p-8 space-y-6">
          {/* Messages */}
          <AnimatePresence>
            {success && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 font-medium flex items-center gap-2">
                <Check className="h-4 w-4" /> {success}
              </motion.div>
            )}
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4" /> {error}
                <button onClick={() => setError(null)} className="ml-auto"><XCircle className="h-4 w-4" /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats bar */}
          <div className="flex gap-4">
            <div className="rounded-xl bg-white/70 border border-white px-5 py-3 text-center">
              <p className="text-2xl font-black text-blue-700">{departments.length}</p>
              <p className="text-xs font-semibold text-neutral-500">Bo'limlar</p>
            </div>
            <div className="rounded-xl bg-white/70 border border-white px-5 py-3 text-center">
              <p className="text-2xl font-black text-violet-700">{departments.reduce((s, d) => s + d.positions.length, 0)}</p>
              <p className="text-xs font-semibold text-neutral-500">Lavozimlar</p>
            </div>
            <div className="rounded-xl bg-white/70 border border-white px-5 py-3 text-center">
              <p className="text-2xl font-black text-emerald-700">{departments.reduce((s, d) => s + d.totalUsers, 0)}</p>
              <p className="text-xs font-semibold text-neutral-500">Xodimlar</p>
            </div>
          </div>

          {/* Department cards grid */}
          {departments.length === 0 ? (
            <div className="text-center py-20">
              <Building2 className="mx-auto h-16 w-16 text-neutral-300 mb-4" />
              <p className="text-neutral-500 text-lg font-semibold">Hali bo'lim yaratilmagan</p>
              <p className="text-neutral-400 text-sm mt-1">"Yangi bo'lim" tugmasini bosing</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((dept, idx) => (
                <motion.div
                  key={dept.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="group relative rounded-2xl overflow-hidden cursor-pointer"
                  onClick={() => setSelectedDept(dept)}
                  style={{
                    background: `linear-gradient(135deg, ${dept.color}18 0%, ${dept.color}08 50%, rgba(255,255,255,0.7) 100%)`,
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: `1px solid ${dept.color}30`,
                    boxShadow: `0 8px 32px ${dept.color}15, inset 0 1px 0 rgba(255,255,255,0.6)`,
                  }}
                >
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/20 to-transparent pointer-events-none" />
                  
                  {/* Color accent line */}
                  <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${dept.color}, ${dept.color}90)` }} />

                  <div className="relative p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-xl shadow-lg"
                          style={{ background: `linear-gradient(135deg, ${dept.color}, ${dept.color}CC)` }}>
                          <DeptIcon icon={dept.icon} className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-neutral-900 text-base">{dept.name}</h3>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingDept(dept); setDeptForm({ name: dept.name, description: dept.description || "", color: dept.color, icon: dept.icon || "briefcase" }); setShowDeptModal(true); }}
                          className="p-1.5 rounded-lg bg-white/60 hover:bg-white text-neutral-500 hover:text-blue-600 transition-colors shadow-sm"
                          title="Tahrirlash"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteDept(dept); }}
                          className="p-1.5 rounded-lg bg-white/60 hover:bg-rose-50 text-neutral-500 hover:text-rose-600 transition-colors shadow-sm"
                          title="O'chirish"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
                        style={{ background: `${dept.color}15`, color: dept.color }}>
                        <Briefcase className="h-3 w-3" /> {dept.positions.length} lavozim
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50/80 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <Users className="h-3 w-3" /> {dept.totalUsers} xodim
                      </span>
                    </div>

                    {/* Positions preview */}
                    {dept.positions.length > 0 ? (
                      <div className="space-y-1.5">
                        {dept.positions.slice(0, 4).map((pos) => (
                          <div key={pos.id} className="flex items-center justify-between rounded-lg bg-white/50 backdrop-blur-sm px-3 py-2 border border-white/60">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${pos.isVacant ? "bg-amber-400" : "bg-emerald-500"}`} />
                              <span className="text-xs font-medium text-neutral-700 truncate">{pos.name}</span>
                            </div>
                            <span className="text-[10px] font-semibold text-neutral-400 shrink-0 ml-2">
                              {pos.isVacant ? "Bosh" : `${pos.userCount} nafar`}
                            </span>
                          </div>
                        ))}
                        {dept.positions.length > 4 && (
                          <p className="text-[10px] text-neutral-400 text-center">+{dept.positions.length - 4} ta yana...</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400 text-center py-3">Lavozimlar yo'q</p>
                    )}

                    {/* Arrow */}
                    <div className="flex justify-end mt-3">
                      <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ═══════ Department Detail Slide-over ═══════ */}
      <AnimatePresence>
        {selectedDept && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
            onClick={() => { setSelectedDept(null); setSelectedPos(null); }}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-lg h-full overflow-y-auto"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,245,255,0.98) 100%)",
                backdropFilter: "blur(40px)",
                WebkitBackdropFilter: "blur(40px)",
                boxShadow: "-8px 0 40px rgba(0,0,0,0.15), inset 1px 0 0 rgba(255,255,255,0.5)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gradient header */}
              <div className="relative overflow-hidden">
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${selectedDept.color}CC, ${selectedDept.color}80)` }} />
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                <div className="relative p-6 pb-8">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/25 backdrop-blur-sm shadow-lg border border-white/30">
                        <DeptIcon icon={selectedDept.icon} className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white drop-shadow-sm">{selectedDept.name}</h2>
                        <div className="flex gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/80">
                            <Briefcase className="h-3 w-3" /> {selectedDept.positions.length} lavozim
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/80">
                            <Users className="h-3 w-3" /> {selectedDept.totalUsers} xodim
                          </span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedDept(null); setSelectedPos(null); }}
                      className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors backdrop-blur-sm">
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingPos(null); setPosForm({ name: "", description: "", normativeUrl: "", normativeDesc: "" }); setShowPosModal(true); }}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-md hover:shadow-lg hover:scale-[1.02]"
                    style={{ background: `linear-gradient(135deg, ${selectedDept.color}, ${selectedDept.color}CC)` }}
                  >
                    <Plus className="h-4 w-4" /> Lavozim qo'shish
                  </button>
                  <button
                    onClick={() => {
                      setTransferTarget({ department: selectedDept.name, position: "" });
                      setTransferUsers([]);
                      setShowTransferModal(true);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-all shadow-md hover:shadow-lg hover:scale-[1.02]"
                  >
                    <ArrowRightLeft className="h-4 w-4" /> Xodim ko'chirish
                  </button>
                </div>

                {/* Positions list */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Lavozimlar ({selectedDept.positions.length})</h3>
                  {selectedDept.positions.length === 0 ? (
                    <div className="text-center py-8 rounded-2xl bg-neutral-50/80 border border-dashed border-neutral-200">
                      <Briefcase className="mx-auto h-10 w-10 text-neutral-300 mb-2" />
                      <p className="text-sm text-neutral-400">Hali lavozim yaratilmagan</p>
                    </div>
                  ) : (
                    selectedDept.positions.map((pos) => {
                      const isExpanded = selectedPos?.id === pos.id;
                      return (
                        <motion.div
                          key={pos.id}
                          layout
                          className="rounded-2xl overflow-hidden cursor-pointer transition-all"
                          style={{
                            background: isExpanded
                              ? `linear-gradient(135deg, ${selectedDept.color}12, ${selectedDept.color}06)`
                              : "rgba(255,255,255,0.7)",
                            backdropFilter: "blur(10px)",
                            border: isExpanded ? `1.5px solid ${selectedDept.color}40` : "1px solid rgba(0,0,0,0.06)",
                            boxShadow: isExpanded ? `0 4px 20px ${selectedDept.color}15` : "0 1px 3px rgba(0,0,0,0.04)",
                          }}
                          onClick={() => setSelectedPos(isExpanded ? null : pos)}
                        >
                          {/* Position header */}
                          <div className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <span className={`h-3 w-3 rounded-full block ${pos.isVacant ? "bg-amber-400" : "bg-emerald-500"}`} />
                                  {!pos.isVacant && (
                                    <span className="absolute inset-0 h-3 w-3 rounded-full bg-emerald-400 animate-ping opacity-40" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-semibold text-neutral-900">{pos.name}</p>
                                  <p className="text-xs text-neutral-500 mt-0.5">
                                    {pos.isVacant ? "Lavozim bo'sh" : `${pos.userCount} nafar xodim`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => { setEditingPos({ ...pos, departmentId: selectedDept.id }); setPosForm({ name: pos.name, description: pos.description || "", normativeUrl: pos.normativeUrl || "", normativeDesc: pos.normativeDesc || "" }); setShowPosModal(true); }}
                                  className="p-1.5 rounded-lg hover:bg-white/80 text-neutral-400 hover:text-blue-600 transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePos(pos)}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Normative file */}
                            {pos.normativeUrl && (
                              <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50/80 backdrop-blur-sm px-3 py-2.5 border border-blue-100">
                                <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100">
                                  <FileText className="h-4 w-4 text-blue-600" />
                                </div>
                                <a href={pos.normativeUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}
                                  className="text-xs font-semibold text-blue-700 hover:underline truncate flex-1">
                                  Normativ hujjat
                                </a>
                                {pos.normativeDesc && (
                                  <button onClick={(e) => { e.stopPropagation(); setShowNormativeInfo({ url: pos.normativeUrl!, desc: pos.normativeDesc! }); }}
                                    className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">
                                    Batafsil
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Upload */}
                            <label className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-neutral-200 px-3 py-2 text-xs text-neutral-400 hover:border-blue-300 hover:text-blue-500 cursor-pointer transition-colors"
                              onClick={(e) => e.stopPropagation()}>
                              <Upload className="h-3.5 w-3.5" />
                              {uploading ? "Yuklanmoqda..." : "Fayl yuklash"}
                              <input type="file" accept=".pdf,.xlsx,.xls,.doc,.docx" className="hidden"
                                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadNormative(file, pos.id); }} />
                            </label>
                          </div>

                          {/* Expanded: Users */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 space-y-2 border-t border-neutral-100 pt-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Xodimlar</p>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTransferTarget({ department: selectedDept.name, position: pos.name });
                                        setTransferUsers([]);
                                        setShowTransferModal(true);
                                      }}
                                      className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                      <UserPlus className="h-3 w-3" /> Qo'shish
                                    </button>
                                  </div>
                                  {pos.users.length === 0 ? (
                                    <div className="text-center py-4 rounded-xl bg-amber-50/80 border border-amber-100">
                                      <UserMinus className="mx-auto h-6 w-6 text-amber-400 mb-1" />
                                      <p className="text-xs text-amber-600 font-medium">Lavozim bo'sh — xodim tayinlanmagan</p>
                                    </div>
                                  ) : (
                                    pos.users.map((u) => (
                                      <motion.div
                                        key={u.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center justify-between rounded-xl bg-white/80 backdrop-blur-sm px-3.5 py-3 border border-white shadow-sm"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md"
                                            style={{ background: `linear-gradient(135deg, ${selectedDept.color}, ${selectedDept.color}BB)` }}>
                                            {u.name[0]}{u.surname?.[0] || ""}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-sm font-semibold text-neutral-800 truncate">{u.name} {u.surname}</p>
                                            <p className="text-[11px] text-neutral-400 truncate">{u.email}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                                            {u.isActive ? "Faol" : "Nofaol"}
                                          </span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveUser(u.id, u.name, u.surname);
                                            }}
                                            className="p-1 rounded-lg hover:bg-rose-50 text-neutral-300 hover:text-rose-500 transition-colors"
                                            title="Lavozimdan chiqarish"
                                          >
                                            <UserMinus className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </motion.div>
                                    ))
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ Department Modal ═══════ */}
      <AnimatePresence>
        {showDeptModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowDeptModal(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-neutral-900">{editingDept ? "Bo'limni tahrirlash" : "Yangi bo'lim"}</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Nomi *</label>
                  <input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="Masalan: IT bo'limi" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-2">Rang</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setDeptForm({ ...deptForm, color: c })}
                        className={`h-8 w-8 rounded-full border-2 transition-all ${deptForm.color === c ? "border-neutral-900 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-2">Ikkona</label>
                  <div className="flex gap-2 flex-wrap">
                    {ICON_KEYS.map((key) => {
                      const IconComp = ICON_MAP[key];
                      return (
                        <button key={key} onClick={() => setDeptForm({ ...deptForm, icon: key })}
                          className={`h-9 w-9 rounded-lg flex items-center justify-center border-2 transition-all ${deptForm.icon === key ? "border-blue-500 bg-blue-50 text-blue-600" : "border-transparent hover:bg-neutral-50 text-neutral-400"}`}>
                          <IconComp className="h-5 w-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveDept} disabled={saving || !deptForm.name.trim()}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {editingDept ? "Saqlash" : "Yaratish"}
                </button>
                <button onClick={() => setShowDeptModal(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-500 hover:bg-neutral-100 transition-colors">
                  Bekor qilish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ Position Modal ═══════ */}
      <AnimatePresence>
        {showPosModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowPosModal(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-neutral-900">{editingPos ? "Lavozimni tahrirlash" : "Yangi lavozim"}</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Lavozim nomi *</label>
                  <input value={posForm.name} onChange={(e) => setPosForm({ ...posForm, name: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="Masalan: Dasturchi" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Normativ fayl (PDF/Excel)</label>
                  <div className="flex gap-2">
                    <input value={posForm.normativeUrl} onChange={(e) => setPosForm({ ...posForm, normativeUrl: e.target.value })}
                      className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="/uploads/normatives/..." />
                    <label className="flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-500 hover:bg-neutral-50 cursor-pointer">
                      <Upload className="h-4 w-4" />
                      <input type="file" accept=".pdf,.xlsx,.xls,.doc,.docx" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          const res = await fetch("/api/admin/upload-normative", { method: "POST", body: fd });
                          const data = await res.json();
                          if (data.ok) setPosForm((prev) => ({ ...prev, normativeUrl: data.url }));
                        } finally { setUploading(false); }
                      }} />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Normativ tavsifi</label>
                  <textarea value={posForm.normativeDesc} onChange={(e) => setPosForm({ ...posForm, normativeDesc: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 h-20 resize-none"
                    placeholder="Bu fayl nima uchun kerakligini tushuntiruvchi matn..." />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleSavePos} disabled={saving || !posForm.name.trim()}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {editingPos ? "Saqlash" : "Yaratish"}
                </button>
                <button onClick={() => setShowPosModal(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-500 hover:bg-neutral-100 transition-colors">
                  Bekor qilish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ Transfer Modal ═══════ */}
      <AnimatePresence>
        {showTransferModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowTransferModal(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-neutral-900">Xodimlarni ko'chirish</h3>
              <p className="text-xs text-neutral-500">Foydalanuvchilarni tanlang va maqsadli bo'lim/lavozimni belgilang. Bir vaqtda faqat bitta bo'limda bo'ladi.</p>

              {/* User multi-select */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Foydalanuvchilar (bir nechta tanlash mumkin)</label>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-neutral-200 divide-y divide-neutral-100">
                  {users.filter((u) => u.department !== transferTarget.department || !transferTarget.department).map((u) => (
                    <label key={u.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${transferUsers.includes(u.id) ? "bg-blue-50" : ""}`}>
                      <input
                        type="checkbox"
                        checked={transferUsers.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setTransferUsers((prev) => [...prev, u.id]);
                          else setTransferUsers((prev) => prev.filter((id) => id !== u.id));
                        }}
                        className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {u.name[0]}{u.surname?.[0] || ""}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-neutral-700 truncate">{u.name} {u.surname}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{u.department || "Bo'limsiz"} → {u.position || "Lavozimsiz"}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Target department */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Maqsadli bo'lim *</label>
                  <select value={transferTarget.department} onChange={(e) => setTransferTarget({ ...transferTarget, department: e.target.value, position: "" })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Tanlang...</option>
                    {departments.map((d) => <option key={d.id} value={d.name}>{d.icon} {d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Lavozim</label>
                  <select value={transferTarget.position} onChange={(e) => setTransferTarget({ ...transferTarget, position: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Tanlanmagan</option>
                    {transferPositions.map((p) => <option key={p.id} value={p.name}>{p.name} {p.isVacant ? "(Bosh)" : `(${p.userCount})`}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleTransfer} disabled={saving || transferUsers.length === 0 || !transferTarget.department}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                  Ko'chirish ({transferUsers.length})
                </button>
                <button onClick={() => setShowTransferModal(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-500 hover:bg-neutral-100 transition-colors">
                  Bekor qilish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ Normative Info Modal ═══════ */}
      <AnimatePresence>
        {showNormativeInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowNormativeInfo(null)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900">Normativ fayl</h3>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">{showNormativeInfo.desc}</p>
              <div className="flex gap-2">
                <a href={showNormativeInfo.url} target="_blank" rel="noopener"
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                  <FileText className="h-4 w-4" /> Ochish
                </a>
                <button onClick={() => setShowNormativeInfo(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-neutral-500 hover:bg-neutral-100 transition-colors">
                  Yopish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
