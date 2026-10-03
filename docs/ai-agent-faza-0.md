# Faza 0 — Tahlil va arxitektura hujjati

> Sana: 2026-10-03 · Loyiha: `akela-app` (basalt-hiss worktree) · Stack: Next.js 16.3.3 + TypeScript + Prisma 6.11 + MySQL (`akelagro_eduapp` @ 95.46.96.13) + Tailwind 4 + shadcn/ui

---

## 1. MAVJUD HOLAT — qisqa xulosa

Loyiha "AI-agent chatbot" talabining **taxminan 55–60%** ini allaqachon ichida o'zlashtirgan. Quyidagi tizim **ishlayapti** (dalil: `localhost:3000` da admin sessiya bilan sinov — `POST /api/ai/chat` → 200, NDJSON stream, LLM javobi "47 ta xodim", 2.3 s, narx hisoblangan):

- NDJSON-stream chat yadrosi (`/api/ai/chat`, `src/lib/ai/agent.ts`)
- 41 ta tool (Zod sxema + `mutating`/`needsConfirm`/`adminOnly` bayroqlari)
- Agentic loop: 4 raund, 12 xabarlik tarix, `confirm/pick` eventlari
- PDF/DOCX/XLSX/CSV/ZIP matn ajratish (`src/lib/ai/documents.ts`, 734 qator)
- Test-generator (LLM yoki deterministik cloze — `generator.ts`)
- MCP server (6 read-only tool, `/api/mcp`)
- Admin UI: 14 komponent (chat, capabilities, uploads, drafts, analytics, access matrix)

**Butunlay yo'q (talab qilingan):** rasm generatsiyasi, TTS/ovoz, artifact/sandbox preview, RAG/vector/embedding, Word (.docx) yozish, Excel yozish (faqat o'qish), token-level streaming, imzolangan vaqtinchalik fayl URL'lari, foydalanuvchi xotirasi (memory RAG emas, faqat kunlik session xotirasi).

**DB:** MySQL 8 — PostgreSQL `pgvector` **ishlamaydi** (talab: `pgvector`). Embedding/vector uchun muqobil kerak.

---

## 2. ACTION INVENTORY (74 API route)

To'liq ro'yxat: `docs/ai-agent-inventory.md`. Quyida faqat AI-agent uchun muhim bo'lgan qismlar.

### 2.1 AI orqali XAVFSIZ chaqirish mumkin bo'lgan READ — 25 ta

**AI guard (`requireAiActor()`) bilan himoyalangan — toza:**

| Route | Nima qaytaradi |
|---|---|
| `GET /api/ai/analytics?view=overview` | Umumiy statistika |
| `GET /api/ai/analytics?view=test&testId=` | Test tahlili (savol bo'yicha) |
| `GET /api/ai/analytics?view=user&userId=` | Xodim tahlili |
| `GET /api/ai/analytics?view=departments` | Bo'limlar kesimi |
| `GET /api/ai/analytics?view=audit` | Oxirgi 100 amal izi |
| `GET /api/ai/analytics?view=usage` | Kvota/narx |
| `GET /api/ai/capabilities` | Tool katalogi + picker ro'yxatlari |
| `GET /api/ai/access` | `AccessRule` qoidalari |
| `GET /api/ai/drafts` / `?id=` | Qoralamalar + payload |
| `GET /api/ai/uploads` | Faqat o'z fayllari |
| `GET /api/ai/chat` / `?conversationId=` | Faqat o'z suhbatlari |
| `GET /api/ai/tools/[name]` | Tool shakli |
| `POST /api/mcp` → 6 ta `akela.*` tool | overview/users/tests/courses/results/accessRules |

**Session/admin (HTTP orqali, AI tool EMAS — ulashdan oldin auth mustahkamlanadi):**

| Route | Nima qaytaradi | Holat |
|---|---|---|
| `GET /api/admin/user-stats?userId=` | Xodim dashboardi | admin ✓ |
| `GET /api/admin/skills?action=overview` | Barcha test+user stat | **auth YO'Q** ⚠ |
| `GET /api/admin/skills?action=review` | Urinish ko'rish | **auth YO'Q** ⚠ |
| `GET /api/my-stats` | Shaxsiy progress | session ✓ |

### 2.2 WRITE / DESTRUCTIVE — tasdiqlash shart (17 ta)

| Endpoint | Amal | Xavf | Fayl:Qator |
|---|---|---|---|
| `DELETE /api/admin/users?userId=` | User + 6 jadval | **destructive** | `admin/users/route.ts:191,213` |
| `DELETE /api/tests/history` | `testResult.deleteMany` | **destructive (bulk)** | `tests/history/route.ts:9,20` |
| `DELETE /api/admin/courses/[id]` | Kurs + cascade | **destructive** | `admin/courses/[id]/route.ts:37` |
| `DELETE /api/admin/tests/[id]` | Test + cascade | **destructive** | `admin/tests/[id]/route.ts:46` |
| `DELETE /api/admin/lessons-v2/[id]` | Dars | **destructive** | `admin/lessons-v2/[id]/route.ts:35` |
| `DELETE /api/ai/access?id=` | Ruxsat qoidasi | **destructive** | `ai/access/route.ts:178` |
| `POST /api/admin/skills/retake` | `TestResult` yaratish | **destructive + auth'siz** | `admin/skills/retake/route.ts:24,47` |
| `DELETE /api/admin/departments?id=` | Bo'lim + `user.updateMany` | **destructive (bulk)** | `admin/departments/route.ts:153,169` |
| `POST /api/telegram-bot?action=block` | Bloklash | **destructive + hardcoded secret** | `telegram-bot/route.ts:16,89` |
| `PATCH /api/admin/users` | Rol/isActive/parol | **write** | `admin/users/route.ts:113,154` |
| `POST /api/admin/users` | User yaratish | **write** | `admin/users/route.ts:66,88` |
| `POST /api/ai/access` | Ruxsat qoidasi | **write** | `ai/access/route.ts:99` |
| `POST /api/ai/drafts {action:"apply"}` | Qoralama → real test | **write** | `ai/drafts/route.ts:108` |
| `POST /api/admin/questions/import` | Excel bulk import | **write (bulk)** | `admin/questions/import/route.ts:23` |
| `POST /api/admin/transfer` | Bulk ko'chirish | **write (bulk)** | `admin/transfer/route.ts:11,49` |
| `POST /api/ai/uploads` | Fayl → disk+DB | **write (fs)** | `ai/uploads/route.ts:23,66` |
| `POST /api/admin/upload-video` / `upload-pdf` | `fs.writeFileSync` | **write (fs)** | `upload-video/route.ts:40` / `upload-pdf/route.ts:39` |
| **`POST /api/ai/tools/code.exec`** | `cmd.exe /c` serverda | **BLOKLASH SHART** | `tools.ts:2085–2160, 2092, 2110` |

### 2.3 Auth'siz endpointlar (darhal tuzatish shart — 8 ta)

| Route | Ochiq qolgan nima | Fayl:Qator |
|---|---|---|
| `GET /api/admin/skills?action=overview` | Barcha userlar+testlar+`isCorrect` | `admin/skills/route.ts:14` |
| `GET /api/admin/skills/user-report?userId=` | **PDF hisobot** — F.I.Sh, javoblar | `admin/skills/user-report/route.ts:14` |
| `GET /api/admin/skills/result-report?resultId=` | **PDF** — savol-b-savol | `admin/skills/result-report/route.ts:19` |
| `POST /api/admin/skills/retake` | Istalgan user uchun `TestResult` | `admin/skills/retake/route.ts:24` |
| `GET /api/admin/courses/[id]` | Kurs+modul+darslar | `admin/courses/[id]/route.ts:7-14` |
| `GET /api/admin/tests/[id]` | Test + `isCorrect` javoblar | `admin/tests/[id]/route.ts:7-14` |
| `GET /api/admin/lessons-v2/[id]` | Dars | `admin/lessons-v2/[id]/route.ts:7-12` |
| `GET /api/telegram-bot?secret=akela-bot-secret-2024` | approve/reject/block/unblock — **hardcoded secret** | `telegram-bot/route.ts:16` |
| `GET /api/onboarding?userId=` | **Sessiyasiz** istalgan user kursi | `onboarding/route.ts:17-22` |

---

## 3. DB SXEMA — 29 model (MySQL)

Muhim: `AiConversation, AiMessage, AiAttachment, AiDraft, AiUsage, AiAuditLog, AccessRule` — to'liq bor. `User.role` — **String** (`"user"|"admin"|"grader"`), enum emas (`schema.prisma:54`). `department`/`position` — **String, FK emas** (`:51-52`).

**Talabga zid:** PostgreSQL + `pgvector` so'ralgan — hozir MySQL. Vector/embedding uchun: (a) MySQL `JSON` + kosinus o'xshash (sekin, 100K+ yozuvga yaramaydi), (b) alohida `pgvector` konteyneri, (c) Qdrant/Weaviate. **Qaror sizga** (pastda savol #2).

---

## 4. ROL TIZIMI — mos kelmasliklar (fayl:qator)

| № | Muammo | Fayl:Qator |
|---|---|---|
| M1 | `UserRole` tipida `user`/`grader` yo'q | `auth-core.ts:3` ↔ `schema.prisma:54` |
| M2 | `auth.ts:72` `"user"` qaytaradi — tipga mos emas | `auth.ts:72` |
| M4 | `isAdmin` grader'ni admin qilmaydi, AI guard esa qiladi | `auth.ts:60,77` ↔ `ai/guard.ts:54-56` |
| M8 | `admin/users` PATCH `"grader"` rad etadi, AI tool qabul qiladi | `admin/users/route.ts:137` ↔ `tools.ts:1306` |
| M13 | **Parol hash:** NextAuth sha256 solishtiradi, `user.resetPassword` scrypt yozadi → **login buziladi** | `tools.ts:1345-1348` ↔ `auth/[...nextauth]/route.ts:11,39` |
| M14 | `AKELA_SESSION_SECRET` `.env` da yo'q → kod ichidagi `"akela-dev-session-secret"` ishlatiladi | `auth-core.ts:17-24` |

---

## 5. MIDDLEWARE

`src/middleware.ts` — Next 16.3.3 da **deprecation** ogohlantirishi (`middleware` → `proxy` migratsiyasi, `node_modules/next/dist/build/index.js:730`). Matcher faqat `/admin, /dashboard, /courses` — **`/api/*` qamrab olinmagan**, role tekshiruvi yo'q (`middleware.ts:16-26`). Shu sababli yuqoridagi 8 ta auth'siz endpoint ochiq qoladi.

---

## 6. MAVJUD ARXITEKTURA — texnik tavsif

```
Chat UI (AiChatPanel / AiFloatingWidget)
   ↓ fetch, NDJSON stream (ReadableStream, application/x-ndjson)
/api/ai/chat  →  requireAiActor() (guard.ts)  →  runAgent()
   ↓                                             ↓
 resolveProvider() (OpenRouter, json_object)  agentic loop ≤4 raund
                                                ↓ JSON parse
                                         { reply, actions[] }
                                                ↓
                                         runTool() — Zod validatsiya,
                                         adminOnly/needsConfirm gate,
                                         AiAuditLog yozuvi
                                                ↓
                                         execute() → DB (Prisma) / fs / LLM
```

- **Tool sxema:** Zod (`tools.ts:104`) — JSON Schema emas. Modelga faqat `key:type` ro'yxati beriladi (`toolPrompt`, `tools.ts:2325-2336`) → argument xatolari ko'p.
- **Ruxsat:** `read` (darhol) / `mutating` / `needsConfirm: true` (UI'da tasdiq kartasi — `AiChatPanel.tsx:227-235`).
- **Hujjat kiritish:** `documents.ts` — o'z ZIP/DOCX/PDF/XLSX/CSV parserlari. 25 MB, `fs.writeFile`.
- **Hujjat chiqarish:** faqat **bitta PDF route** (`admin/skills/user-report`, `pdf-lib` + NotoSans TTF — o'zbekcha belgilar to'g'ri). **Word va Excel yozish yo'q.** `report.build` tool'iga **oddiy href** qaytaradi — **imzolangan URL yo'q** (`tools.ts:1757`).

---

## 7. TALQIN QILINGAN ARXITEKTURA (tasdiqlash uchun)

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js, App Router)                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Floating     │  │ /admin/ai    │  │ Artifact Panel        │  │
│  │ Widget       │  │ (full chat)  │  │ (iframe, sandbox)     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         └──────────────────┴─────────────────────┘              │
│                          ↓ NDJSON stream                        │
├─────────────────────────────────────────────────────────────────┤
│  BACKEND (Next.js API)                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ /api/ai/chat — Agent Loop (SSE/NDJSON)                     │  │
│  │   ├─ guard.ts — auth + role + rate limit + IP             │  │
│  │   ├─ agent.ts — LLM ↔ tool ↔ LLM ... (≤4 raund)           │  │
│  │   ├─ tools.ts — Tool Registry (41 → kengaytiriladi)       │  │
│  │   ├─ provider.ts — OpenRouter (config'dan model)          │  │
│  │   ├─ documents.ts — ingest (PDF/DOCX/XLSX)                 │  │
│  │   ├─ docgen.ts (YANGI) — Excel/Word/PDF yozish             │  │
│  │   ├─ tts.ts (YANGI) — adapter (Azure/UzbekVoice/…)         │  │
│  │   ├─ image.ts (YANGI) — adapter (OpenRouter/…)             │  │
│  │   └─ rag.ts (YANGI) — embedding + qidiruv                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  /api/ai/artifacts — sandbox iframe HTML (srcdoc, CSP)          │
│  /api/ai/files — imzolangan vaqtinchalik URL (HMAC, exp)        │
├─────────────────────────────────────────────────────────────────┤
│  STORAGE                                                         │
│  MySQL (Prisma) — mavjud 29 model + AiArtifact, AiFile,          │
│                   AiEmbedding, AiTtsCache, AiFeedback, AiPrompt  │
│  Disk/Blob — fayllar (public/uploads → Vercel Blob/MinIO)       │
│  Vector store — Qaror: pgvector (yangi pg) | Qdrant | MySQL JSON│
├─────────────────────────────────────────────────────────────────┤
│  TASHQI                                                          │
│  OpenRouter (LLM + image?) | Azure Neural TTS uz-UZ |            │
│  UzbekVoice.ai | Telegram Bot API                                │
└─────────────────────────────────────────────────────────────────┘
```

### Yangi papka strukturasi (qo'llaniladigan)

```
src/
├─ lib/ai/
│  ├─ guard.ts, agent.ts, tools.ts, provider.ts      (mavjud, kengaytiriladi)
│  ├─ documents.ts                                    (mavjud — ingest)
│  ├─ docgen.ts            ← YANGI: Excel/Word/PDF generatsiya
│  ├─ tts.ts               ← YANGI: TTS adapter (interface + Azure + UzbekVoice)
│  ├─ image.ts             ← YANGI: rasm adapter
│  ├─ rag.ts               ← YANGI: embedding + qidiruv
│  ├─ artifacts.ts         ← YANGI: sandbox HTML qurish
│  ├─ files.ts             ← YANGI: imzolangan vaqtinchalik URL
│  └─ memory.ts            ← YANGI: foydalanuvchi xotirasi (feedback asosida)
├─ app/api/ai/
│  ├─ chat/ (mavjud)
│  ├─ artifacts/route.ts   ← YANGI
│  ├─ files/[id]/route.ts  ← YANGI (imzolangan)
│  ├─ tts/route.ts         ← YANGI (POST matn → audio; GET kesh)
│  └─ images/route.ts      ← YANGI
└─ components/admin/ai/
   ├─ AiChatPanel.tsx (mavjud, kengaytiriladi)
   ├─ AiArtifactPanel.tsx   ← YANGI (iframe + "Kod/Ko'rinish" tablar)
   ├─ AiTtsPlayer.tsx       ← YANGI (har javobda "Tinglash")
   └─ AiFileCard.tsx        ← YANGI (yaratilgan fayl kartasi)
```

---

## 8. XAVFSIZLIK — Faza 0 da HAL QILINISH SHART (talabgina)

Quyidagilar talab qilingan arxitekturaga kiritilmaydi, lekin **joriy tizim xavfsiz ishlashi uchun Faza 1 dan oldin tuzatiladi** (mas'uliyatli arxitekturaning bir qismi):

1. **8 ta auth'siz endpoint** — `getSession()` + `isAdmin` qo'shish (§2.3).
2. **`code.exec`** — `needsConfirm: true` + `mutating: true` (`tools.ts:2092`).
3. **Parol hash mos emasligi** — `user.resetPassword` scrypt → sha256 (`tools.ts:1345-1348`).
4. **`AKELA_SESSION_SECRET`** `.env` ga qo'shish (`auth-core.ts:17-24`).
5. **`telegram-bot` hardcoded secret** → `.env` (`telegram-bot/route.ts:16`).
6. **`/api/onboarding?userId=`** — sessiya talab qilsin (`onboarding/route.ts:17-22`).
7. **`guard.ts`** — `status`/`isActive` tekshiruvi (`guard.ts:38-40` tanlanadi, lekin ishlatilmaydi).
8. **Rate limit** — `/api/ai/tools/[name]`, `/api/ai/drafts` (`checkRateLimit` chaqirilmaydi — `tools/[name]/route.ts:31`, `drafts/route.ts:100-114`).
9. **Prompt injection** — manba matnini "ma'lumot" deb ajratish (sentinel + sanity-check, `generator.ts:235`).
10. **Tool sxema → JSON Schema** — argument xatolarini kamaytirish (`tools.ts:2325-2336`).

---

## 9. Faza 1–10 reja (mavjud asosda qayta guruhlangan)

| Faza | Talab | Holat | Ish |
|---|---|---|---|
| **0** | Tahlil | **Tayyor** (shu hujjat) | — |
| **0.5** | Xavfsizlik poydevori (yuqoridagi 10 band) | **Yo'q** | Kichik, kritik |
| **1** | Chat yadrosi (SSE) | **70% tayyor** (NDJSON bor) | SSE'ga o'tkazish, token-streaming, prompt-injection himoyasi |
| **2** | Agent + tool use | **85% tayyor** (41 tool) | JSON Schema, tasdiq kartasi UX, audit to'ldirish, bloklash `code.exec` |
| **3** | Hujjatlar (Excel/Word/PDF) | **15%** (faqat 1 PDF, auth'siz) | `docx`, `exceljs` qo'shish; imzolangan URL; auth |
| **4** | Artifacts (kod/dashboard) | **0%** | `AiArtifactPanel`, sandbox iframe, CSP, lokal chart lib |
| **5** | Rasm generatsiyasi | **0%** | `image.ts` adapter, OpenRouter DALL-E/Flux, kunlik limit |
| **6** | O'zbekcha TTS | **0%** | Benchmark (Azure Madina/Sardor, UzbekVoice, Google, MMS), normalizatsiya moduli, kesh |
| **7** | Moslashuv (RAG, feedback, eval) | **0%** | `pgvector`/Qdrant qarori, `AiFeedback`, eval to'plami (50 senariy) |
| **8** | Chat oynasi (Claude.ai darajasi) | **30%** (panel bor, lekin sodda) | Chap panel (suhbatlar), markdown, kod highlight, STT, responsive, a11y, Lighthouse 90+ |
| **9** | Xavfsizlik/sifat/kuzatuv | **10%** | OWASP, token limit, strukturalangan log, backup, E2E |
| **10** | Deploy | **50%** (Ubuntu+Docker+Nginx) | SSE buffering, `.env.example`, CI, hujjatlar |

---

## 10. MENGA KERAK BO'LGAN QARORLAR (savollar)

1. **Vector store / RAG:** DB MySQL — `pgvector` ishlamaydi. Qaysi yo'l?
   - (a) Yangi alohida **PostgreSQL + pgvector** konteyneri (faqat embedding uchun) — toza, lekin 2-DB.
   - (b) **Qdrant** (yoki Weaviate) konteyneri — kuchli, lekin yangi servis.
   - (c) **MySQL `VECTOR`** (MySQL 9.0+ qo'llaydi) — agar server versiyasini yangilasa bo'ladi.
   - (d) Hozircha **kalit-so'z qidiruv** (mavjud) — RAG'ni Faza 7 ga kechiktirish.
   **Tavsiyam: (b) Qdrant** — o'rnatish oson, o'zbekcha matnlar uchun yetarli, MySQL'dan mustaqil.

2. **TTS provayder (Faza 6):** Benchmark uchun 4 kandidat:
   - **Microsoft Azure Neural TTS** `uz-UZ-MadinaNeural` / `uz-UZ-SardorNeural` — eng yuqori sifat, streaming bor, pullik (~$16/1M belgi).
   - **UzbekVoice.ai** — o'zbek startapi, maxsus o'zbek talaffuzi, arzonroq.
   - **Google Cloud TTS** `uz-UZ-Wavenet-A` — barqaror, lekin o'zbekcha ovoz sifati Azure'dan pastroq.
   - **Open-source: Meta MMS-TTS `uzb`** yoki **Coqui VITS** — bepul, o'z serverda, lekin sifat pastroq va GPU kerak.
   **Tavsiyam: avval Azure Neural TTS (asosiy) + UzbekVoice (zaxira).** Buni tasdiqlaysizmi?

3. **Rasm generatsiyasi (Faza 5):** OpenRouter orqali **DALL-E 3** yoki **Flux** (sifat/narx). Yoki sizda boshqa API kalit bormi? **Tavsiyam: OpenRouter Flux (tez, arzon, sifatli).**

4. **`code.exec` tool:** Bloklash kerakmi (`needsConfirm + mutating`), yoki umuman olib tashlash kerakmi? Hozir admin `cmd.exe /c` orqali serverda istalgan buyruqni ishga tushira oladi (`tools.ts:2110`).

5. **`middleware.ts` → `proxy.ts` migratsiyasi** (Next 16.3.3 deprecation) — Faza 0.5 da bajaramanmi?

6. **Rollar:** `User.role`'ni Prisma `enum` ga o'tkazish (`admin|grader|user`) va `UserRole` tipini shunga moslashtirish — Faza 0.5 dami? (Hozir `auth-core.ts:3` da `"observer"|"manager"|"participant"` bor — DB da yo'q.)

7. **Local "AI ishlamayapti" (Orca browser):** men `localhost:3000` da admin sessiya bilan tekshirdim — **AI to'liq ishlayapti** (200, NDJSON, LLM javobi "47 ta xodim"). Muammo, ehtimol, siz **oddiy `user` roli bilan** kirgandirsiz — AI faqat `admin`/`grader` uchun (`guard.ts:22-82`). Tasdiqlaysizmi? Agar admin bilan ham muammo bo'lsa — qanday xato (konsol/network) chiqayotganini yuboring.

---

## 11. "Tayyor mezoni" — Faza 0

- [x] Sayt kodi o'rganildi (74 route, 29 model, 41 tool, 14 AI komponent).
- [x] Action inventory tuzildi (`docs/ai-agent-inventory.md` + yuqoridagi jadval).
- [x] Arxitektura hujjati + papka strukturasi berildi (§7).
- [x] Aniq savollar (§10).
- [ ] **Sizning tasdiqingiz** — keyingi qadam Faza 0.5 (xavfsizlik poydevori) → Faza 1.
