"use client";

// components/admin/ai/AiArtifactPanel.tsx
//
// Faza 4 — artifact paneli: chat ichida yopiq, skriptsiz iframe'da HTML
// dashboard/kod ko'rinishi. Claude/Gemini uslubidagi "artifact" kartasi.
//
// Xavfsizlik: `sandbox=""` (BO'SH) — iframe ichida skript, forma, top-level
// navigatsiya, clipboard va localStorage yo'q. Qo'shimcha chaqiruv serverdan
// keladi va `Content-Security-Policy: default-src 'none'` bilan beriladi.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Code2,
  ExternalLink,
  Download,
  ChevronDown,
  ChevronUp,
  Eye,
  ShieldCheck,
} from "lucide-react";

export type ArtifactData = {
  artifactId?: string;
  title?: string;
  kind?: "dashboard" | "code" | "html";
  artifactUrl?: string;
  bytes?: number;
};

export function AiArtifactPanel({ data }: { data: ArtifactData }) {
  const url = data?.artifactUrl || (data?.artifactId ? `/api/ai/artifacts/${data.artifactId}` : "");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"view" | "code">("view");
  if (!url) return null;

  const isCode = data.kind === "code";
  const title = data.title || "Artifact";
  const sizeKb = typeof data.bytes === "number" ? `${(data.bytes / 1024).toFixed(1)} KB` : "";

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          {isCode ? <Code2 className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-slate-800">{title}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="rounded bg-slate-100 px-1 py-px font-mono text-[10px] uppercase">
              {data.kind || "dashboard"}
            </span>
            {sizeKb}
            <span className="inline-flex items-center gap-0.5 text-emerald-600">
              <ShieldCheck className="h-3 w-3" /> skriptsiz
            </span>
          </span>
        </span>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setTab(isCode ? "code" : "view")}
            title={isCode ? "Kod matnini ko'rsatish" : "Ko'rinish"}
            className="rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 transition hover:border-violet-300 hover:text-violet-600"
          >
            {isCode ? <Code2 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <a
            href={`${url}?download=1`}
            title="HTML faylini yuklab olish"
            className="rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 transition hover:border-violet-300 hover:text-violet-600"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Yangi oynada ochish"
            className="rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 transition hover:border-violet-300 hover:text-violet-600"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            title={open ? "Yopish" : "Ichida ochish"}
            className="rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 transition hover:border-violet-300 hover:text-violet-600"
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {tab === "code" ? (
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
                Kodni bajarish uchun <code className="rounded bg-white px-1 py-0.5">code.exec</code>{" "}
                vositasidan foydalaning — bu panel faqat koʻrsatadi.
              </div>
            ) : (
              <iframe
                title={title}
                src={url}
                sandbox=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="block h-[420px] w-full border-t border-slate-100 bg-slate-50"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Step natijasi artifactmi? (`artifact.*` tool natijasi) */
export function isArtifactStep(tool?: string, data?: unknown): boolean {
  if (!tool || !data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    tool.startsWith("artifact.") &&
    (typeof d.artifactUrl === "string" || typeof d.artifactId === "string")
  );
}