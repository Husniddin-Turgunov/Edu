"use client";

/**
 * components/excel/SpreadsheetEditor.tsx
 *
 * Test qo'shishda Excel faylni tahlil qilish va javoblarni tasdiqlash.
 *
 * Sizning talab bo'yicha: AI har bir tab uchun javoblarni ALOHIDA chiqaradi
 * va har bir tabni ALOHIDA tasdiqlanadi. Tasdiqlangan javob serverga
 * saqlanadi — test vaqtida model chaqirilmaydi.
 *
 * Oqim:
 *   1) Grid ochiladi (Excel ko'rinishida), bo'sh/`?` kataklar ko'rinadi
 *   2) "Javoblarni chiqarish" — server barcha formula kataklarini HISOBLAYDI
 *   3) Har bir tab uchun alohida tasdiqlash tugmasi
 *   4) "Tasdiqlanganlarni saqlash" — TestSpreadsheet ga yoziladi
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, CheckCircle2, Circle, Sparkles, Save, AlertCircle, FileSpreadsheet, Eye, EyeOff } from "lucide-react";
import ExcelGrid, { type CellMap } from "./ExcelGrid";
import UniverSheet from "./UniverSheet";
import type { Sheet } from "@/lib/excel/engine";

/**
 * ENG TEZ USUL: bir AI so'rovida nechta katak yuboriladi.
 * Butun tabni bitta so'rovda so'rash 180-215 s ketar edi. Kichik guruhlar
 * (12 katak) bir vaqtda yuborilganda javoblar tez keladi va progress
 * bosqichma-bosqich siljiydi.
 */
const CHUNK = 12;

/** Server tahlil qilgan jadval tuzilmasi. */
export type SheetPlan = {
  headerRow: number;
  /** Hisoblanadigan bo'sh ustunlar. */
  fillableColumns: string[];
  /** Berilgan — tegilmaydi. */
  givenColumns: string[];
  /** Matn ustuni ("Номи", "Бух.счет") — so'z yoziladi, tegilmaydi. */
  textOnlyColumns: string[];
  /** Hech qachon tegilmaydi (sarlavhasi yo'q, masalan A). */
  lockedColumns: string[];
  /** `?` bilan aniq belgilangan kataklar. */
  marked: string[];
  totalRows: number[];
  reason: string;
};

export type SpreadsheetData = {
  fileName: string;
  sheets: Sheet[];
  tabs: { name: string; rows: number; cols: number; answerCells: string[]; plan?: SheetPlan }[];
  /** AI holati — ishlayaptimi yoki yo'q. */
  ai?: { live: boolean; model: string | null; provider: string | null; note: string };
};

type Props = {
  data: SpreadsheetData;
  testId: string | null;
  questionId?: string | null;
  onSaved?: (questionId: string) => void;
};

export default function SpreadsheetEditor({ data, testId, questionId, onSaved }: Props) {
  const [active, setActive] = useState(data.tabs[0]?.name || "");
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /** Javoblar ko'rinadimi? Tugma bilan yashiriladi/ko'rsatiladi (animatsiya bilan). */
  const [answersVisible, setAnswersVisible] = useState(true);
  const autoRan = useRef(false);
  /**
 * FOIZ PROGRESS — AI sekin ishlaydi (o'lchov: bir tabga 180-215 s).
 * Foydalanuvchi yo'q turib qolmasin: qaysi qismda ekani, necha foiz
 * tugallagani va o'tgan vaqt ko'rsatiladi.
 */
  const [progress, setProgress] = useState<{ done: number; total: number; active: string[] } | null>(null);
  /** Har bir katak uchun "bu rostan to'g'rimi?" isboti. */
  const [proofs, setProofs] = useState<Record<string, string>>({});
  /** Tekshiruvdan o'tmagan kataklar va sababi. */
  const [rejected, setRejected] = useState<Record<string, string>>({});
  /** Foydalanuvchi to'xtatish tugmasini bosdimi? */
  const [stop, setStop] = useState(false);
  const stoppedRef = useRef(false);
  const rejectedRef = useRef<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);

  const tab = data.tabs.find((t) => t.name === active);
  const sheetAnswer = answers[active] || {} as Record<string, unknown>;
  const isConfirmed = Boolean(confirmed[active]);
  const confirmedCount = Object.values(confirmed).filter(Boolean).length;
  void isConfirmed;

  const onCellChange = useCallback(
    (sheetName: string, ref: string, value: string | number | boolean | null) => {
      setDrafts((prev) => {
        const per = { ...(prev[sheetName] || {}) };
        if (value === null || value === "") delete per[ref];
        else per[ref] = String(value);
        return { ...prev, [sheetName]: per };
      });
      // O'zgartirilgan tab qayta tasdiqlashni talab qiladi
      setConfirmed((prev) => (prev[sheetName] ? { ...prev, [sheetName]: false } : prev));
    },
    [],
  );

  /**
   * AI JAVOBNI OLISH — fayl yuklangan zahoti AVTOMATIK ishlaydi.
   *
   * Sizning talab: "ai javobini tugma bosish bilan emas, fayl kirishi bilan
   * ai ishga tushishi va hamma listni avto javobi bilan toldirishi kerak".
   * Shu sabab tugma endi javobni YO'QDIRMAYDI — u faqat javoblarni
   * yashiradi/ko'rsatadi. Bu yerda barcha tablar ketma-ket so'raladi.
   */
  const runAiAll = useCallback(async () => {
    setNote(null);
    setAnswersVisible(true);

    // BIR KATAK BIR KETMA-KET — sizning talabingiz:
    //  · har bir katakka ALOHIDA so'rov
    //  · javob "bu rostan to'g'rimi?" deb tekshiriladi
    //  · o'tmasa — bo'sh qoldiriladi, keyingi katakka o'tiladi
    //  · XATO bo'lsa — keyingi katak to'xtamaydi
    const jobs: { sheet: string; cells: string[] }[] = [];
    for (const t of data.tabs) {
      for (let i = 0; i < t.answerCells.length; i += CHUNK) {
        jobs.push({ sheet: t.name, cells: t.answerCells.slice(i, i + CHUNK) });
      }
    }
    const total = jobs.reduce((n, j) => n + j.cells.length, 0);
    setProgress({ done: 0, total, active: data.tabs.map((t) => t.name) });
    setBusy("ai");

    // Natija har bir tab uchun alohida saqlanadi
    const got: Record<string, Record<string, string>> = {};
    const errors: Record<string, string> = {};
    let done = 0;

    // BITTA KATAKNI so'raydi va TEKSHIRADI — "bu rostan to'g'rimi?"
    // `prev` — shu tabda OLDINGI qadamda tasdiqlangan javoblar.
    // Formula ularga bog'langan bo'lsa (F3 = D3/E3) ularsiz natija 0 chiqadi.
    const askCell = async (sheet: string, ref: string, prev: Record<string, string>): Promise<string> => {
      const waits = [0, 1500, 4000];
      let last = "noma'lum xato";
      for (let attempt = 0; attempt < waits.length; attempt++) {
        if (waits[attempt]) await new Promise((r) => setTimeout(r, waits[attempt]));
        try {
          const res = await fetch("/api/ai/spreadsheet?action=suggestCell", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheets: data.sheets, sheetName: sheet, ref, prev }),
          });
          const out = await res.json().catch(() => null);
          if (!res.ok || !out?.ok) {
            last = out?.error || `server ${res.status}`;
            continue;
          }
          // Isbotni saqlaymiz — UI da ko'rsatamiz
          const key = `${sheet}!${ref}`;
          const line = out.question || `${ref}: ${out.valid ? "to'g'ri" : "rad etildi"}`;
          setProofs((prev) => ({ ...prev, [key]: line }));
          // Tekshiruvdan O'TMAGAN javob — bo'sh qoldiriladi
          if (!out.valid) {
            setRejected((prev) => (prev[key] ? prev : { ...prev, [key]: out.reason || "tekshiruvdan o'tmadi" }));
            rejectedRef.current[key] = out.reason || "tekshiruvdan o'tmadi";
            return "";
          }
          return String(out.proposed || "");
        } catch (e: any) {
          last = e?.message || "tarmoq xatosi";
        }
      }
      errors[sheet] = last;
      return "";
    };

    // ——— KETMA-KET: bitta katak to'ldiriladi → tekshiriladi → keyingisi ———
    // Ketma-ket ishlash AI'ni chalkashtirmaydi va har bir javob alohida
    // tekshiriladi. Bitta katak xato bo'lsa, qolganlari to'xtamaydi.
for (const job of jobs) {
      // Qatorlar ketma-ket — har biri O'Z QATOSIDAN oldingi natijaga bog'lanadi
      const rowOrder = [...job.cells].sort((a, b) => Number(a.replace(/\D+/g, "")) - Number(b.replace(/\D+/g, "")));
      for (const ref of rowOrder) {
        if (stoppedRef.current) break;
        setBusy(`cell:${job.sheet}:${ref}`);
        const prev = { ...(got[job.sheet] || {}) };
        const val = await askCell(job.sheet, ref, prev);
        if (val) {
          got[job.sheet] = { ...(got[job.sheet] || {}), [ref]: val };
          done++;
          setDrafts((prev) => {
            const o = { ...prev };
            o[job.sheet] = { ...(o[job.sheet] || {}), [ref]: val };
            return o;
          });
        }
        setProgress({ done, total, active: data.tabs.map((t) => t.name) });
      }
      if (stoppedRef.current) break;
    }
    setBusy(null);
    setStop(false);

    setProgress(null);
    setBusy(null);

    // ——— YAKUNIY HISOBOT: har bir tab va rad etilganlar alohida ———
    const lines: string[] = [];
    for (const t of data.tabs) {
      const need = t.answerCells.length;
      if (need === 0) continue;
      const have = Object.keys(got[t.name] || {}).length;
      const err = errors[t.name];
      lines.push(
        `"${t.name}": ${have}/${need}${have === need ? " — to'liq" : ""}${err ? ` (${err})` : ""}`,
      );
    }
    const noWork = data.tabs.filter((t) => t.answerCells.length === 0).map((t) => t.name);
    if (noWork.length) lines.push(`Hisoblanadigan katak yo'q: ${noWork.join(", ")}`);

    const rejCount = Object.keys(rejectedRef.current).length;
    setNote(
      `${done}/${total} katak to'ldirildi va tekshirildi` +
        `${rejCount ? `, ${rejCount} ta rad etildi` : ""}. ${lines.join(" · ")}`,
    );
  }, [data.tabs, data.sheets]);

  /** O'tgan vaqt — progress yonida ko'rsatiladi. */
  useEffect(() => {
    if (!progress) return;
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [progress]);

  // Fayl tahlil qilingach ZAHOTI avtomatik ishga tushadi (tugmasiz)
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    void runAiAll();
  }, [runAiAll]);

  /** Bitta tabni serverga yuborib, QAYTA HISOBLASHni so'raymiz. */
  const confirmTab = async (sheetName: string) => {
    setBusy(sheetName);
    setNote(null);
    try {
      const res = await fetch("/api/ai/spreadsheet?action=saveSheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheets: data.sheets,
          sheetName,
          drafts: drafts[sheetName] || {},
        }),
      });
      const out = await res.json().catch(() => null);
      if (!res.ok || !out?.ok) throw new Error(out?.error || "Tasdiqlanmadi");

      // Javoblarni FORMULA bilan qaytamiz — katakda ko'rinishi uchun.
      const formulas = drafts[sheetName] || {};
      const merged: Record<string, string> = {};
      for (const [ref, f] of Object.entries(formulas)) {
        if (String(f).startsWith("=")) merged[ref] = String(f);
      }
      setAnswers((prev) => ({ ...prev, [sheetName]: { ...(prev[sheetName] || {}), ...merged } }));
      setConfirmed((prev) => ({ ...prev, [sheetName]: true }));
      const n = Object.keys(out.answers || {}).length;
      setNote(`"${sheetName}" tasdiqlandi — ${n} ta javob hisoblandi va saqlandi`);
    } catch (e: any) {
      setNote("XATO: " + (e?.message || "noma'lum"));
    } finally {
      setBusy(null);
    }
  };

  /**
   * BIR TUGMA — BARCHA TABLARNI TASDIQLASH.
   *
   * Sizning talab: har bir tabni alohida tasdiqlash tugmalari kerak emas —
   * o'zi tekshirib barchasini tasdiqlagan tugma kerak. Bu tugma barcha
   * tablarni ketma-ket tekshiradi (har biri alohida qayta hisoblanadi va
   * serverga yoziladi) — bitta tab xato bo'lsa ham qolganlari to'xtamasin.
   */
  const confirmAll = async () => {
    setBusy("confirm-all");
    setNote(null);
    let ok = 0;
    for (const t of data.tabs) {
      try {
        await confirmTab(t.name);
        ok++;
      } catch {
        /* keyingi tabga o'tamiz */
      }
    }
    setBusy(null);
    const cells = Object.values(answers).reduce((n: number, m: any) => n + Object.keys(m || {}).length, 0);

    // Tasdiqlash bilan birga SERVERGA SAQLASH — bitta amal, ikki bosqich emas
    await saveAll();

    setNote(
      ok
        ? `Barcha tablar tasdiqlandi va saqlandi — ${ok}/${data.tabs.length} tab, ${cells} ta katak.`
        : "Tasdiqlash muvaffaqiyatsiz bo'ldi. Qayta urinib ko'ring.",
    );
  };

  /** Barcha tasdiqlangan tablar bitta paketka yig'iladi. */
  const saveAll = async () => {
    if (!testId) return;
    setBusy("save");
    setNote(null);
    try {
      // Har bir tasdiqlangan tab uchun javoblarni yig'amiz
      const merged: Sheet[] = data.sheets.map((s) => {
        const cells = { ...s.cells };
        const per = drafts[s.name] || {};
        for (const [ref, val] of Object.entries(per)) {
          cells[ref] =
            String(val).startsWith("=")
              ? { t: "n", v: 0, f: String(val) }
              : { t: typeof val === "number" ? "n" : "s", v: val as any };
        }
        return { ...s, cells };
      });
      const answerKey: Record<string, unknown> = {};
      for (const [sheet, per] of Object.entries(answers)) answerKey[sheet] = per;

      const res = await fetch("/api/ai/spreadsheet?action=save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, fileName: data.fileName, sheets: merged, answerKey }),
      });
      const out = await res.json().catch(() => null);
      if (!res.ok || !out?.ok) throw new Error(out?.error || "Saqlanmadi");
      setNote(`Testga saqlandi: ${data.fileName} (${merged.length} ta tab)`);
      if (questionId) onSaved?.(questionId);
    } catch (e: any) {
      setNote("XATO: " + (e?.message || "noma'lum"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      {/* Tab holati — har biri alohida */}
      <div className="flex flex-wrap items-center gap-1.5">
        {data.tabs.map((t) => {
          const ok = Boolean(confirmed[t.name]);
          const draftCount = Object.keys(drafts[t.name] || {}).length;
          const pct = Math.round((draftCount / Math.max(t.answerCells.length, 1)) * 100);
          return (
            <span
              key={t.name}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11.5px] font-medium ${
                ok ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"
              }`}
            >
              {ok ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              {t.name}
              <span className="opacity-70">
                ({draftCount}/{t.answerCells.length} · {pct}%)
              </span>
            </span>
          );
        })}
        <span className="ml-auto text-[11px] text-neutral-500">
          Tasdiqlangan: {confirmedCount}/{data.tabs.length}
        </span>
      </div>

      {/* TAHLIL NATIJASI — faylda qayeraga yozish va qayerega
          YOZMAYDIGI ko'rsatiladi. Bu tahlilsiz AI xaritalarga ham
          javob yozib qo'yardi. */}
      <div
        className={`flex items-start gap-1.5 rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed ${
          data.ai?.live
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-300 bg-amber-50 text-amber-900"
        }`}
      >
        {data.ai?.live ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
        <span>{data.ai?.note || "AI holati tekshirilmadi"}</span>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
        <summary className="cursor-pointer text-[11.5px] font-semibold text-slate-700">
          Tahlil: qayeraga yoziladi, qayerega yozilmaydi
        </summary>
        <div className="mt-2 space-y-2">
          {/* ISBOT — har bir katak "bu rostan to'g'rimi?" deb tekshirilgan */}
          {Object.keys(proofs).length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-2">
              <p className="text-[11px] font-semibold text-emerald-900">
                Tekshiruv isboti — {Object.keys(proofs).length} katak ketma-ket tekshirildi
              </p>
              <div className="mt-1 max-h-44 space-y-0.5 overflow-y-auto">
                {Object.entries(proofs).map(([k, v]) => (
                  <p key={k} className="font-mono text-[10px] leading-relaxed text-emerald-800">
                    {v}
                  </p>
                ))}
              </div>
            </div>
          )}
          {/* RAD ETILGANLAR — nima uchun bo'sh qoldirildi */}
          {Object.keys(rejected).length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-2">
              <p className="text-[11px] font-semibold text-amber-900">
                Rad etilgan javoblar — {Object.keys(rejected).length} ta bo'sh qoldirildi
              </p>
              <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
                {Object.entries(rejected).map(([k, v]) => (
                  <p key={k} className="text-[10px] leading-relaxed text-amber-800">
                    <b>{k}</b>: {v}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 space-y-2">
          {data.tabs.map((t) => {
            const p = t.plan;
            if (!p) return null;
            return (
              <div key={t.name} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] leading-relaxed">
                <p className="font-semibold text-slate-800">{t.name}</p>
                <p className="text-slate-600">
                  Sarlavha: <b>{p.headerRow ? `${p.headerRow}-qator` : "topilmadi"}</b> · javob kataklari:{" "}
                  <b>{t.answerCells.length}</b>
                </p>
                <p className="text-emerald-700">
                  <b>Hisoblanadi:</b>{" "}
                  {p.fillableColumns.length ? p.fillableColumns.map((c) => `${c} ustuni`).join(", ") : p.marked.length ? `${p.marked.join(", ")} (belgilangan)` : "yo'q"}
                </p>
                <p className="text-slate-500">
                  <b>Berilgan (tegilinmaydi):</b> {p.givenColumns.join(", ") || "yo'q"}
                </p>
                <p className="text-amber-700">
                  <b>Matn ustuni (so'z yoziladi, tegilmaydi):</b> {p.textOnlyColumns?.join(", ") || "yo'q"}
                </p>
                <p className="text-slate-400">
                  <b>Umuman tegilmaydi:</b> {p.lockedColumns.join(", ") || "yo'q"}
                </p>
              </div>
            );
          })}
        </div>
      </details>

      {/* FOIZ PROGRESS QATORI — AI ishlayotganda. Foydalanuvchi
          kutayotganini bilsin: necha foiz, qaysi tablar, qancha vaqt. */}
      <AnimatePresence>
        {progress && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-900">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                AI javobni chiqarayapti… {elapsed}s
              </span>
              <span className="font-mono text-indigo-800">
                {Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%
                <span className="opacity-70">
                  {" "}
                  ({progress.done}/{progress.total})
                </span>
              </span>
            </div>

            {/* Foiz chizig'i */}
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-200/70">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                initial={{ width: "0%" }}
                animate={{
                  width: `${Math.max(4, Math.round((progress.done / Math.max(progress.total, 1)) * 100))}%`,
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            {/* Qaysi tablar kutilmoqda */}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {data.tabs.map((t) => {
                const got = Object.keys(drafts[t.name] || {}).length;
                const pct = Math.round((got / Math.max(t.answerCells.length, 1)) * 100);
                return (
                  <span
                    key={t.name}
                    className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${
                      got ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-500"
                    }`}
                  >
                    {t.name}: {got}/{t.answerCells.length} ({pct}%)
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jadval — javoblar yashirilganda faqat ASLI fayl ko'rinadi.
          Ko'rsatilganda animatsiya bilan qaytadi (sizning talabingiz). */}
      <AnimatePresence mode="wait" initial={false}>
        {answersVisible ? (
          <motion.div
            key="javoblar"
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{ height: "min(62vh, 560px)" }}>
              <UniverSheet
                sheets={data.sheets.map((s) => {
                  // TEKSHIRILGAN javoblar fayldagi matn ustidan YOPILADI.
                  const cells = { ...s.cells };
                  for (const [ref, v] of Object.entries(drafts[s.name] || {})) {
                    const text = String(v ?? "");
                    if (!text) continue;
                    if (text.startsWith("=")) cells[ref] = { t: "n", v: 0, f: text };
                    else cells[ref] = { t: "s", v: text };
                  }
                  for (const [ref, f] of Object.entries(sheetAnswer)) {
                    if (cells[ref]) continue;
                    if (typeof f === "string" && f.startsWith("=")) cells[ref] = { t: "n", v: 0, f };
                  }
                  return { ...s, cells };
                })}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="asl-fayl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div style={{ height: "min(62vh, 560px)" }}>
              <UniverSheet sheets={data.sheets} readOnly />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {note && (
        <p
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] ${
            note.startsWith("XATO")
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {note.startsWith("XATO") ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {note}
        </p>
      )}

      {/* Tugmalar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* JAVOBNI YASHIRISH / KO'RSATISH — bitta tugma.
            Yashirganda fayl ASLI ko'rinishida (javobsiz) bo'ladi — shunda
            admin o'zi tekshirishi mumkin. Qayta bosganda javoblar
            ANIMATSIYA bilan qaytadi. */}
        <button
          type="button"
          onClick={() => setAnswersVisible((v) => !v)}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[12.5px] font-semibold transition sm:flex-none ${
            answersVisible
              ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              : "border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          }`}
        >
          {answersVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {answersVisible ? "Javoblarni yashirish" : "Javoblarni ko'rsatish"}
        </button>

        {busy && busy.startsWith("ai:") && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-indigo-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            AI ishlayapti… {busy.slice(3)}
          </span>
        )}

        <button
          type="button"
          onClick={() => void runAiAll()}
          disabled={Boolean(busy)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2.5 text-[12.5px] font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 sm:flex-none"
        >
          <Sparkles className="h-3.5 w-3.5" /> AI qayta ishlatish
        </button>

        {/* TO'XTATISH — ketma-ket ishlashda kerak */}
        {busy === "ai" ? (
          <button
            type="button"
            onClick={() => {
              stoppedRef.current = true;
              setStop(true);
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-[12.5px] font-semibold text-rose-700 hover:bg-rose-100 sm:flex-none"
          >
            To'xtatish
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              stoppedRef.current = false;
              setStop(false);
              rejectedRef.current = {};
              setProofs({});
              setRejected({});
              void runAiAll();
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2.5 text-[12.5px] font-semibold text-indigo-700 hover:bg-indigo-100 sm:flex-none"
          >
            <Sparkles className="h-3.5 w-3.5" /> Qayta ishlatish
          </button>
        )}

        {/* BIR TUGMA — barcha tablar o'zi tekshiriladi va tasdiqlanadi */}
        <button
          type="button"
          onClick={() => void confirmAll()}
          disabled={Boolean(busy) || !answersVisible || data.tabs.length === 0}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 sm:flex-none"
        >
          {busy === "confirm-all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Barchasini tasdiqlash
        </button>

        <button
          type="button"
          onClick={() => void saveAll()}
          disabled={busy === "save" || confirmedCount === 0 || !testId}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2.5 text-[12.5px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-40 sm:w-auto"
        >
          {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Tasdiqlanganlarni saqlash ({confirmedCount}/{data.tabs.length})
        </button>
      </div>

        {!testId && (
          <span className="inline-flex w-full items-center gap-1 text-[11.5px] text-amber-700">
            <FileSpreadsheet className="h-3 w-3" /> Avval savolni testga qo'shing
          </span>
        )}

      <p className="text-[11px] leading-relaxed text-neutral-500">
        Bo&apos;sh kataklarga <code className="rounded bg-neutral-100 px-1">=SUM(B5:B7)</code> yoki{" "}
        <code className="rounded bg-neutral-100 px-1">=B5*0.12</code> kabi formula yozing. Server
        uni <b>o&apos;zi qayta hisoblaydi</b> — siz yozgan qiymat ishlatilmaydi, shuning uchun
        hisob xato bo&apos;lmaydi.
      </p>
    </div>
  );
}