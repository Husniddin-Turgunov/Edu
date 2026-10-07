// components/admin/ai/AiFileCard.tsx
//
// AI yaratgan fayl kartasi: nomi, turi, hajmi, "Yuklab olish" tugmasi.
// `doc.*` tool natijasi (`data.downloadUrl`) shu karta orqali chatda ko'rinadi.
//
// Qo'shimcha amallar: "Qayta yarat" va "Boshqa format" — ikkalasi ham chatga
// aniq buyrum yuboradi, shuning uchun foydalanuvchi yangi fayl olish uchun
// qo'lda yozmaydi (agent esa doc.recreate orqali haqiqiy yangi fayl quradi).

"use client";

import { FileSpreadsheet, FileText, FileDown, Download, RefreshCw, Shuffle } from "lucide-react";

export type FileCardData = {
  fileId?: string;
  fileName?: string;
  size?: number;
  mimeType?: string;
  downloadUrl?: string;
  kind?: "excel" | "word" | "pdf";
  pages?: number;
};

/** Kartadagi tugmalar bosilganda bajariladigan amallar (panel yuboradi). */
export type FileCardActions = {
  /** "Qayta yarat" — aynan shu ma'lumotdan yangi fayl (doc.recreate) */
  onRecreate?: (fileName: string) => void;
  /** "Boshqa format" — Word/PDF formatiga o'tkazish (doc.recreate) */
  onConvert?: (fileName: string) => void;
};

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

const KIND_STYLE: Record<string, { icon: typeof FileText; label: string; classes: string }> = {
  excel: { icon: FileSpreadsheet, label: "Excel", classes: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  word: { icon: FileText, label: "Word", classes: "bg-blue-50 text-blue-700 ring-blue-200" },
  pdf: { icon: FileDown, label: "PDF", classes: "bg-rose-50 text-rose-700 ring-rose-200" },
};

/** Boshqa format nomi — foydalanuvchi "PDF" desa PDF, aks holda Word. */
function nextFormat(kind?: string): string {
  if (kind === "excel") return "Word formatida";
  return "PDF formatida";
}

export function AiFileCard({
  data,
  summary,
  actions,
}: {
  data: FileCardData;
  summary?: string;
  actions?: FileCardActions;
}) {
  if (!data?.downloadUrl) return null;
  const style = KIND_STYLE[data.kind || ""] || KIND_STYLE.pdf;
  const Icon = style.icon;
  const name = data.fileName || "hujjat";
  const canRecreate = Boolean(actions?.onRecreate);
  const canConvert = Boolean(actions?.onConvert);

  return (
    <div
      className={`mt-2 rounded-xl ring-1 ${style.classes}`}
      data-file-id={data.fileId}
    >
      <a
        href={data.downloadUrl}
        download={name}
        className="flex items-center gap-3 px-3 py-2.5 transition hover:brightness-95"
        title={`${name} — yuklab olish`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="block text-xs opacity-80">
            {style.label}
            {typeof data.size === "number" ? ` · ${formatBytes(data.size)}` : ""}
            {typeof data.pages === "number" ? ` · ${data.pages} sahifa` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold">
          <Download className="h-4 w-4" />
          Yuklab olish
        </span>
      </a>

      {(canRecreate || canConvert) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-current/10 px-3 py-2">
          {canRecreate && (
            <button
              type="button"
              onClick={() => actions?.onRecreate?.(name)}
              title="Aynan shu ma'lumotdan yangi fayl yaratish (doc.recreate)"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-[11.5px] font-medium text-slate-700 transition hover:bg-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Qayta yarat
            </button>
          )}
          {canConvert && (
            <button
              type="button"
              onClick={() => actions?.onConvert?.(name)}
              title="Faylni boshqa formatga o'tkazish (doc.recreate)"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-[11.5px] font-medium text-slate-700 transition hover:bg-white"
            >
              <Shuffle className="h-3.5 w-3.5" />
              {nextFormat(data.kind)} o'tkaz
            </button>
          )}
          <span className="ml-auto text-[10.5px] opacity-70">
            {summary ? summary.slice(0, 48) : ""}
          </span>
        </div>
      )}
    </div>
  );
}

/** Step ichida fayl kartasi bormi (doc.* tool natijasi). */
export function isFileStep(tool?: string, data?: unknown): boolean {
  if (!tool || !data || typeof data !== "object") return false;
  if (!tool.startsWith("doc.")) return false;
  return typeof (data as Record<string, unknown>).downloadUrl === "string";
}