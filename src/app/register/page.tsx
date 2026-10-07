"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { UserPlus, ArrowLeft, Loader2, CheckCircle2, Building2, Phone, Mail, Lock, User, Eye, EyeOff } from "lucide-react";

type DeptFromApi = {
  id: string;
  name: string;
  positions: { id: string; name: string }[];
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    password: "",
    phone: "",
    department: "",
    position: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [regOpen, setRegOpen] = useState(true);
  const [departments, setDepartments] = useState<DeptFromApi[]>([]);
  const [deptsLoading, setDeptsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setRegOpen(d.settings.registrationOpen !== false); })
      .catch(() => {});
  }, []);

  // Bo'limlarni API dan olish
  useEffect(() => {
    fetch("/api/departments", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setDepartments(d.departments || []); })
      .catch(() => {})
      .finally(() => setDeptsLoading(false));
  }, []);

  // Tanlangan bo'lim bo'yicha lavozimlar ro'yxati
  const selectedDept = useMemo(() => {
    if (!form.department) return null;
    return departments.find((d) => d.name === form.department) || null;
  }, [form.department, departments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!regOpen) {
      setError("Ro'yxatdan o'tish vaqtincha yopilgan. Admin bilan bog'laning.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Xatolik yuz berdi");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch {
      setError("Serverga ulanib bo'lmadi");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <LiquidBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative glass-card rounded-3xl p-10 text-center max-w-md w-full"
        >
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-600 text-white">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">Muvaffaqiyatli!</h1>
          <p className="mt-3 text-[color:var(--ink-soft)] text-sm leading-relaxed">
            Ro'yxatdan o'tish muvaffaqiyatli yakunlandi. Admin tasdiqlagandan so'ng avtomatik kirishingiz mumkin.
          </p>
          <div className="mt-6 glass-card rounded-xl p-4">
            <p className="text-xs text-[color:var(--ink-soft)]">
              Admin tasdiqlashi: <span className="font-bold text-[color:var(--emerald-deep)]">1-2 ish kuni</span>
            </p>
          </div>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:scale-105 transition-transform"
          >
            <ArrowLeft className="h-4 w-4" /> Login sahifasiga qaytish
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <LiquidBackground />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative glass-card rounded-3xl p-8 max-w-lg w-full"
      >
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)] mb-6">
          <ArrowLeft className="h-4 w-4" /> Bosh sahifa
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 grid place-items-center text-white">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">Ro'yxatdan o'tish</h1>
            <p className="text-xs text-[color:var(--ink-soft)]">AKELA GROUP MACHINERY yangi xodimi</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!regOpen && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-800">
              Ro'yxatdan o'tish vaqtincha yopilgan. Admin bilan bog'laning.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1.5">Ism *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full glass-card rounded-xl pl-10 pr-4 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Ismingiz"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1.5">Familiya</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
                <input
                  type="text"
                  value={form.surname}
                  onChange={(e) => setForm({ ...form, surname: e.target.value })}
                  className="w-full glass-card rounded-xl pl-10 pr-4 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Familiya"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1.5">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full glass-card rounded-xl pl-10 pr-4 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="email@akela.uz"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1.5">Parol *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                className="w-full glass-card rounded-xl pl-10 pr-12 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Kamida 6 belgi"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)] hover:bg-black/5 transition"
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1.5">Telefon</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full glass-card rounded-xl pl-10 pr-4 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="+998 XX XXX XX XX"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1.5">Bo'lim</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)] pointer-events-none" />
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value, position: "" })}
                  className="w-full glass-card rounded-xl pl-10 pr-4 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400 appearance-none"
                >
                  <option value="">
                    {deptsLoading ? "Yuklanmoqda..." : "Tanlang..."}
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1.5">
                Lavozim {!form.department && <span className="text-[color:var(--ink-soft)] font-normal">(avval bo'limni tanlang)</span>}
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)] pointer-events-none" />
                <select
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  disabled={!form.department}
                  className="w-full glass-card rounded-xl pl-10 pr-4 py-2.5 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400 appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {selectedDept?.positions?.length ? "Tanlang..." : "Lavozimlar yo'q"}
                  </option>
                  {selectedDept?.positions?.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !regOpen}
            className="w-full rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-6 py-3 text-base font-bold text-white shadow-lg shadow-indigo-900/20 transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
            {loading ? "Yuklanmoqda..." : "Ro'yxatdan o'tish"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)] underline">
            allaqachon akkauntingiz bormi? Kirish
          </Link>
        </div>
      </motion.div>
    </main>
  );
}

