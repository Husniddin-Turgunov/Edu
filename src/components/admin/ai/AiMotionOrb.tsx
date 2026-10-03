"use client";

// components/admin/ai/AiMotionOrb.tsx
// "ai motion.lottie" animatsiyasini chizadi va holatga qarab o'zgartiradi.
//
// To'rt holat:
//   idle       -> orginal animatsiya o'z holicha (kichik ikonkalar shunday);
//   typing     -> ko'z sohasida "typing" yozuvi;
//   generating -> ko'z sohasida "generating" yozuvi;
//   answering  -> kattalashib-kichrayib pulsatsiya qiladi (matnsiz).
//
// Yozuv K O'ZGA (49.2% / 46.7%) joylashtiriladi: kadr kadrida ikki yorug'
// novda shu nuqtada turadi. Sfera rangi kadrga qarab o'zgarib turgani
// uchun matn oq, qora soya va yorug'lik halqasi bilan ishlangan — ham och,
// ham to'q fonda o'qiladi.
//
// Yozuv faqat 48 px dan katta orbda chiqadi: kichikroqda so'z o'qilmaydi va
// u yerda shart bo'lib, orginal animatsiya qolishi kerak.
//
// 75 kadrlik animatsiya ekrandan tashqarida to'xtaydi (lottieInView), shuning
// uchun uzun chatda har bir xabar orbini CPU yemaydi.

import { motion, useReducedMotion } from "framer-motion";
import { Lottie, LottieDisplay, LottieInteractions, LottieLoading, lottieInView } from "lottie-react";
import type { LottieInteraction } from "lottie-react";

export type AiMotionMode = "idle" | "typing" | "generating" | "answering";

/** Kadr kadridagi ko'z novdalari markazi — 256x256 canvas'da o'lchangan. */
const DATA_URL = "/lottie/ai-motion/animation.json";
/**
 * Kadrlar manzili shu papkaga nisbiy (`u: "images/"`) yozilgan, shuning uchun
 * lottie-web ularni `assetsPath + u + p` deb yig'adi. Bu qiymatni aniq
 * belgilasak, kutubxona manzilni JSON papkasidan hosil qilishiga bog'liq
 * bo'lmay qoladi — aks holda manzil ikki marta qo'shilib, barcha kadr 404 beradi.
 */
const ASSETS_PATH = "/lottie/ai-motion/";
const EYE_X = 49.2;
const EYE_Y = 46.7;

/** Bu o'lchamdan kichik orbda yozuv o'qilmaydi — orginal holat qoladi. */
const LABEL_MIN_SIZE = 56;

/** Holatga mos ko'z ichidagi yozuv. */
const LABEL: Record<AiMotionMode, string | null> = {
  idle: null,
  typing: "typing",
  generating: "generating",
  answering: null,
};

/**
 * Yozuv o'lchamiga moslashuvi.
 *
 * Bitta o'lcham ikkala so'z uchun ham ishlatiladi ("typing"ga kattaroq,
 * "generating"ga kichikroq deb o'zgartirilsa, holat almashganda yozuv
 * sakrab ketardi). Shuning uchun o'lcham ENG UZUN so'zga ("generating",
 * 10 ta belgi) moslashtiriladi — shu qat'iy chegara ikkalasiga ham tegadi.
 *
 * `SPHERE_FILL` — kadrda sfera kadr chegarasini ~84% egallaydi (chetlarida
 * shaffof bo'shliq bor). Shuning uchun yozuv KADRGA emas, SFERA ICHIGA
 * sig'ishi kerak: aks holda u sferaning chegarasidan chiqib ketadi.
 * `CHAR_W` — yirg'orqa shriftdagi o'rtacha belgi kengligi (shrift nisbatida).
 */
const LABEL_CHARS = 10;
const SPHERE_FILL = 0.84;
const CHAR_W = 0.6;

const IN_VIEW: readonly LottieInteraction[] = [lottieInView({ margin: "120px" })];

export function AiMotionOrb({
  mode = "idle",
  size = 44,
  className = "",
}: {
  mode?: AiMotionMode;
  size?: number;
  className?: string;
}) {
  // Harakatni kamaytirish yoqilgan foydalanuvchiga faqat birinchi kadr:
  // animatsiya o'zi to'xtaydi, matn esa o'qiladigan bo'lib qoladi.
  const reduced = useReducedMotion();
  const label = size >= LABEL_MIN_SIZE ? LABEL[mode] : null;
  // AI ishlayotgan har holatda orb nafas oladi: `generating` (vositalar
  // bajarilmoqda) va `typing` (javob matni yozilmoqda). Aynan shu o'sish va
  // kichrayish — "javob berishda kattalashib kichrayishi".
  const working = mode !== "idle" && !reduced;
  // Sfera diametriga sig'adigan eng kattaroq shrift.
  const labelSize = Math.max(
    8,
    Math.min(Math.round(size * 0.28), Math.floor(size / (LABEL_CHARS * CHAR_W))),
  );

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <motion.span
        className="absolute inset-0 flex items-center justify-center"
        animate={working ? { scale: [1, 1.16, 1] } : { scale: 1 }}
        transition={
          working
            ? { duration: 1.7, repeat: Infinity, ease: "easeInOut" }
            : { type: "spring", stiffness: 300, damping: 22 }
        }
      >
        <Lottie src={DATA_URL} assetsPath={ASSETS_PATH} loop autoplay={false} className="relative h-full w-full">
          <LottieInteractions interactions={reduced ? [] : IN_VIEW}>
            <LottieDisplay className="absolute inset-0 h-full w-full" />
          </LottieInteractions>

          {/* Tez yuklanmasa aylanish ko'rsatkichi chiqmaydi (150 ms dan keyin). */}
          <LottieLoading showAfter={150}>
            <span className="block h-full w-full rounded-full bg-gradient-to-br from-indigo-500/25 via-fuchsia-400/20 to-cyan-400/25" />
          </LottieLoading>

          {label && (
            <span
              className="pointer-events-none absolute select-none whitespace-nowrap font-semibold leading-none tracking-tight text-white"
              style={{
                left: `${EYE_X}%`,
                top: `${EYE_Y}%`,
                transform: "translate(-50%, -50%)",
                fontSize: labelSize,
                textShadow:
                  "0 1px 2px rgba(15,23,42,.8), 0 0 6px rgba(15,23,42,.5), 0 0 14px rgba(255,255,255,.5)",
              }}
            >
              {label}
            </span>
          )}
        </Lottie>
      </motion.span>
    </span>
  );
}

export default AiMotionOrb;