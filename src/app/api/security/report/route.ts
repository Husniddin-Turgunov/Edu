import { NextRequest } from "next/server";
import { handleSecurityReport } from "@/lib/security-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/security/report
 *
 * Klient "konsol ochildi" deb xabar beradi. Qarorni SERVER qabul qiladi:
 * bazaga yozadi, foydalanuvchini bloklaydi va Telegram orqali adminlarga
 * xabar yuboradi.
 *
 * So'rov tanasidagi `userId` butunlay e'tiborsiz qoldiriladi — identifikator
 * faqat imzolangan sessiyadan olinadi.
 */
export async function POST(req: NextRequest) {
  return handleSecurityReport(req);
}
