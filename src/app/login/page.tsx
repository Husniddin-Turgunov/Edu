"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { LogIn, Loader2, Mail, Lock, ArrowLeft, UserPlus, Eye, EyeOff, KeyRound, X, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [supportContact, setSupportContact] = useState("");

  // Forgot password modal
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotToken, setForgotToken] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState<"token" | "hidden" | null>(null);

  useEffect(() => {
    fetch("/api/portal-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok && d.settings.supportContact) setSupportContact(d.settings.supportContact); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      const role = (session?.user as any)?.role;
      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/#home");
      }
    }
  }, [status, session, router]);

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotMsg(null);
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setForgotMsg(data?.error || "Xatolik yuz berdi");
        return;
      }
      setForgotMode(data.mode);
      setForgotToken(data.token || "");
      if (data.mode === "hidden") {
        setForgotMsg("Yashirin admin: parolni yangilash uchun tasdiqlang");
      } else if (data.token) {
        setForgotMsg("Tasdiqlash havolasi tayyor");
      } else {
        setForgotMsg("Agar email ro'yxatda bo'lsa, havolasiz yuborildi");
      }
    } catch {
      setForgotMsg("Serverga ulanib bo'lmadi");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Login yoki parol noto'g'ri yoki admin tasdiqlamagan");
    } else if (result?.ok) {
      router.push("/");
      router.refresh();
    }
  }

  if (status === "authenticated") return null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <LiquidBackground />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative glass-card rounded-3xl p-8 max-w-md w-full"
      >
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)] mb-6">
          <ArrowLeft className="h-4 w-4" /> Bosh sahifa
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <img src="/akela/logo.png" alt="AKELA" className="h-14 w-auto object-contain shrink-0" />
          <div>
            <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">AKELA GROUP</h1>
            <p className="text-xs text-[color:var(--ink-soft)]">Tizimga kirish</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input
                type="email"
                value={email}
                autoComplete="off"
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full glass-card rounded-xl pl-10 pr-4 py-3 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="email@akela.uz"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-[color:var(--emerald-deep)] mb-1.5">Parol</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete="off"
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full glass-card rounded-xl pl-10 pr-12 py-3 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)] hover:bg-black/5 transition"
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                title={showPassword ? "Yashirish" : "Ko'rsatish"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

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
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
            {loading ? "Kirish..." : "Kirish"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/register" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--emerald-deep)] hover:text-blue-600 transition-colors">
            <UserPlus className="h-4 w-4" /> Yangi akkaunt ochish
          </Link>
        </div>

        {supportContact && (
          <div className="mt-4 glass-card rounded-xl p-3 text-center">
            <p className="text-[11px] text-[color:var(--ink-soft)]">
              Yordam: <span className="font-bold text-[color:var(--emerald-deep)]">{supportContact}</span>
            </p>
          </div>
        )}
      </motion.div>
    </main>
  );
}

