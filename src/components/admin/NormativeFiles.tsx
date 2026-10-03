"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Upload, Trash2, Loader2, ExternalLink, Download, Eye } from "lucide-react";

type Normative = {
  id: string;
  name: string;
  url: string;
  size: number;
  note: string | null;
  createdAt: string;
};

function humanSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Lavozimga biriktirilgan normativ fayllar — bir nechtasi bo'lishi mumkin.
 * Yuklash, ko'rish (Batafsil) va o'chirish.
 */
export function NormativeFiles({ positionId, onChanged }: { positionId: string; onChanged?: () => void }) {
  const [items, setItems] = useState<Normative[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [detail, setDetail] = useState<Normative | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/position-normatives?positionId=${positionId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) setItems(data.items || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [positionId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/admin/upload-normative", { method: "POST", body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up?.ok || !upData?.url) return alert(upData?.error || "Yuklab bo'lmadi");

      await fetch("/api/admin/position-normatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId, name: file.name, url: upData.url, size: file.size }),
      });
      await load();
      onChanged?.();
    } catch (e: any) {
      alert("Xatolik: " + (e?.message || e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Normativ faylni o'chirilsinmi?")) return;
    await fetch("/api/admin/position-normatives", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    await load();
    onChanged?.();
  };

  return (
    <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
          Normativ fayllar {items.length > 0 && `(${items.length})`}
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 rounded-lg border border-dashed border-neutral-200 px-2 py-1 text-[10px] font-semibold text-neutral-500 transition-colors hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploading ? "Yuklanmoqda..." : "Fayl yuklash"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.doc,.docx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl bg-blue-50/60 px-3 py-2 text-[11px] text-blue-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Yuklanmoqda...
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 px-3 py-2 text-[11px] text-neutral-400">
          Hali normativ fayl yuklanmagan
        </p>
      ) : (
        items.map((n) => (
          <div
            key={n.id}
            data-testid="normative-item"
            className="flex items-center gap-2 rounded-xl bg-blue-50/80 px-3 py-2 border border-blue-100"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <a
              href={n.url}
              target="_blank"
              rel="noopener"
              className="min-w-0 flex-1 truncate text-xs font-semibold text-blue-700 hover:underline"
              title={n.name}
            >
              {n.name}
            </a>
            {n.size > 0 && <span className="shrink-0 text-[10px] text-blue-400">{humanSize(n.size)}</span>}
            {/* Yuklab olish — server orqali (blob boshqa domen'da, download atributi ishlamaydi) */}
            <a
              href={`/api/normatives/download?url=${encodeURIComponent(n.url)}&name=${encodeURIComponent(n.name)}`}
              data-testid="normative-download"
              onClick={(e) => e.stopPropagation()}
              title="Yuklab olish"
              className="shrink-0 rounded-md p-1 text-blue-600 transition-colors hover:bg-blue-100"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setDetail(n)}
              className="shrink-0 text-[10px] font-medium text-blue-500 hover:text-blue-700"
            >
              Batafsil
            </button>
            <button
              type="button"
              onClick={() => remove(n.id)}
              aria-label="O'chirish"
              className="shrink-0 rounded-md p-1 text-rose-500 transition-colors hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}

      {detail && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-black">Normativ fayl</h3>
            <p className="mt-2 truncate text-sm font-semibold text-neutral-800">{detail.name}</p>
            {detail.note && <p className="mt-2 text-sm text-neutral-600">{detail.note}</p>}
            <p className="mt-1 text-xs text-neutral-400">
              {humanSize(detail.size)} · {new Date(detail.createdAt).toLocaleDateString()}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Yopish
              </button>
              <a
                href={detail.url}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700"
              >
                <ExternalLink className="h-4 w-4" /> Ko'rish
              </a>
              <a
                href={`/api/normatives/download?url=${encodeURIComponent(detail.url)}&name=${encodeURIComponent(detail.name)}`}
                data-testid="normative-download-modal"
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
              >
                <Download className="h-4 w-4" /> Yuklab olish
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
