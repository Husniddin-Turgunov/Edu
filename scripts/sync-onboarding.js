const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();
const jsonPath = path.join(__dirname, "..", "src", "data", "akela-onboarding.json");
const json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

(async () => {
  const course = await prisma.course.findFirst({ where: { title: "Akela Onboarding" } });
  if (!course) {
    console.error("No 'Akela Onboarding' course found in DB");
    process.exit(1);
  }

  const oldMods = await prisma.module.findMany({ where: { courseId: course.id } });
  for (const m of oldMods) {
    await prisma.lesson.deleteMany({ where: { moduleId: m.id } });
    await prisma.module.delete({ where: { id: m.id } });
  }

  for (let mi = 0; mi < json.length; mi++) {
    const modData = json[mi];
    const mod = await prisma.module.create({
      data: {
        courseId: course.id,
        title: modData.title,
        order: mi,
        description: "",
        viewOrder: "open",
      },
    });

    if (modData.lessons) {
      for (let li = 0; li < modData.lessons.length; li++) {
        const lesData = modData.lessons[li];
        await prisma.lesson.create({
          data: {
            moduleId: mod.id,
            title: lesData.title,
            content: lesData.content || "",
            order: li,
          },
        });
      }
    }
  }

  console.log("✅ Synced all modules and lessons with full content into DB!");
  process.exit(0);
})();
