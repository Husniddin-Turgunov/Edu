import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

type ExcelRow = {
  question?: string;
  savol?: string;
  A?: string;
  B?: string;
  C?: string;
  D?: string;
  E?: string;
  javob?: string;
  correct?: string;
  answer?: string;
  tushuntirish?: string;
  explanation?: string;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const testId = formData.get("testId") as string | null;

    if (!file || !testId) {
      return NextResponse.json({ ok: false, error: "file and testId required" }, { status: 400 });
    }

    // Read Excel file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Excel fayl bo'sh" }, { status: 400 });
    }

    let created = 0;
    let errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const questionText = row.question || row.savol;
      if (!questionText) {
        errors.push(`Qator ${i + 1}: Savol matni yo'q`);
        continue;
      }

      const a = row.A;
      const b = row.B;
      const c = row.C;
      const d = row.D;
      const e = row.E;
      if (!a || !b) {
        errors.push(`Qator ${i + 1}: Kamida A va B javoblari kerak`);
        continue;
      }

      const correctRaw = (row.javob || row.correct || row.answer || "").toString().trim().toUpperCase();
      if (!correctRaw) {
        errors.push(`Qator ${i + 1}: To'g'ri javob ko'rsatilmagan`);
        continue;
      }

      const allChoices = [
        { text: a, label: "A" },
        { text: b, label: "B" },
        c ? { text: c, label: "C" } : null,
        d ? { text: d, label: "D" } : null,
        e ? { text: e, label: "E" } : null,
      ].filter(Boolean) as { text: string; label: string }[];

      const choices = allChoices.map((ch) => ({
        text: ch.text,
        isCorrect: correctRaw === ch.label,
        order: allChoices.indexOf(ch),
      }));

      try {
        await lmsStorage.createQuestion({
          testId,
          text: questionText,
          type: "single",
          points: 1,
          explanation: row.tushuntirish || row.explanation || "",
          choices,
        });
        created++;
      } catch (e) {
        errors.push(`Qator ${i + 1}: Xato - ${(e as Error).message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      errors: errors.length > 0 ? errors : undefined,
      total: rows.length,
    });
  } catch (error) {
    console.error("POST /api/admin/questions/import error:", error);
    return NextResponse.json({ ok: false, error: "Import failed" }, { status: 500 });
  }
}
