import { createHash, randomBytes } from "crypto";
import nodemailer from "nodemailer";
import { locales, type Locale, defaultLocale } from "@/i18n";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

export function normalizeLocale(locale: string | null | undefined): Locale {
  if (locale && (locales as readonly string[]).includes(locale)) {
    return locale as Locale;
  }
  return defaultLocale;
}

type EmailCopy = {
  subject: string;
  greeting: (name: string) => string;
  body: string;
  cta: string;
  ignore: string;
};

type EmailMessages = {
  verifySubject: string;
  greeting: string;
  greetingNoName: string;
  verifyBody: string;
  verifyCta: string;
  verifyIgnore: string;
  resetSubject: string;
  resetBody: string;
  resetCta: string;
  resetIgnore: string;
};

/**
 * Email texts live in messages/<locale>.json under "Email" (same
 * pre-translated files as the website UI). Falls back to English per key.
 */
async function loadEmailMessages(locale: Locale): Promise<EmailMessages> {
  const en = (await import("../messages/en.json")).default.Email as EmailMessages;
  if (locale === "en") return en;
  try {
    const loc = (await import(`../messages/${locale}.json`)).default as {
      Email?: Partial<EmailMessages>;
    };
    return { ...en, ...(loc.Email ?? {}) };
  } catch {
    return en;
  }
}

async function getEmailCopy(
  locale: Locale,
  kind: "verify" | "reset"
): Promise<EmailCopy> {
  const m = await loadEmailMessages(locale);
  return {
    subject: kind === "verify" ? m.verifySubject : m.resetSubject,
    greeting: (name) =>
      name ? m.greeting.replace("{name}", name) : m.greetingNoName,
    body: kind === "verify" ? m.verifyBody : m.resetBody,
    cta: kind === "verify" ? m.verifyCta : m.resetCta,
    ignore: kind === "verify" ? m.verifyIgnore : m.resetIgnore,
  };
}

async function buildVerificationHtml(opts: {
  locale: Locale;
  name: string | null | undefined;
  verifyUrl: string;
}): Promise<{ subject: string; text: string; html: string }> {
  const copy = await getEmailCopy(opts.locale, "verify");
  const greeting = copy.greeting(opts.name?.trim() || "");
  const subject = copy.subject;
  const text = `${greeting}\n\n${copy.body}\n\n${copy.cta}: ${opts.verifyUrl}\n\n${copy.ignore}\n\n— Nunvio`;
  const html = `
<!DOCTYPE html>
<html lang="${opts.locale}">
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#f8fafc; padding:32px; color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
    <tr><td>
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;">Nunvio</div>
      <p style="margin:24px 0 8px;font-size:16px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#475569;">${escapeHtml(copy.body)}</p>
      <a href="${escapeHtml(opts.verifyUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">${escapeHtml(copy.cta)}</a>
      <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">${escapeHtml(copy.ignore)}</p>
    </td></tr>
  </table>
</body>
</html>`.trim();
  return { subject, text, html };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.EMAIL_SERVER ||
      (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS)
  );
}

async function getTransport() {
  if (process.env.EMAIL_SERVER) {
    return nodemailer.createTransport(process.env.EMAIL_SERVER);
  }

  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendMailMessage(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
  logLabel?: string;
  /** Extra headers, e.g. List-Unsubscribe for alert e-mails */
  headers?: Record<string, string>;
}): Promise<{ sent: boolean; logged: boolean }> {
  const from = process.env.EMAIL_FROM || "Nunvio <noreply@nunvio.com>";
  const transport = await getTransport();

  if (!transport || !isSmtpConfigured()) {
    console.warn(
      `[nunvio/mail] SMTP not configured — ${opts.logLabel || "message"} (dev):\n`,
      opts.text
    );
    return { sent: false, logged: true };
  }

  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    ...(opts.headers ? { headers: opts.headers } : {}),
  });

  return { sent: true, logged: false };
}

export async function sendVerificationEmail(opts: {
  to: string;
  name?: string | null;
  locale: string;
  verifyUrl: string;
}): Promise<{ sent: boolean; logged: boolean }> {
  const locale = normalizeLocale(opts.locale);
  const { subject, text, html } = await buildVerificationHtml({
    locale,
    name: opts.name,
    verifyUrl: opts.verifyUrl,
  });

  return sendMailMessage({
    to: opts.to,
    subject,
    text,
    html,
    logLabel: `verification link ${opts.verifyUrl}`,
  });
}


export async function sendPasswordResetEmail(opts: {
  to: string;
  name?: string | null;
  locale: string;
  resetUrl: string;
}): Promise<{ sent: boolean; logged: boolean }> {
  const locale = normalizeLocale(opts.locale);
  const copy = await getEmailCopy(locale, "reset");
  const greeting = copy.greeting(opts.name?.trim() || "");
  const subject = copy.subject;
  const text = `${greeting}\n\n${copy.body}\n\n${copy.cta}: ${opts.resetUrl}\n\n${copy.ignore}\n\n— Nunvio`;
  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<body style="font-family: system-ui, sans-serif; background:#f8fafc; padding:32px; color:#0f172a;">
  <table width="100%" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
    <tr><td>
      <div style="font-size:20px;font-weight:700;">Nunvio</div>
      <p style="margin:24px 0 8px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 24px;color:#475569;">${escapeHtml(copy.body)}</p>
      <a href="${escapeHtml(opts.resetUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">${escapeHtml(copy.cta)}</a>
      <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;">${escapeHtml(copy.ignore)}</p>
    </td></tr>
  </table>
</body>
</html>`.trim();

  return sendMailMessage({
    to: opts.to,
    subject,
    text,
    html,
    logLabel: `password reset ${opts.resetUrl}`,
  });
}

/** Inform Google-only accounts that they have no password to reset. */
export async function sendGoogleSignInHintEmail(opts: {
  to: string;
  name?: string | null;
  locale: string;
  loginUrl: string;
}): Promise<{ sent: boolean; logged: boolean }> {
  const locale = normalizeLocale(opts.locale);
  const isSk = locale === "sk" || locale === "cs";
  const subject = isSk
    ? "Prihlásenie do Nunvio cez Google"
    : "Sign in to Nunvio with Google";
  const greeting = opts.name?.trim()
    ? isSk
      ? `Ahoj ${opts.name.trim()},`
      : `Hi ${opts.name.trim()},`
    : isSk
      ? "Ahoj,"
      : "Hi,";
  const body = isSk
    ? "Tento účet je prepojený s Google a nemá nastavené heslo. Obnovenie hesla preto nie je potrebné — prihláste sa tlačidlom „Pokračovať cez Google“."
    : "This account is linked to Google and has no password. You don’t need a password reset — sign in with “Continue with Google”.";
  const cta = isSk ? "Prejsť na prihlásenie" : "Go to sign in";

  const text = `${greeting}\n\n${body}\n\n${cta}: ${opts.loginUrl}\n\n— Nunvio`;
  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<body style="font-family: system-ui, sans-serif; background:#f8fafc; padding:32px; color:#0f172a;">
  <table width="100%" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
    <tr><td>
      <div style="font-size:20px;font-weight:700;">Nunvio</div>
      <p style="margin:24px 0 8px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 24px;color:#475569;">${escapeHtml(body)}</p>
      <a href="${escapeHtml(opts.loginUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">${escapeHtml(cta)}</a>
    </td></tr>
  </table>
</body>
</html>`.trim();

  return sendMailMessage({
    to: opts.to,
    subject,
    text,
    html,
    logLabel: `google sign-in hint to ${opts.to}`,
  });
}

export async function sendInquiryEmail(opts: {
  to: string;
  propertyTitle: string;
  propertyUrl: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string | null;
  message: string;
}): Promise<{ sent: boolean; logged: boolean }> {
  const subject = `Nunvio lead: ${opts.propertyTitle}`;
  const text = [
    `New inquiry for: ${opts.propertyTitle}`,
    `Listing: ${opts.propertyUrl}`,
    "",
    `From: ${opts.senderName} <${opts.senderEmail}>`,
    opts.senderPhone ? `Phone: ${opts.senderPhone}` : null,
    "",
    opts.message,
    "",
    "— Nunvio",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
    <div style="font-size:18px;font-weight:700;">Nunvio</div>
    <p style="margin:16px 0 8px;"><strong>New inquiry</strong> for <a href="${escapeHtml(opts.propertyUrl)}">${escapeHtml(opts.propertyTitle)}</a></p>
    <p style="margin:0 0 4px;"><strong>From:</strong> ${escapeHtml(opts.senderName)} &lt;${escapeHtml(opts.senderEmail)}&gt;</p>
    ${opts.senderPhone ? `<p style="margin:0 0 12px;"><strong>Phone:</strong> ${escapeHtml(opts.senderPhone)}</p>` : ""}
    <pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-family:inherit;">${escapeHtml(opts.message)}</pre>
  </div>
</body>
</html>`.trim();

  return sendMailMessage({
    to: opts.to,
    subject,
    text,
    html,
    logLabel: `inquiry to ${opts.to}`,
  });
}
