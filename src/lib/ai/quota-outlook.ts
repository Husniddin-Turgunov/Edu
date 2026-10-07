/**
 * lib/ai/quota-outlook.ts
 *
 * KVOTA PROGNOZI — "qancha qoldi, qachon tugaydi".
 *
 * Bu hisob-kitob FreeLLMAPI loyihasidan ko'chirilgan va bu yerga
 * `aiUsage` jadvaliga moslashtirilgan:
 *   `balanceByKey` + `QuotaOutlookSection` tamoyillariga.
 *
 * Nima uchun kerak: "kvota tugadi" xatosi kelganda admin faqat
 * raqamni ko'radi, lekin QANDAY tezlikda yopilishini bilmaydi.
 * Shu panel: qoldi / foiz / daqiqada tezlik / tugash vaqti.
 */

/** 60 daqiqadan qisqa oynani hisobga olmaymiz — u sekundlarda to'ladi. */
export const OUTLOOK_MIN_WINDOW_MS = 60 * 60 * 1000;

export type UsagePoint = { day: string; requests: number; cost: number };

export type Outlook = {
  used: number;
  limit: number;
  remaining: number;
  /** 0–100. */
  remainingPct: number;
  /** Kunlik o'rtacha so'rov — nechta/soat. */
  ratePerHour: number;
  /** Qolgan vaqt — soatda. `null` = ma'lumot yetarli emas. */
  hoursLeft: number | null;
  /** "Bugun 18:40 da tugaydi" yoki "Ma'lumot yetarli emas". */
  exhaustsAt: string | null;
  status: "yaxshi" | "ehtiyot" | "xavf" | "ma'lumot yetarli emas";
  message: string;
};

/**
 * Kvota prognozini hisoblaydi.
 *
 * @param todayBugun   bugungi so'rovlar
 * @param limitKunlik   kunlik limit
 * @param historyOshilgan kunlar (bugundan tashqari), eskidan yangiga
 */
export function buildOutlook(today: number, limit: number, history: UsagePoint[]): Outlook {
  const remaining = Math.max(0, limit - today);
  const remainingPct = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

  // O'rtacha tezlik: bugun + oxirgi 7 kunlik faollik
  const recent = history.filter((h) => h.requests > 0).slice(-7);
  const totalRecent = recent.reduce((n, h) => n + h.requests, 0);
  // Har bir kun 24 soat — bitta kunlik nuqtadan yaxshiroq o'rtacha
  const avgPerDay = recent.length ? totalRecent / recent.length : today;
  const ratePerHour = Math.round((avgPerDay / 24) * 10) / 10;

  // Kamida 20 ta so'rov bo'lmasa prognoz ishonchsiz
  const enough = today >= 20 || totalRecent >= 50;
  const hoursLeft = enough && ratePerHour > 0 ? Math.round((remaining / ratePerHour) * 10) / 10 : null;

  let exhaustsAt: string | null = null;
  if (hoursLeft != null) {
    const d = new Date(Date.now() + hoursLeft * 3600_000);
    exhaustsAt = d.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  const status: Outlook["status"] =
    remaining === 0 ? "xavf" : remainingPct <= 20 ? "xavf" : remainingPct <= 50 ? "ehtiyot" : hoursLeft == null ? "ma'lumot yetarli emas" : "yaxshi";

  const message =
    remaining === 0
      ? "Kvota tugagan — yangi so'rov yuborilmaydi."
      : hoursLeft == null
        ? "Prognoz uchun so'rovlar yetarli emas — bir necha soat ishlating, keyin aniq bo'ladi."
        : hoursLeft < 1
          ? `Faqat ${Math.round(hoursLeft * 60)} daqiqa qoldi (${exhaustsAt} da tugaydi).`
          : hoursLeft < 24
            ? `Taxminan ${Math.round(hoursLeft)} soat qoldi (${exhaustsAt} da tugaydi).`
            : `${Math.round(hoursLeft / 24)} kunlik kvota bor — xavf yo'q.`;

  return { used: today, limit, remaining, remainingPct, ratePerHour, hoursLeft, exhaustsAt, status, message };
}