// components/admin/ai/types.ts — AI sahifalari uchun umumiy tiplar

export type ToolFieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "textarea"
  | "multiselect"
  | "entity";

export type ToolField = {
  key: string;
  label: string;
  type: ToolFieldType;
  required?: boolean;
  options?: string[];
  hint?: string;
  entity?: "user" | "test" | "lesson" | "course" | "job" | "attachment";
};

export type ToolMeta = {
  name: string;
  title: string;
  category: string;
  description: string;
  example: string;
  adminOnly: boolean;
  mutating: boolean;
  needsConfirm: boolean;
  fields: ToolField[];
};

export type PickerOption = { id: string; title: string; label?: string };
export type UserOption = {
  id: string;
  label: string;
  email: string;
  department: string;
  position: string;
  status: string;
};

export type Capabilities = {
  actor: { name: string; email: string; role: string; isAdmin: boolean };
  provider: { name: string; model: string; kind: string; live: boolean };
  modelChain: { order: number; model: string; free: boolean; available: boolean }[];
  searchEngine: string;
  quota: { allowed: boolean; used: number; limit: number; remaining: number };
  supportedExtensions: readonly string[];
  tools: ToolMeta[];
  categories: string[];
  stats: { tools: number; destructive: number; accessRules: number };
  /** Kunlik sessiya: 07:00 da yangilanadi */
  session: {
    dayKey: string;
    rolloverAt: string;
    inHuman: string;
    conversationId: string | null;
    title: string;
    messages: number;
    remembered: boolean;
  };
  skills: { name: string; title: string; when: string }[];
  mcp: { selfUrl: string; enabled: boolean; servers: { name: string; url: string; description?: string }[] };
  pickers: {
    tests: (PickerOption & { status: string; visibility: string; maxAttempts: number; questions: number })[];
    lessons: (PickerOption & { module: string })[];
    users: UserOption[];
    courses: PickerOption[];
    jobs: PickerOption[];
    attachments: (PickerOption & { chars: number; words: number; parser: string; status: string; error?: string | null; date: string })[];
    drafts: { id: string; title: string; topic: string; status: string; sourceMode: string; date: string }[];
    conversations: { id: string; title: string; messages: number; date: string }[];
    departments: string[];
    positions: string[];
  };
};

export type ChatStep = {
  type: "thinking" | "action" | "result" | "warning" | "dashboard" | "answer";
  tool?: string;
  title?: string;
  args?: unknown;
  summary?: string;
  ok?: boolean;
  data?: unknown;
  link?: { label: string; href: string } | null;
  /** Tekshiruv tizimi: natija bazadan/diskdan qayta o'qilib tasdiqlandi */
  verified?: boolean;
  /** Tekshiruv izohi (o'tmasa — muammo matni) */
  verifyNote?: string;
};

/** Javob bosqichi — chat nima qilayotganini real vaqtda ko'rsatadi. */
export type ChatPhase = "plan" | "tools" | "dashboard" | "answer";

/**
 * Tasdiqlash uchun TUGMA variantlari.
 *
 * Claude/Gemini/ChatGPT kabi yordamchilar foydalanuvchidan yozib so'ramaydi,
 * balki variantli tugmalar chiqaradi: "Tasdiqlash", "Qayta yaratish",
 * "Bekor qilish". Foydalanuvchi bitta bosish bilan javob beradi.
 */
export type ChatConfirmOption = {
  /** Tugma matni */
  label: string;
  /** Bosilganda AI ga yuboriladigan matn */
  send: string;
  /** Ko'rinish: asosiy (primary), xavfli (danger), yoki oddiy (ghost) */
  variant?: "primary" | "danger" | "ghost";
};

export type ChatConfirm = {
  /** Nima uchun tasdiqlash kerakligi */
  question: string;
  /** Qaysi vosita kutayotgani */
  tool: string;
  options: ChatConfirmOption[];
  /** Foydalanuvchi biror variantni bosdi (tugmalar yashiriladi) */
  answered?: boolean;
};

/**
 * Tanlov uchun TUGMALAR — bir nechta moslik topilganda.
 *
 * Muammo: AI bir nechta xodim topganda to'xtab "qaysi biri?" deb YOZIB
 * so'raydi. Bu foydalanuvchini charchatadi va ko'p qadam talab qiladi.
 * Yechim: topilganlar ro'yxati TUGMA ko'rinishida chiqadi; foydalanuvchi
 * bitta bosish bilan tanlaydi va ish o'sha zahoti davom etadi.
 */
export type ChatPickOption = {
  /** Asosiy matn (odatda ism yoki nom) */
  label: string;
  /** Qisqa tushuntirish (bo'lim, lavozim, pochta) */
  detail?: string;
  /** Bosilganda AI ga yuboriladigan matn */
  send: string;
};

export type ChatPick = {
  question: string;
  options: ChatPickOption[];
  answered?: boolean;
};

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: ChatStep[];
  conversationId?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    cost: number;
    model: string;
    provider: string;
    latencyMs: number;
  };
  error?: string;
  pending?: boolean;
  /** Serverdan kelgan joriy bosqich (plan → tools → dashboard → answer) */
  phase?: ChatPhase;
  /** Dashboard skeleti ko'rsatilmoqda (yig'ilish animatsiyasi) */
  dashBuilding?: boolean;
  /** Dashboard yig'ilib bo'ldi — endi haqiqiy karta chiqadi */
  dashBuilt?: boolean;
  /** Javob matni typewriter bilan yozilmoqda */
  typing?: boolean;
  /** SSE reply_delta qaysi agent raundidan kelyapti (raund almashsa matn yangilanadi) */
  streamRound?: number;
  /** Tugma (variantli) tasdiqlash so'rovi ko'rsatilmoqda */
  confirm?: ChatConfirm | null;
  /** Tanlov uchun tugmalar (bir nechta moslik topilganda) */
  pick?: ChatPick | null;
  /**
   * Ko'rsatilmaydigan xabar (tugma tanlanganda yuboriladi).
   *
   * AI yangi savolni OLMAYDI — foydalanuvchi faqat variantni tanlaydi. Shu
   * sababli yangi xabar pufog'i chiqmasligi kerak: tanlov shu zahoti
   * joriy javobning davomi bo'lib hisoblanadi.
   */
  silent?: boolean;
};

export const CATEGORY_STYLES: Record<string, { from: string; to: string; ring: string }> = {
  Testlar: { from: "from-indigo-600", to: "to-blue-600", ring: "ring-indigo-200" },
  "Ko'rinish va ruxsat": { from: "from-amber-500", to: "to-orange-600", ring: "ring-amber-200" },
  Darslar: { from: "from-emerald-600", to: "to-teal-600", ring: "ring-emerald-200" },
  Foydalanuvchi: { from: "from-rose-500", to: "to-pink-600", ring: "ring-rose-200" },
  Natijalar: { from: "from-violet-600", to: "to-purple-600", ring: "ring-violet-200" },
  Analitika: { from: "from-cyan-600", to: "to-sky-600", ring: "ring-cyan-200" },
  Manbalar: { from: "from-lime-600", to: "to-green-600", ring: "ring-lime-200" },
  "Hisobot va xabar": { from: "from-fuchsia-600", to: "to-pink-600", ring: "ring-fuchsia-200" },
  Tizim: { from: "from-slate-700", to: "to-slate-600", ring: "ring-slate-200" },
};

export function categoryStyle(category: string) {
  return CATEGORY_STYLES[category] || { from: "from-blue-600", to: "to-indigo-600", ring: "ring-blue-200" };
}