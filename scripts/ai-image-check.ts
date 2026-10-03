/**
 * scripts/ai-image-check.ts — Faza 5 dalil skripti.
 *
 *   npx tsx --env-file=.env scripts/ai-image-check.ts
 *
 * Nima qilinadi: lokal "stub" server quriladi (OpenRouter chat/completions
 * shaklini takror qiladi, rasm esa `sharp` bilan haqiqiy PNG yaratiladi) va
 * to'liq pipeline shu orqali sinovdan o'tkaziladi:
 *
 *  1) buildImagePrompt — o'lcham/uslub va "matn yo'q" qo'shiladi
 *  2) detectImageType — PNG/JPEG/WebP belgilari to'g'ri aniqlanadi
 *  3) generateImage (stub orqali) — b64 data URL dan haqiqiy PNG olinadi
 *  4) storeGeneratedImage — disk + AiFile + imzolangan URL
 *  5) verifyImage — tekshiruv o'tadi (bazada, diskda, belgilar)
 *  6) KAPOT: rasm emas (JSON xato) qaytsa → tekshiruvdan O'TMAYDI
 *  7) KAPOT: 402 → foydalanuvchiga tushunarli "balans yo'q" xabari
 *  8) KAPOT: barcha modellar ishlamasa → aniq xato (models ro'yxati bilan)
 *  9) HAQIQIY OpenRouter probu — joriy holatni ko'rsatadi (402 bo'lishi mumkin)
 */

import http from "node:http";
import sharp from "sharp";
import {
  generateImage,
  storeGeneratedImage,
  buildImagePrompt,
  detectImageType,
  explainImageError,
  IMAGE_MODEL_CHAIN,
  ImageGenerationError,
  imageDailyLimit,
} from "@/lib/ai/image";
import { verifyToolResult } from "@/lib/ai/verify";
import { db } from "@/lib/db";
import type { ToolContext } from "@/lib/ai/tools";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  OK   ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Haqiqiy PNG (sharp) — 1024x1024, yashil kvadrat. */
async function realPng(): Promise<Buffer> {
  return sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 34, g: 197, b: 94 } },
  })
    .png()
    .toBuffer();
}

/** Stub: OpenRouter ga o'xshash javob, lekin rasm base64 bilan. */
function startStub(mode: "ok" | "notimage" | "fail"): Promise<{ url: string; close: () => void; calls: number }> {
  let calls = 0;
  const server = http.createServer((req, res) => {
    calls++;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      if (mode === "fail") {
        res.writeHead(402, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: 402, message: "Insufficient credits" } }));
        return;
      }
      const png = (await realPng()).toString("base64");
      const url = mode === "notimage" ? `data:application/json;base64,${Buffer.from('{"error":"nope"}').toString("base64")}` : `data:image/png;base64,${png}`;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "stub",
          model: "stub-model",
          choices: [{ message: { role: "assistant", content: "", images: [{ type: "image_url", image_url: { url } }] } }],
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        }),
      );
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as any;
      resolve({ url: `http://127.0.0.1:${addr.port}/v1`, close: () => server.close(), calls: () => calls });
    });
  });
}

async function main() {
  console.log("\n=== 1) Prompt quruvchi ===");
  const p = buildImagePrompt({ prompt: "Yashil olma, oq fon", size: "16:9", style: "yapon minimalizmi" });
  check("prompt matni kiritildi", p.includes("Yashil olma"));
  check("uslub kiritildi", p.includes("yapon minimalizmi"));
  check("nisbat kiritildi", p.includes("16:9"));
  check("matn yo'qligi qo'shildi", /BO'LMASIN/i.test(p));
  check("1:1 default", buildImagePrompt({ prompt: "x" }).includes("1:1"));

  console.log("\n=== 2) Fayzodiy rasm turini aniqlash ===");
  const png = await realPng();
  check("PNG", detectImageType(png)?.ext === "png", `${png.length} bayt`);
  check("JPEG", detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))?.ext === "jpg");
  check("WEBP", detectImageType(Buffer.from("RIFF0000WEBPVP8 ", "ascii"))?.ext === "webp");
  check("JSON rasm emas", detectImageType(Buffer.from('{"error":"x"}')) === null);

  console.log("\n=== 3) generateImage — stub orqali ===");
  const stub = await startStub("ok");
  const stubCalls = () => (stub as any).calls;
  void stubCalls;
  const image = await generateImage({ prompt: "Yashil olma", size: "1:1", baseUrl: stub.url, apiKey: "test-key" });
  check("rasm qaytarildi", image.bytes.length > 10_000, `${(image.bytes.length / 1024).toFixed(1)} KB, ${image.mime}`);
  check("tur png", image.ext === "png");
  check("model qaytarildi", image.model === IMAGE_MODEL_CHAIN[0], image.model);
  stub.close();

  console.log("\n=== 4+5) Saqlash va tekshiruv ===");
  const admin: any = await db.user.findFirst({ where: { role: "admin" }, select: { id: true, email: true, role: true } });
  const ctx: ToolContext = {
    actor: { userId: admin.id, email: admin.email, role: "admin", name: "T", isAdmin: true },
    conversationId: null,
    source: "api",
  };
  const stored = await storeGeneratedImage({
    ownerId: admin.id,
    image,
    prompt: "Yashil olma",
    title: "olma sinovi",
  });
  check("fayl nomi", stored.fileName.startsWith("olma"), stored.fileName);
  check("imzolangan URL", stored.url.includes("sig="), stored.url);
  const verifyOk = await verifyToolResult("image.generate", {}, ctx, {
    ok: true,
    summary: "stub",
    data: { fileId: stored.id },
  } as any);
  check("tekshiruv o'tdi", verifyOk.ok === true, verifyOk.detail);

  console.log("\n=== 6) KAPOT: rasm emas ===");
  const badStub = await startStub("notimage");
  let badResult: any = null;
  try {
    await generateImage({ prompt: "x", baseUrl: badStub.url, apiKey: "k" });
  } catch (e: any) {
    badResult = e;
  }
  badStub.close();
  check("rasm bo'lmaganda xato", badResult instanceof ImageGenerationError, badResult?.message?.slice(0, 90));
  check("xato sababida model qaytarilgan", String(badResult?.message).includes("belgilar mos kelmadi"));

  console.log("\n=== 7) KAPOT: 402 balans ===");
  const failStub = await startStub("fail");
  let balanceErr: any = null;
  try {
    await generateImage({ prompt: "x", baseUrl: failStub.url, apiKey: "k" });
  } catch (e: any) {
    balanceErr = e;
  }
  failStub.close();
  check("402 → ImageGenerationError", balanceErr instanceof ImageGenerationError, String(balanceErr?.providerStatus));
  check("xabar balans haqida", /balans|mablag/i.test(String(balanceErr?.message)), String(balanceErr?.message).slice(0, 80));
  check("barcha modellar urindi", (balanceErr?.attempts || []).length === IMAGE_MODEL_CHAIN.length, `${(balanceErr?.attempts || []).length}/${IMAGE_MODEL_CHAIN.length}`);
  check("explainImageError(402) o'zbekcha", /balans/i.test(explainImageError(402)));

  console.log("\n=== 8) Limit va sozlamalar ===");
  check("kunlik limit o'qildi", imageDailyLimit() > 0, String(imageDailyLimit()));
  check("model zanjiri to'ldirilgan", IMAGE_MODEL_CHAIN.length >= 3, IMAGE_MODEL_CHAIN.join(", "));

  console.log("\n=== 9) HAQIQIY OpenRouter probu (joriy holat) ===");
  try {
    const real = await generateImage({ prompt: "Yashil olma" });
    check("haqiqiy rasm olindi", real.bytes.length > 1000, `${(real.bytes.length / 1024).toFixed(1)} KB`);
  } catch (e: any) {
    const status = e instanceof ImageGenerationError ? e.providerStatus : 0;
    console.log(`  ℹ️  HAQIQIY probu: ${status} — ${String(e.message).slice(0, 160)}`);
    check("real xato tushunarli shaklda", String(e.message).length > 30);
  }

  console.log(`\n=== NATIJA: ${failed === 0 ? "BARCHASI O'TDI" : `${failed} ta xato`} ===\n`);
  await db.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Skript xatosi:", e?.message || e);
  process.exit(1);
});