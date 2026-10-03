"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Loader2, Lock, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";

/** Parol talablari — server bilan bir xil (passwordProblems bilan mos) */
function clientPasswordProblems(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 8) out.push("kamida 8 belgi");
  if (!/[a-zA-Z]/.test(pw)) out.push("kamida 1 ta harf");
  if (!/\d/.test(pw)) out.push("kamida 1 ta raqam");
  return out;
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const problems = clientPasswordProblems(password);
    if (problems.length) {
      setError(`Parol juda oddiy: ${problems.join(", ")}`);
      return;
    }
    if (password !== confirm) {
      setError("Parollar mos kelmadi");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Xatolik yuz berdi");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          Havola noto'g'ri yoki eskirgan. «Parolni tiklash» dan yangi havola so'rang.
        </div>
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--emerald-deep)] hover:text-blue-600">
          <ArrowLeft className="h-4 w-4" /> Login sahifasiga qaytish
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600" />
        <p className="text-sm font-semibold text-[color:var(--emerald-deep)]">
          Parol yangilandi. Login sahifasiga yo'naltirilmoqda…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1.5">Yangi parol</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
          <input
            type={show ? "text" : "password"}
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full glass-card rounded-xl pl-10 pr-4 py-3 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="••••••••"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1.5">Parolni tasdiqlang</label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
          <input
            type={show ? "text" : "password"}
            value={confirm}
            autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full glass-card rounded-xl pl-10 pr-4 py-3 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="••••••••"
          />
        </div>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="mt-1.5 text-xs text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]"
        >
          {show ? "Yashirish" : "Ko'rsatish"}
        </button>
      </div>

      <p className="text-[11px] text-[color:var(--ink-soft)]">
        Parol: kamida 8 belgi, 1 ta harf va 1 ta raqam bo'lishi kerak.
      </p>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-6 py-3 text-base font-bold text-white shadow-lg shadow-indigo-900/20 transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
        {loading ? "Saqlanmoqda…" : "Parolni o'rnatish"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <LiquidBackground />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative glass-card rounded-3xl p-8 max-w-md w-full"
      >
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)] mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Login sahifasi
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <img src="/akela/logo.png" alt="AKELA" className="h-14 w-auto object-contain shrink-0" />
          <div>
            <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">AKELA GROUP</h1>
            <p className="text-xs text-[color:var(--ink-soft)]">Yangi parol o'rnatish</p>
          </div>
        </div>

        {/* useSearchParams uchun Suspense majburiy (Next.js build talabi) */}
        <Suspense fallback={<div className="text-center text-sm text-[color:var(--ink-soft)]">Yuklanmoqda…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </motion.div>
    </main>
  );
}
