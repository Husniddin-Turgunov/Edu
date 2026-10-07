"use client";

/**
 * components/excel/ExcelGrid.tsx
 *
 * Excel ko'rinishidagi elektron jadval.
 *
 * Nima uchun bitta komponent: fayl kirgizilganda, test yaratilganda va test
 * topshirilganda — uchalasida ham xuddi shu oyna ochilishi kerak (sizning
 * talabingiz). Uch alohida yozilsa, ular vaqt o'tib ket-a ket farqlanadi.
 *
 * Excelga o'xshash qismlar:
 *  - ustun sarlavhalari A, B, C… va qator raqamlari
 *  - "Name Box" — faol katak manzili (masalan E18)
 *  - formulalar satri (fx)
 *  - faol katak yashil chegarasi
 *  - pastda sheet tablar
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Sheet } from "@/lib/excel/engine";
import { toRef, evaluate } from "@/lib/excel/engine";

export type CellValue = number | string | boolean | null;
export type CellMap = Record<string, CellValue>;

type Props = {
  sheets: Sheet[];
  activeSheet: string;
  onTabChange: (name: string) => void;
  /** Foydalanuvchi kiritgan qiymatlar — katak manzili bo'yicha. */
  values?: CellMap;
  onCellChange?: (sheet: string, ref: string, value: CellValue) => void;
  /** Tekshiruv natijasi: to'g'ri (yashil) / noto'g'ri (qizil). */
  results?: Record<string, boolean>;
  readOnly?: boolean;
  /** To'g'ri javob ko'rsatilsin (admin tasdiqlashdan oldin). */
  answerKey?: Record<string, CellValue>;
  /** Minimal qator/ustun soni — bo'sh joy ham ko'rinishi uchun. */
  minRows?: number;
  minCols?: number;
};

const HEAD_W = 44;
const HEAD_H = 26;
/** Excel katak kengligi (px) — keng oynada haqiqiy Excel kabi ko'rinishi uchun. */
const COL_MIN_W = 120;
/** Bir belgi taxminan shu qancha px (monospace 12px font). */
const CHAR_W = 7.2;
/** Katak ichidagi qo'shimcha bo'shliq (px). */
const PAD_X = 14;
/** Ustun chegarasi — ustun juda kengayib, jadval sig'masligi kerak emas. */
const COL_MAX_W = 220;

/**
 * Ustun kengligini MATN UZUNLIGIGA QARAB avtomatik hisoblaydi.
 *
 * Sizning talab: "katakka sigmasa katak avto kattayadigan bo'lsin".
 * Har bir ustun uchun eng uzun matn o'lchanadi va ustun shunga qarab
 * kengayadi — Excel kabi.
 */
function autoColWidth(texts: string[]): number {
  let longest = 0;
  for (const t of texts) {
    const len = String(t ?? "").length;
    if (len > longest) longest = len;
  }
  const need = Math.ceil(longest * CHAR_W) + PAD_X;
  return Math.min(Math.max(COL_MIN_W, need), COL_MAX_W);
}

/** Raqamni Excel ko'rinishida formatlaydi: butun son — kasrsiz. */
function fmtValue(v: number | string | boolean): string {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 100) / 100);
  }
  return String(v);
}

/**
 * Katakning IKKI qismi bor (haqiqiy Excel kabi):
 *  - `formula` — formulalar satrida ko'rinadi
 *  - `display`  — KATAKDA formula emas, uning NATIJASI ko'rinadi
 *
 * Nima uchun `effectiveSheet` kerak: foydalanuvchi/AI yozgan formulalar
 * `values` da turadi, `sheet.cells` da esa emas. Agar ularni birlashtirmasak,
 * `=SUM(C3:C7)` kabi formula ichki formulalarni KO'RMASDI (noto'g'ri hisoblanar).
 */
function buildEffectiveSheet(sheet: Sheet, values: CellMap): Sheet {
  const cells = { ...sheet.cells };
  for (const [ref, v] of Object.entries(values)) {
    if (v === null || v === undefined || v === "") continue;
    const s = String(v);
    if (s.startsWith("=")) cells[ref] = { t: "n", v: 0, f: s };
    else if (Number.isFinite(Number(s)) && s.trim() !== "") cells[ref] = { t: "n", v: Number(s) };
    else cells[ref] = { t: "s", v: s };
  }
  return { ...sheet, cells };
}

function resolveCell(sheet: Sheet, values: CellMap, ref: string): { display: string; formula: string } {
  const mine = values[ref];
  const base = sheet.cells?.[ref];
  const mineSet = mine !== undefined && mine !== null && String(mine) !== "";
  const formula = mineSet ? String(mine) : base?.f ? String(base.f) : "";
  const raw = mineSet ? (mine as any) : base?.v;

  if (formula) {
    try {
      return { display: fmtValue(evaluate(sheet, formula.slice(1)) as any), formula };
    } catch {
      return { display: "#XATO", formula };
    }
  }
  return { display: raw === undefined || raw === null ? "" : fmtValue(raw as any), formula: raw === undefined || raw === null ? "" : String(raw) };
}

export default function ExcelGrid({
  sheets,
  activeSheet,
  onTabChange,
  values = {},
  onCellChange,
  results,
  readOnly,
  answerKey,
  minRows = 24,
  minCols = 8,
}: Props) {
  const sheet = useMemo(
    () => sheets.find((s) => s.name === activeSheet) || sheets[0],
    [sheets, activeSheet],
  );
  const [sel, setSel] = useState({ col: 0, row: 0 });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = Math.max(sheet?.rows ?? minRows, minRows);
  const cols = Math.max(sheet?.cols ?? minCols, minCols);

  const ref = toRef(sel.col, sel.row);

  /** `values` dagi kiritilganlarni `sheet.cells` ga birlashtirilgan nusxa —
      formula ichki formulalarni to'g'ri ko'rsin. */
  const effective = useMemo(() => buildEffectiveSheet(sheet || { name: "", rows: 1, cols: 1, cells: {} }, values), [sheet, values]);

  /**
   * AVTO KENGLIK — har bir ustun o'z eng uzun matniga qarab kengayadi.
   * Sizning talab: "javoblar to'liq ko'rinmasin" — matn sig'masa ustun
   * o'zi kattalashadi. `px` aniq hisoblanadi va jadvalga qo'yiladi.
   */
  const colWidths = useMemo(() => {
    const out: number[] = [];
    for (let c = 0; c < cols; c++) {
      let longest = 0;
      for (let r = 0; r < rows; r++) {
        const key = toRef(c, r);
        const shown = resolveCell(effective, values, key).display;
        const len = String(shown ?? "").length;
        if (len > longest) longest = len;
      }
      out.push(Math.min(Math.max(COL_MIN_W, Math.ceil(longest * CHAR_W) + PAD_X * 2), COL_MAX_W));
    }
    return out;
  }, [cols, rows, effective, values]);

  const tableW = Math.max(HEAD_W + colWidths.reduce((a, b) => a + b, 0), 600);

  // Sheet almashganda selni reset qilamiz
  useEffect(() => {
    setSel({ col: 0, row: 0 });
  }, [activeSheet]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  /** FAOL katak uchun formulalar satri — Excel kabi formula KO'RSATILADI. */
  const cellFormulaLine = useCallback(
    (r: number, c: number): string => resolveCell(effective, values, toRef(c, r)).formula,
    [effective, values],
  );

  const move = (dc: number, dr: number) => {
    setSel((s) => ({
      col: Math.max(0, Math.min(cols - 1, s.col + dc)),
      row: Math.max(0, Math.min(rows - 1, s.row + dr)),
    }));
  };

  const commit = (text: string) => {
    const raw = text.trim();
    if (raw === "") {
      onCellChange?.(activeSheet, ref, null);
    } else if (raw.startsWith("=")) {
      onCellChange?.(activeSheet, ref, raw); // formula — saqlanadi
    } else {
      const n = Number(raw.replace(/\s/g, "").replace(",", "."));
      onCellChange?.(activeSheet, ref, Number.isFinite(n) && raw !== "" ? n : raw);
    }
  };

  /** Jadval ustidagi klaviatura — fokus katakda bo'lganda ishlaydi. */
  const onGridKeyDown = (e: React.KeyboardEvent, c: number, r: number) => {
    if (editing || readOnly) return;
    setSel({ col: c, row: r });
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      setDraft(resolveCell(effective, values, toRef(c, r)).formula);
      setEditing(true);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onCellChange?.(activeSheet, toRef(c, r), null);
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setDraft(e.key);
      setEditing(true);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === "Enter") {
        e.preventDefault();
        commit(draft);
        setEditing(false);
        move(0, 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditing(false);
      } else if (e.key === "Tab") {
        e.preventDefault();
        commit(draft);
        setEditing(false);
        move(e.shiftKey ? -1 : 1, 0);
      }
      return;
    }

    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      setDraft(cellFormulaLine(sel.row, sel.col));
      setEditing(true);
      return;
    }
    if (e.key === "ArrowUp") { e.preventDefault(); move(0, -1); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); move(0, 1); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); move(-1, 0); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); move(1, 0); return; }
    if (e.key === "Tab") { e.preventDefault(); move(e.shiftKey ? -1 : 1, 0); return; }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onCellChange?.(activeSheet, ref, null);
      return;
    }
    // To'g'ridan-to'g'ri yozish — Excel kabi
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setDraft(e.key);
      setEditing(true);
    }
  };

  if (!sheet) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-[13px] text-slate-500">
        Jadval yukilmadi
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-600/60 bg-white shadow-sm">
      {/* ——— Formula paneli: Name Box + fx ——— */}
      <div className="flex items-stretch border-b border-slate-300 bg-slate-50">
        <div className="flex h-8 w-[84px] shrink-0 items-center justify-center border-r border-slate-300 bg-white font-mono text-[12px] font-semibold text-slate-700">
          {ref}
        </div>
        <div className="flex w-9 shrink-0 items-center justify-center border-r border-slate-300 bg-white font-serif text-[13px] italic text-slate-500">
          fx
        </div>
        <input
          value={editing ? draft : cellFormulaLine(sel.row, sel.col)}
          onChange={(e) => setDraft(e.target.value)}
          /* Faqat formulalar satriga BOSILGANDA tahrirlash ochiladi —
              katak bosilsa, bu yerda faqat formula KO'RINADI (Excel kabi). */
          onFocus={() => {
            if (readOnly) return;
            setDraft(cellFormulaLine(sel.row, sel.col));
            setEditing(true);
          }}
          onBlur={() => {
            if (editing) commit(draft);
            setEditing(false);
          }}
          onKeyDown={onKeyDown}
          readOnly={readOnly}
          placeholder={readOnly ? "" : "Qiymat yoki =SUM(A1:A9) formulasi"}
          className="h-8 min-w-0 flex-1 bg-white px-2 font-mono text-[12.5px] text-slate-800 outline-none"
        />
      </div>

      {/* —*** Jadval —*** */}
      <div className="max-h-[60vh] w-full overflow-auto">
        <table
          className="border-collapse"
          style={{ tableLayout: "fixed", width: tableW }}
        >
          {/* AVTO KENGLIK — colgroup QAT'IY <table> ICHIDA bo'lishi shart.
              Tashqarisida qo'yilsa brauzer uni butunlay E'TIBORSIZ qoldiradi
              va barcha ustunlar siqilib, harflar ustma-ust tushadi. */}
          <colgroup>
            <col style={{ width: HEAD_W }} />
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ width: HEAD_W, height: HEAD_H }} className="sticky left-0 top-0 z-20 border-b border-r border-slate-300 bg-slate-100" />
              {Array.from({ length: cols }).map((_, c) => (
                <th
                  key={c}
                  className={`sticky top-0 z-10 border-b border-r border-slate-300 text-[11.5px] font-semibold ${
                    sel.col === c ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {toRef(c, 0).replace(/\d+/, "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                <td
                  style={{ width: HEAD_W, height: 26 }}
                  className={`sticky left-0 z-10 border-b border-r border-slate-300 text-center text-[11.5px] font-semibold ${
                    sel.row === r ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {r + 1}
                </td>
                {Array.from({ length: cols }).map((_, c) => {
                  const key = toRef(c, r);
                  const base = sheet.cells[key];
                  const { display: shown, formula } = resolveCell(effective, values, key);
                  const okRes = results?.[key];
                  const answer = answerKey?.[key];
                  const isActive = sel.col === c && sel.row === r;
                  const isEditing = editing && isActive;

                  return (
                    <td
                      key={key}
                      onClick={() => setSel({ col: c, row: r })}
                      onDoubleClick={() => {
                        if (readOnly) return;
                        setSel({ col: c, row: r });
                        setDraft(formula);
                        setEditing(true);
                      }}
                      title={
                        answer !== undefined && answer !== null
                          ? `To'g'ri javob: ${answer}`
                          : formula.startsWith("=")
                            ? formula
                            : undefined
                      }
                      className={[
                        // `overflow-hidden` + `whitespace-nowrap` — matn KESILMAYDI,
                        // ustun o'zi kengaydi (avval `truncate` bosh harfini
                        // chapdan kesib tashlayardi)
                        "overflow-hidden whitespace-nowrap border-b border-r border-slate-200 px-2 font-mono text-[12px] leading-[24px] text-slate-800 align-middle",
                        isActive ? "bg-emerald-50/60 ring-2 ring-inset ring-emerald-600" : "",
                        okRes === true ? "bg-emerald-100" : okRes === false ? "bg-rose-100" : "",
                        base && String(base.v).trim() === "" && !base.f ? "bg-amber-50/40" : "",
                        !base && values[key] === undefined && answer !== undefined ? "bg-sky-50" : "",
                      ].join(" ")}
                      /* Klaviatura: yonma-yon (Excel kabi) — Enter yozishni
                         boshlaydi, yo'qlar esa katak bo'sh qoladi. */
                      onKeyDown={isEditing ? undefined : (e) => onGridKeyDown(e, c, r)}
                    >
                      {/* KATAK ICHIDA tahrirlash — double-click bilan, Excel kabi.
                          Formula yozilsa, yozib bo'lgach natija ko'rinadi. */}
                      {isEditing && !readOnly ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => {
                            commit(draft);
                            setEditing(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commit(draft);
                              setEditing(false);
                              move(0, 1);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setEditing(false);
                            } else if (e.key === "Tab") {
                              e.preventDefault();
                              commit(draft);
                              setEditing(false);
                              move(e.shiftKey ? -1 : 1, 0);
                            }
                          }}
                          className="w-full bg-white px-0 py-0 font-mono text-[12px] leading-[24px] text-slate-900 outline-none"
                          style={{ minWidth: Math.max(...colWidths) - 20 }}
                        />
                      ) : (
                        <span className="block whitespace-nowrap">{shown}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ——— KATAK BOSILGANDA: TO'LIQ MATN ———
          Sizning talab: "ustiga bosib ochib ko'rsang to'liq ko'rinadi".
          Katak sig'masa (uzun nom, uzun formula) — bu oyna butun matnni
          ko'rsatadi va nusxalashga imkon beradi. */}
      {(() => {
        const key = toRef(sel.col, sel.row);
        const { display: shown, formula } = resolveCell(effective, values, key);
        const text = String(shown ?? "").trim();
        const full = formula && formula.startsWith("=") ? formula : "";
        if (!text && !full) return null;
        return (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 rounded-md bg-emerald-700 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
                {key}
              </span>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-[13px] font-medium leading-relaxed text-slate-900">
                  {text || "—"}
                </p>
                {full && <p className="mt-1 break-words font-mono text-[11.5px] leading-relaxed text-emerald-800">{full}</p>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ——— Sheet tablar ——— */}
      <div className="flex items-stretch overflow-x-auto border-t border-slate-300 bg-slate-100">
        {sheets.map((s) => {
          const on = s.name === activeSheet;
          return (
            <button
              key={s.name}
              onClick={() => onTabChange(s.name)}
              className={`shrink-0 border-r border-slate-300 px-3 py-1.5 text-[12px] font-medium transition ${
                on
                  ? "border-t-2 border-t-emerald-600 bg-white text-slate-800"
                  : "text-slate-600 hover:bg-white/60"
              }`}
            >
              {s.name}
            </button>
          );
        })}
        {!readOnly && (
          <span className="shrink-0 px-2 py-1.5 text-[13px] text-slate-400" title="Yangi tab (keyingi bosqichda)">
            +
          </span>
        )}
      </div>
    </div>
  );
}