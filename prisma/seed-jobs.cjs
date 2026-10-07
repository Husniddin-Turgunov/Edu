const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');

const prisma = new PrismaClient();

function slugify(input) {
  return String(input).toLowerCase().trim().replace(/[^a-z0-9\u0400-\u04FF]+/g, "-").replace(/^-+|-+$/g, "").replace(/--+/g, "-") || "job-" + Date.now();
}

async function main() {
  const count = await prisma.jobCourse.count();
  console.log("Existing jobCourse count:", count);
  if (count > 0) {
    console.log("Already seeded, skipping. To re-seed, delete existing first.");
    // Optionally update missing? We'll just exit
    return;
  }
  const JOBS_PATH = path.join(process.cwd(), "src", "data", "akela-jobs.json");
  const raw = await fs.readFile(JOBS_PATH, "utf-8");
  const jobs = JSON.parse(raw);
  console.log("Found JSON jobs:", jobs.length);
  for (let idx = 0; idx < jobs.length; idx++) {
    const j = jobs[idx];
    await prisma.jobCourse.create({
      data: {
        jobId: String(j.id),
        folder: j.folder || "",
        title: j.title,
        slug: slugify(j.slug || j.title),
        hasNormative: Boolean(j.hasNormative),
        order: idx,
        parts: {
          create: (j.parts || []).map((p, pi) => ({
            title: p.title || "",
            type: p.type || (pi === 0 ? "5day" : "30day"),
            order: pi,
            days: {
              create: (p.days || []).map((d, di) => ({
                title: d.title || "",
                num: d.num ?? di + 1,
                kind: d.kind || "kun",
                content: d.content || "",
                order: di,
              })),
            },
          })),
        },
      },
    });
    console.log(`Seeded ${idx+1}/${jobs.length}: ${j.title}`);
  }
  const newCount = await prisma.jobCourse.count();
  console.log("Seed done, count:", newCount);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
