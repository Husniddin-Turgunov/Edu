import { requireAiActor, failResponse } from "@/lib/ai/guard";
import { visibleTools } from "@/lib/ai/tools";
import { resolveProvider, providerChainInfo } from "@/lib/ai/provider";
import { searchEngineInfo } from "@/lib/ai/search";
import { checkRateLimit } from "@/lib/ai/agent";
import { db } from "@/lib/db";
import { SUPPORTED_EXTENSIONS } from "@/lib/ai/documents";
import { rolloverInfo, openDailySession } from "@/lib/ai/session";
import { SKILLS } from "@/lib/ai/skills";
import { configuredServers, mcpApiKey } from "@/lib/ai/mcp";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/capabilities
 *
 * Chat sahifasida ko'rsatiladigan TO'LIQ imkoniyatlar ro'yxati + shu tizimning
 * joriy holati (model, kvota, qidiruv engine) + forma maydonlari uchun
 * tanlash ro'yxatlari (xodimlar, testlar, darslar, fayllar).
 */
export async function GET(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  const actor = guard.actor;
  const provider = resolveProvider();
  const quota = await checkRateLimit(actor.userId);

  const [tests, lessons, attachments, users, courses, jobs, drafts, conversations, ruleCount] =
    await Promise.all([
      db.test.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          visibility: true,
          maxAttempts: true,
          _count: { select: { questions: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.lesson.findMany({
        select: { id: true, title: true, module: { select: { title: true, courseId: true } } },
        orderBy: { title: "asc" },
        take: 300,
      }),
      db.aiAttachment.findMany({
        where: { ownerId: actor.userId },
        select: {
          id: true,
          fileName: true,
          size: true,
          charCount: true,
          wordCount: true,
          parser: true,
          status: true,
          error: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      db.user.findMany({
        select: { id: true, email: true, name: true, surname: true, department: true, position: true, status: true },
        orderBy: [{ department: "asc" }, { surname: "asc" }],
        take: 500,
      }),
      db.course.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" }, take: 200 }),
      db.jobCourse.findMany({ select: { id: true, title: true, slug: true }, orderBy: { title: "asc" }, take: 300 }),
      db.aiDraft.findMany({
        // Faqat o'z qoralamalari (boshqa adminniki ko'rinmaydi)
        where: { ownerId: actor.userId },
        select: { id: true, title: true, topic: true, status: true, sourceMode: true, updatedAt: true, ownerId: true },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
      db.aiConversation.findMany({
        where: { userId: actor.userId },
        select: { id: true, title: true, updatedAt: true, messageCount: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.accessRule.count(),
    ]);

  const tools = visibleTools(actor).map((tool) => ({
    name: tool.name,
    title: tool.title,
    category: tool.category,
    description: tool.description,
    example: tool.example,
    adminOnly: tool.adminOnly,
    mutating: tool.mutating,
    needsConfirm: !!tool.needsConfirm,
    fields: tool.fields,
  }));

  const categories = [...new Set(tools.map((t) => t.category))];

  // Kunlik sessiya + skills + MCP holati (UI va model uchun)
  const roll = rolloverInfo();
  const daily = await openDailySession(actor.userId);
  const servers = configuredServers();
  const apiKeyReady = !!mcpApiKey();

  return Response.json({
    ok: true,
    actor: { name: actor.name, email: actor.email, role: actor.role, isAdmin: actor.isAdmin },
    provider: {
      name: provider.name,
      model: provider.model,
      kind: provider.kind,
      live: provider.live,
    },
    modelChain: providerChainInfo(provider),
    searchEngine: searchEngineInfo(),
    quota,
    supportedExtensions: SUPPORTED_EXTENSIONS,
    tools,
    categories,
    session: {
      dayKey: roll.dayKey,
      rolloverAt: roll.at,
      inHuman: roll.inHuman,
      conversationId: daily.id,
      title: daily.title,
      messages: daily.messageCount,
      remembered: true,
    },
    skills: SKILLS.map((s) => ({ name: s.name, title: s.title, when: s.when })),
    mcp: {
      selfUrl: "/api/mcp",
      enabled: apiKeyReady,
      servers: servers.map((s) => ({ name: s.name, url: s.url, description: s.description })),
    },
    stats: {
      tools: tools.length,
      destructive: tools.filter((t) => t.needsConfirm).length,
      accessRules: ruleCount,
    },
    pickers: {
      tests: tests.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        visibility: t.visibility,
        maxAttempts: t.maxAttempts,
        questions: t._count.questions,
      })),
      lessons: lessons.map((l) => ({ id: l.id, title: l.title, module: l.module?.title || "" })),
      users: users.map((u) => ({
        id: u.id,
        label: [u.surname, u.name].filter(Boolean).join(" ").trim() || u.email,
        email: u.email,
        department: u.department || "",
        position: u.position || "",
        status: u.status,
      })),
      courses: courses.map((c) => ({ id: c.id, title: c.title })),
      jobs: jobs.map((j) => ({ id: j.id, title: j.title })),
      attachments: attachments.map((a) => ({
        id: a.id,
        title: a.fileName,
        chars: a.charCount,
        words: a.wordCount,
        parser: a.parser,
        status: a.status,
        error: a.error,
        date: a.createdAt.toISOString(),
      })),
      drafts: drafts.map((d) => ({
        id: d.id,
        title: d.title,
        topic: d.topic,
        status: d.status,
        sourceMode: d.sourceMode,
        date: d.updatedAt.toISOString(),
      })),
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        messages: c.messageCount,
        date: c.updatedAt.toISOString(),
      })),
      departments: [...new Set(users.map((u) => u.department).filter(Boolean))].sort(),
      positions: [...new Set(users.map((u) => u.position).filter(Boolean))].sort(),
    },
  });
}

export async function POST() {
  return failResponse("Bu yo'l faqat o'qish uchun (GET)", 405);
}