// lib/lms-storage.ts - Prisma-based LMS storage (replaces in-memory lesson-storage)
import { db as prisma } from "./db";

export type CourseInput = {
  title: string;
  description?: string;
  language?: string;
  coverColor?: string;
  status?: string;
  isPublic?: boolean;
  authorId: string;
  folderId?: string;
};

export const lmsStorage = {
  // ====== COURSES ======
  async getAllCourses(authorId?: string) {
    return prisma.course.findMany({
      where: authorId ? { authorId } : undefined,
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: { orderBy: { order: "asc" } },
            tests: { orderBy: { order: "asc" } },
          },
        },
        _count: { select: { modules: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getCourse(id: string) {
    return prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: { orderBy: { order: "asc" } },
            tests: {
              orderBy: { order: "asc" },
              include: { _count: { select: { questions: true } } },
            },
          },
        },
      },
    });
  },

  async createCourse(data: CourseInput) {
    const { folderId, ...rest } = data;
    return prisma.course.create({
      data: {
        title: rest.title,
        description: rest.description,
        language: rest.language || "uz",
        coverColor: rest.coverColor || "from-indigo-900 to-teal-950",
        status: rest.status || "draft",
        isPublic: rest.isPublic ?? false,
        authorId: rest.authorId,
        folders: folderId ? { connect: [{ id: folderId }] } : undefined,
      },
    });
  },

  async updateCourse(id: string, data: Partial<CourseInput>) {
    const { folderId, ...rest } = data;
    return prisma.course.update({
      where: { id },
      data: {
        ...rest,
        folders: folderId ? { set: [{ id: folderId }] } : undefined,
      },
    });
  },

  async deleteCourse(id: string) {
    return prisma.course.delete({ where: { id } });
  },

  // ====== FOLDERS ======
  async getAllFolders(authorId?: string) {
    return prisma.courseFolder.findMany({
      where: authorId ? { authorId } : undefined,
      include: { _count: { select: { courses: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  async createFolder(data: { name: string; color?: string; authorId: string }) {
    return prisma.courseFolder.create({
      data: {
        name: data.name,
        color: data.color || "#ef4444",
        authorId: data.authorId,
      },
    });
  },

  async deleteFolder(id: string) {
    return prisma.courseFolder.delete({ where: { id } });
  },

  // ====== MODULES ======
  async createModule(data: { courseId: string; title: string; description?: string; viewOrder?: string; order?: number }) {
    return prisma.module.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        description: data.description,
        viewOrder: data.viewOrder || "open",
        order: data.order ?? 0,
      },
    });
  },

  async updateModule(id: string, data: { title?: string; description?: string; viewOrder?: string; order?: number }) {
    return prisma.module.update({ where: { id }, data });
  },

  async deleteModule(id: string) {
    return prisma.module.delete({ where: { id } });
  },

  async reorderModules(courseId: string, orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, idx) =>
        prisma.module.update({ where: { id }, data: { order: idx } })
      )
    );
  },

  // ====== LESSONS ======
  async getLesson(id: string) {
    return prisma.lesson.findUnique({ where: { id } });
  },

  async createLesson(data: { moduleId: string; title: string; content?: string; videoUrl?: string; pdfUrl?: string; duration?: number; order?: number; language?: string; isHomework?: boolean }) {
    return prisma.lesson.create({
      data: {
        moduleId: data.moduleId,
        title: data.title,
        content: data.content || "",
        videoUrl: data.videoUrl,
        pdfUrl: data.pdfUrl,
        duration: data.duration ?? 0,
        order: data.order ?? 0,
        language: data.language || "uz",
        isHomework: data.isHomework ?? false,
      },
    });
  },

  async updateLesson(id: string, data: Partial<{ title: string; content: string; videoUrl: string; pdfUrl: string; duration: number; order: number; status: string; language: string; isHomework: boolean }>) {
    return prisma.lesson.update({ where: { id }, data });
  },

  async deleteLesson(id: string) {
    return prisma.lesson.delete({ where: { id } });
  },

  async reorderLessons(moduleId: string, orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, idx) =>
        prisma.lesson.update({ where: { id }, data: { order: idx } })
      )
    );
  },

  // ====== TESTS ======
  async createTest(data: { title: string; description?: string; language?: string; timeLimit?: number; passScore?: number; moduleId?: string; courseId?: string; order?: number; maxAttempts?: number; questionCount?: number; shuffleQuestions?: boolean; shuffleChoices?: boolean; visibility?: string; assignedUserIds?: string[] }) {
    return prisma.test.create({
      data: {
        title: data.title,
        description: data.description,
        language: data.language || "uz",
        timeLimit: data.timeLimit ?? 0,
        passScore: data.passScore ?? 60,
        moduleId: data.moduleId,
        courseId: data.courseId,
        order: data.order ?? 0,
        maxAttempts: data.maxAttempts ?? 1,
        questionCount: data.questionCount ?? 10,
        shuffleQuestions: data.shuffleQuestions ?? true,
        shuffleChoices: data.shuffleChoices ?? true,
        visibility: data.visibility || "all",
        assignedUserIds: data.assignedUserIds ? JSON.stringify(data.assignedUserIds) : "[]",
      },
    });
  },

  async getTest(id: string) {
    return prisma.test.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { choices: { orderBy: { order: "asc" } } },
        },
      },
    });
  },

  async getAllTests() {
    return prisma.test.findMany({
      include: {
        _count: { select: { questions: true } },
        module: { select: { id: true, title: true, courseId: true } },
        results: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getTestsForUser(userId: string) {
    const all = await prisma.test.findMany({
      include: {
        _count: { select: { questions: true } },
        module: { select: { id: true, title: true, courseId: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return all.filter((t) => {
      // Show/hide: faqat active testlar foydalanuvchiga ko'rinadi (draft/archived = yashirin)
      if (t.status !== "active") return false;
      if (t.visibility === "all") return true;
      try {
        const ids: string[] = JSON.parse(t.assignedUserIds || "[]");
        return ids.includes(userId);
      } catch { return false; }
    });
  },

  async updateTest(id: string, data: Partial<{ title: string; description: string; timeLimit: number; passScore: number; status: string; maxAttempts: number; shuffleQuestions: boolean; shuffleChoices: boolean; visibility: string; assignedUserIds: string }>) {
    const payload: any = { ...data };
    if ((data as any).assignedUserIds && Array.isArray((data as any).assignedUserIds)) {
      payload.assignedUserIds = JSON.stringify((data as any).assignedUserIds);
    } else if (typeof (data as any).assignedUserIds === "string") {
      // already JSON string
    }
    return prisma.test.update({ where: { id }, data: payload });
  },

  async deleteTest(id: string) {
    return prisma.test.delete({ where: { id } });
  },

  // ====== QUESTIONS ======
  async createQuestion(data: { testId: string; text: string; type?: string; points?: number; explanation?: string; correctAnswer?: string; choices?: { text: string; isCorrect: boolean }[] }) {
    const maxOrder = await prisma.question.aggregate({
      where: { testId: data.testId },
      _max: { order: true },
    });
    const questionType = data.type || "single";
    const createData: any = {
      testId: data.testId,
      text: data.text,
      type: questionType,
      points: data.points ?? 1,
      explanation: data.explanation,
      correctAnswer: data.correctAnswer || null,
      order: (maxOrder._max.order ?? -1) + 1,
    };
    // Yozma javobda variantlar kerak emas
    if (questionType !== "written" && data.choices && data.choices.length > 0) {
      createData.choices = {
        create: data.choices.map((c, i) => ({
          text: c.text,
          isCorrect: c.isCorrect,
          order: i,
        })),
      };
    }
    return prisma.question.create({
      data: createData,
      include: { choices: true },
    });
  },

  async deleteQuestion(id: string) {
    return prisma.question.delete({ where: { id } });
  },

  // ====== TEST ATTEMPTS + RANDOMIZER + HISTORY ======
  shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  async getTestForTaking(testId: string, userId: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: { orderBy: { order: "asc" }, include: { choices: { orderBy: { order: "asc" } } } },
      },
    });
    if (!test) return null;
    // Show/hide: draft/archived testni olish va topshirish mumkin emas
    if (test.status !== "active") return null;
    // visibility check
    if (test.visibility === "selected") {
      try {
        const ids: string[] = JSON.parse(test.assignedUserIds || "[]");
        if (!ids.includes(userId)) return null; // not allowed
      } catch { return null; }
    }
    // maxAttempts check
    if (test.maxAttempts && test.maxAttempts > 0) {
      const count = await prisma.testResult.count({ where: { userId, testId } });
      if (count >= test.maxAttempts) return { blocked: true, test, attempts: count } as any;
    }
    // shuffle
    let questions = [...test.questions];
    if (test.shuffleQuestions) {
      questions = this.shuffleArray(questions);
    }
    questions = questions.map((q) => {
      let choices = [...(q as any).choices];
      if ((test as any).shuffleChoices) {
        choices = this.shuffleArray(choices);
      }
      return { ...q, choices };
    });
    return { ...test, questions };
  },

  async submitTestResult(data: { userId: string; testId: string; answers: Record<string, string>; }) {
    const test = await prisma.test.findUnique({
      where: { id: data.testId },
      include: { questions: { include: { choices: true } } },
    });
    if (!test) throw new Error("Test not found");
    // Show/hide: faqat active testga javob yuborish mumkin
    if (test.status !== "active") throw new Error("Test hozircha yashirilgan");
    // visibility check
    if (test.visibility === "selected") {
      try {
        const ids: string[] = JSON.parse((test as any).assignedUserIds || "[]");
        if (!ids.includes(data.userId)) throw new Error("Sizga bu test biriktirilmagan");
      } catch (e) { throw e; }
    }
    // maxAttempts
    if ((test as any).maxAttempts && (test as any).maxAttempts > 0) {
      const cnt = await prisma.testResult.count({ where: { userId: data.userId, testId: data.testId } });
      if (cnt >= (test as any).maxAttempts) throw new Error(`Urinishlar tugadi (${(test as any).maxAttempts} / ${cnt})`);
    }

    const questions = test.questions as any[];

    // Score: savollar SONI asosida — to'g'ri javoblar / jami MCQ savollar * 100
    // (points vazni emas, shuning uchun barcha to'g'ri bo'lsa 100% bo'ladi)
    let mcqCount = 0;
    let correctCount = 0;
    for (const q of questions) {
      if (q.type === "written") continue; // yozma savollar avtomatik baholanmaydi
      mcqCount += 1;
      const correctChoices = q.choices.filter((c: any) => c.isCorrect).map((c: any) => c.id);
      const ans = (data.answers as any)[q.id];
      const isCorrect = Array.isArray(ans)
        ? ans.length === correctChoices.length && ans.every((v: any) => correctChoices.includes(v))
        : correctChoices.includes(ans);
      if (isCorrect) correctCount += 1;
    }

    // Foiz = to'g'ri savollar soni / jami MCQ savollar soni * 100
    const percent = mcqCount > 0 ? Math.round((correctCount / mcqCount) * 100) : 0;
    const hasWritten = questions.some((q: any) => q.type === "written");
    // Yozma savol bo'lsa — umumiy ball avtomatik hisoblanmaydi (grader qo'yadi)
    const finalScore = hasWritten ? null : percent;
    const passed = hasWritten ? false : percent >= test.passScore;

    const result = await prisma.testResult.create({
      data: {
        userId: data.userId,
        testId: data.testId,
        score: finalScore as number | undefined,
        passed,
        answers: JSON.stringify(data.answers),
        completedAt: new Date(),
        gradingStatus: hasWritten ? "pending" : "auto",
      },
    });
    return result;
  },

  async getTestHistory(userId: string, testId?: string) {
    const where: any = { userId };
    if (testId) where.testId = testId;
    return prisma.testResult.findMany({ where, orderBy: { startedAt: "desc" }, include: { test: { select: { title: true } } } });
  },

  async getAllTestResultsForAdmin(testId?: string) {
    const where: any = {};
    if (testId) where.testId = testId;
    return prisma.testResult.findMany({ where, orderBy: { startedAt: "desc" }, include: { user: { select: { id: true, name: true, surname: true, email: true } }, test: { select: { title: true } } } });
  },

  /**
   * Oldingi urinishni ko'rish: savollar + tanlangan javoblar.
   * isCorrect faqat urinishlar tugaganda (bunibossa) ochiladi — avvalgi urinishlarda cheat oldini olish uchun.
   */
  async getAttemptReview(testId: string, userId: string, resultId?: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: { orderBy: { order: "asc" }, include: { choices: { orderBy: { order: "asc" } } } },
      },
    });
    if (!test) return null;

    const resultWhere: any = { userId, testId };
    if (resultId) resultWhere.id = resultId;
    const result = await prisma.testResult.findFirst({
      where: resultWhere,
      orderBy: { startedAt: "desc" },
    });
    if (!result) return null;

    const attemptCount = await prisma.testResult.count({ where: { userId, testId } });
    const maxAttempts = (test as any).maxAttempts ?? 0;
    // Foydalanuvchi o'z natijasini ko'rayotganda har doim to'g'ri javobni ko'rsatamiz
    // (topshirilgan urinishni ko'rish — o'rganish uchun). Cheat himoyasi kerak bo'lsa
    // admin paneldan maxAttempts bilan boshqariladi, review doim ochiq.
    const revealCorrect = true;

    let answers: Record<string, any> = {};
    try {
      answers = JSON.parse(result.answers || "{}") || {};
    } catch {
      answers = {};
    }

    return {
      result: {
        id: result.id,
        score: result.score,
        passed: result.passed,
        completedAt: result.completedAt,
        gradingStatus: result.gradingStatus,
      },
      test: {
        id: test.id,
        title: test.title,
        passScore: test.passScore,
        maxAttempts,
      },
      attemptCount,
      revealCorrect,
      questions: (test as any).questions.map((q: any) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        points: q.points,
        order: q.order,
        explanation: revealCorrect ? q.explanation : null,
        correctAnswer: revealCorrect ? q.correctAnswer : null,
        selected: answers[q.id] ?? null,
        choices: (q.choices || []).map((c: any) => ({
          id: c.id,
          text: c.text,
          order: c.order,
          isCorrect: revealCorrect ? !!c.isCorrect : false,
        })),
      })),
    };
  },
};
