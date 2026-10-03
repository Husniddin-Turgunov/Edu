"use client";

// app/admin/ai/access/page.tsx — kirish va ruxsat qoidalari
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AiAccessMatrix } from "@/components/admin/ai/AiAccessMatrix";
import type { Capabilities } from "@/components/admin/ai/types";

export default function AiAccessPage() {
  const router = useRouter();
  const { status } = useSession();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;
    fetch("/api/ai/capabilities", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data?.ok) throw new Error(data?.error || "Yuklab bo'lmadi");
        setCaps(data);
      })
      .catch((err) => setError(err.message));
  }, [status, router]);

  if (status === "unauthenticated") return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-blue-200/60 bg-[#EAF1FE]/80 px-6 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-[17px] font-bold text-neutral-900">
                <KeyRound className="h-5 w-5 text-amber-600" /> Kirish va Ruxsat Qoidalari
              </h1>
              <p className="mt-0.5 text-[12.5px] text-neutral-500">
                Kimga qaysi dars/test ko'rinadi, kimga qayta topshirishga ruxsat bor
              </p>
            </div>
            <a
              href="/admin/ai"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> AI markazga
            </a>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
              {error}
            </p>
          )}
          {!caps && !error && (
            <p className="flex items-center justify-center gap-2 py-16 text-[13px] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
            </p>
          )}
          {caps && <AiAccessMatrix caps={caps} />}
        </main>
      </div>
    </div>
  );
}