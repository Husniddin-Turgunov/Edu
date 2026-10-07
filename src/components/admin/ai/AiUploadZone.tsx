"use client";

// components/admin/ai/AiUploadZone.tsx
// Manba fayllarni yuklash. Yuklangan faylning matni serverda ajratiladi va
// saqlanadi — test generatsiyasi faqat shu matnlardan o'qiydi.

import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { Capabilities } from "./types";

type Props = {
  caps: Capabilities;
  onRefresh: () => void;
  selected: string[];
  onToggle: (id: string) => void;
};

export function AiUploadZone({ caps, onRefresh, selected, onToggle }: Props) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setBusy(true);
      setError(null);
      setInfo(null);

      const form = new FormData();
      for (const file of list) form.append("files", file);

      try {
        const res = await fetch("/api/ai/uploads", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data?.error || `Yuklashda xato (${res.status})`);
        }
        if (data.attachments?.length) {
          setInfo(`${data.attachments.length} ta fayl o'qildi va saqlandi.`);
          data.attachments.forEach((a: any) => onToggle(a.id));
        }
        if (data.failed?.length) {
          setError(data.failed.map((f: any) => `${f.name}: ${f.error}`).join("\n"));
        }
        onRefresh();
      } catch (err: any) {
        setError(err?.message || "Tarmoq xatosi");
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onRefresh, onToggle],
  );

  const remove = async (id: string) => {
    try {
      await fetch(`/api/ai/uploads?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      onRefresh();
    } catch {
      /* xato bo'lsa ham ro'yxatni yangilaymiz */
      onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          drag
            ? "border-indigo-400 bg-indigo-50"
            : "border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"
        }`}
      >
        {busy ? (
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        ) : (
          <UploadCloud className="h-8 w-8 text-indigo-500" />
        )}
        <p className="mt-3 text-[14px] font-semibold text-slate-800">
          {busy ? "Fayl o'qilmoqda..." : "Faylni shu yerga tashlang yoki bosing"}
        </p>
        <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-slate-500">
          PDF, DOCX, XLSX, CSV, TXT, MD, JSON yoki ZIP. Fayldagi matn serverda ajratilib saqlanadi
          va test faqat shu manbadan yig'iladi — internetdan foydalanilmaydi.
        </p>
        <p className="mt-2 text-[11.5px] text-slate-400">
          {caps.supportedExtensions.join("  ·  ")}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={caps.supportedExtensions.join(",")}
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
      </div>

      {info && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" /> {info}
        </p>
      )}
      {error && (
        <pre className="whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
          {error}
        </pre>
      )}

      {caps.pickers.attachments.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[12.5px] font-semibold text-slate-700">
            Yuklangan manbalar ({caps.pickers.attachments.length})
          </p>
          <div className="space-y-1.5">
            {caps.pickers.attachments.map((file) => {
              const on = selected.includes(file.id);
              return (
                <div
                  key={file.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                    on ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 bg-white"
                  }`}
                >
                  <button onClick={() => onToggle(file.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        file.parser === "xlsx"
                          ? "bg-emerald-50 text-emerald-600"
                          : file.parser === "zip"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-red-50 text-red-600"
                      }`}
                    >
                      {file.parser === "xlsx" ? (
                        <FileSpreadsheet className="h-4 w-4" />
                      ) : file.parser === "zip" ? (
                        <FileArchive className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-800">
                        {file.title}
                      </span>
                      <span className="block text-[11.5px] text-slate-500">
                        {file.words.toLocaleString("uz-UZ")} so'z · {file.chars.toLocaleString("uz-UZ")} belgi
                        · {file.parser}
                        {file.date ? ` · ${new Date(file.date).toLocaleDateString("uz-UZ")}` : ""}
                      </span>
                    </span>
                    {on && (
                      <span className="shrink-0 rounded-md bg-indigo-600 px-2 py-0.5 text-[10.5px] font-semibold text-white">
                        tanlangan
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => remove(file.id)}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    title="O'chirish"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="flex items-start gap-1.5 text-[11.5px] text-slate-500">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
            Tanlangan fayllar chat orqali test yaratishda avtomatik ulanadi.
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-[12.5px] text-slate-500">
          Hali fayl yuklanmagan.
        </p>
      )}
    </div>
  );
}

export { AiUploadZone as default };