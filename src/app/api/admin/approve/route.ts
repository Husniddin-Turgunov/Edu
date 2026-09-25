import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { isHiddenAdminEmail } from "@/lib/hidden-admin";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "userId kiritilishi shart" }, { status: 400 });
    }

    try {
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (target && isHiddenAdminEmail(target.email)) {
        return NextResponse.json({ error: "Himoyalangan foydalanuvchi" }, { status: 403 });
      }
    } catch {}

    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: "approved", approvedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      message: `${user.name} tasdiqlandi`,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
