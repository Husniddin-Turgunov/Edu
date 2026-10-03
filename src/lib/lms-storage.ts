// lib/lms-storage.ts - Prisma-based LMS storage (replaces in-memory lesson-storage)
import { db as prisma } from "./db";
import { parseAnswersJson } from "./answers-json";

// Eski (kesilgan) natijalarni o'qish uchun yumshoq parser — `./answers-json.ts`
export { parseAnswersJson };

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

/**
 * Tanlangan javob to'g'rimi — review uchun serverda hisoblanadi.
 * true = to'g'ri, false = noto'g'ri, null = javob berilmagan.
 */
function computeAnswerCorrect(q: any, selected: any): boolean | null {
  if (q.type === "written") {
    if (selected == null || selected === "") return null;
    const a = String(selected).trim().toLowerCase();
    const b = String(q.correctAnswer || "").trim().toLowerCase();
    if (!b) return null;
    return a === b;
  }
  const correctIds: string[] = (q.choices || []).filter((c: any) => c.isCorrect).map((c: any) => c.id);
  if (selected == null || selected === "" || (Array.isArray(selected) && selected.length === 0)) return null;
  if (Array.isArray(selected)) {
    return selected.length === correctIds.length && selected.every((s: any) => correctIds.includes(s));
  }
  return correctIds.includes(selected);
}

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

  async updateQuestion(
    id: string,
    data: {
      text: string;
      type?: string;
      points?: number;
      explanation?: string;
      correctAnswer?: string;
      choices?: { text: string; isCorrect: boolean }[];
    },
  ) {
    const questionType = data.type || "single";
    return prisma.$transaction(async (tx) => {
      const currentChoices = await tx.choice.findMany({ where: { questionId: id }, orderBy: { order: "asc" } });
      const nextChoices = questionType !== "written" && data.choices ? data.choices : [];

      for (const choice of currentChoices.slice(nextChoices.length)) {
        await tx.choice.delete({ where: { id: choice.id } });
      }
      for (const [index, choice] of nextChoices.entries()) {
        if (currentChoices[index]) {
          await tx.choice.update({
            where: { id: currentChoices[index].id },
            data: { text: choice.text, isCorrect: choice.isCorrect, order: index },
          });
        } else {
          await tx.choice.create({ data: { questionId: id, text: choice.text, isCorrect: choice.isCorrect, order: index } });
        }
      }

      return tx.question.update({
        where: { id },
        data: {
          text: data.text,
          type: questionType,
          points: data.points ?? 1,
          explanation: data.explanation || null,
          correctAnswer: questionType === "written" ? data.correctAnswer || null : null,
        },
        include: { choices: { orderBy: { order: "asc" } } },
      });
    });
  },

  async deleteQuestion(id: string) {
    return prisma.question.delete({ where: { id } });
  },

  // Bir nechat savolni BIRTA so'rovda o'chirish (tezroq).
  // Variantlar Choice -> Question onDelete: Cascade orqali o'chadi.
  async deleteQuestions(ids: string[]) {
    const clean = Array.from(new Set(ids.filter(Boolean)));
    if (!clean.length) return { count: 0 };
    return prisma.question.deleteMany({ where: { id: { in: clean } } });
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

  /**
   * Barqaror (deterministic) seed — FNV-1a.
   * Shu satr har doim BIR XIL raqamni qaytaradi (Math.random emas).
   */
  hashSeed(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  },

  /** mulberry32 PRNG — seed dan barqaror oqim. */
  mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  /**
   * Variantlarni KO'RSATISH uchun tartiblash.
   *
   * Qoida (foydalanuvchi talabi):
   *  - A/B/C/D slotlari doim ketma-ket (qator har doim A→B→C→D) va test
   *    davomida joyi ALMASHMAYDI (har GET / sahifa yangilanishda bir xil);
   *  - shuffleChoices yoqilgan bo'lsa — faqat javob MATNLARI slotlar
   *    orasida almashadi, ustun tartibiga ta'sir qilmaydi;
   *  - seed = userId + testId + questionId → bir xil foydalanuvchi uchun
   *    test va review HAR DOIM BIR XIL tartibni ko'rsatadi (anti-cheat
   *    saqlanadi: turli foydalanuvchilarda xarakterlar boshqacha).
   *  - `order` har doim ko'rsatish indeksiga teng (0..n-1) — hariflar
   *    (65+order) ham doim to'g'ri ketma-ket.
   */
  orderChoicesForDisplay(
    choices: any[],
    opts: { userId: string; testId: string; questionId: string; shuffle: boolean },
  ): any[] {
    let list = [...choices];
    if (opts.shuffle && list.length > 1) {
      const rnd = this.mulberry32(
        this.hashSeed(`${opts.userId}:${opts.testId}:${opts.questionId}`),
      );
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    return list.map((c, idx) => ({ ...c, order: idx }));
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
    // maxAttempts check — faqat TUGALLANGAN (completedAt != null) urinishlar
    // hisoblanadi. Retake placeholder (gradingStatus="retake", completedAt=null)
    // qo'shimcha imkoniyat beradi: u bor ekan test qayta ochiladi.
    const unconsumedRetakes = await prisma.testResult.count({
      where: { userId, testId, gradingStatus: "retake", completedAt: null },
    });
    if (test.maxAttempts && test.maxAttempts > 0) {
      const completed = await prisma.testResult.count({
        where: { userId, testId, completedAt: { not: null } },
      });
      // Bloklash: tugallangan urinishlar yetdi VA kutilayotgan retake yo'q
      if (completed >= test.maxAttempts && unconsumedRetakes === 0) {
        return { blocked: true, test, attempts: completed } as any;
      }
    }
    // ===== Savollar soni cheklovi (questionCount) =====
    // Muhim: random YOQILGAN bo'lsa avval BUTUN savol bazasi aralashtiriladi,
    // keyin shu aralashgan ro'yxatdan kerakli sonda savol olinadi — natijada har
    // bir urinishda bazadan TASODIFIY savollar tanlanadi (faqat tartibi emas).
    // Random o'chirilgan bo'lsa — savollar tartibi bo'yicha birinchi N tasi olinadi.
    let questions = [...test.questions];
    if (test.shuffleQuestions) {
      questions = this.shuffleArray(questions);
    }
    const limit = Number((test as any).questionCount) || 0;
    if (limit > 0 && questions.length > limit) {
      questions = questions.slice(0, limit);
    }
    questions = questions.map((q) => {
      // Barqaror ko'rsatish tartibi: slotlar A→B→C→D doim ketma-ket,
      // faqat matnlar (shuffleChoices bo'lsa) barqaror seed bilan almashadi.
      // Eski Math.random har GET da qayta aralashtirib, ABCD joyini
      // "olib ketardi" — endi test davomida o'zgarmaydi.
      const choices = this.orderChoicesForDisplay((q as any).choices, {
        userId,
        testId,
        questionId: String(q.id),
        shuffle: !!(test as any).shuffleChoices,
      });
      return { ...q, choices };
    });
    return {
      ...test,
      questions,
      // Ko'rsatilgan savollar soni (cheklov qo'llangandan keyin)
      presentedCount: questions.length,
      // Bazadagi jami savollar soni
      totalQuestions: test.questions.length,
      retakePending: unconsumedRetakes > 0,
    };
  },

  async submitTestResult(data: { userId: string; testId: string; answers: Record<string, string>; questionIds?: string[]; }) {
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
    // maxAttempts — faqat tugallangan urinishlar; retake placeholder
    // qo'shimcha imkoniyat beradi (u bor ekan submit mumkin)
    if ((test as any).maxAttempts && (test as any).maxAttempts > 0) {
      const completed = await prisma.testResult.count({
        where: { userId: data.userId, testId: data.testId, completedAt: { not: null } },
      });
      const unconsumedRetakes = await prisma.testResult.count({
        where: { userId: data.userId, testId: data.testId, gradingStatus: "retake", completedAt: null },
      });
      if (completed >= (test as any).maxAttempts && unconsumedRetakes === 0) {
        throw new Error(`Urinishlar tugadi (${(test as any).maxAttempts} / ${completed})`);
      }
    }

    // Cheklangan testda (questionCount) ball faqat KO'RSATILGAN savollar asosida
    // hisoblanadi: 30 savoldan 30 tasi to'g'ri → 100%. Klient ko'rgan savollar
    // ro'yxati `questionIds` orqali keladi (faqat shu testga tegishli ID lar olinadi).
    // Yuborilmagan javoblar (javobsiz qolganlar) noto'g'ri hisoblanadi.
    const allQuestions = test.questions as any[];
    const allIds = new Set(allQuestions.map((q) => String(q.id)));
    const limit = Number((test as any).questionCount) || 0;
    const answeredIds = Object.keys(data.answers || {}).filter(
      (k) => !k.startsWith("__") && allIds.has(k),
    );
    let presentedIds: string[];
    if (Array.isArray(data.questionIds) && data.questionIds.length > 0) {
      presentedIds = Array.from(
        new Set(data.questionIds.map(String).filter((qid) => allIds.has(qid))),
      );
    } else if (limit > 0 && answeredIds.length > 0) {
      // Zaxira (eski/keshdagi klient): cheklangan testda javob berilgan savollar —
      // ko'rsatilgan savollar hisoblanadi.
      presentedIds = answeredIds;
    } else {
      presentedIds = allQuestions.map((q) => String(q.id));
    }
    const presentedSet = new Set(presentedIds);
    const questions = allQuestions.filter((q) => presentedSet.has(String(q.id)));
    // Review/grading shu ro'yxatdan foydalanishi uchun natijaga saqlaymiz
    const answersToStore = { ...data.answers, __questionIds: presentedIds };

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

    const completedAt = new Date();
    const gradingStatus = hasWritten ? "pending" : "auto";

    // Retake placeholder bo'lsa — uni yangi natijaga aylantiramiz (yeyib,
    // takror qator yaratmaymiz) va `__retake: true` belgisini yozamiz.
    // Shu belgi admin panelida "qayta topshirishdan keyingi natija" deya
    // ko'rsatiladi. Placeholder yo'q bo'la — oddiy natija yaratiladi.
    const placeholder = await prisma.testResult.findFirst({
      where: { userId: data.userId, testId: data.testId, gradingStatus: "retake", completedAt: null },
      orderBy: { startedAt: "desc" },
    });

    let result;
    if (placeholder) {
      result = await prisma.testResult.update({
        where: { id: placeholder.id },
        data: {
          score: finalScore as number | undefined,
          passed,
          answers: JSON.stringify({ ...answersToStore, __retake: true }),
          completedAt,
          gradingStatus,
        },
      });
    } else {
      result = await prisma.testResult.create({
        data: {
          userId: data.userId,
          testId: data.testId,
          score: finalScore as number | undefined,
          passed,
          answers: JSON.stringify(answersToStore),
          completedAt,
          gradingStatus,
        },
      });
    }
    // Natija ekrani uchun: nechta to'g'ri / nechta xato / jami (avto-baholangan savollar)
    return {
      ...result,
      correctCount,
      wrongCount: Math.max(0, mcqCount - correctCount),
      autoGradedCount: mcqCount,
      hasWritten,
    } as any;
  },

  async getTestHistory(userId: string, testId?: string) {
    // Faqat tugallangan natijalar (retake placeholder ko'rinmaydi)
    const where: any = { userId, completedAt: { not: null } };
    if (testId) where.testId = testId;
    return prisma.testResult.findMany({ where, orderBy: { startedAt: "desc" }, include: { test: { select: { title: true } } } });
  },

  async getAllTestResultsForAdmin(testId?: string) {
    // Faqat tugallangan natijalar (placeholder ko'rinmaydi)
    const where: any = { completedAt: { not: null } };
    if (testId) where.testId = testId;
    return prisma.testResult.findMany({ where, orderBy: { startedAt: "desc" }, include: { user: { select: { id: true, name: true, surname: true, email: true } }, test: { select: { title: true } } } });
  },

  /**
   * Oldingi urinishni ko'rish: savollar + tanlangan javoblar.
   * isCorrect faqat urinishlar tugaganda ochiladi — cheat oldini olish uchun.
   */
  async getAttemptReview(testId: string, userId: string, resultId?: string) {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: { orderBy: { order: "asc" }, include: { choices: { orderBy: { order: "asc" } } } },
      },
    });
    if (!test) return null;

    const resultWhere: any = { userId, testId, completedAt: { not: null } };
    if (resultId) resultWhere.id = resultId;
    const result = await prisma.testResult.findFirst({
      where: resultWhere,
      orderBy: { startedAt: "desc" },
    });
    if (!result) return null;

    const attemptCount = await prisma.testResult.count({ where: { userId, testId, completedAt: { not: null } } });
    const maxAttempts = (test as any).maxAttempts ?? 0;
    // Foydalanuvchi o'z natijasini ko'rayotganda har doim to'g'ri javobni ko'rsatamiz
    // (topshirilgan urinishni ko'rish — o'rganish uchun). Cheat himoyasi kerak bo'lsa
    // admin paneldan maxAttempts bilan boshqariladi, review doim ochiq.
    const revealCorrect = true;

    // Eski (kesilgan) JSON bo'lsa ham to'liq juftliklar tiklanadi — pastdagi
    // `parseAnswersJson` izohiga qarang.
    const parsedAnswers = parseAnswersJson(result.answers);
    const answers: Record<string, any> = parsedAnswers.answers;
    const answersTruncated = parsedAnswers.truncated;

    // Cheklangan testda faqat KO'RSATILGAN savollarni ko'rsatamiz
    // (`__questionIds` submit paytida saqlanadi).
    const presentedIds: string[] = Array.isArray((answers as any).__questionIds)
      ? (answers as any).__questionIds.map(String)
      : [];

    const presentedQuestions = (test as any).questions.filter(
      (q: any) => presentedIds.length === 0 || presentedIds.includes(String(q.id)),
    );
    // Saqlanib qolgan javoblar soni (ko'rsatilgan savollar bo'yicha) — UI
    // "javoblar saqlanmagan" holatini ajratib ko'rsatishi uchun.
    const answeredCount = presentedQuestions.filter((q: any) => {
      const s = answers[q.id];
      return s != null && s !== "" && !(Array.isArray(s) && s.length === 0);
    }).length;

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
      // Eski kesilgan JSON → ba'zi javoblar qaytarib bo'lmaydi (data yo'qolgan).
      answersTruncated,
      answeredCount,
      questionCount: presentedQuestions.length,
      questions: presentedQuestions.map((q: any) => {
        const selected = answers[q.id] ?? null;
        return {
          id: q.id,
          text: q.text,
          type: q.type,
          points: q.points,
          order: q.order,
          explanation: revealCorrect ? q.explanation : null,
          correctAnswer: revealCorrect ? q.correctAnswer : null,
          selected,
          answerCorrect: computeAnswerCorrect(q, selected),
          // Test paytida ko'rsatilgan BIR XIL tartib (seed userId+testId+qId)
          // — review hariflari ham foydalanuvchi bosgan A/B/C/D ga mos keladi.
          choices: this.orderChoicesForDisplay(
            (q.choices || []).map((c: any) => ({
              id: c.id,
              text: c.text,
              isCorrect: revealCorrect ? !!c.isCorrect : false,
            })),
            { userId, testId, questionId: String(q.id), shuffle: !!test.shuffleChoices },
          ).map((c: any) => ({ id: c.id, text: c.text, order: c.order, isCorrect: c.isCorrect })),
        };
      }),
    };
  },
};
