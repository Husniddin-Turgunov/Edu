import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { parseAnswersJson } from "@/lib/answers-json";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// POST ko'chirildi: /api/admin/skills/retake (alohida route).
// Eski POST shu yerda `deleteMany` qilardi va bazada "retake" belgisini
// qoldirmas edi — endi u yo'q. Retake uchun /retake ishlatiladi.

// GET: Malaka tekshirish — barcha test natijalari + statistika
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "overview";

  try {
    // 1. Umumiy overview — dashboard uchun
    // E'TIBOR: retake placeholderlari (completedAt = null) statistikadan chetlashtiriladi.
    if (action === "overview") {
      const [totalUsers, totalTests, totalResults, passedResults, pendingGrading] = await Promise.all([
        prisma.user.count({ where: { status: "approved" } }),
        prisma.test.count({ where: { status: { in: ["active", "draft"] } } }),
        prisma.testResult.count({ where: { completedAt: { not: null } } }),
        prisma.testResult.count({ where: { passed: true, completedAt: { not: null } } }),
        prisma.testResult.count({ where: { gradingStatus: "pending", completedAt: { not: null } } }),
      ]);

      // O'rtacha ball (faqat tugallangan natijalar)
      const avgScore = await prisma.testResult.aggregate({
        _avg: { score: true },
        where: { completedAt: { not: null } },
      });

      // Oxirgi 7 kun natijalari (kunlik)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const dailyResults = await prisma.testResult.groupBy({
        by: ["startedAt"],
        _count: { id: true },
        _avg: { score: true },
        where: { startedAt: { gte: weekAgo }, completedAt: { not: null } },
        orderBy: { startedAt: "asc" },
      });

      // Testlar bo'yicha natijalar (faqat tugallangan — placeholder yo'q)
      const testStats = await prisma.test.findMany({
        where: { status: { in: ["active", "draft"] } },
        select: {
          id: true,
          title: true,
          passScore: true,
          _count: { select: { questions: true } },
          results: {
            where: { completedAt: { not: null } },
            select: { score: true, passed: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const testAnalytics = testStats.map((t) => {
        const scores = t.results.map((r) => r.score);
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const passRate = scores.length ? Math.round(t.results.filter((r) => r.passed).length / scores.length * 100) : 0;
        return {
          id: t.id,
          title: t.title,
          passScore: t.passScore,
          totalAttempts: t.results.length,
          questionCount: t._count.questions,
          avgScore: avg,
          passRate,
        };
      });

      // Bilim darajalari (foydalanuvchilar bo'yicha)
      // User modelida relation nomi: testResults (results emas)
      const users = await prisma.user.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          department: true,
          testResults: {
            select: { score: true, passed: true, completedAt: true, test: { select: { title: true } }, startedAt: true },
            orderBy: { startedAt: "desc" },
          },
        },
        orderBy: { name: "asc" },
      });

      const userLevels = users.map((u) => {
        // Faqat tugallangan natijalar (retake placeholderlari hisobga olinmaydi)
        const completed = u.testResults.filter((r) => r.completedAt);
        const scores = completed.map((r) => r.score);
        const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const totalPassed = completed.filter((r) => r.passed).length;
        const totalAttempts = completed.length;

        // Bilim darajasi (0-69: III, 70-85: II, 86-100: I)
        let level = "Baholanmagan";
        let levelColor = "gray";
        if (avgScore >= 86) { level = "I daraja"; levelColor = "I daraja"; }
        else if (avgScore >= 70) { level = "II daraja"; levelColor = "II daraja"; }
        else if (avgScore > 0) { level = "III daraja"; levelColor = "III daraja"; }

        return {
          id: u.id,
          name: [u.surname, u.name].filter(Boolean).join(" ") || u.email,
          email: u.email,
          department: u.department,
          avgScore,
          totalAttempts,
          totalPassed,
          level,
          levelColor,
          recentTests: completed.slice(0, 5).map((r) => ({
            testTitle: r.test.title,
            score: r.score,
            passed: r.passed,
            date: r.startedAt,
          })),
        };
      });

      return NextResponse.json({
        ok: true,
        overview: {
          totalUsers,
          totalTests,
          totalResults,
          passedResults,
          pendingGrading,
          avgScore: Math.round(avgScore._avg.score || 0),
          passRate: totalResults ? Math.round(passedResults / totalResults * 100) : 0,
        },
        testAnalytics,
        userLevels,
        dailyResults: dailyResults.map((d) => ({
          date: d.startedAt.toISOString().split("T")[0],
          count: d._count.id,
          avgScore: Math.round(d._avg.score || 0),
        })),
      });
    }

    // 2. Bitta foydalanuvchi natijalari
    if (action === "user") {
      const userId = searchParams.get("userId");
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          department: true,
          position: true,
          createdAt: true,
          testResults: {
            select: {
              id: true,
              score: true,
              passed: true,
              answers: true,
              gradingStatus: true,
              startedAt: true,
              completedAt: true,
              test: {
                select: {
                  id: true,
                  title: true,
                  passScore: true,
                  questions: { select: { id: true, text: true, type: true, points: true, choices: true } },
                },
              },
            },
            orderBy: { startedAt: "desc" },
          },
        },
      });

      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

      // avgScore faqat tugallangan natijalar bo'yicha (placeholder 0 ball qo'shmasin)
      const completedResults = user.testResults.filter((r) => r.completedAt);
      const scores = completedResults.map((r) => r.score);
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const totalPassed = completedResults.filter((r) => r.passed).length;

      // Bilim darajasi (0-69: III, 70-85: II, 86-100: I) — overview bilan bir xil
      let level = "Baholanmagan";
      if (avgScore >= 86) level = "I daraja";
      else if (avgScore >= 70) level = "II daraja";
      else if (avgScore > 0) level = "III daraja";

      const fullName =
        [user.surname, user.name].filter(Boolean).join(" ").trim() || user.email;

      // testResults (placeholder bilan) o'zgarmaydi — u "Imkoniyatlar" ro'yxatida ko'rinadi
      return NextResponse.json({
        ok: true,
        user: {
          ...user,
          fullName,
          avgScore,
          level,
          levelColor: level,
          totalAttempts: completedResults.length,
          totalPassed,
          passRate: completedResults.length
            ? Math.round((totalPassed / completedResults.length) * 100)
            : 0,
        },
      });
    }

    // Admin review — foydalanuvchining urinish natijasini ko'rish
    if (action === "review") {
      const userId = searchParams.get("userId") || undefined;
      const testId = searchParams.get("testId") || undefined;
      const resultId = searchParams.get("resultId") || undefined;
      if (!userId || !testId) return NextResponse.json({ error: "userId and testId required" }, { status: 400 });

      const test = await prisma.test.findUnique({
        where: { id: testId },
        include: {
          questions: { orderBy: { order: "asc" }, include: { choices: { orderBy: { order: "asc" } } } },
        },
      });
      if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

      const resultWhere: any = { userId, testId, completedAt: { not: null } };
      if (resultId) resultWhere.id = resultId;
      const result = resultId
        ? await prisma.testResult.findUnique({ where: { id: resultId, userId, testId, completedAt: { not: null } } })
        : await prisma.testResult.findFirst({ where: resultWhere, orderBy: { startedAt: "desc" } });
      if (!result) return NextResponse.json({ error: "Result not found" }, { status: 404 });

      const revealCorrect = true;
      // Eski (kesilgan) JSON lar uchun yumshoq o'qish — javoblarning bir qismi
      // bo'lmasa ham, qolganini ko'rsatamiz (pastdagi `parseAnswersJson`).
      const parsedAnswers = parseAnswersJson(result.answers);
      const answers: Record<string, any> = parsedAnswers.answers;
      // Cheklangan testda faqat KO'RSATILGAN savollarni ko'rsatamiz
      // (`__questionIds` submit paytida saqlanadi; kesilgan bo'lsa ham tiklanadi).
      const presentedIds: string[] = Array.isArray(answers.__questionIds)
        ? answers.__questionIds.map(String)
        : [];
      const reviewedQuestions = (test as any).questions.filter(
        (q: any) => presentedIds.length === 0 || presentedIds.includes(String(q.id)),
      );

      return NextResponse.json({
        ok: true,
        review: {
          result: {
            id: result.id,
            score: result.score,
            passed: result.passed,
            completedAt: result.completedAt,
            gradingStatus: result.gradingStatus,
            isRetake: !!answers.__retake,
          },
          test: {
            id: test.id,
            title: test.title,
            passScore: test.passScore,
          },
          revealCorrect,
          // Eski kesilgan JSON → ba'zi javoblar yo'q (UI ogohlantirishi mumkin)
          answersTruncated: parsedAnswers.truncated,
          questions: reviewedQuestions.map((q: any) => {
            const selected = answers[q.id] ?? null;
            // Savol darajasida javob to'g'rimi (true/false/null) — UI qizil "Noto'g'ri" uchun
            let answerCorrect: boolean | null = null;
            if (q.type === "written") {
              if (selected != null && selected !== "" && q.correctAnswer) {
                answerCorrect =
                  String(selected).trim().toLowerCase() ===
                  String(q.correctAnswer).trim().toLowerCase();
              }
            } else if (selected != null && selected !== "" && !(Array.isArray(selected) && selected.length === 0)) {
              const correctIds = (q.choices || []).filter((c: any) => c.isCorrect).map((c: any) => c.id);
              answerCorrect = Array.isArray(selected)
                ? selected.length === correctIds.length && selected.every((s: any) => correctIds.includes(s))
                : correctIds.includes(selected);
            }
            return {
              id: q.id,
              text: q.text,
              type: q.type,
              points: q.points,
              order: q.order,
              explanation: revealCorrect ? q.explanation : null,
              correctAnswer: revealCorrect ? q.correctAnswer : null,
              selected,
              answerCorrect,
              choices: (q.choices || []).map((c: any) => ({
                id: c.id,
                text: c.text,
                order: c.order,
                isCorrect: revealCorrect ? !!c.isCorrect : false,
              })),
            };
          }),
        },
      });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
