import { db as prisma } from "./db";
import fs from "fs/promises";
import path from "path";

// Job storage — DB persistence for Kasbiy kurslar (ticket)

export type JobDayInput = {
  title: string;
  num: number;
  kind: string;
  content: string;
  videoUrl?: string;
  order?: number;
};

export type JobPartInput = {
  title: string;
  type: string;
  order?: number;
  days: JobDayInput[];
};

export type JobCourseInput = {
  jobId?: string;
  folder?: string;
  title: string;
  slug: string;
  hasNormative?: boolean;
  order?: number;
  parts?: JobPartInput[];
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0400-\u04FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-") || "job-" + Date.now();
}

export const jobStorage = {
  async getAllJobs() {
    const jobs = await prisma.jobCourse.findMany({
      orderBy: { order: "asc" },
      include: {
        parts: {
          orderBy: { order: "asc" },
          include: {
            days: { orderBy: { order: "asc" } },
          },
        },
      },
    });
    // Map to legacy shape expected by frontend: id = jobId, parts[].days with same fields
    return jobs.map((j) => ({
      id: j.jobId,
      folder: j.folder,
      title: j.title,
      slug: j.slug,
      hasNormative: j.hasNormative,
      order: j.order,
      _id: j.id, // internal cuid
      parts: j.parts.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        order: p.order,
        days: p.days.map((d) => ({
          id: d.id,
          title: d.title,
          num: d.num,
          kind: d.kind,
          content: d.content,
          videoUrl: d.videoUrl,
          order: d.order,
        })),
      })),
    }));
  },

  async getJobBySlug(slug: string) {
    const job = await prisma.jobCourse.findFirst({
      where: {
        OR: [{ slug }, { jobId: slug }],
      },
      include: {
        parts: {
          orderBy: { order: "asc" },
          include: { days: { orderBy: { order: "asc" } } },
        },
      },
    });
    if (!job) return null;
    return {
      id: job.jobId,
      folder: job.folder,
      title: job.title,
      slug: job.slug,
      hasNormative: job.hasNormative,
      order: job.order,
      _id: job.id,
      parts: job.parts.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        order: p.order,
        days: p.days.map((d) => ({
          id: d.id,
          title: d.title,
          num: d.num,
          kind: d.kind,
          content: d.content,
          videoUrl: d.videoUrl,
          order: d.order,
        })),
      })),
    };
  },

  async createJob(data: JobCourseInput) {
    const slug = slugify(data.slug || data.title);
    const existing = await prisma.jobCourse.findFirst({ where: { slug } });
    if (existing) throw new Error("Slug allaqachon mavjud");

    const maxOrder = await prisma.jobCourse.aggregate({ _max: { order: true } });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const maxJobId = await prisma.jobCourse.findMany({ select: { jobId: true } });
    const maxNumeric = maxJobId.reduce((m, j) => Math.max(m, parseInt(j.jobId, 10) || 0), 0);
    const nextJobId = String(data.jobId || maxNumeric + 1);

    const parts = data.parts ?? [
      { title: `1-QISM — 5 kunlik "Normativlar" kursi`, type: "5day", order: 0, days: [] },
      { title: `2-QISM — 30 kunlik professional kurs (4 hafta)`, type: "30day", order: 1, days: [] },
    ];

    const created = await prisma.jobCourse.create({
      data: {
        jobId: nextJobId,
        folder: data.folder || `${nextJobId}.${data.title.replace(/\s+/g, "_")}`,
        title: data.title.trim(),
        slug,
        hasNormative: data.hasNormative ?? true,
        order: data.order ?? nextOrder,
        parts: {
          create: parts.map((p, pi) => ({
            title: p.title,
            type: p.type,
            order: p.order ?? pi,
            days: {
              create: (p.days || []).map((d, di) => ({
                title: d.title,
                num: d.num,
                kind: d.kind,
                content: d.content,
                videoUrl: d.videoUrl,
                order: d.order ?? di,
              })),
            },
          })),
        },
      },
      include: {
        parts: { include: { days: true } },
      },
    });
    return created;
  },

  async updateJob(slug: string, data: Partial<JobCourseInput> & { parts?: any[] }) {
    const existing = await prisma.jobCourse.findFirst({ where: { OR: [{ slug }, { jobId: slug }] } });
    if (!existing) throw new Error("Not found");

    if (data.slug) {
      const newSlug = slugify(String(data.slug));
      if (newSlug !== existing.slug) {
        const dup = await prisma.jobCourse.findFirst({ where: { slug: newSlug } });
        if (dup) throw new Error("Slug allaqachon mavjud");
        data.slug = newSlug;
      } else {
        data.slug = newSlug;
      }
    }

    // If parts provided, replace all parts/days transactionally
    if (data.parts && Array.isArray(data.parts)) {
      // Delete existing parts (cascade deletes days)
      await prisma.jobPart.deleteMany({ where: { jobId: existing.id } });
      // Recreate
      await prisma.$transaction(
        data.parts.map((p: any, pi: number) =>
          prisma.jobPart.create({
            data: {
              jobId: existing.id,
              title: p.title,
              type: p.type || "5day",
              order: p.order ?? pi,
days: {
                  create: (p.days || []).map((d: any, di: number) => ({
                    title: d.title,
                    num: d.num ?? di + 1,
                    kind: d.kind || "kun",
                    content: d.content || "",
                    videoUrl: d.videoUrl,
                    order: d.order ?? di,
                  })),
                },
            },
          })
        )
      );
    }

    const updated = await prisma.jobCourse.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined ? { title: String(data.title).trim() } : {}),
        ...(data.slug !== undefined ? { slug: slugify(String(data.slug)) } : {}),
        ...(data.folder !== undefined ? { folder: String(data.folder).trim() } : {}),
        ...(data.hasNormative !== undefined ? { hasNormative: Boolean(data.hasNormative) } : {}),
        ...(data.order !== undefined ? { order: Number(data.order) } : {}),
      },
      include: {
        parts: { orderBy: { order: "asc" }, include: { days: { orderBy: { order: "asc" } } } },
      },
    });
    return updated;
  },

  async deleteJob(slug: string) {
    const existing = await prisma.jobCourse.findFirst({ where: { OR: [{ slug }, { jobId: slug }] } });
    if (!existing) throw new Error("Not found");
    await prisma.jobCourse.delete({ where: { id: existing.id } });
    return existing;
  },

  async ensureSeedFromJson() {
    const count = await prisma.jobCourse.count();
    if (count > 0) return { seeded: false, count };

    // Try to read JSON file
    const JOBS_PATH = path.join(process.cwd(), "src", "data", "akela-jobs.json");
    try {
      const raw = await fs.readFile(JOBS_PATH, "utf-8");
      const jobs = JSON.parse(raw) as any[];
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
              create: (j.parts || []).map((p: any, pi: number) => ({
                title: p.title || "",
                type: p.type || (pi === 0 ? "5day" : "30day"),
                order: pi,
days: {
                  create: (d: any, di: number) => ({
                    title: d.title || "",
                    num: d.num ?? di + 1,
                    kind: d.kind || "kun",
                    content: d.content || "",
                    videoUrl: d.videoUrl,
                    order: di,
                  })
                },
              })),
            },
          },
        });
      }
      const newCount = await prisma.jobCourse.count();
      return { seeded: true, count: newCount };
    } catch (e) {
      console.error("ensureSeedFromJson error:", e);
      return { seeded: false, count, error: String(e) };
    }
  },

  // ====== JOB TEST RESULTS (history + randomizer support) ======
  async getJobTestHistory(userId: string, jobSlug: string, partIdx?: number, dayIdx?: number) {
    const job = await prisma.jobCourse.findFirst({ where: { OR: [{ slug: jobSlug }, { jobId: jobSlug }] } });
    if (!job) return [];
    const where: any = { userId, jobId: job.id };
    if (partIdx !== undefined) where.partIdx = partIdx;
    if (dayIdx !== undefined) where.dayIdx = dayIdx;
    return prisma.jobTestResult.findMany({ where, orderBy: { createdAt: "desc" } });
  },

  async submitJobTestResult(data: { userId: string; jobSlug: string; partIdx: number; dayIdx: number; jobDayId?: string; score: number; passed: boolean; answers: any }) {
    const job = await prisma.jobCourse.findFirst({ where: { OR: [{ slug: data.jobSlug }, { jobId: data.jobSlug }] } });
    if (!job) throw new Error("Job not found");
    const attemptCount = await prisma.jobTestResult.count({ where: { userId: data.userId, jobId: job.id, partIdx: data.partIdx, dayIdx: data.dayIdx } });
    const attempt = attemptCount + 1;
    return prisma.jobTestResult.create({
      data: {
        userId: data.userId,
        jobId: job.id,
        partIdx: data.partIdx,
        dayIdx: data.dayIdx,
        jobDayId: data.jobDayId || null,
        score: data.score,
        passed: data.passed,
        answers: JSON.stringify(data.answers || {}),
        attempt,
        completedAt: new Date(),
      },
    });
  },

  async getUserJobHistory(userId: string) {
    return prisma.jobTestResult.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { job: { select: { title: true, slug: true } } } });
  },
};
