import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// GET: all test results (with optional status filter)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // pending | graded | auto | null = all

    const where: any = { completedAt: { not: null } }; // retake placeholder ko'rinmaydi
    if (status) where.gradingStatus = status;

    const results = await prisma.testResult.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, surname: true } },
        test: {
          select: {
            id: true,
            title: true,
            passScore: true,
            questions: { select: { id: true, text: true, type: true, points: true, correctAnswer: true, choices: true } },
          },
        },
      },
      orderBy: { completedAt: "desc" },
    });
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("GET /api/admin/lms/grading error:", error);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}

// POST: grade a result
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { resultId, score, passed } = body;
    if (!resultId || score === undefined) {
      return NextResponse.json({ ok: false, error: "resultId and score required" }, { status: 400 });
    }
    const updated = await prisma.testResult.update({
      where: { id: resultId },
      data: {
        score: Number(score),
        passed: Boolean(passed),
        gradingStatus: "graded",
        graderId: session.userId,
        gradedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, result: updated });
  } catch (error) {
    console.error("POST /api/admin/lms/grading error:", error);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
