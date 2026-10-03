import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

/**
 * Telegram uchun test natijasi kartochkasi (PNG rasm).
 *
 * Rasm `next/og` (ImageResponse → Satori → resvg) orqali server tomonda
 * generatsiya qilinadi — qo'shimcha paket kerak emas. Matn to'liq
 * (o'zbek + rus/kirill) ko'rinishi uchun `public/fonts` dagi Noto Sans
 * shrifti yuklanadi.
 */

export type ResultCardData = {
  /** To'liq ism-familiya */
  fullName: string;
  department?: string | null;
  position?: string | null;
  testTitle: string;
  /** 0-100 (yozma savolli testlarda null bo'lishi mumkin) */
  score: number | null;
  passScore?: number | null;
  passed: boolean;
  /** "I daraja" | "II daraja" | "III daraja" | "Baholanmagan" */
  level: string;
  /** Nechta to'g'ri javob (avto-baholangan) */
  correctCount?: number | null;
  /** Nechta xato javob */
  wrongCount?: number | null;
  /** ISO yoki Date */
  completedAt?: string | Date | null;
};

const SIZE = 1080;

const LEVEL_COLOR: Record<string, string> = {
  "I daraja": "#c4b5fd",
  "II daraja": "#7dd3fc",
  "III daraja": "#fcd34d",
  "Baholanmagan": "#cbd5e1",
};

/** Ball bo'yicha bilim darajasi (admin/skills bilan bir xil mantiq) */
export function levelForScore(score: number | null | undefined): string {
  const s = typeof score === "number" ? score : 0;
  if (s >= 86) return "I daraja";
  if (s >= 70) return "II daraja";
  if (s > 0) return "III daraja";
  return "Baholanmagan";
}

function formatDate(value?: string | Date | null) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ====== Shriftlar (bir marta o'qiladi, keyin keshdan olinadi) ======

type LoadedFont = { name: string; data: Uint8Array; weight: 400 | 700; style: "normal" };

let fontCache: LoadedFont[] | null = null;

async function loadFonts(origin?: string): Promise<LoadedFont[]> {
  if (fontCache) return fontCache;

  const files: { file: string; weight: 400 | 700 }[] = [
    { file: "NotoSans-Regular.ttf", weight: 400 },
    { file: "NotoSans-Bold.ttf", weight: 700 },
  ];

  const fonts: LoadedFont[] = [];
  for (const { file, weight } of files) {
    let data: Uint8Array | null = null;

    // 1) Fayl tizimidan (build vaqtida trace qilinadi)
    try {
      data = new Uint8Array(fs.readFileSync(path.join(process.cwd(), "public", "fonts", file)));
    } catch {
      data = null;
    }

    // 2) Zaxira: o'z domenimizdan (public/fonts CDN da)
    if (!data && origin) {
      try {
        const res = await fetch(`${origin.replace(/\/$/, "")}/fonts/${file}`);
        if (res.ok) data = new Uint8Array(await res.arrayBuffer());
      } catch {
        data = null;
      }
    }

    if (data) fonts.push({ name: "NotoSans", data, weight, style: "normal" });
  }

  fontCache = fonts;
  return fonts;
}

// ====== Kartochkani PNG qilib chizish ======

export async function renderResultCardPng(
  data: ResultCardData,
  origin?: string,
): Promise<ArrayBuffer> {
  const level = data.level || levelForScore(data.score);
  const accent = LEVEL_COLOR[level] || "#cbd5e1";
  const scoreText = typeof data.score === "number" ? `${data.score}%` : "—";
  const statusText = data.passed ? "O'TDI" : "YIQILDI";
  const statusColor = data.passed ? "#34d399" : "#fb7185";
  const fullName = (data.fullName || "Noma'lum").trim();
  const department = (data.department || "").trim();
  const position = (data.position || "").trim();
  const testTitle = (data.testTitle || "Test").trim();

  const fonts = await loadFonts(origin);

  const card = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 64px",
        backgroundColor: "#062a20",
        backgroundImage: "linear-gradient(135deg, #064e3b 0%, #062a20 55%, #041f18 100%)",
        fontFamily: "NotoSans",
        color: "#ffffff",
      }}
    >
      {/* Sarlavha */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: 4 }}>
            AKELA GROUP
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#6ee7b7", marginTop: 6 }}>
            Malaka tekshirish tizimi
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 20,
            padding: "10px 22px",
            borderRadius: 999,
            border: "2px solid rgba(110,231,183,0.45)",
            color: "#a7f3d0",
          }}
        >
          TEST NATIJASI
        </div>
      </div>

      {/* Ball + daraja + hodim */}
      <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
        <div
          style={{
            display: "flex",
            width: 300,
            height: 300,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            border: `10px solid ${accent}`,
            backgroundColor: "rgba(255,255,255,0.04)",
            fontSize: 104,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {scoreText}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "10px 26px",
              borderRadius: 14,
              backgroundColor: accent,
              color: "#052e22",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {level}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 46,
              fontWeight: 700,
              marginTop: 22,
              lineHeight: 1.15,
            }}
          >
            {fullName}
          </div>
          {department ? (
            <div style={{ display: "flex", fontSize: 24, color: "#cbd5e1", marginTop: 10 }}>
              {department}
            </div>
          ) : null}
          {position ? (
            <div style={{ display: "flex", fontSize: 22, color: "#94a3b8", marginTop: 4 }}>
              {position}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              color: statusColor,
              marginTop: 20,
            }}
          >
            {statusText}
          </div>
        </div>
      </div>

      {/* To'g'ri / xato soni va foizlari */}
      {typeof data.correctCount === "number" && typeof data.wrongCount === "number" && (data.correctCount + data.wrongCount) > 0 ? (
        <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              background: "rgba(16,185,129,0.16)",
              border: "2px solid rgba(16,185,129,0.45)",
              borderRadius: 18,
              padding: "14px 18px",
            }}
          >
            <div style={{ display: "flex", fontSize: 19, color: "#6ee7b7", fontWeight: 600 }}>To'g'ri javoblar</div>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "#ecfdf5", marginTop: 4 }}>
              {data.correctCount}
              <span style={{ fontSize: 20, color: "#6ee7b7", marginLeft: 8 }}>
                ({Math.round((data.correctCount / (data.correctCount + data.wrongCount || 1)) * 100)}%)
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              background: "rgba(244,63,94,0.16)",
              border: "2px solid rgba(244,63,94,0.45)",
              borderRadius: 18,
              padding: "14px 18px",
            }}
          >
            <div style={{ display: "flex", fontSize: 19, color: "#fda4af", fontWeight: 600 }}>Xato javoblar</div>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "#fff1f2", marginTop: 4 }}>
              {data.wrongCount}
              <span style={{ fontSize: 20, color: "#fda4af", marginLeft: 8 }}>
                ({Math.round((data.wrongCount / (data.correctCount + data.wrongCount || 1)) * 100)}%)
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Test nomi + sana */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          borderTop: "2px solid rgba(255,255,255,0.14)",
          paddingTop: 26,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, lineHeight: 1.3 }}>
          {testTitle}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 14,
            fontSize: 22,
            color: "#94a3b8",
          }}
        >
          <div style={{ display: "flex" }}>{formatDate(data.completedAt)}</div>
          <div style={{ display: "flex" }}>
            {typeof data.passScore === "number" ? `O'tish bali: ${data.passScore}%` : ""}
          </div>
        </div>
      </div>
    </div>
  );

  const image = new ImageResponse(card, {
    width: SIZE,
    height: SIZE,
    fonts: fonts.length ? (fonts as any) : undefined,
  });

  return image.arrayBuffer();
}
