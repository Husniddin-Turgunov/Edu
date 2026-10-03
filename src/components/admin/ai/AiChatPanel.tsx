"use client";

// components/admin/ai/AiChatPanel.tsx
// NDJSON stream'ni o'qib, har bir bosqichni real vaqtda ko'rsatadi.
// Ishlayotgan paytda orb pulsatsiyasi, faza matni, o'tgan vaqt va bosqichlar
// timeline'i (AiActivity) qo'llaniladi.
//
// TAYYOR VAZIFALAR (buyruq tugmalari):
//  - aniq bir shaxsga ANIQ bir mavzuga qaratilgan test yaratish buyruqlari
//    olib tashlandi (ular noaniq natija berardi);
//  - o'rniga umumiy va faylga asoslangan buyruqlar;
//  - bosilgan buyruq "faol vazifa" indikatorini yondiradi — vazifa tayyor
//    ekani shunda aniq ko'rinadi, bekor qilish ushun X bor.

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  User as UserIcon,
  Sparkles,
  Gauge,
  Send,
  Paperclip,
  X,
  Plus,
  MessageSquare,
  ExternalLink,
  Check,
  Target,
  Clock,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  AiWorkingOrb,
  AiSteps,
  AiAvatar,
  TypewriterText,
  DashboardBuilding,
} from "./AiActivity";
import type { AiMotionMode } from "./AiMotionOrb";
import { AiDataCard } from "./AiDataCard";
import { AiFileCard, type FileCardActions, type FileCardData } from "./AiFileCard";
import { AiArtifactPanel, type ArtifactData } from "./AiArtifactPanel";
import { AiImageCard, type ImageCardData } from "./AiImageCard";
import type { Capabilities, ChatConfirm, ChatMessageView, ChatPick, ChatPhase, ChatStep } from "./types";

type Props = {
  caps: Capabilities;
  onToolSuggested?: (tool: string, example: string) => void;
  /** Suzib yuradigan oynada ixcham ko'rinish */
  compact?: boolean;
  /** Tashqi boshqaruv: /admin/ai sahifasidagi "Manba fayllar" tabi */
  attachments?: string[];
  onAttachmentsChange?: (ids: string[]) => void;
};

/** Tayyor vazifa — biror narsani bir marta bosish bilan tayyorlanadi. */
type TaskSample = {
  id: string;
  label: string;
  text: string;
  tool?: string;
  /** Bosilganda fayl biriktirish oynasi ochiladi */
  needsFile?: boolean;
};

export function AiChatPanel({ caps, onToolSuggested, compact, attachments, onAttachmentsChange }: Props) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(caps.session?.conversationId ?? null);
  const [ownAttachments, setOwnAttachments] = useState<string[]>([]);
  const [uploadNames, setUploadNames] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Yuqori boshqaruv paneli (Suhbat, model, kvota, foydalanilganlar) —
  // bir tugma bilan yashiriladi/oyi ko'rinish beriladi: chat maydoni ortadi.
  const [topOpen, setTopOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskSample | null>(null);
  const [usage, setUsage] = useState<{ tokens: number; cost: number; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const attachmentIds = attachments ?? ownAttachments;
  const setAttachmentIds = useCallback(
    (updater: (prev: string[]) => string[]) => {
      const next = updater(attachmentIds);
      if (onAttachmentsChange) onAttachmentsChange(next);
      else setOwnAttachments(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attachments, onAttachmentsChange],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Bugungi sessiya xabarlarini tiklash — sahifa yangilanganida ham eslab qoladi
  useEffect(() => {
    let cancelled = false;
    const id = caps.session?.conversationId;
    if (!id || !caps.session?.messages) return;
    fetch(`/api/ai/chat?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok || !Array.isArray(data.messages) || data.messages.length === 0) return;
        setConversationId(data.conversation.id);
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
            steps: Array.isArray(m.actions) ? m.actions : [],
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [caps.session?.conversationId, caps.session?.messages]);

  const uploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        Array.from(files).forEach((f) => form.append("files", f));
        const res = await fetch("/api/ai/uploads", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Faylni yuklab bo'lmadi");
        const ids: string[] = (data.attachments || []).map((a: any) => a.id);
        const names: Record<string, string> = {};
        (data.attachments || []).forEach((a: any) => {
          names[a.id] = a.fileName;
        });
        setUploadNames((prev) => ({ ...prev, ...names }));
        setAttachmentIds((prev) => [...prev, ...ids.filter((id) => !prev.includes(id))]);
      } catch (err: any) {
        setError(err?.message || "Faylni yuklab bo'lmadi");
      } finally {
        setUploading(false);
      }
    },
    [setAttachmentIds],
  );

  const patch = useCallback((id: string, updater: (m: ChatMessageView) => ChatMessageView) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  }, []);

  const send = useCallback(async (override?: string, opts?: { silent?: boolean }) => {
    // `override` — tugma bosilganda keladi: setInput bilan yuborish o'rniga
    // to'g'ridan-to'g'ri shu matn yuboriladi (setInput keyingi render'da
    // kuchayardi, shuning uchun bu yerga `input` eskirgan qiymatda qolardi).
    // `opts.silent` — tanlov/tasdiq tugmasi: xabar pufog'i KO'RSATILMAYDI,
    // faqat agent uchun matn yuboriladi (javob shu zahoti davom etadi).
    const text = (override ?? input).trim();
    if (!text || busy) return;
    const silent = Boolean(opts?.silent);

    setError(null);
    setInput("");
    setActiveTask(null);
    const now = Date.now();
    const userMessage: ChatMessageView = { id: `u-${now}`, role: "user", content: text, silent };
    const botMessage: ChatMessageView = {
      id: `a-${now}`,
      role: "assistant",
      content: "",
      steps: [],
      pending: true,
    };
    setMessages((prev) => [...prev, userMessage, botMessage]);
    setBusy(true);
    setStartedAt(now);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId, attachmentIds }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `Server xatosi (${response.status})`);
      }
      if (!response.body) throw new Error("Javob tanasi yo'q");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // SSE: `data: {...}`. Eski NDJSON (to'g'ridan-to'g'ri JSON) ham
          // qo'llanadi — orqa-compatibilitet uchun.
          const payload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
          if (!payload || payload === "[DONE]") continue;
          let event: any;
          try {
            event = JSON.parse(payload);
          } catch {
            continue;
          }

          if (event.type === "phase") {
            // Bosqich almashuvi: plan → tools → dashboard → answer.
            // Orb matni va status satr shundan o'zgaradi.
            patch(botMessage.id, (m) => ({
              ...m,
              phase: event.phase as ChatPhase,
              dashBuilding: event.phase === "dashboard" ? true : m.dashBuilding,
            }));
          } else if (event.type === "reply_delta") {
            // Token-level streaming: model yozayotganda jonli keladi.
            // Yangi raund — yangi matn; bir raund ichida — qo'shib boriladi.
            patch(botMessage.id, (m) => {
              const sameRound = m.streamRound === event.round;
              return {
                ...m,
                streamRound: event.round,
                content: sameRound ? `${m.content || ""}${event.delta || ""}` : event.delta || "",
                typing: true,
                phase: m.phase ?? "answer",
              };
            });
          } else if (event.type === "reply") {
            setConversationId(event.conversationId || null);
            // Yakuniy javob — delta yig'indisini to'liq matn bilan almashtiradi
            patch(botMessage.id, (m) => ({
              ...m,
              content: event.reply || "",
              typing: Boolean(event.reply),
              phase: m.phase ?? "answer",
            }));
          } else if (event.type === "step") {
            patch(botMessage.id, (m) => ({ ...m, steps: [...(m.steps || []), event.step as ChatStep] }));
          } else if (event.type === "confirm") {
            // Tugma (variantli) tasdiqlash so'rovi — foydalanuvchi bitta
            // bosish bilan javob beradi, yozmaydi.
            patch(botMessage.id, (m) => ({
              ...m,
              confirm: event.confirm as ChatConfirm,
              typing: false,
              phase: m.phase ?? "answer",
            }));
          } else if (event.type === "pick") {
            // Bir nechta moslik topildi — chatda TUGMA ro'yxati chiqadi.
            // Foydalanuvchi yozmaydi: bitta bosish tanlaydi, ish davom etadi.
            patch(botMessage.id, (m) => ({
              ...m,
              pick: event.pick as ChatPick,
              typing: false,
              phase: m.phase ?? "answer",
            }));
          } else if (event.type === "usage") {
            // pending o'chadi, lekin `typing` typewriter tugaguncha qoladi —
            // shuning uchun matn "birdan to'lib" ketmaydi.
            patch(botMessage.id, (m) => ({ ...m, usage: event.usage, pending: false }));
            setUsage({
              tokens: (event.usage?.promptTokens || 0) + (event.usage?.completionTokens || 0),
              cost: event.usage?.cost || 0,
              ms: event.usage?.latencyMs || 0,
            });
          } else if (event.type === "error") {
            patch(botMessage.id, (m) => ({ ...m, error: event.error, pending: false, typing: false }));
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || "Xatolik yuz berdi");
      patch(botMessage.id, (m) => ({ ...m, pending: false, error: err?.message }));
    } finally {
      setBusy(false);
      patch(botMessage.id, (m) => ({ ...m, pending: false }));
    }
  }, [input, busy, conversationId, attachmentIds, patch]);

  const loadConversation = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/chat?conversationId=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || "Suhbatni yuklab bo'lmadi");
      setConversationId(id);
      setMessages(
        (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          steps: Array.isArray(m.actions) ? m.actions : [],
        })),
      );
    } catch (err: any) {
      setError(err?.message || "Xatolik");
    } finally {
      setBusy(false);
    }
  };

const lastSteps = (messages[messages.length - 1]?.steps || []) as ChatStep[];
  const lastStep = lastSteps.length ? lastSteps[lastSteps.length - 1] : null;
  const lastMsg = messages[messages.length - 1];

  // Orb faqat ishlayotganda jonli; matni joriy bosqichdan.
  const orbActive = busy || Boolean(lastMsg?.typing);
  const orbStep: ChatStep | null =
    lastMsg?.phase === "dashboard"
      ? { type: "dashboard", title: "Dashboard yaratilmoqda" }
      : lastMsg?.phase === "answer" && (lastMsg.typing || !lastMsg.content)
        ? { type: "answer", title: "Javob yozilmoqda" }
        : lastStep;

  // Orb holati — IKKALA holat ham AI ishlayotgan paytni bildiradi:
  //   generating — rejalashtirilmoqda, vositalar bajarilmoqda, natija yoki
  //               dashboard yozilmoqda (kod/natija "generating" payti);
  //   typing     — javob MATNI yozilmoqda, typewriter ishlayapti.
  // Foydalanuvchi yozishi bu holatga KIRITILMAYDI: "typing" AI javob
  // yozayotganini bildiradi.
  const orbMode: AiMotionMode = lastMsg?.phase === "answer" ? "typing" : "generating";

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* Jonli faollik — faqat ishlayotganda */}
      {/* Yuqori panel — bir tugma bilan yashir/ko'rsat */}
      {!compact && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTopOpen((o) => !o)}
            title="Suhbat boshqaruvi panelini yashirish / ko'rsatish"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50"
          >
            {topOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {topOpen ? "Panellarni yashirish" : "Suhbat sozlamalari"}
          </button>
        </div>
      )}
      {!compact && topOpen && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setConversationId(caps.session?.conversationId ?? null);
              setMessages([]);
              setUsage(null);
              setActiveTask(null);
              setAttachmentIds(() => []);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-indigo-700 transition hover:bg-indigo-50"
          >
            <Plus className="h-3.5 w-3.5" /> Yangi suhbat
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            {caps.provider.live ? caps.provider.model : "O'rnatilgan rejim"}
          </span>
          <span
            title={`Bugungi sessiyada eslab qolinadi. Yangi sessiya har kuni ${caps.session?.rolloverAt} da ochiladi.`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-medium text-emerald-800"
          >
            <Clock className="h-3.5 w-3.5" />
            Sessiya {caps.session?.dayKey} · {caps.session?.inHuman} dan keyin yangilanadi
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-600">
            <Gauge className="h-3.5 w-3.5 text-emerald-500" />
            Bugun: {caps.quota.used}/{caps.quota.limit}
          </span>
          {usage && (
            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11.5px] text-slate-500">
              {usage.tokens} token · ${usage.cost.toFixed(4)} · {(usage.ms / 1000).toFixed(1)}s
            </span>
          )}
          {caps.pickers.conversations.length > 0 && (
            <div className="ml-auto flex max-w-[46%] items-center gap-1.5 overflow-x-auto">
              {caps.pickers.conversations.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  title={c.title}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] transition ${
                    conversationId === c.id
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <MessageSquare className="h-3 w-3" />
                  <span className="max-w-[130px] truncate">{c.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Jonli faollik — faqat ishlayotganda */}
      <AiWorkingOrb active={orbActive} step={orbStep} startedAt={startedAt || Date.now()} mode={orbMode} />

      {/* Xabarlar */}
      <div
        ref={scrollRef}
        className={`min-h-[220px] flex-1 space-y-2.5 overflow-y-auto pr-1 ${compact ? "" : "rounded-2xl border border-slate-200 bg-white/70 p-3.5"}`}
      >
        {messages.length === 0 && (
          <Welcome
            caps={caps}
            compact={compact}
            activeId={activeTask?.id ?? null}
            onPick={(task) => {
              setActiveTask(task);
              setInput(task.text);
              if (task.needsFile) fileRef.current?.click();
            }}
          />
        )}

        {messages.map((m, i) => {
          // O'zi bilib ko'rsatadi: agar so'rov statistika / natija / sonlarni
          // so'ragan bo'lsa dashboard beriladi, aks holda yo'q.
          const askForDashboard =
            m.role === "assistant"
              ? (() => {
                  for (let j = i - 1; j >= 0; j--) {
                    if (messages[j].role === "user") return messages[j].content;
                  }
                  return undefined;
                })()
              : undefined;

          // Vizual dashboard shartli chiqadi: foydalanuvchi statistika so'ragan
          // YOKI analytics vositasi ishlatilgan bo'lsa. Oddiy savolga
          // ("salom", "darsni yashir") dashboard yig'ilmaydi.
          const dashCards = ((m.steps || []) as ChatStep[]).filter(
            (s) =>
              s.type === "result" &&
              s.ok !== false &&
              s.data != null &&
              (isAnalyticsIntent(askForDashboard || "") || DASHBOARD_TOOL_RE.test(s.tool || "")),
          );
          // Dashboard yig'ilayotgan vaqt — JAVOB KUTILADI (chiroyli tartib):
          // skelet → haqiqiy kartalar → keyin matn yoziladi.
          const dashPending = Boolean(m.dashBuilding) && !m.dashBuilt && dashCards.length > 0;
          const statusText =
            m.phase === "tools"
              ? "Vositalarni bajarayapti..."
              : m.phase === "answer"
                ? "Javobni yozayapti..."
                : "Buyruqni tahlil qilyapti...";

          // Qadamlar ro'yxati VAQTINCHA: ish tugagach yopiladi va bitta qator
          // ("N ta amal bajarildi") qoladi. Dashboard esa DOIMIY qoladi —
          // u analitik natija, foydalanuvchi u doimiy qaytib kelishi kerak.
          const answerReady = !m.typing && !m.pending && Boolean(m.content);
          const showWork = !answerReady;

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}
            >
              {m.role === "assistant" && <AiAvatar active={m.pending || m.typing} />}

              <div
                className={`min-w-0 max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
                    : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <AiSteps steps={(m.steps || []) as any[]} settled={!showWork} />

                {/* Dashboard DOIMIY qoladi: bir marta chiqarildi — yo'qolmaydi.
                    Vaqtincha bo'lib yo'qoladigan narsa — qadamlar ro'yxati
                    (yuqorida, `settled` bilan yopiladi). */}
                <StepDashboards
                  steps={(m.steps || []) as ChatStep[]}
                  intent={askForDashboard}
                  building={dashPending}
                  onBuilt={() => patch(m.id, (mm) => ({ ...mm, dashBuilt: true }))}
                />
                <StepFileCards
                  steps={(m.steps || []) as ChatStep[]}
                  actions={{
                    onRecreate: (name) => {
                      // Tugma foydalanuvchiga buyruksiz ishlaydi: agent
                      // doc.recreate orqali AYNAN o'sha ma'lumotdan yangi
                      // fayl quradi (eski fayl saqlanib qoladi).
                      void send(`"${name}" faylini qayta yasab, yangi yuklab olish uchun fayl ber (eski fayl qoladi)`);
                    },
                    onConvert: (name) => {
                      const isExcel = (m.steps || []).some((s) => s.tool === "doc.excel");
                      void send(`"${name}" faylini ${isExcel ? "Word" : "PDF"} formatida qayta yasab, yangi fayl ber`);
                    },
                  }}
                />
                <StepArtifactPanels steps={(m.steps || []) as ChatStep[]} />
                <StepImageCards
                  steps={(m.steps || []) as ChatStep[]}
                  onAsk={(text) => void send(text)}
                />

                {m.content && !dashPending ? (
                  <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
                    {m.typing ? (
                      <TypewriterText
                        text={m.content}
                        onDone={() => patch(m.id, (mm) => ({ ...mm, typing: false }))}
                      />
                    ) : (
                      m.content
                    )}
                  </p>
                ) : m.pending && !m.content && !dashPending ? (
                  <p className="flex items-center gap-2 text-[13px] text-slate-500">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                    </span>
                    {statusText}
                  </p>
                ) : null}

                {m.usage && !m.typing && !dashPending && (
                  <p className="mt-2 border-t border-slate-100 pt-1.5 text-[11px] text-slate-400">
                    {m.usage.model} · {m.usage.promptTokens + m.usage.completionTokens} token ·
                    ${(m.usage.cost || 0).toFixed(4)} · {(m.usage.latencyMs / 1000).toFixed(1)}s
                  </p>
                )}
                {m.error && <p className="mt-1.5 text-[12px] text-rose-600">{m.error}</p>}

                {/* Tanlov tugmalari — bir nechta moslik topilganda.
                    Kirish va CHIQISH ikkalasi animatsiyali (AnimatePresence). */}
                {m.pick && !m.pick.answered && (
                  <div className="mt-2.5 border-t border-slate-100 pt-2.5">
                    <p className="mb-1.5 text-[12.5px] font-medium text-slate-700">
                      {m.pick.question}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {m.pick.options.map((opt, oi) => (
                        <motion.button
                          key={`${m.pick?.question}-${oi}`}
                          type="button"
                          initial={{ opacity: 0, y: 10, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.18 } }}
                          transition={{
                            delay: oi * 0.06,
                            type: "spring",
                            stiffness: 380,
                            damping: 26,
                          }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            patch(m.id, (mm) => ({
                              ...mm,
                              pick: { ...(mm.pick as ChatPick), answered: true },
                            }));
                            void send(opt.send);
                          }}
                          className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-indigo-300 hover:bg-indigo-50/60"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-slate-800">
                              {opt.label}
                            </span>
                            {opt.detail && (
                              <span className="block truncate text-[11.5px] text-slate-500">
                                {opt.detail}
                              </span>
                            )}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Variantli tasdiqlash tugmalari — Claude/Gemini/ChatGPT usuli.
                    Foydalanuvchi yozmaydi: bitta tugma bosadi. */}
                {m.confirm && !m.confirm.answered && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
                    {m.confirm.options.map((opt, oi) => (
                      <motion.button
                        key={`${m.confirm?.tool}-${oi}`}
                        type="button"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: oi * 0.05, type: "spring", stiffness: 340, damping: 26 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          // Tanlangan tugma "javob"ga aylanadi va yuboriladi —
                          // foydalanuvchi qo'lda yozmaydi.
                          patch(m.id, (mm) => ({
                            ...mm,
                            confirm: { ...(mm.confirm as ChatConfirm), answered: true },
                          }));
                          setInput(opt.send);
                          void send(opt.send);
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition ${
                          opt.variant === "primary"
                            ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                            : opt.variant === "danger"
                              ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

            {m.role === "user" && (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-white">
                <UserIcon className="h-4 w-4" />
              </span>
            )}
            </motion.div>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
          {error}
        </p>
      )}

      {/* Tayyor vazifa indikatori — vazifa faol ekanini aniq ko'rsatadi */}
      {activeTask && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold leading-tight text-emerald-900">
              Vazifa tayyor: {activeTask.label}
            </p>
            <p className="truncate text-[11.5px] leading-tight text-emerald-700">
              {activeTask.needsFile && attachmentIds.length === 0
                ? "Fayl biriktiring — so'ng Enter bosing"
                : "Enter bosing — AI bajaradi"}
            </p>
          </div>
          {activeTask.tool && (
            <code className="hidden shrink-0 rounded bg-white/70 px-1.5 py-0.5 text-[10.5px] text-emerald-800 sm:inline">
              {activeTask.tool}
            </code>
          )}
          <button
            onClick={() => {
              setActiveTask(null);
              setInput("");
            }}
            title="Vazifani bekor qilish"
            className="shrink-0 rounded-lg p-1 text-emerald-700 transition hover:bg-emerald-200/60 hover:text-emerald-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {/* Fayl biriktirish */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Fayl biriktirish — haqiqiy (ko'rinadigan) fayl maydoni ustida
            shaffof input: bosilganda brauzer dialogi har doim ochiladi */}
        <label
          title={`Fayl biriktirish — undan test yaratish uchun. Formatlar: ${(caps.supportedExtensions || []).join(", ")}`}
          className={`relative inline-flex select-none items-center gap-1.5 overflow-hidden rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition ${
            uploading
              ? "border-slate-200 bg-white text-slate-400"
              : "cursor-pointer border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          {uploading ? "Yuklanmoqda..." : "Fayl biriktirish"}
          <input
            ref={fileRef}
            type="file"
            multiple
            disabled={uploading}
            accept={(caps.supportedExtensions || []).join(",")}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => {
              void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        <button
          onClick={() => {
            setMessages([]);
            setActiveTask(null);
            setInput("");
          }}
          title="Tayyor vazifalar ro'yxatini ochish"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50"
        >
          <Target className="h-3.5 w-3.5" /> Tayyor vazifalar
        </button>

        {attachmentIds.map((id) => {
          const file = caps.pickers.attachments.find((a) => a.id === id);
          const name = uploadNames[id] || file?.title || id;
          return (
            <span
              key={id}
              className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-[11.5px] text-indigo-700"
            >
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate">{name}</span>
              <button onClick={() => setAttachmentIds((p) => p.filter((v) => v !== id))}>
                <X className="h-3 w-3 hover:text-rose-600" />
              </button>
            </span>
          );
        })}
      </div>

      {/* Yozish — faylni shu maydonga tashlash ham mumkin */}
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files?.length) return;
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        className={`relative flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-indigo-300 ${
          dragOver ? "ring-2 ring-indigo-400" : ""
        }`}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-indigo-50/90">
            <p className="text-[13px] font-semibold text-indigo-900">
              Faylni shu yerga tashlang
            </p>
          </div>
        )}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (activeTask && e.target.value.trim() !== activeTask.text.trim()) setActiveTask(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={compact ? 1 : 2}
          placeholder={
            compact
              ? "Buyruq yozing..."
              : "Masalan: «bo'limlar kesimida natija» yoki «biriktirilgan fayldan test tuz»"
          }
          className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-slate-800 outline-none placeholder:text-slate-400"
        />
        <motion.button
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          whileTap={{ scale: 0.94 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-900/15 transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
            />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </motion.button>
      </div>

      {onToolSuggested && <span className="hidden">{onToolSuggested.length}</span>}
    </div>
  );
}

/** Javob statistika / xodimlar ro'yxati bo'lishi kerak bo'lgan savollar matni.
 * Asosan: foydalanuvchi statistika, natija, grafik, xodim, bo'lim, ball,
 * o'tish darajasi, zaif savollar, foydalanuvchi qidiruvi haqida so'ragan
 * bo'lsa — o'sha javob uchun chiroyli vizual kartalar ko'rinadi.
 */
const ANALYTICS_INTENT =
  /(statistik|analitik|tahlil|natija|hisobot|diagram|grafik|dashbor|foiz|o['’]tish|otish|ball|topshir|urinish|urinish|zaif|bo['’]lim|bo'lim|xodim|umumiy|qancha|necha|nechta|ko['’]proq|noto['’]g['’]ri|ezil|yiqil|o['’]rtacha|balans|kimlar)/i;

/** Analytics vositalari natijasi — avtomatik dashboardga aylantiriladi. */
const DASHBOARD_TOOL_RE = /^analytics\./;

function StepFileCards({ steps, actions }: { steps: ChatStep[]; actions?: FileCardActions }) {
  // Jonli oqimda `data.downloadUrl` bor; DB'dan yuklanganda `data` qisqartirilgan
  // bo'ladi (joy tejalishi uchun) — lekin `link.href` qoladi. Ikkalasini qo'llaymiz.
  const files = (steps || []).filter(
    (s) =>
      s.type === "result" &&
      s.ok !== false &&
      typeof s.tool === "string" &&
      s.tool.startsWith("doc.") &&
      (typeof (s.data as Record<string, unknown> | null | undefined)?.downloadUrl === "string" ||
        typeof (s as { link?: { href?: string } }).link?.href === "string"),
  );
  if (!files.length) return null;
  return (
    <>
      {files.map((s, i) => {
        const d = (s.data || {}) as FileCardData;
        const href = d.downloadUrl || (s as { link?: { href?: string } }).link?.href || "";
        // DB'dan kelganda nomni summary'dan chiqaramiz ("Excel tayyor: nom.xlsx (...)")
        const nameFromSummary = (s.summary || "").match(/tayyor:\s*([^\s(]+\.(xlsx|docx|pdf))/i)?.[1];
        const data: FileCardData = {
          fileName: d.fileName || nameFromSummary || "hujjat",
          size: d.size,
          mimeType: d.mimeType,
          downloadUrl: href,
          kind: d.kind || (s.tool === "doc.excel" ? "excel" : s.tool === "doc.word" ? "word" : "pdf"),
          pages: d.pages,
          fileId: d.fileId,
        };
        return <AiFileCard key={`file-${i}`} data={data} summary={s.summary} actions={actions} />;
      })}
    </>
  );
}

/** Artifact natijalari — chat ichidagi skriptsiz iframe panel. */
function StepArtifactPanels({ steps }: { steps: ChatStep[] }) {
  const items = (steps || []).filter((s) => {
    if (s.type !== "result" || s.ok === false) return false;
    const d = (s.data || {}) as ArtifactData;
    return typeof s.tool === "string" && s.tool.startsWith("artifact.") && typeof (d.artifactUrl || d.artifactId) === "string";
  });
  if (!items.length) return null;
  return (
    <>
      {items.map((s, i) => {
        const d = (s.data || {}) as ArtifactData;
        const data: ArtifactData = {
          artifactId: d.artifactId,
          artifactUrl: d.artifactUrl || d.artifactId ? d.artifactUrl || `/api/ai/artifacts/${d.artifactId}` : undefined,
          title: d.title || "Artifact",
          kind: d.kind,
          bytes: d.bytes,
        };
        return <AiArtifactPanel key={`artifact-${i}`} data={data} />;
      })}
    </>
  );
}

/** Rasm natijalari — chat ichidagi rasm kartasi. */
function StepImageCards({ steps, onAsk }: { steps: ChatStep[]; onAsk: (text: string) => void }) {
  const items = (steps || []).filter((s) => {
    if (s.type !== "result" || s.ok === false) return false;
    const d = (s.data || {}) as ImageCardData;
    return s.tool === "image.generate" && typeof d.imageUrl === "string";
  });
  if (!items.length) return null;
  return (
    <>
      {items.map((s, i) => {
        const d = (s.data || {}) as ImageCardData;
        return (
          <AiImageCard
            key={`image-${i}`}
            data={d}
            summary={s.summary}
            actions={{
              onRegenerate: (prompt) => onAsk(`"${prompt}" prompti bilan rasmni qayta chiz`),
              onRefine: (prompt) => onAsk(`"${prompt}" rasmini o'zgartirib chiz: avvalgisidan boshqa ko'rinishda`),
            }}
          />
        );
      })}
    </>
  );
}

function isAnalyticsIntent(text: string) {
  return ANALYTICS_INTENT.test(text || "");
}

/**
 * Natija bosqichlaridagi ma'lumotni vizual dashboardga aylantiradi.
 * Ikkita shartdan BIRI bajarilsa chiqadi: so'rov statistikaga tegishli
 * yoki analytics vositasi ishlatilgan. Oddiy matnli javobda chiqmaydi.
 *
 * `building=true` bo'lsa — avval "Dashboard yaratilmoqda..." skeleti,
 * animatsiya tugagach (`onBuilt`) haqiqiy kartalar ochiladi.
 */
function StepDashboards({
  steps,
  intent,
  building,
  onBuilt,
}: {
  steps: ChatStep[];
  intent?: string;
  building?: boolean;
  onBuilt?: () => void;
}) {
  const cards = (steps || []).filter(
    (s) =>
      s.type === "result" &&
      s.ok !== false &&
      s.data != null &&
      (isAnalyticsIntent(intent || "") || DASHBOARD_TOOL_RE.test(s.tool || "")),
  );
  if (!cards.length) return null;

  if (building) return <DashboardBuilding onDone={onBuilt} />;

  return (
    <>
      {cards.map((s, i) => (
        <AiDataCard key={`card-${i}`} tool={s.tool} data={s.data} summary={s.summary} />
      ))}
    </>
  );
}

function Welcome({
  caps,
  compact,
  activeId,
  onPick,
}: {
  caps: Capabilities;
  compact?: boolean;
  activeId?: string | null;
  onPick: (task: TaskSample) => void;
}) {
  // Tayyor vazifalar. Atiq shaxs + atiq mavzu + test yaratish kabi noaniq
  // buyruqlar olib tashlandi — ular qaysi odim/nom degani noaniq bo'lganida
  // AI ni chalkashtiradi. O'rniga umumiy va faylga asoslangan buyruqlar.
  const samples: TaskSample[] = compact
    ? [
        { id: "stats", label: "Statistika", text: "Umumiy statistikani ko'rsat" },
        { id: "weak", label: "Noinotg'ri savollar", text: "Qaysi savollar eng ko'p noto'g'ri berilgan?", tool: "analytics.weakQuestions" },
        {
          id: "file-test",
          label: "Fayldan test",
          text: "Biriktirilgan fayl asosida test tuz",
          tool: "test.generate",
          needsFile: true,
        },
        {
          id: "lesson",
          label: "Darsni yashirish",
          text: "Xavfsizlik darsini IT bo'limiga yashir",
          tool: "lesson.setVisibility",
        },
      ]
    : [
        { id: "stats", label: "Statistika", text: "Umumiy statistikani ko'rsat" },
        {
          id: "weak",
          label: "Noinotg'ri savollar",
          text: "Qaysi savollar hammadan ko'p noto'g'ri berilgan?",
          tool: "analytics.weakQuestions",
        },
        {
          id: "departments",
          label: "Bo'limlar kesimi",
          text: "Bo'limlar kesimida natijani taqqosla",
          tool: "analytics.departments",
        },
        {
          id: "file-test",
          label: "Fayldan test",
          text: "Biriktirilgan fayl asosida test tuz",
          tool: "test.generate",
          needsFile: true,
        },
        {
          id: "lesson",
          label: "Darsni yashirish",
          text: "IT bo'limidagi xodimlar uchun «Xavfsizlik texnikasi» darsini yashir",
          tool: "lesson.setVisibility",
        },
        {
          id: "access",
          label: "Ruxsat qoidalari",
          text: "Kim qanday dars va testlarni ko'ra oladi?",
          tool: "access.rules.list",
        },
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-3 py-3"
    >
      <div>
        <p className="text-[14.5px] font-semibold text-slate-800">
          Salom, {caps.actor.name}. Nima qilamiz?
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
          {caps.stats.tools} ta vosita, {caps.skills?.length ?? 0} ta skill bor. Tabiiy tilda yozing —
          AI vositani tanlab, argumentlarni bazadagi haqiqiy ma'lumotdan oladi va bajaradi.
        </p>
      </div>

      <div className={`grid gap-1.5 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        {samples.map((s, i) => {
          const on = activeId === s.id;
          return (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 * i, duration: 0.3 }}
              onClick={() => onPick(s)}
              title={on ? "Vazifa tayyor — Enter bosing" : "Bosish bilan vazifa tayyorlanadi"}
              className={`relative rounded-xl border px-3 py-2 text-left text-[12.5px] transition ${
                on
                  ? "border-emerald-400 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-300"
                  : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {on ? (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"
                  >
                    <Check className="h-3 w-3" />
                  </motion.span>
                ) : (
                  <Target className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
                <span className="font-semibold">{s.label}</span>
                {s.needsFile && (
                  <span className="rounded bg-indigo-100 px-1 text-[10px] font-medium text-indigo-700">
                    fayl kerak
                  </span>
                )}
              </span>
              <span className="mt-0.5 block pl-5.5 text-[12px] leading-snug text-slate-600">
                {s.text}
              </span>
              {s.tool && (
                <code className="ml-5.5 mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-500">
                  {s.tool}
                </code>
              )}
            </motion.button>
          );
        })}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11.5px] text-slate-400">
          <ExternalLink className="h-3 w-3" />
          {caps.stats.destructive} ta xavfli amal alohida tasdiqlaydi
        </div>
      )}
    </motion.div>
  );
}

export { AiChatPanel as default };