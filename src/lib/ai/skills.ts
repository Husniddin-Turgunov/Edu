/**
 * lib/ai/skills.ts
 *
 * SKILLAR — sayt qoidalari va ish oqimlarining yozma qo'llanmalari.
 *
 * Nima uchun kerak: model faqat vosita nomlarini ko'rib turadi, lekin saytning
 * mantig'ini (rol nima uchun, test hayoti qanday, ko'rinish qoidalari qanday)
 * bilmaydi. Shu sababdan har bir skill — qisqa, aniq va modelga to'g'ri
 * qo'llanma. Promptga faqat INDEKS qo'yiladi (kichik), to'liq matn esa
 * `skill.read` vositasi orqali kerak bo'lganda o'qiladi.
 *
 * Yangi skill qo'shish uchun: SKILLS ga yozib qo'yish — chat darhol
 * foydalanadi (prompt indeksi avtomatik yangilanadi).
 */

export type Skill = {
  name: string;
  title: string;
  /** Qachon shu skill kerak — model buni o'z xabari bilan solishtiradi. */
  when: string;
  body: string;
};

export const SKILLS: Skill[] = [
  {
    name: "platform.actors",
    title: "Kim kim bilan ish yuritadi (rol va huquqlar)",
    when: "Foydalanuvchi rol, huquq, ruxsat, 'kim nima qila oladi' degan savollarda",
    body: `PLATFORM AKTLORLARI
- admin — to'liq huquq: foydalanuvchi, test, dars, ko'rinish, hisobot, AI sozlamalari.
- grader — test baholaydi (gradingStatus), natijalarni ko'radi, tahrirlaydi.
- xodim (role = "user") — faqat o'ziga berilgan kurs/dars/testlarni ko'radi va topshiradi.
AI bo'limi (chat) FAQAT admin va grader uchun ochiladi. Oddiy xodim uchun yopiq.

FOYDALANUVCHI HOLATLARI (User.status)
- pending — ro'yxatdan o'tgan, admin hali tasdiqlamagan. Login bloklangan.
- approved — tasdiqlangan, kirishi mumkin.
- rejected — rad etilgan, kirishi mumkin emas.
- isActive = false — hisob o'chirilgan/ishdan bo'shatilgan.

JAVOB QOIDASI: ro'l yoki huquq haqida savol kelsa, "access.rules.list" va
"permissions.check" vositalaridan foydalanib, bazadagi haqiqiy holatni ayt.`,
  },
  {
    name: "tests.lifecycle",
    title: "Test yaratish va hayot sikli",
    when: "Test yaratish, savol qo'shish, nashr qilish, urinishlar soni, o'tish bahosi, qoralamani qo'llash",
    body: `TEST HAYOT SIKLI
1) test.create — bo'sh test yaratadi (nom, modul/kurs, o'tish balyi, urinishlar soni).
2) savollar — test.generate (AI avtomatik, fayl/internet manbasidan),
   yoki test.questions.add (qo'lda).
3) test.update — nom, bal, urinishlar soni (maxAttempts), ko'rinish.
4) test.setStatus — draft | published | archived. Faqat published ko'rinadi.
5) Xodim topshiradi -> natija yaratiladi -> grader baholaydi (result.grade).
6) test.delete — butunlay o'chirish. XAVFLI: avval tasdiq so'rang.

AI TEST YARATISH (test.generate)
- Manba: attachmentIds (yuklangan fayllar) -> mode "source" (faqat shu fayllar).
  Internet -> mode "web". Ikkalasi -> "hybrid".
- AI avval QORALAMA (AiDraft) yaratadi: test.applyDraftorqali tasdiqlanadi,
  keyin testga aylanadi. Bu xavfsizlik uchun: AI hech qachon to'g'ridan-to'g'ri
  nashr qilinmagan test yaratmaydi.
- Agar fayl biriktirilmagan bo'lsa va foydalanuvchi "fayldan test" desa —
  avval fayl biriktirishni so'rang (chatga fayl yuklanadi).

O'TISH BALI: odatda 70 yoki 80 (foiz). maxAttempts = qayta topshirish huquqi.`,
  },
  {
    name: "onboarding.flow",
    title: "Adaptatsiya portali oqimi (kurs/dars)",
    when: "Kurs, modul, dars, video, tanishtirish, tuzilma, intizom, yo'riqlar, bog'lanish bo'limlari haqida",
    body: `PORTAL TUZILISHI
- Bosh sahifa → Tanishtirish → Tuzilma → Intizom → Yo'riqlar → Bog'lanish.
- Darslar (Lessons) moduli (Module) ichida joylashadi; modul kurs (Course) ichida.
- Ish (Job) kurslari alohida: JobCourse + JobDayProgress, har kunga bo'lingan.
- Har bir dars: sarlavha, matn, video, rasm; ko'rinish visibility orqali boshqariladi.

KO'RINISH VA RUXSAT (AccessRule)
- "shu xodimga / shu bo'limga / shu lavozimga / shu rolga ko'rsat yoki yashir"
- lesson.setVisibility — darsni yashirish/ko'rsatish
- access.rules.list — barcha maxsus qoidalarni ko'rish
- Bo'lim bo'yicha: departmentComparison / analytics.departments bilan solishtir.

XODIMNI QAYTA ISHLATISH (job.enroll / course.enroll / job.unenroll)
- Xodimni kursga yozish, chiqarish. Kursni bitirganini tasdiqlash uchun
  job.enroll bilan "bitirildi" holatiga o'tkaziladi.`,
  },
  {
    name: "results.grading",
    title: "Natijalar, baholash va analitika",
    when: "Baholash, natija, topshirish, reyting, zaif savollar, bo'limlar kesimida",
    body: `BAHOLASH
- Natijada gradingStatus: pending | graded (grader baholaydi).
- result.grade — baho qo'yish va izoh. Baho 0-100.
- results.list — filtrlar: test, xodim, bo'lim, sana.

ANALITIKA
- analytics.overview — umumiy statistika (xodim, test, topshirish, o'rtacha).
- analytics.weakQuestions — eng ko'p noto'g'ri berilgan savollar (o'qitish uchun).
- analytics.departments — bo'limlar kesimida natija.
- analytics.test / analytics.user — bitta test yoki xodim batafsil.
- report.build — hisobot (PDF/CSV). audit.recent — oxirgi o'zgarishlar.

TAZIQLANGAN QISM: baho va ruxsat — xavfli emas, lekin BOG'LIQ: baho qo'yishdan
oldin natijani (javoblarni) ko'rib chiq, shunda xato baho qo'yilmaydi.`,
  },
  {
    name: "users.management",
    title: "Xodimlarni boshqarish",
    when: "Xodim qo'shish, tasdiqlash, bloklash, parolni tiklash, ro'lini o'zgartirish",
    body: `XODIM BOSHQARUVI
- user.search — avval shuni ishlat: ism, familiya yoki pochta bo'yicha qidirdir.
- user.setStatus — pending/approved/rejected. Yangi ro'yxatdan o'tganlarni tasdiqlash.
- user.resetPassword — parolni tiklash (xodimga vaqtinchalik parol beriladi).
- Role: user | admin | grader. Admin faqat admin bo'lishi mumkin.

XAVFLI: bloklash, rad etish, ro'ldan o'zgartirish — avval tasdiq so'rang
(needsConfirm). O'chirish umuman yo'q — status bilan boshqariladi.`,
  },
  {
    name: "files.sources",
    title: "Manba fayllar bilan ishlash",
    when: "Fayl yuklash, PDF/DOCX dan test yaratish, fayl matnini qidirish",
    body: `FAYL YUKLASH
- Formatlar: PDF, DOCX, XLSX, TXT, MD, CSV. Bir so'rovda ko'pi bilan 12 ta fayl.
- Fayl yuklanadi -> matn ajratib olinadi -> bazada saqlanadi (AiAttachment).
- Skanlangan (rasm) PDF da matn topilmaydi — bu normal, foydalanuvchiga ayt.

FAYLDAN TEST (test.generate + attachmentIds)
- attachmentIds = chatdagi biriktirilgan fayl id'lari.
- mode "source" faqat shu fayllarni manba qiladi — boshqa joydan ma'lumot qo'shmaydi.

QO'LDA QIDIRISH (files.search)
- Dars matnida so'z qidirish. "Qaysi darsda ... degani bor?" — shu vosita.

MATN KITCHIK BO'LSA: max ~25 MB fayl, ~600 000 belgi.`,
  },
  {
    name: "files.output",
    title: "Fayl (Excel/Word/PDF) yaratish va qayta yaratish",
    when: "Fayl yaratish, Excel/Word/PDF chiqarish, 'faylni qayta yasab ber', 'boshqa formatda ber'",
    body: `FAYL CHIQARISH
- Excel (.xlsx) → doc.excel | Word (.docx) → doc.word | PDF → doc.pdf
- Har biri haqiqiy fayl yozadi va "downloadUrl" (imzolangan, 24 soat) qaytaradi.
  Chatda fayl kartasi chiqadi: "Yuklab olish", "Qayta yarat", "Boshqa formatga o'tkaz".
- Natija tekshiriladi (verify.ts): bazadagi yozuv + diskdagi fayl qayta o'qiladi.
  Tekshiruv o'tmasa, natija foydalanuvchiga BERILMAYDI — qayta bajariladi.
  Shuning uchun "downloadUrl"siz "yaratdim" DEYMA.

QAYTA YARATISH ("qayta yasab", "yana bir fayl ber", "obnovi")
1) Eski fayl nomi aniq bo'lmasa → file.list bilan qidiring (nom + yangi havola).
2) doc.recreate {"file":"nom.xlsx"} → aynan o'sha ma'lumotdan YANGI fayl (_v2).
3) Formatni o'zgartirish: doc.recreate {"file":"nom.xlsx","as":"word"|"pdf"}.
   Konversiya qoidalari: Excel→Word/PDF (jadvalga aylanadi), Word→Excel/PDF,
   PDF→Word/Excel. Eski fayl O'CHMAYDI.

MA'LUMOT YETARLI BO'LMASA
- Qatorlar/sarlavhalar/yil nomi ko'rsatilmagan bo'lsa — bitta aniq savol so'ring
  va fayl QURMA. Bo'sh fayl yaratib "tayyor" deyish — yolg'oni.`,
  },
  {
    name: "artifacts.visual",
    title: "Vizual dashboard va artifact",
    when: "Dashboard, diagramma, choy, grafik, vizual ko'rinish, infografika, kod ko'rinishi",
    body: `ARTIFACT NIMA
- Chat ichida ochiladigan mustaqil HTML hujjat (bazada saqlanadi, ID orqali
  ochiladi). Panel skriptsiz sandbox iframe'da ishlaydi.
- Grafik — LOKAL statik SVG (bar, ustunli, donut). CDN, JS va tashqi shrift yo'q.

ARTIFACT.DASHBOARD ARGUMENTLARI
- title (majburiy), subtitle
- kpis: [{"label":"Xodimlar","value":47}]
- charts: [{"title":"Bo'limlar","type":"bar"|"column","items":[{"label":"IT","value":12}]}]
- donut: {"title":"Holatlar","items":[{"label":"O'tgan","value":30}]}
- tables: [{"title":"Ro'yxat","headers":["Xodim","Ball"],"rows":[["Alisher",88]]}]
Cheklov: 8 KPI, 4 grafik, 24 element, 200 qator, 12 ustun.

ARTIFACT.CODE
- Kod/soyuzlarni ko'rsatish uchun: {title, language, code, note}
- Eslatma: kod BAJARILMAYDI — ko'rsatish uchun. Bajarish: code.exec.

QOIDA
- Raqamni o'ylab topma: avval analytics.* / results.* dan oling, keyin diagramma qur.
- Panel bo'sh chiqsa, tekshiruv (verify) "artifactUrl" ni tekshiradi — agar
  "Tekshiruv" xabari chiqsa, demak natija berilmadi va foydalanuvchiga
  "tayyor" deb yozma.`,
  } as Skill,
  {
    name: "image.create",
    title: "Rasm yaratish qoidalari",
    when: "Rasm chizish, illyustratsiya, poster, banner, avatar, rasm yaratish",
    body: `RASM YARATISH (image.generate)
- prompt: nima chizilishi (aniq, vizual, 3-8 ta so'zdan ko'p emas),
  size: 1:1 | 16:9 | 4:3 | 3:4 | 9:16, style: uslub (ixtiyoriy).
- Promptga "matn yo'q / logotip yo'q" deb qo'shishni unutma — aks holda rasm
  ichida xato yozuvlar chiqadi.
- Adapter o'zi promptga "tabiiy yorug'lik, matn yo'q" qo'shadi, lekin sizning
  tavsifyingiz asosiy qismi.

NATIJA
- Rasm chatda karta ko'rinishida chiqadi: kattalashtirish, "Qayta chiz",
  "O'zgartir", "Yuklab olish".
- Natija tekshiriladi: fayl bazada, diskda va fayzodiy PNG/JPEG/WebP belgisi
  bilan. "imageUrl" kelmagan holda "chizdim" DEYMA.

XATOLAR
- 402 — OpenRouter balansida rasm uchun mablag' yo'q. Foydalanuvchiga shuni
  ayt (matnli model ishlaydi, rasm modeli to'lanmaydi) va "chizdim" deme.
- 429 — kunlik/tanaffut limiti: qayta urinish emas, kutish kerak.
- Limit tugagan (AI_IMAGE_DAILY_LIMIT, standart 20) — boshqa kунni kutishni ayt.`,
  } as Skill,
  {
    name: "assistant.style",
    title: "Foydalanuvchi bilan muhokaza qilish qoidalari",
    when: "Har doim — javob toni, uzunligi va tasdiqlash tartibi",
    body: `JAVOB QOIDALARI (HAMMA VAQT)
1. Til: O'ZBEK, oddiy va tabiiy. Inglizcha so'zlarni kerak bo'lsa qo'sh.
2. Uzunlik: odatda 2-5 jumla. Ro'yxat kerak bo'lsa qisqa punktlar.
3. Avval natija, keyin tushuntirish. Keraksiz ma'rumot berma.
4. Nima qilishingni ANIQ ayt: "Alisherga ruxsat berdim, 3 ta urinish".
5. Noma'lum narsa — o'ylab topma. "Aniq nom yoki pochta kerak" de.
6. Xavfli amal (o'chirish, bloklash, hamma yodlash) — avval tasdiq so'ra,
   hech qachon o'z-o'zidan bajarma.
7. Sesiyani eslab qol: bugungi sessiyada so'ralgan narsalarni takror so'rma,
   avvalgi javoblarga bog'la ("Siz avval ... dedingiz").
8. Agar foydalanuvchi noaniq gapirsa — 1 ta aniq savol bilan qayta aniqlash.`,
  },
  {
    name: "mcp.usage",
    title: "MCP serverlar bilan ishlash",
    when: "Tashqi MCP serverlardagi vosita yoki ma'lumot kerak bo'lsa",
    body: `MCP (Model Context Protocol)
- Platforma bitta MCP endpoint beradi: /api/mcp (JSON-RPC 2.0).
- Tashqi agentlar shu endpoint orqali Akela ma'lumotini o'qi oladi
  (kurs, dars, test, xodim, natija, ko'rinish qoidalari).
- Autentifikatsiya: x-api-key sarlavhasi (AKELA_MCP_API_KEY) yoki admin sessiya.

TASHQI MCP
- "mcp.servers" — ulangan tashqi serverlar ro'yxati.
- "mcp.tools" — serverdagi vositalar ro'yxati.
- "mcp.call" — vositani chaqirish (server, tool, args).
- Tashqi vosita javobi model uchun matn ko'rinishida qaytariladi.

QO'LLANISH: agar foydalanuvchi tashqi manba (hujjat, rasmiy sayt) haqida
savol qilsa va internet qidiruv yetarli bo'lmasa — mcp.* vositalaridan foydalan.`,
  },
];

export function skillByName(name: string): Skill | undefined {
  const q = String(name || "").trim().toLowerCase();
  return SKILLS.find((s) => s.name === q);
}

/** Promptga qo'yiladigan ixcham indeks. */
export function skillsPrompt(): string {
  return SKILLS.map((s) => `- ${s.name} — ${s.title}. Qachon: ${s.when}`).join("\n");
}

export function skillCount(): number {
  return SKILLS.length;
}