"use client";

// app/admin/ai/page.tsx — AI boshqaruv markazi
import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Bot, LayoutGrid, Paperclip, FileText, BarChart3, KeyRound, Wifi, WifiOff } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AiChatPanel } from "@/components/admin/ai/AiChatPanel";
import { AiCapabilitiesGrid, AiResultBanner } from "@/components/admin/ai/AiCapabilitiesGrid";
import { AiUploadZone } from "@/components/admin/ai/AiUploadZone";
import { AiDraftReview } from "@/components/admin/ai/AiDraftReview";
import type { Capabilities } from "@/components/admin/ai/types";

type Tab = "chat" | "capabilities" | "files" | "drafts";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "chat", label: "Chat", icon: Bot },
  { key: "capabilities", label: "Imkoniyatlar", icon: LayoutGrid },
  { key: "files", label: "Manba fayllar", icon: Paperclip },
  { key: "drafts", label: "Qoralamalar", icon: FileText },
];

export default function AiAdminPage() {
  return (
    <Suspense fallback={<div className="p-10 text-[13px] text-slate-500">Yuklanmoqda...</div>}>
      <AiAdminInner />
    </Suspense>
  );
}

function AiAdminInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, status } = useSession();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "chat");
  const [draftId, setDraftId] = useState<string | null>(params.get("draft"));
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    ok: boolean;
    text: string;
    link?: { label: string; href: string } | null;
  } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/ai/capabilities", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || "Yuklab bo'lmadi");
      setCaps(data);
      if (data.provider?.live) {
        setAttachmentIds((prev) => (prev.length ? prev : []));
      }
    } catch (err: any) {
      setError(err?.message || "Xato");
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated") load();
  }, [status, load, router]);

  if (status === "unauthenticated") return null;

  if (!caps) {
    return (
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex flex-1 items-center justify-center gap-2 text-[13px] text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
        </div>
      </div>
    );
  }

  if (!caps.actor.isAdmin && caps.actor.role !== "grader") {
    return (
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex flex-1 items-center justify-center p-10 text-center">
          <div>
            <KeyRound className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-[15px] font-semibold text-slate-700">Ruxsat yo'q</p>
            <p className="mt-1 text-[13px] text-slate-500">
              Bu bo'lim faqat admin va grader uchun.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sarlavha */}
        <header className="shrink-0 border-b border-blue-200/60 bg-[#EAF1FE]/80 px-6 py-3 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-[17px] font-bold text-neutral-900">
                <Bot className="h-5 w-5 text-indigo-600" /> AI Boshqaruv Markazi
              </h1>
              <p className="mt-0.5 text-[12.5px] text-neutral-500">
                Test yaratish, boshqarish, ko'rinish va ruxsatlarni tabiiy tilda boshqarish
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                ok={caps.provider.live}
                label={caps.provider.live ? `${caps.provider.name} · ${caps.provider.model}` : "Kalit yo'q (offline)"}
              />
              <StatusPill ok={caps.quota.remaining > 0} label={`Kvota ${caps.quota.used}/${caps.quota.limit}`} />
              <a
                href="/admin/ai/analytics"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <BarChart3 className="h-3.5 w-3.5" /> Analitika
              </a>
              <a
                href="/admin/ai/access"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <KeyRound className="h-3.5 w-3.5" /> Kirish qoidalari
              </a>
            </div>
          </div>

          <nav className="mt-3 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition ${
                  tab === t.key
                    ? "bg-gradient-to-br from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/15"
                    : "text-neutral-600 hover:bg-blue-100/70"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
                {t.key === "files" && caps.pickers.attachments.length > 0 && (
                  <span className="rounded bg-black/10 px-1 text-[10.5px]">{caps.pickers.attachments.length}</span>
                )}
                {t.key === "drafts" && caps.pickers.drafts.length > 0 && (
                  <span className="rounded bg-black/10 px-1 text-[10.5px]">{caps.pickers.drafts.length}</span>
                )}
              </button>
            ))}
          </nav>
        </header>

        {/* Mazmun */}
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {error && (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
              {error}
            </p>
          )}

          {tab === "chat" && (
            <div className="mx-auto flex h-[calc(100vh-230px)] min-h-[560px] max-w-5xl flex-col">
              <AiChatPanel
                caps={caps}
                attachments={attachmentIds}
                onAttachmentsChange={setAttachmentIds}
              />
            </div>
          )}

          {tab === "capabilities" && (
            <AiCapabilitiesGrid caps={caps} onResult={setResult} />
          )}

          {tab === "files" && (
            <div className="mx-auto max-w-3xl">
              <AiUploadZone
                caps={caps}
                selected={attachmentIds}
                onToggle={(id) =>
                  setAttachmentIds((prev) =>
                    prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
                  )
                }
                onRefresh={load}
              />
            </div>
          )}

          {tab === "drafts" && (
            <AiDraftReview
              caps={caps}
              selectedId={draftId}
              onSelect={setDraftId}
              onApplied={load}
            />
          )}
        </main>
      </div>

      {result && <AiResultBanner result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

function SearchIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function StatusPill({
  ok,
  label,
  icon: Icon,
}: {
  ok: boolean;
  label: string;
  icon?: any;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : ok ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span className="max-w-[240px] truncate">{label}</span>
    </span>
  );
}