import { NextResponse } from "next/server";
import { buildTestImportTemplate } from "@/lib/test-import";

export const dynamic = "force-dynamic";

export async function GET() {
  const buf = buildTestImportTemplate();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="akela-test-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
