"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ArrowLeft, ExternalLink, Eye, Loader2 } from "lucide-react";

// Ko'rish rejimi: boshqa sayt sahifasi ADMIN FULL CONTROLL ichida ochiladi.
// Foydalanuvchi admin panelidan chiqmaydi, sidebar va boshqa bo'limlar joyida qoladi.
function PreviewInner() {
  const router = useRouter();
  const params = useSearchParams();
  const target = params.get("path") || "/courses";
  const [loaded, setLoaded] = useState(false);

  // Har o'tganda iframe qayta yuklanmasligi uchun kalit
  const [frameKey, setFrameKey] = useState(0);
  useEffect(() => {
    setLoaded(false);
    setFrameKey((k) => k + 1);
  }, [target]);

  const safeTarget = target.startsWith("/") ? target : "/courses";

  return (
    <div className="flex bg-transparent min-h-screen">
      <AdminSidebar />

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Sarlavha paneli */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-blue-200/60 bg-[#EAF1FE]/90 px-6 py-3 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Orqaga
            </button>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-700 to-indigo-600 text-white">
              <Eye className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-neutral-900">Ko&apos;rish rejimi</h1>
              <p className="truncate text-xs text-neutral-500" title={safeTarget}>{safeTarget}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setFrameKey((k) => k + 1)}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Loader2 className={`h-4 w-4 ${loaded ? "" : "animate-spin"}`} aria-hidden="true" /> Qayta yuklash
            </button>
            <a
              href={safeTarget}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-blue-700 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.02]"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Yangi oynada
            </a>
          </div>
        </div>

        {/* Ko'rilayotgan sahifa */}
        <div className="relative flex-1 bg-white">
          {!loaded && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/80 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-600">
                <Loader2 className="h-5 w-5 animate-spin text-blue-700" aria-hidden="true" />
                Sahifa yuklanmoqda...
              </div>
            </div>
          )}
          <iframe
            key={frameKey}
            src={safeTarget}
            title="Admin ko'rish rejimi"
            onLoad={() => setLoaded(true)}
            className="h-full min-h-[calc(100vh-4.5rem)] w-full border-0"
          />
        </div>
      </main>
    </div>
  );
}

export default function AdminPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-blue-700" aria-hidden="true" />
        </div>
      }
    >
      <PreviewInner />
    </Suspense>
  );
}
