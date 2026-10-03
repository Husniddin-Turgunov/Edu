"use client";

// components/admin/ai/AiCapabilitiesGrid.tsx
// Barcha vositalar bo'yicha bo'limlar kesimida ko'rsatiladi. Har bir karta
// "Bajarish" tugmasi orqali shu vositani to'g'ridan-to'g'ri ishga tushiradi —
// chat orqali yozish shart emas.

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Play,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { AiToolForm } from "./AiToolForm";
import { categoryStyle } from "./types";
import type { Capabilities, ToolMeta } from "./types";

type Props = {
  caps: Capabilities;
  onResult: (message: { ok: boolean; text: string; link?: { label: string; href: string } | null }) => void;
};

export function AiCapabilitiesGrid({ caps, onResult }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Hammasi");
  const [openTool, setOpenTool] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const tools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return caps.tools.filter((t) => {
      if (category !== "Hammasi" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.example.toLowerCase().includes(q)
      );
    });
  }, [caps.tools, query, category]);

  const run = async (tool: string, args: Record<string, unknown>) => {
    setBusy(tool);
    try {
      const res = await fetch(`/api/ai/tools/${encodeURIComponent(tool)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      onResult({
        ok: !!data?.ok,
        text: data?.summary || data?.error || "Natija yo'q",
        link: data?.link || null,
      });
      if (data?.ok) setOpenTool(null);
    } catch (err: any) {
      onResult({ ok: false, text: err?.message || "Tarmoq xatosi" });
    } finally {
      setBusy(null);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, ToolMeta[]>();
    for (const tool of tools) {
      const list = map.get(tool.category) || [];
      list.push(tool);
      map.set(tool.category, list);
    }
    return [...map.entries()];
  }, [tools]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Vosita qidirish: test, ruxsat, statistika, fayl..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <span className="rounded-lg bg-slate-100 px-2.5 py-2 text-[12px] text-slate-600">
          {tools.length}/{caps.tools.length} vosita
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["Hammasi", ...caps.categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
              category === cat
                ? "bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {cat}
            {cat !== "Hammasi" && (
              <span className="ml-1.5 opacity-70">{caps.tools.filter((t) => t.category === cat).length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {grouped.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-[13px] text-slate-500">
            Hech narsa topilmadi.
          </p>
        )}

        {grouped.map(([cat, list]) => {
          const style = categoryStyle(cat);
          return (
            <section key={cat}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${style.from} ${style.to}`} />
                <h3 className="text-[14px] font-semibold text-slate-800">{cat}</h3>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                  {list.length}
                </span>
              </div>

              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {list.map((tool) => {
                  const isOpen = openTool === tool.name;
                  return (
                    <article
                      key={tool.name}
                      className={`flex flex-col rounded-2xl border bg-white transition ${
                        isOpen ? "border-indigo-300 shadow-md" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <header className="flex items-start gap-2 border-b border-slate-100 px-3.5 py-3">
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${style.from} ${style.to} text-white`}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-[13.5px] font-semibold text-slate-800">
                            {tool.title}
                          </h4>
                          <code className="mt-0.5 block truncate text-[10.5px] text-slate-400">
                            {tool.name}
                          </code>
                        </div>
                        {tool.needsConfirm && (
                          <span
                            title="Tasdiqlash talab qiladi"
                            className="flex h-6 shrink-0 items-center gap-1 rounded-md bg-amber-50 px-1.5 text-amber-700"
                          >
                            <ShieldAlert className="h-3 w-3" />
                          </span>
                        )}
                      </header>

                      <p className="flex-1 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-600">
                        {tool.description}
                      </p>

                      <div className="px-3.5 pb-2">
                        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11.5px] leading-relaxed text-slate-500">
                          <span className="font-semibold text-slate-600">Misol: </span>
                          {tool.example}
                        </p>
                      </div>

                      <div className="border-t border-slate-100 px-3.5 py-2.5">
                        {isOpen ? (
                          <AiToolForm
                            tool={tool}
                            caps={caps}
                            busy={busy === tool.name}
                            onSubmit={run}
                            onCancel={() => setOpenTool(null)}
                          />
                        ) : (
                          <button
                            onClick={() => setOpenTool(tool.name)}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-[12.5px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
                          >
                            <Play className="h-3.5 w-3.5" /> Bajarish
                            <ChevronDown className="h-3 w-3 opacity-60" />
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Bitta amal natijasi — kartalar ustida ko'rinadigan qisqa panel. */
export function AiResultBanner({
  result,
  onClose,
}: {
  result: { ok: boolean; text: string; link?: { label: string; href: string } | null };
  onClose: () => void;
}) {
  return (
    <div
      className={`fixed bottom-5 right-5 z-50 w-[min(420px,calc(100vw-2rem))] rounded-2xl border p-4 shadow-2xl ${
        result.ok ? "border-emerald-200 bg-white" : "border-rose-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {result.ok ? (
          <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-rose-500" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`text-[11.5px] font-semibold uppercase tracking-wide ${
              result.ok ? "text-emerald-600" : "text-rose-500"
            }`}
          >
            {result.ok ? "Bajarildi" : "Xato"}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
            {result.text}
          </p>
          {result.link && (
            <a
              href={result.link.href}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-indigo-600 hover:underline"
            >
              {result.link.label} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 transition hover:text-slate-700">
          <XCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export { AiCapabilitiesGrid as default };