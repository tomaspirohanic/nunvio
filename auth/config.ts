// ============================================
// NEXTAUTH CONFIGURATION
// ============================================
// Providers:
// 1. Google OAuth
// 2. Credentials (email + password) after email verification
// Session: JWT — enriched with userId, role, agencyId from DB
// ============================================

import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const authConfig: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  // Locale is applied by middleware when hitting /login without prefix
  pages: {
    signIn: "/en/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          throw new Error("MISSING_CREDENTIALS");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            emailVerified: true,
          },
        });

        if (!user?.passwordHash) {
          throw new Error("INVALID_CREDENTIALS");
        }

        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          throw new Error("INVALID_CREDENTIALS");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      const email = user.email.trim().toLowerCase();

      if (account?.provider === "google") {
        await prisma.user.upsert({
          where: { email },
          update: {
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            emailVerified: new Date(),
          },
          create: {
            email,
            name: user.name,
            image: user.image,
            emailVerified: new Date(),
          },
        });
        return true;
      }

      if (account?.provider === "credentials") {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, emailVerified: true, passwordHash: true },
        });
        return Boolean(dbUser?.emailVerified && dbUser.passwordHash);
      }

      return true;
    },

    async jwt({ token, user }) {
      const email = user?.email || (token.email as string | undefined);

      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: email.trim().toLowerCase() },
          select: { id: true, role: true, agencyId: true, email: true },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.agencyId = dbUser.agencyId;
          token.email = dbUser.email;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.agencyId = token.agencyId as string | null;
      }

      return session;
    },
  },
};
