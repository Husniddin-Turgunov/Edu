import { readFile } from "node:fs/promises";
import path from "node:path";
import * as fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { getAttestationReview } from "@/db/attestation-reviews";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const decisionLabels: Record<string, string> = {
  middle_confirmed: "Middle подтверждён",
  middle_not_confirmed: "Middle не подтверждён",
  keep_junior: "Оставить Junior",
  additional_learning: "Назначить дополнительное обучение",
  repeat: "Повторить аттестацию",
  transfer: "Перевести на другую должность",
};

function wrap(text: string, max = 82) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const { id } = await params;
  const detail = await getAttestationReview(Number(id));
  if (!detail || !detail.review.protocolNumber) {
    return new Response("Protocol not found", { status: 404 });
  }
  const allowed =
    session?.role === "admin" ||
    (session?.role === "participant" &&
      session.employeeId === detail.employee.id &&
      detail.review.status === "completed");
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontPath = path.join(
    process.cwd(),
    "public",
    "manrope-cyrillic-400-normal.woff",
  );
  const font = await pdf.embedFont(await readFile(fontPath), { subset: true });
  let page = pdf.addPage([595.28, 841.89]);
  const margin = 48;
  let y = 790;

  const line = (text: string, size = 10, gap = 15) => {
    for (const part of wrap(text, size >= 16 ? 60 : 88)) {
      if (y < 55) {
        page = pdf.addPage([595.28, 841.89]);
        y = 790;
      }
      page.drawText(part, {
        x: margin,
        y,
        size,
        font,
        color: rgb(0.1, 0.11, 0.18),
      });
      y -= gap;
    }
  };
  const section = (title: string) => {
    y -= 8;
    line(title, 13, 19);
  };
  const score = (label: string, value: number | null) =>
    line(`${label}: ${value == null ? "—" : `${Math.round(value * 10) / 10}%`}`);

  line("AKELA GROUP", 18, 24);
  line("ПРОТОКОЛ АТТЕСТАЦИИ СОТРУДНИКА", 16, 22);
  line(`№ ${detail.review.protocolNumber}`, 11, 18);
  line(
    `Дата: ${new Date(detail.review.completedAt || detail.review.scheduledAt).toLocaleDateString("ru-RU")}`,
  );

  section("1. Сведения о сотруднике");
  line(`Ф.И.О.: ${detail.employee.name}`);
  line(`Должность: ${detail.employee.roleTitle}`);
  line(`Подразделение: ${detail.employee.department}`);
  line(
    `Уровень: ${detail.employee.currentLevel} → ${detail.employee.targetLevel}`,
  );
  line(`Аттестация: ${detail.attestation.title}`);
  line(`Комиссия: ${detail.review.commission.join(", ") || "—"}`);

  section("2. Результаты");
  score("Тест", detail.review.testScore);
  score("Практическая задача", detail.review.practicalScore);
  score("Рабочий проект", detail.review.projectScore);
  score("Защита", detail.review.defenseScore);
  score("Самостоятельность", detail.review.independenceScore);
  score("Дисциплина", detail.review.disciplineScore);
  score("Оценка наставника", detail.review.mentorScore);
  score("Оценка руководителя", detail.review.managerScore);
  score("Итоговый балл", detail.review.finalScore);

  section("3. Компетенции и комментарии");
  line(
    `Слабые компетенции: ${detail.review.weakCompetencies.join(", ") || "—"}`,
  );
  line(`Наставник: ${detail.review.mentorComment || "—"}`);
  line(`Руководитель: ${detail.review.managerComment || "—"}`);
  line(`Комиссия: ${detail.review.commissionComment || "—"}`);

  section("4. Решение комиссии");
  line(decisionLabels[detail.review.decision] || detail.review.decision || "—", 12);
  line(
    `Следующая проверка: ${
      detail.review.nextCheckAt
        ? new Date(detail.review.nextCheckAt).toLocaleDateString("ru-RU")
        : "не назначена"
    }`,
  );

  section("5. Подписи");
  for (const signer of detail.review.signatures) {
    line(`${signer}  ____________________`);
  }
  if (detail.review.signatures.length === 0) {
    line("____________________");
  }

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${detail.review.protocolNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
