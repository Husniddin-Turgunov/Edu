"use client";

// components/admin/ai/AiImageCard.tsx
//
// Faza 5 — rasm kartasi: rasm ko'rinishi, yuklab olish, kattalashtirish,
// "qayta chiz" va "promptni o'zgartir" tugmalari.
//
// Rasm imzolangan vaqtinchalik URL orqali keladi (24 soat), shuning uchun
// `<img>` oddiy ishlatiladi — ichki skript yo'q, shuning uchun xavfsiz.

import { useState } from "react";
import { Image as ImageIcon, Download, Maximize2, RefreshCw, Wand2 } from "lucide-react";

export type ImageCardData = {
  fileId?: string;
  fileName?: string;
  imageUrl?: string;
  mimeType?: string;
  size?: number;
  prompt?: string;
  model?: string;
};

export function AiImageCard({
  data,
  summary,
  actions,
}: {
  data: ImageCardData;
  summary?: string;
  actions?: { onRegenerate?: (prompt: string) => void; onRefine?: (prompt: string) => void };
}) {
  const [open, setOpen] = useState(false);
  const url = data?.imageUrl;
  if (!url) return null;
  const prompt = data.prompt || "";

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-fuchsia-200 bg-white">
      <div className="relative">
        <img
          src={url}
          alt={prompt || data.fileName || "AI rasm"}
          className="block max-h-[420px] w-full cursor-zoom-in bg-slate-50 object-contain"
          onClick={() => setOpen(true)}
          loading="lazy"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Kattalashtirish"
          className="absolute right-2 top-2 rounded-lg bg-white/85 p-1.5 text-slate-600 shadow-sm transition hover:bg-white hover:text-fuchsia-700"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-fuchsia-100 px-3 py-2">
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px] text-slate-600">
          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-fuchsia-500" />
          <span className="truncate" title={prompt}>
            {prompt || data.fileName}
          </span>
        </span>
        {actions?.onRefine && prompt && (
          <button
            type="button"
            onClick={() => actions.onRefine?.(prompt)}
            title="Rasmni chizilgan holicha saqlash va o'zgartirishni so'rash"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-fuchsia-300 hover:text-fuchsia-700"
          >
            <Wand2 className="h-3 w-3" />
            O'zgartir
          </button>
        )}
        {actions?.onRegenerate && prompt && (
          <button
            type="button"
            onClick={() => actions.onRegenerate?.(prompt)}
            title="Shu prompt bilan qayta chizish"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-fuchsia-300 hover:text-fuchsia-700"
          >
            <RefreshCw className="h-3 w-3" />
            Qayta chiz
          </button>
        )}
        <a
          href={url}
          download={data.fileName || "rasm.png"}
          className="inline-flex items-center gap-1 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-2 py-1 text-[11px] font-medium text-fuchsia-700 transition hover:bg-fuchsia-100"
        >
          <Download className="h-3 w-3" />
          Yuklab olish
        </a>
      </div>

      {summary && (
        <p className="border-t border-fuchsia-100 bg-fuchsia-50/40 px-3 py-1.5 text-[10.5px] text-slate-500">
          {summary}
        </p>
      )}

      {/* Kattalashtirilgan ko'rinish */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setOpen(false)}
        >
          <img
            src={url}
            alt={prompt || "AI rasm"}
            className="max-h-[92vh] max-w-[94vw] rounded-xl bg-white shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-6 top-6 rounded-lg bg-white/90 px-3 py-1.5 text-[12px] font-medium text-slate-700"
          >
            Yopish
          </button>
        </div>
      )}
    </div>
  );
}

/** Step natijasi rasm natijasi mi? (`image.generate`) */
export function isImageStep(tool?: string, data?: unknown): boolean {
  if (!tool || !data || typeof data !== "object") return false;
  return tool === "image.generate" && typeof (data as Record<string, unknown>).imageUrl === "string";
}