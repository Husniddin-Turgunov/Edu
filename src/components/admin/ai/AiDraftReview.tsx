"use client";

// components/admin/ai/AiDraftReview.tsx
// AI tayyorlagan test qoralamasini ko'rib chiqish. Faqat "Tasdiqlash"dan
// keyin savollar bazadagi haqiqiy testga yoziladi вЂ” ya'ni test hech qachon
// tasdiqlashsiz qo'shilmaydi.

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Link2,
  Globe,
  BookOpen,
  ChevronDown,
  Ban,
  Send,
  Trash2,
} from "lucide-react";
import type { Capabilities } from "./types";

type Props = {
  caps: Capabilities;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onApplied: () => void;
};

type Draft = {
  id: string;
  title: string;
  topic: string;
  status: string;
  sourceMode: string;
  testId: string | null;
  sourceNotes: string;
  updatedAt: string;
  payload: {
    test?: Record<string, unknown>;
    questions?: Array<{
      text: string;
      type: string;
      points: number;
      choices: { text: string; isCorrect: boolean }[];
      correctAnswer: string | null;
      explanation: string;
      sourceQuote: string;
      sourceKind: string;
      sourceRef: string;
    }>;
    notes?: string;
    generation?: { mode: string; provider: string; model: string };
    coverage?: { topics?: string[]; sourceKinds?: Record<string, number> };
  };
  attachments?: { id: string; fileName: string; wordCount: number }[];
  webRefs?: { title: string; url: string }[];
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  applied: "bg-indigo-50 text-indigo-700 border-indigo-200",
  rejected: "bg-slate-100 text-slate-500 border-slate-200",
};

export function AiDraftReview({ caps, selectedId, onSelect, onApplied }: Props) {
  const [list, setList] = useState<Draft[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/drafts", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setList(data.drafts || []);
    } catch (err: any) {
      setError(err?.message || "Qoralamalarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDraft = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/drafts?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Qoralama topilmadi");
      setDraft(data.draft);
    } catch (err: any) {
      setError(err?.message || "Xato");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) loadDraft(selectedId);
    else setDraft(null);
  }, [selectedId, loadDraft]);

  const act = async (action: "apply" | "reject", status?: string) => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/ai/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id, action, status }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.summary || data.error || "Amal bajarilmadi");
      setNotice(data.summary);
      await loadDraft(draft.id);
      await loadList();
      onApplied();
    } catch (err: any) {
      setError(err?.message || "Xato");
    } finally {
      setBusy(false);
    }
  };

  if (loading && list.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 py-16 text-[13px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
      </p>
    );
  }

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center">
        <p className="text-[14px] font-semibold text-slate-700">Hali qoralama yo'q</p>
        <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-slate-500">
          Chat orqali В«Yuklangan fayl bo'yicha test tuzВ» deb yozing yoki "Imkoniyatlar" bo'limida
          <strong> Testlar в†’ Yangi test yaratish (AI)</strong> vositasini ishga tushiring. Natija shu
          yerda ko'rinadi va tasdiqlashdan keyin testga aylanadi.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Ro'yxat */}
      <aside className="space-y-1.5">
        {list.map((d) => (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
              selectedId === d.id
                ? "border-indigo-300 bg-indigo-50/70"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="truncate text-[13px] font-semibold text-slate-800">{d.title}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-slate-500">{d.topic}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold ${STATUS_STYLE[d.status] || STATUS_STYLE.draft}`}
              >
                {d.status}
              </span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-500">
                {d.sourceMode === "source" ? "fayl" : d.sourceMode === "web" ? "internet" : "aralash"}
              </span>
              <span className="ml-auto text-[10.5px] text-slate-400">
                {new Date(d.updatedAt).toLocaleDateString("uz-UZ")}
              </span>
            </div>
          </button>
        ))}
      </aside>

      {/* Tafsilot */}
      <section className="space-y-3">
        {!draft && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-[13px] text-slate-500">
            Qoralama tanlang.
          </p>
        )}

        {draft && (
          <>
            <header className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-slate-800">{draft.title}</h2>
                  <p className="mt-0.5 text-[12.5px] text-slate-500">Mavzu: {draft.topic}</p>
                </div>
                {draft.status === "draft" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => act("reject")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Ban className="h-3.5 w-3.5" /> Rad etish
                    </button>
                    <button
                      onClick={() => act("apply", "draft")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[12.5px] font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                      Qoralamada saqlash
                    </button>
                    <button
                      onClick={() => act("apply", "active")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Tasdiqlash va testga qo'shish
                    </button>
                  </div>
                )}
                {draft.status === "applied" && draft.testId && (
                  <a
                    href={`/admin/lms/tests/${draft.testId}`}
                    className="rounded-lg bg-indigo-50 px-3 py-1.5 text-[12.5px] font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Testni ochish в†’
                  </a>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {renderSetting("Savollar", (draft.payload.questions || []).length)}
                {renderSetting("O'tish balli", `${Number(draft.payload.test?.passScore ?? 60)}%`)}
                {renderSetting("Vaqt", Number(draft.payload.test?.timeLimit ?? 0) > 0 ? `${draft.payload.test?.timeLimit} daq` : "chek yo'q")}
                {renderSetting("Urinish", Number(draft.payload.test?.maxAttempts ?? 1) === 0 ? "cheksiz" : Number(draft.payload.test?.maxAttempts ?? 1))}
              </dl>

              {draft.payload.generation && (
                <p className="mt-2 text-[11.5px] text-slate-400">
                  Yaratilgan: {draft.payload.generation.mode === "ai" ? draft.payload.generation.provider : "o'rnatilgan generator"} В·{" "}
                  {draft.payload.generation.model}
                </p>
              )}
            </header>

            {notice && (
              <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" /> {notice}
              </p>
            )}
            {error && (
              <p className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
                <XCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}

            {draft.sourceNotes && (
              <pre className="whitespace-pre-wrap rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                {draft.sourceNotes}
              </pre>
            )}

            {draft.attachments && draft.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {draft.attachments.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11.5px] text-slate-700"
                  >
                    <FileText className="h-3 w-3" /> {a.fileName} В· {a.wordCount} so'z
                  </span>
                ))}
              </div>
            )}

            {draft.webRefs && draft.webRefs.length > 0 && (
              <details className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <summary className="cursor-pointer text-[12.5px] font-semibold text-slate-700">
                  <Globe className="mr-1 inline h-3.5 w-3.5 text-sky-500" />
                  Internet manbalari ({draft.webRefs.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {draft.webRefs.map((r, i) => (
                    <li key={i} className="text-[12px]">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                      >
                        <Link2 className="h-3 w-3" /> {r.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {/* Savollar */}
            <div className="space-y-1.5">
              {(draft.payload.questions || []).map((q, i) => {
                const open = openQuestion === i;
                return (
                  <article key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <button
                      onClick={() => setOpenQuestion(open ? null : i)}
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-relaxed text-slate-800">{q.text}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-400">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5">{typeLabel(q.type)}</span>
                          <span>{q.points} ball</span>
                          {q.sourceKind === "web" && <Globe className="h-3 w-3 text-sky-500" />}
                          {q.sourceKind === "lesson" && <BookOpen className="h-3 w-3 text-emerald-500" />}
                          {q.sourceRef && <span className="truncate">В· {q.sourceRef}</span>}
                        </span>
                      </span>
                      <ChevronDown
                        className={`mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
                      />
                    </button>

                    {open && (
                      <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5">
                        {q.choices.length > 0 && (
                          <ul className="space-y-1">
                            {q.choices.map((c, ci) => (
                              <li
                                key={ci}
                                className={`rounded-md px-2 py-1 text-[12.5px] ${
                                  c.isCorrect
                                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                                    : "bg-white text-slate-600"
                                }`}
                              >
                                {c.isCorrect ? "вњ“ " : "В· "}
                                {c.text}
                              </li>
                            ))}
                          </ul>
                        )}
                        {q.correctAnswer && (
                          <p className="rounded-md bg-white px-2 py-1 text-[12.5px] text-slate-700">
                            <span className="font-semibold">Kutilgan javob: </span>
                            {q.correctAnswer}
                          </p>
                        )}
                        {q.explanation && (
                          <p className="text-[12px] leading-relaxed text-slate-600">
                            <span className="font-semibold">Tushuntirish: </span>
                            {q.explanation}
                          </p>
                        )}
                        {q.sourceQuote && (
                          <blockquote className="border-l-2 border-indigo-300 bg-white px-2.5 py-1.5 text-[11.5px] italic leading-relaxed text-slate-500">
                            {q.sourceQuote}
                          </blockquote>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function renderSetting(label: string, value: string | number) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="text-[14px] font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function typeLabel(type: string) {
  return (
    {
      single: "bir javob",
      multiple: "ko'p javob",
      truefalse: "to'g'ri/noto'g'ri",
      written: "yozma",
    }[type] || type
  );
}

export { AiDraftReview as default };
export { Trash2 };