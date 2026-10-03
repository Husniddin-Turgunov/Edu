"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Shield, ShieldAlert, X } from "lucide-react";
import { LiquidBackground } from "@/components/akela/LiquidBackground";

type AccessState = "checking" | "pending" | "approved" | "rejected" | "expired" | "off";

/**
 * Testga kirish ruxsati eshigi.
 * Telegram botga so'rov yuboriladi, foydalanuvchi javobni kutadi:
 *  - approved  -> children ko'rsatiladi (test ochiladi)
 *  - rejected  -> bosh sahifaga chiqariladi + ogohlantirish
 */
export function TestAccessGate({
  endpoint,
  body,
  children,
  testTitle,
}: {
  /** Masalan: /api/tests/ID/access yoki /api/lesson-access */
  endpoint: string;
  /** POST yuboriladigan ma'lumot (dars/kurs testlari uchun) */
  body?: Record<string, any>;
  children: React.ReactNode;
  testTitle?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<AccessState>("checking");
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [requestId, setRequestId] = useState<string | null>(null);
  const consumedRef = useRef(false);

  /** Ruxsatni bir marta ishlatish: test ochilgach so'rov "used" ga o'tadi.
   *  Keyin chiqib yana kelsa — yangi ruxsat so'raydi. */
  const consumeOnce = useCallback(
    (id: string | null) => {
      if (!id || consumedRef.current) return;
      consumedRef.current = true;
      fetch(`${endpoint}/consume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id }),
      }).catch(() => {});
    },
    [endpoint],
  );

  // 1) So'rov yaratish
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body || {}),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data?.ok) return setState("off");
        setRequestId(data.requestId ?? null);
        if (data.bypassed || data.status === "approved") return setState("approved");
        if (data.status === "rejected") return setState("rejected");
        setRequestedAt(data.requestedAt || new Date().toISOString());
        setState("pending");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  // 2) Holatni tekshirish (har 2 soniyada) + animatsiya taymeri
  useEffect(() => {
    if (state !== "pending") return;
    const t = window.setInterval(() => setTick((v) => v + 1), 1000);
    const p = window.setInterval(async () => {
      try {
        const qs = new URLSearchParams({ ...(body || {}), poll: "1" } as any).toString();
        const res = await fetch(`${endpoint}?${qs}`, { method: "GET", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (data?.status === "approved") {
          if (data.requestId) setRequestId(data.requestId);
          setState("approved");
        } else if (data?.status === "rejected") setState("rejected");
        else if (data?.status === "expired") setState("expired");
      } catch { /* ignore */ }
    }, 2000);
    return () => { window.clearInterval(t); window.clearInterval(p); };
  }, [state, endpoint, body]);

  // 3) Rad etilgan -> bosh sahifa + ogohlantirish
  useEffect(() => {
    if (state === "rejected") {
      try { sessionStorage.setItem("akela:test-rejected", "1"); } catch {}
      router.push("/");
    }
  }, [state, router]);

  // Ruxsat berilgan bo'lsa — bir marta "ishlatilgan" deb belgilaymiz
  if (state === "approved" || state === "off") {
    if (state === "approved" && requestId) consumeOnce(requestId);
    return <>{children}</>;
  }

  if (state === "checking" || state === "pending") {
    const secs = requestedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(requestedAt).getTime()) / 1000))
      : tick;
    return (
      <main className="min-h-screen grid place-items-center bg-background px-6" data-testid="access-waiting">
        <LiquidBackground />
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="glass-card w-full max-w-md rounded-3xl p-8 text-center"
        >
          <div className="relative mx-auto mb-6 h-20 w-20">
            <span className="absolute inset-0 rounded-full border-4 border-violet-200" />
            <span className="absolute inset-0 animate-ping rounded-full bg-violet-400/30 motion-reduce:animate-none" />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-violet-600/10">
              <Loader2 className="h-9 w-9 animate-spin text-violet-600 motion-reduce:animate-none" />
            </span>
          </div>
          <h1 className="text-lg font-black text-neutral-900">Ruxsat so&apos;rovi yuborildi</h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            Testni boshlashingiz uchun ruxsat so&apos;rovi yuborildi. Iltimos <b>kutib turing</b> — ruxsat berilgach
            test avtomatik ochiladi.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none" />
            Kutish vaqti: {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
          </div>
          {testTitle && <p className="mt-4 text-[11px] text-neutral-400">{testTitle}</p>}
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center bg-background px-6" data-testid="access-rejected">
      <LiquidBackground />
      <div className="glass-card w-full max-w-md rounded-3xl p-8 text-center">
        {state === "rejected" ? (
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-rose-500" />
        ) : (
          <Shield className="mx-auto mb-4 h-12 w-12 text-amber-500" />
        )}
        <h1 className="text-lg font-black text-neutral-900">
          {state === "rejected" ? "Ruxsat berilmadi" : "So'rov vaqti tugadi"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          {state === "rejected"
            ? "Sizga hozirda testni topshirishga ruxsat etilmadi. HR bilan bog'laning."
            : "Ruxsat so'rovi vaqti tugadi. Qayta urinish uchun HR bilan bog'laning."}
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white"
        >
          <X className="h-4 w-4" /> Bosh sahifaga
        </button>
      </div>
    </main>
  );
}
