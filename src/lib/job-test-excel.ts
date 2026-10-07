// helper for Excel test template — import/export with randomization
export type QuizItem = {
  question: string;
  options: string[];
  correct: number;
  /**
   * `false` — bu YOZMA javobli savol (variant yo'q, foydalanuvchi javobni
   * o'zi yozadi). `true` — variantli savol.
   *
   * Nima uchun kerak: avval parser 2 ta variant bo'lmasa qatorni butunlay
   * tashlab ketardi (`if (opts.length < 2) continue`), ya'ni Excel orqali
   * yozma javobli savol kiritib bo'lmas edi. Endi ikkala tur ham qabul qilinadi
   * va HAR BIR QATOR ALOHIDA savol bo'lib saqlanadi.
   */
  hasOptions: boolean;
  /** Yozma javob uchun to'g'ri javob matni. */
  correctText: string;
};

function shuffleWithCorrect(options: string[], correctIdx: number): { options: string[]; correct: number } {
  const correctText = options[correctIdx];
  // Fisher-Yates
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const newCorrect = shuffled.indexOf(correctText);
  return { options: shuffled, correct: newCorrect === -1 ? 0 : newCorrect };
}

export async function parseExcelFileToQuestions(file: File): Promise<QuizItem[]> {
  const XLSX: any = await import("xlsx");
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error("Excelda varaq topilmadi");
  const sheet = wb.Sheets[firstSheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rows.length < 2) throw new Error("Excel bo'sh yoki sarlavha yo'q");

  // Detect header row: first row should contain "Savol" or "Question"
  let startIdx = 0;
  const header = rows[0].map((c: any) => String(c).toLowerCase());
  const hasHeader = header.some((h: string) => h.includes("savol") || h.includes("question") || h.includes("вопрос"));
  if (hasHeader) startIdx = 1;

  const items: QuizItem[] = [];

  for (let r = startIdx; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const qRaw = String(row[0] ?? "").trim();
    if (!qRaw) continue; // skip empty question

    // Options B-E => indices 1..4
    const rawOpts: string[] = [];
    for (let c = 1; c <= 4; c++) {
      const v = String(row[c] ?? "").trim();
      if (v) rawOpts.push(v);
      else if (c <= 2) rawOpts.push(""); // keep placeholders for A,B if empty? but we filter later
    }
    // Filter empty but keep at least 2
    const opts = rawOpts.filter(o => o.trim() !== "");
    // To'g'ri javob matni — F ustun (index 5)
    const correctTextRaw = String(row[5] ?? "").trim();

    // ——— YOZMA JAVOBLI SAVOL ———
    //
    // Variant 2 tadan kam bo'lsa, bu variantli savol EMAS. Balki yozma javobli
    // savol: foydalanuvchi javobni o'zi yozadi, nazoratchi solishtiradi.
    // Shuni avval tashlab ketish sabab 1 — sabab 2, savollar aralashib
    // ketmasligi uchun har biri alohida `items.push` qilinadi.
    if (opts.length < 2) {
      if (opts.length === 1) {
        // bitta katak = to'g'ri javob matni deb qabul qilamiz
        items.push({
          question: qRaw,
          options: [],
          correct: -1,
          hasOptions: false,
          correctText: correctTextRaw || opts[0],
        });
        continue;
      }
      // variant yo'q, to'g'ri javob F ustunda bo'lishi SHART
      if (!correctTextRaw) continue;
      items.push({
        question: qRaw,
        options: [],
        correct: -1,
        hasOptions: false,
        correctText: correctTextRaw,
      });
      continue;
    }

    // To'g'ri javob - column 5 (index 5) => F
    const correctRaw = String(row[5] ?? "").trim();
    let correctIdx = 0;
    if (correctRaw) {
      const upper = correctRaw.toUpperCase().trim();
      if (["A", "B", "C", "D"].includes(upper)) {
        correctIdx = upper.charCodeAt(0) - 65; // A=0
      } else if (["1", "2", "3", "4"].includes(upper)) {
        correctIdx = parseInt(upper, 10) - 1;
      } else if (correctRaw.includes("✓")) {
        // find which option has ✓
        const withMark = rawOpts.findIndex(o => String(o).includes("✓"));
        if (withMark >= 0) correctIdx = withMark;
        else {
          // try to match text
          const matched = opts.findIndex(o => correctRaw.replace(/✓/g, "").trim().toLowerCase() === o.toLowerCase());
          if (matched >= 0) correctIdx = matched;
        }
      } else {
        // Try to match correctRaw text to option text
        const matched = opts.findIndex(o => o.toLowerCase() === correctRaw.toLowerCase());
        if (matched >= 0) correctIdx = matched;
        else {
          // If correctRaw is like "B variant text", try first char
          const firstChar = upper[0];
          if (["A", "B", "C", "D"].includes(firstChar)) correctIdx = firstChar.charCodeAt(0) - 65;
        }
      }
    } else {
      // No correct column, try to detect ✓ inside options
      const idxWithCheck = rawOpts.findIndex(o => String(o).includes("✓"));
      if (idxWithCheck >= 0) {
        // remove ✓ from option text and set correct
        rawOpts[idxWithCheck] = String(rawOpts[idxWithCheck]).replace(/✓/g, "").replace(/to[‘'ʼ`]g[‘'ʼ`]ri\s*javob/gi, "").trim();
        correctIdx = opts.indexOf(rawOpts[idxWithCheck].trim()) >=0 ? opts.indexOf(rawOpts[idxWithCheck].trim()) : idxWithCheck;
        // need to rebuild opts without ✓
        // opts already filtered, but we need to clean
        for (let i=0;i<opts.length;i++) opts[i] = opts[i].replace(/✓/g, "").replace(/to[‘'ʼ`]g[‘'ʼ`]ri\s*javob/gi, "").trim();
      }
    }

    // Clean options from ✓ remnants
    const cleanOpts = opts.map(o => String(o).replace(/✓/g, "").replace(/to[‘'ʼ`]g[‘'ʼ`]ri\s*javob/gi, "").trim()).filter(o=>o);

    if (cleanOpts.length < 2) continue;
    // Clamp correctIdx
    if (correctIdx < 0 || correctIdx >= cleanOpts.length) correctIdx = 0;

    // Shuffle so correct is random position even if template had fixed B
    const { options: shuffled, correct: newCorrect } = shuffleWithCorrect(cleanOpts, correctIdx);

    items.push({
      question: qRaw,
      options: shuffled,
      correct: newCorrect,
      hasOptions: true,
      correctText: "",
    });
  }

  if (items.length === 0)
    throw new Error(
      "Hech qanday savol topilmadi. Shablonni tekshiring: Savol ustuni to'ldirilgan, " +
        "hamda yoki variantlar (kamida 2 ta) yoki «To'g'ri javob» ustuni bo'lishi kerak.",
    );
  return items;
}

export async function downloadTestTemplate() {
  const XLSX: any = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const header = ["Savol *", "A variant *", "B variant *", "C variant", "D variant", "To'g'ri javob * (A/B/C/D)"];

  const example1 = [
    "Mijoz so'rovlari qaysi kanallar orqali kelishi mumkin?",
    "Faqat telefon orqali",
    "Email, CRM, telefon, veb-sayt",
    "Faqat pochta orqali",
    "Faqat shaxsan",
    "B",
  ];
  const example2 = [
    "Normativ nimani belgilaydi?",
    "Faqat maosh miqdorini",
    "Ish qanday, qachon va qanday sifatda bajarilishini",
    "Kompaniya nomini",
    "Ofis rangini",
    "B",
  ];
  const example3 = [
    "Haftalik moliyaviy tahlil qachon ko'rib chiqiladi?",
    "Hafta boshida (dushanba)",
    "Hech qachon",
    "Har kuni",
    "Faqat oy oxirida",
    "A",
  ];

  const wsData = [
    header,
    example1,
    example2,
    example3,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = [
    { wch: 50 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 18 },
  ];

  // Header style (bold) - via !rows? xlsx doesn't support style without extra, but we can set filter
  // Add autoFilter
  ws["!autofilter"] = { ref: `A1:F${wsData.length}` };

  XLSX.utils.book_append_sheet(wb, ws, "Testlar");

  // Instruction sheet
  const instr = [
    ["Yo'riqnoma - Test shabloni"],
    [],
    ["1. Har bir qator - bitta savol."],
    ["2. A-D ustunlariga variantlarni yozing (kamida 2 ta)."],
    ["3. To'g'ri javob ustuniga faqat harf yozing: A, B, C yoki D (yoki 1-4)."],
    ["4. Sayt yuklaganda to'g'ri javobni avtomatik taniydi va variantlarni random aralashtiradi."],
    ["5. Hatto shablonda to'g'ri javob har doim B da bo'lsa ham, saytda har safar har xil joyda chiqadi."],
    ["6. Faylni saqlab, admin paneldagi 'Excel dan import' tugmasi orqali yuklang."],
    [],
    ["Eslatma: Savol va kamida 2 ta variant to'ldirilishi shart."],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(instr);
  ws2["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Yo'riqnoma");

  const fileName = "test-shablon.xlsx";
  XLSX.writeFile(wb, fileName);
}
