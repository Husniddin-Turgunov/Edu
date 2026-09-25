import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();

const ONBOARDING_COURSE_TITLE = "Akela Onboarding";
const ONBOARDING_COURSE_SLUG = "akela-onboarding";

type JsonLesson = {
  guid: string;
  title: string;
  sort: number;
  types: string[];
  fileAccess?: "full" | "preview";
  content: string;
  video?: { url: string; title: string; size: string; description: string };
};

type JsonModule = {
  guid: string;
  title: string;
  sort: number;
  lessons: JsonLesson[];
};

async function loadJson(): Promise<JsonModule[]> {
  const p = path.join(process.cwd(), "src", "data", "akela-onboarding.json");
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw) as JsonModule[];
}

async function ensureAdminUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (admin) return admin.id;
  const anyUser = await prisma.user.findFirst();
  if (anyUser) return anyUser.id;
  const created = await prisma.user.create({
    data: {
      email: "seed-admin@akela.local",
      name: "Seed",
      surname: "Admin",
      passwordHash: "!seed-no-login",
      role: "admin",
      status: "approved",
      approvedAt: new Date(),
    },
  });
  return created.id;
}

async function main() {
  const json = await loadJson();
  const authorId = await ensureAdminUserId();

  let course = await prisma.course.findFirst({ where: { title: ONBOARDING_COURSE_TITLE } });

  if (!course) {
    course = await prisma.course.create({
      data: {
        title: ONBOARDING_COURSE_TITLE,
        description:
          "Yangi xodimlar uchun AKELA GROUP MACHINERY bilan tanishtiruv — tarix, qoidalar, tuzilma, tijorat sirlari.",
        language: "uz",
        coverColor: "from-emerald-500 to-teal-600",
        status: "active",
        isPublic: true,
        authorId,
      },
    });
    console.log(`[seed] created Course ${course.id}`);
  } else {
    console.log(`[seed] reusing existing Course ${course.id}`);
  }

  for (let mi = 0; mi < json.length; mi++) {
    const m = json[mi];
    const existingModule = await prisma.module.findFirst({
      where: { courseId: course.id, title: m.title },
    });
    const mod =
      existingModule ??
      (await prisma.module.create({
        data: {
          courseId: course.id,
          title: m.title,
          description: `Modul ${mi + 1}`,
          order: m.sort ?? mi,
          viewOrder: "open",
        },
      }));
    if (!existingModule) console.log(`[seed]   + Module ${mod.id} "${mod.title}"`);

    for (let li = 0; li < m.lessons.length; li++) {
      const l = m.lessons[li];
      const isTest = (l.types || []).includes("test") || (l.types || []).includes("quiz");
      const existingLesson = await prisma.lesson.findFirst({
        where: { moduleId: mod.id, title: l.title },
      });

      const lessonData = {
        moduleId: mod.id,
        title: l.title,
        content: l.content || "",
        videoUrl: l.video?.url ?? null,
        duration: 0,
        order: l.sort ?? li,
        status: "active" as const,
        language: "uz",
        isHomework: false,
      };

      if (existingLesson) {
        await prisma.lesson.update({
          where: { id: existingLesson.id },
          data: {
            content: lessonData.content,
            videoUrl: lessonData.videoUrl,
            order: lessonData.order,
          },
        });
      } else {
        const created = await prisma.lesson.create({ data: lessonData });
        console.log(`[seed]     + Lesson ${created.id} "${created.title}"${isTest ? " [test]" : ""}`);
      }
    }
  }

  console.log("[seed] done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });