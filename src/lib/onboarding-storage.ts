// lib/onboarding-storage.ts
import { db as prisma } from "./db";

export const ONBOARDING_COURSE_TITLE = "Akela Onboarding";

export const onboardingStorage = {
  async getCourse() {
    return prisma.course.findFirst({
      where: { title: ONBOARDING_COURSE_TITLE },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: { orderBy: { order: "asc" } },
          },
        },
      },
    });
  },

  /**
   * Foydalanuvchiga ko'ra filtrlangan kurs.
   * "Shu xodimga shu darslik ko'rinmasin" вЂ” AccessRule (DENY) shu yerda
   * qo'llaniladi. Kursni ko'rmasligi kerak bo'lsa (course DENY) null qaytaradi.
   */
  async getCourseForUser(userId: string | null | undefined) {
    const course: any = await this.getCourse();
    if (!course) return null;

    const isAdmin = await isPrivileged(userId);
    if (isAdmin) return course;
    if (!userId) return course;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, department: true, position: true, role: true },
    });
    if (!user) return course;

    const rules = await prisma.accessRule.findMany({
      where: {
        resourceType: { in: ["lesson", "course", "module"] },
        OR: [
          { subjectType: "user", subjectValue: user.id },
          { subjectType: "department", subjectValue: user.department || "__none__" },
          { subjectType: "position", subjectValue: user.position || "__none__" },
          { subjectType: "role", subjectValue: user.role },
        ],
      },
      select: { subjectType: true, effect: true, resourceType: true, resourceId: true, expiresAt: true },
    });

    const now = Date.now();
    const active = rules.filter((r) => !r.expiresAt || r.expiresAt.getTime() > now);
    const hasDeny = (type: string, id: string) =>
      active.some((r) => r.resourceType === type && r.resourceId === id && r.effect === "deny");

    if (hasDeny("course", course.id)) return null;
    if (hasDeny("module", "__all__")) return null;

    const hiddenLessons = new Set(
      active.filter((r) => r.resourceType === "lesson" && r.effect === "deny").map((r) => r.resourceId),
    );

    return {
      ...course,
      modules: (course.modules || []).map((module: any) => {
        if (hasDeny("module", module.id)) return null;
        return {
          ...module,
          lessons: (module.lessons || []).filter((l: any) => !hiddenLessons.has(String(l.id))),
        };
      }).filter(Boolean),
    };
  },

  async ensureCourse(authorId: string) {
    const existing = await prisma.course.findFirst({
      where: { title: ONBOARDING_COURSE_TITLE },
    });
    if (existing) return existing;
    return prisma.course.create({
      data: {
        title: ONBOARDING_COURSE_TITLE,
        description:
          "Yangi xodimlar uchun AKELA GROUP MACHINERY bilan tanishtiruv вЂ” tarix, qoidalar, tuzilma, tijorat sirlari.",
        language: "uz",
        coverColor: "from-indigo-500 to-teal-600",
        status: "active",
        isPublic: true,
        authorId,
      },
    });
  },

  async createModule(courseId: string, title: string) {
    const last = await prisma.module.findFirst({
      where: { courseId },
      orderBy: { order: "desc" },
    });
    return prisma.module.create({
      data: {
        courseId,
        title,
        description: "",
        order: (last?.order ?? -1) + 1,
        viewOrder: "open",
      },
    });
  },

  async updateModule(id: string, data: { title?: string; description?: string }) {
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

  async createLesson(moduleId: string, data: { title: string; content?: string; videoUrl?: string; order?: number; status?: string }) {
    const last = await prisma.lesson.findFirst({
      where: { moduleId },
      orderBy: { order: "desc" },
    });
    return prisma.lesson.create({
      data: {
        moduleId,
        title: data.title,
        content: data.content || "",
        videoUrl: data.videoUrl || null,
        order: data.order ?? (last?.order ?? -1) + 1,
        status: data.status || "active",
        language: "uz",
        duration: 0,
      },
    });
  },

  async updateLesson(
    id: string,
    data: { title?: string; content?: string; videoUrl?: string; order?: number; status?: string }
  ) {
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

  async getModule(id: string) {
    return prisma.module.findUnique({
      where: { id },
      include: { lessons: { orderBy: { order: "asc" } } },
    });
  },

  async getLessonById(id: string) {
    return prisma.lesson.findUnique({ where: { id } });
  },
};

/** Admin yoki grader — ular uchun ko'rinish qoidalari qo'llanilmaydi. */
async function isPrivileged(userId: string | null | undefined) {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "admin" || user?.role === "grader";
}