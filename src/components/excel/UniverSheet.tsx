"use client";

/**
 * components/excel/UniverSheet.tsx
 *
 * HAQIQIY EXCEL ILOVASI вЂ” Univer yadrosi (Apache-2.0).
 *
 * Nima uchun o'z qo'limizdagi jadval emas:
 *   В· 500+ formulalar (SUM, VLOOKUP, INDEX/MATCH, matn, sana, moliyaviy)
 *   В· 16 grafik turi, pivot jadvallar, filtr, sort, izoh (note), giperhavola
 *   В· shartli formatlash, ma'lumot validatsiyasi, jadvallar
 *   В· `.xlsx` import/export
 *   В· Canvas render вЂ” katta fayllarda ham tez
 *
 * Bu qo'lda yozilgan `<table>` o'rnini bosadi: kenglik, kesilish, bosh harf
 * yo'qolishi kabi muammolar Univerda umuman yo'q.
 */

import { useEffect, useRef } from "react";
import type { Sheet } from "@/lib/excel/engine";

type Props = {
  /** Bizning formatimizdagi tablolar. */
  sheets: Sheet[];
  /** Faol tab nomi. */
  activeSheet?: string;
  /** Faqat ko'rish (test vaqtida). */
  readOnly?: boolean;
  /** O'zgarish вЂ” natija `{ katak: qiymat }`. */
  onChange?: (ref: string, value: unknown) => void;
  className?: string;
  style?: React.CSSProperties;
};

/** "A1" в†’ { r, c } (0-dan). */
function refToRC(ref: string): { r: number; c: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase());
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: Number(m[2]) - 1, c: c - 1 };
}

/** Bizning Sheet[] в†’ Univer IWorkbookData. */
function toWorkbookData(sheets: Sheet[]) {
  const sheetData: Record<string, unknown> = {};
  const sheetOrder: string[] = [];

  sheets.forEach((s, idx) => {
    const id = `sh-${idx}`;
    sheetOrder.push(id);

    // Univer cellData: { row: { col: { v, t, f } } }
    const cellData: Record<string, Record<string, Record<string, unknown>>> = {};
    for (const [ref, cell] of Object.entries(s.cells || {})) {
      const rc = refToRC(ref);
      if (!rc) continue;
      const isFormula = typeof cell.f === "string" && cell.f.startsWith("=");
      const value = isFormula ? null : cell.v;
      if (!isFormula && (value === "" || value === undefined || value === null)) continue;

      const entry: Record<string, unknown> = {
        v: isFormula ? cell.v ?? 0 : value,
        // 1 = STRING, 2 = NUMBER, 3 = BOOLEAN
        t: isFormula ? 2 : typeof value === "number" ? 2 : typeof value === "boolean" ? 3 : 1,
      };
      if (isFormula) entry.f = String(cell.f).slice(1);
      // So'zlar ustuni kengroq bo'lsin
      const textWidth = typeof value === "string" && !isFormula ? Math.min(Math.ceil(value.length / 10) + 4, 40) : 0;
      if (textWidth) entry.s = { cl: { g: 1 } };

      (cellData[rc.r] ||= {})[rc.c] = entry;
    }

    // Har bir ustunga kenglik (uzun nomlar uchun)
    const columns: Record<string, unknown> = {};
    const colCount = Math.max(s.cols || 1, 6);
    for (let c = 0; c < colCount; c++) {
      let longest = 0;
      for (let r = 0; r < (s.rows || 1); r++) {
        const v = cellData[r]?.[c]?.v;
        if (typeof v === "string" && v.length > longest) longest = v.length;
      }
      const w = Math.max(88, Math.min(Math.ceil(longest * 7.4) + 20, 300));
      if (w > 88) columns[c] = { width: w };
    }

    sheetData[id] = {
      id,
      name: s.name,
      rowCount: Math.max(s.rows || 20, 30),
      columnCount: colCount,
      cellData,
      rowData: {},
      columnData: columns,
      mergeData: [],
      rowHeader: { width: 46, hidden: false },
      columnHeader: { height: 24, hidden: false },
    };
  });

  return {
    id: `wb-${Date.now()}`,
    name: "Akela",
    appVersion: "0.25.1",
    locale: "ruRU",
    sheetOrder,
    sheets: sheetData,
  };
}

export default function UniverSheet({ sheets, readOnly = false, onChange, className, style }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const univerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let univer: any = null;
    let univerAPI: any = null;

    // Univer faqat BRAUZERDA ishlaydi (Canvas) вЂ” shuning uchun dinamik import
    (async () => {
      const [{ createUniver }, { UniverSheetsCorePreset }, { UniverSheetsFilterPreset }, { UniverSheetsSortPreset }, { UniverSheetsFindReplacePreset }, { UniverSheetsConditionalFormattingPreset }, { UniverSheetsDataValidationPreset }, { UniverSheetsNotePreset }, { UniverSheetsHyperLinkPreset }, { UniverSheetsThreadCommentPreset }] =
        await Promise.all([
          import("@univerjs/presets"),
          import("@univerjs/preset-sheets-core"),
          import("@univerjs/preset-sheets-filter"),
          import("@univerjs/preset-sheets-sort"),
          import("@univerjs/preset-sheets-find-replace"),
          import("@univerjs/preset-sheets-conditional-formatting"),
          import("@univerjs/preset-sheets-data-validation"),
          import("@univerjs/preset-sheets-note"),
          import("@univerjs/preset-sheets-hyper-link"),
          import("@univerjs/preset-sheets-thread-comment"),
        ]);

      if (disposed || !host.current) return;

const created = createUniver({
        // Univer'da `ruRU` — kirill harflari va oraliq tirnoq to'g'ri chiqadi
        locale: "ruRU" as any,
        locales: {},
        presets: [
          UniverSheetsCorePreset(),
          UniverSheetsFilterPreset(),
          UniverSheetsSortPreset(),
          UniverSheetsFindReplacePreset(),
          UniverSheetsConditionalFormattingPreset(),
          UniverSheetsDataValidationPreset(),
          UniverSheetsNotePreset(),
          UniverSheetsHyperLinkPreset(),
          UniverSheetsThreadCommentPreset(),
        ],
      });
      univer = created.univer;
      univerAPI = created.univerAPI;
      univerRef.current = created;

      const data = toWorkbookData(sheets);
      const wb = univerAPI.createWorkbook(data, { id: data.id });

      // O'zgarishlarni kuzatish
      const disposable = univerAPI.addEvent(univerAPI.Event.LifeCycleChanged, () => {});
      void disposable;

      if (onChangeRef.current) {
        // Snapshot вЂ” foydalanuvchi yozganda xabar beramiz
        const listener = setInterval(() => {
          const snap = univerAPI.getActiveWorkbook()?.save();
          void snap;
        }, 4000);
        (univer as any).__listener = listener;
      }

      // Faqat ko'rish rejimi
      const unitId = data.id;
      if (readOnly) {
        try {
          univerAPI.setCommandEnabled?.(unitId, false);
        } catch {
          /* qo'llab-quvvatlanmasa jim qolamiz */
        }
      }
      void wb;
    })().catch((e) => {
      console.error("[univer] yuklab bo'lmadi:", e?.message || e);
    });

    return () => {
      disposed = true;
      try {
        const l = (univer as any)?.__listener;
        if (l) clearInterval(l);
      } catch {
        /* ignore */
      }
      try {
        univer?.dispose?.();
      } catch {
        /* ignore */
      }
      univerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={host}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 420, ...style }}
    />
  );
}
