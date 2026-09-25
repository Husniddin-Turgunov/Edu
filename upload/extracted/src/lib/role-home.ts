import { z } from "zod";

export const ROLE_HOME_AUDIENCES = [
  "observer",
  "manager",
  "employee",
  "intern",
] as const;

export type RoleHomeAudience = (typeof ROLE_HOME_AUDIENCES)[number];

export const PERMANENT_VIEW_AUDIENCES = [
  "admin",
  ...ROLE_HOME_AUDIENCES,
] as const;

export type PermanentViewAudience =
  (typeof PERMANENT_VIEW_AUDIENCES)[number];

export type VisibilityPerson = {
  id: number;
  name: string;
  meta: string;
  audience: PermanentViewAudience;
};

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const DEFAULT_BACKGROUND = "#ffffff";
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

const geometrySchema = {
  id: z.string().min(1),
  x: z.number().min(-50).max(150),
  y: z.number().min(-50).max(150),
  w: z.number().min(1).max(100),
  h: z.number().min(1).max(100),
  z: z.number().int(),
};

export const textElementSchema = z.object({
  ...geometrySchema,
  type: z.literal("text"),
  content: z.string(),
  fontSize: z.number().min(8).max(220).default(28),
  color: z.string().default("#1a1b2e"),
  fontWeight: z.number().min(400).max(800).default(700),
  align: z.enum(["left", "center", "right"]).default("left"),
});

export const imageElementSchema = z.object({
  ...geometrySchema,
  type: z.literal("image"),
  src: z.string(),
  alt: z.string().default(""),
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
});

export const videoElementSchema = z.object({
  ...geometrySchema,
  type: z.literal("video"),
  src: z.string(),
  autoplay: z.boolean().default(false),
  muted: z.boolean().default(true),
  loop: z.boolean().default(false),
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
});

export const pageElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  videoElementSchema,
]);

export const roleHomeDocumentSchema = z.object({
  width: z.number().default(CANVAS_WIDTH),
  height: z.number().default(CANVAS_HEIGHT),
  background: z.string().default(DEFAULT_BACKGROUND),
  visibleTo: z
    .array(z.enum(PERMANENT_VIEW_AUDIENCES))
    .default(["intern"]),
  /** Explicit platform users. When non-empty, this overrides visibleTo. */
  visibleUserIds: z.array(z.number().int()).default([]),
  elements: z.array(pageElementSchema).default([]),
});

export type TextElement = z.infer<typeof textElementSchema>;
export type ImageElement = z.infer<typeof imageElementSchema>;
export type VideoElement = z.infer<typeof videoElementSchema>;
export type PageElement = z.infer<typeof pageElementSchema>;
export type RoleHomeDocument = z.infer<typeof roleHomeDocumentSchema>;

export type RoleHomePagesMap = Record<RoleHomeAudience, RoleHomeDocument>;

export function isRoleHomeAudience(value: string): value is RoleHomeAudience {
  return (ROLE_HOME_AUDIENCES as readonly string[]).includes(value);
}

export function emptyRoleHomeDocument(): RoleHomeDocument {
  return {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    background: DEFAULT_BACKGROUND,
    visibleTo: ["intern"],
    visibleUserIds: [],
    elements: [],
  };
}

export function documentVisibleToUser(
  document: RoleHomeDocument,
  input: {
    userId: number;
    audience: PermanentViewAudience | null;
  },
) {
  if (document.visibleUserIds.length > 0) {
    return document.visibleUserIds.includes(input.userId);
  }
  return Boolean(
    input.audience && document.visibleTo.includes(input.audience),
  );
}

export function emptyRoleHomePages(): RoleHomePagesMap {
  return {
    observer: emptyRoleHomeDocument(),
    manager: emptyRoleHomeDocument(),
    employee: emptyRoleHomeDocument(),
    intern: emptyRoleHomeDocument(),
  };
}

function tryParseJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function parseRoleHomeDocument(raw: unknown): RoleHomeDocument {
  const value = typeof raw === "string" ? tryParseJson(raw) : raw;
  const parsed = roleHomeDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : emptyRoleHomeDocument();
}

export function newElementId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
