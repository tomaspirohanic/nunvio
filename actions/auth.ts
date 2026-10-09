"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  generateVerificationToken,
  hashToken,
  normalizeLocale,
  sendGoogleSignInHintEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/mail";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour
const MIN_PASSWORD_LENGTH = 8;

function getBaseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export type AuthActionResult =
  | { ok: true; message?: string; emailLogged?: boolean }
  | { ok: false; error: string };

async function createAndSendVerification(opts: {
  userId: string;
  email: string;
  name?: string | null;
  locale: string;
}): Promise<{ emailLogged: boolean }> {
  const locale = normalizeLocale(opts.locale);
  const rawToken = generateVerificationToken();
  const tokenHash = hashToken(rawToken);

  await prisma.emailVerificationToken.deleteMany({
    where: { userId: opts.userId },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: opts.userId,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const verifyUrl = `${getBaseUrl()}/${locale}/verify-email?token=${rawToken}`;
  const result = await sendVerificationEmail({
    to: opts.email,
    name: opts.name,
    locale,
    verifyUrl,
  });

  return { emailLogged: result.logged };
}

export async function registerWithEmail(input: {
  name: string;
  email: string;
  password: string;
  locale: string;
}): Promise<AuthActionResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const locale = normalizeLocale(input.locale);

  if (!email || !email.includes("@")) {
    return { ok: false, error: "invalidEmail" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: "passwordTooShort" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.emailVerified && existing.passwordHash) {
    return { ok: false, error: "emailTaken" };
  }

  if (existing?.emailVerified && !existing.passwordHash) {
    return { ok: false, error: "useGoogle" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (existing && !existing.emailVerified) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: name || existing.name,
        passwordHash,
        preferredLocale: locale,
      },
    });

    const { emailLogged } = await createAndSendVerification({
      userId: user.id,
      email: user.email,
      name: user.name,
      locale,
    });

    return {
      ok: true,
      message: "verificationSent",
      emailLogged,
    };
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      preferredLocale: locale,
      emailVerified: null,
    },
  });

  const { emailLogged } = await createAndSendVerification({
    userId: user.id,
    email: user.email,
    name: user.name,
    locale,
  });

  return {
    ok: true,
    message: "verificationSent",
    emailLogged,
  };
}

export async function resendVerificationEmail(input: {
  email: string;
  locale: string;
}): Promise<AuthActionResult> {
  const email = input.email.trim().toLowerCase();
  const locale = normalizeLocale(input.locale);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified || !user.passwordHash) {
    // Don't leak whether the account exists
    return { ok: true, message: "verificationSent" };
  }

  const { emailLogged } = await createAndSendVerification({
    userId: user.id,
    email: user.email,
    name: user.name,
    locale: user.preferredLocale || locale,
  });

  return { ok: true, message: "verificationSent", emailLogged };
}

/** Pre-check before NextAuth credentials signIn (clear error codes). */
export async function validateEmailLogin(input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return { ok: false, error: "invalidCredentials" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true, emailVerified: true },
  });

  if (!user?.passwordHash) {
    return { ok: false, error: "invalidCredentials" };
  }

  if (!user.emailVerified) {
    return { ok: false, error: "emailNotVerified" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "invalidCredentials" };
  }

  return { ok: true };
}

export async function verifyEmailToken(
  token: string
): Promise<AuthActionResult & { email?: string }> {
  if (!token || token.length < 20) {
    return { ok: false, error: "invalidToken" };
  }

  const tokenHash = hashToken(token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) {
    return { ok: false, error: "invalidToken" };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    return { ok: false, error: "tokenExpired" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({
      where: { userId: record.userId },
    }),
  ]);

  return { ok: true, email: record.user.email, message: "verified" };
}

export async function requestPasswordReset(input: {
  email: string;
  locale: string;
}): Promise<{ ok: boolean; error?: string; emailLogged?: boolean; message?: string }> {
  const email = input.email.trim().toLowerCase();
  const locale = normalizeLocale(input.locale);

  if (!email || !email.includes("@")) {
    return { ok: false, error: "invalidEmail" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  // Always succeed to avoid email enumeration; only send when usable.
  if (!user) {
    return { ok: true };
  }

  // Google-only account: no password to reset — send a helpful hint email.
  if (!user.passwordHash) {
    const loginUrl = `${getBaseUrl()}/${locale}/login`;
    const result = await sendGoogleSignInHintEmail({
      to: user.email,
      name: user.name,
      locale,
      loginUrl,
    });
    return { ok: true, emailLogged: result.logged, message: "googleAccount" };
  }

  const rawToken = generateVerificationToken();
  const tokenHash = hashToken(rawToken);

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${getBaseUrl()}/${locale}/reset-password?token=${rawToken}`;
  const result = await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    locale,
    resetUrl,
  });

  return { ok: true, emailLogged: result.logged };
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const token = input.token?.trim() || "";
  const password = input.password;

  if (!token || token.length < 20) {
    return { ok: false, error: "resetInvalid" };
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: "passwordTooShort" };
  }

  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record) {
    return { ok: false, error: "resetInvalid" };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } });
    return { ok: false, error: "resetExpired" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId },
    }),
  ]);

  return { ok: true };
}
