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

const EMAIL_COPY: Record<Locale, EmailCopy> = {
  en: {
    subject: "Confirm your Nunvio account",
    greeting: (name) => (name ? `Hi ${name},` : "Hi,"),
    body: "Thanks for signing up for Nunvio. Please confirm your email address to activate your account.",
    cta: "Confirm email",
    ignore: "If you did not create an account, you can ignore this email.",
  },
  sk: {
    subject: "Potvrďte svoj účet Nunvio",
    greeting: (name) => (name ? `Ahoj ${name},` : "Ahoj,"),
    body: "Ďakujeme za registráciu na Nunvio. Potvrďte svoju e-mailovú adresu, aby sme vám aktivovali účet.",
    cta: "Potvrdiť e-mail",
    ignore: "Ak ste si účet nevytvorili, tento e-mail môžete ignorovať.",
  },
  cs: {
    subject: "Potvrďte svůj účet Nunvio",
    greeting: (name) => (name ? `Ahoj ${name},` : "Ahoj,"),
    body: "Děkujeme za registraci na Nunvio. Potvrďte svou e-mailovou adresu, abychom vám aktivovali účet.",
    cta: "Potvrdit e-mail",
    ignore: "Pokud jste si účet nevytvořili, můžete tento e-mail ignorovat.",
  },
  de: {
    subject: "Bestätigen Sie Ihr Nunvio-Konto",
    greeting: (name) => (name ? `Hallo ${name},` : "Hallo,"),
    body: "Danke für Ihre Anmeldung bei Nunvio. Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.",
    cta: "E-Mail bestätigen",
    ignore: "Wenn Sie kein Konto erstellt haben, können Sie diese E-Mail ignorieren.",
  },
  fr: {
    subject: "Confirmez votre compte Nunvio",
    greeting: (name) => (name ? `Bonjour ${name},` : "Bonjour,"),
    body: "Merci de vous être inscrit sur Nunvio. Veuillez confirmer votre adresse e-mail pour activer votre compte.",
    cta: "Confirmer l'e-mail",
    ignore: "Si vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail.",
  },
  es: {
    subject: "Confirma tu cuenta de Nunvio",
    greeting: (name) => (name ? `Hola ${name},` : "Hola,"),
    body: "Gracias por registrarte en Nunvio. Confirma tu correo electrónico para activar tu cuenta.",
    cta: "Confirmar correo",
    ignore: "Si no creaste una cuenta, puedes ignorar este correo.",
  },
  it: {
    subject: "Conferma il tuo account Nunvio",
    greeting: (name) => (name ? `Ciao ${name},` : "Ciao,"),
    body: "Grazie per esserti registrato su Nunvio. Conferma la tua email per attivare l'account.",
    cta: "Conferma email",
    ignore: "Se non hai creato un account, puoi ignorare questa email.",
  },
  pl: {
    subject: "Potwierdź konto Nunvio",
    greeting: (name) => (name ? `Cześć ${name},` : "Cześć,"),
    body: "Dziękujemy za rejestrację w Nunvio. Potwierdź adres e-mail, aby aktywować konto.",
    cta: "Potwierdź e-mail",
    ignore: "Jeśli nie zakładałeś konta, możesz zignorować tę wiadomość.",
  },
  hu: {
    subject: "Erősítse meg Nunvio fiókját",
    greeting: (name) => (name ? `Szia ${name},` : "Szia,"),
    body: "Köszönjük, hogy regisztrált a Nunvio-ra. Erősítse meg e-mail címét a fiók aktiválásához.",
    cta: "E-mail megerősítése",
    ignore: "Ha nem Ön hozott létre fiókot, hagyja figyelmen kívül ezt az e-mailt.",
  },
  ru: {
    subject: "Подтвердите аккаунт Nunvio",
    greeting: (name) => (name ? `Здравствуйте, ${name}!` : "Здравствуйте!"),
    body: "Спасибо за регистрацию на Nunvio. Подтвердите адрес электронной почты, чтобы активировать аккаунт.",
    cta: "Подтвердить email",
    ignore: "Если вы не создавали аккаунт, просто проигнорируйте это письмо.",
  },
  uk: {
    subject: "Підтвердіть обліковий запис Nunvio",
    greeting: (name) => (name ? `Вітаємо, ${name}!` : "Вітаємо!"),
    body: "Дякуємо за реєстрацію на Nunvio. Підтвердіть електронну адресу, щоб активувати обліковий запис.",
    cta: "Підтвердити email",
    ignore: "Якщо ви не створювали обліковий запис, просто проігноруйте цей лист.",
  },
  zh: {
    subject: "确认您的 Nunvio 账户",
    greeting: (name) => (name ? `您好 ${name}，` : "您好，"),
    body: "感谢注册 Nunvio。请确认您的电子邮箱以激活账户。",
    cta: "确认邮箱",
    ignore: "如果您没有创建账户，请忽略此邮件。",
  },
  ja: {
    subject: "Nunvioアカウントを確認してください",
    greeting: (name) => (name ? `${name}様` : "こんにちは"),
    body: "Nunvioへのご登録ありがとうございます。アカウントを有効にするには、メールアドレスを確認してください。",
    cta: "メールを確認",
    ignore: "アカウントを作成していない場合は、このメールを無視してください。",
  },
};

function buildVerificationHtml(opts: {
  locale: Locale;
  name: string | null | undefined;
  verifyUrl: string;
}): { subject: string; text: string; html: string } {
  const copy = EMAIL_COPY[opts.locale] ?? EMAIL_COPY.en;
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

function escapeHtml(value: string): string {
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

async function sendMailMessage(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
  logLabel?: string;
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
  const { subject, text, html } = buildVerificationHtml({
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

const RESET_COPY: Record<Locale, EmailCopy> = {
  en: {
    subject: "Reset your Nunvio password",
    greeting: (name) => (name ? `Hi ${name},` : "Hi,"),
    body: "We received a request to reset your Nunvio password. Click the button below to choose a new password.",
    cta: "Reset password",
    ignore: "If you did not request this, you can ignore this email.",
  },
  sk: {
    subject: "Obnovenie hesla Nunvio",
    greeting: (name) => (name ? `Ahoj ${name},` : "Ahoj,"),
    body: "Dostali sme žiadosť o obnovenie hesla k Nunvio. Kliknite na tlačidlo nižšie a nastavte si nové heslo.",
    cta: "Obnoviť heslo",
    ignore: "Ak ste o to nežiadali, tento e-mail môžete ignorovať.",
  },
  cs: {
    subject: "Obnovení hesla Nunvio",
    greeting: (name) => (name ? `Ahoj ${name},` : "Ahoj,"),
    body: "Obdrželi jsme žádost o obnovení hesla k Nunvio. Klikněte na tlačítko níže a nastavte si nové heslo.",
    cta: "Obnovit heslo",
    ignore: "Pokud jste o to nežádali, můžete tento e-mail ignorovat.",
  },
  de: {
    subject: "Nunvio-Passwort zurücksetzen",
    greeting: (name) => (name ? `Hallo ${name},` : "Hallo,"),
    body: "Wir haben eine Anfrage zum Zurücksetzen Ihres Nunvio-Passworts erhalten. Klicken Sie auf die Schaltfläche unten.",
    cta: "Passwort zurücksetzen",
    ignore: "Wenn Sie dies nicht angefordert haben, können Sie diese E-Mail ignorieren.",
  },
  fr: {
    subject: "Réinitialisez votre mot de passe Nunvio",
    greeting: (name) => (name ? `Bonjour ${name},` : "Bonjour,"),
    body: "Nous avons reçu une demande de réinitialisation de votre mot de passe Nunvio.",
    cta: "Réinitialiser",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
  },
  es: {
    subject: "Restablece tu contraseña de Nunvio",
    greeting: (name) => (name ? `Hola ${name},` : "Hola,"),
    body: "Hemos recibido una solicitud para restablecer tu contraseña de Nunvio.",
    cta: "Restablecer contraseña",
    ignore: "Si no lo solicitaste, puedes ignorar este correo.",
  },
  it: {
    subject: "Reimposta la password Nunvio",
    greeting: (name) => (name ? `Ciao ${name},` : "Ciao,"),
    body: "Abbiamo ricevuto una richiesta di reimpostazione della password Nunvio.",
    cta: "Reimposta password",
    ignore: "Se non hai richiesto tu, ignora questa email.",
  },
  pl: {
    subject: "Zresetuj hasło Nunvio",
    greeting: (name) => (name ? `Cześć ${name},` : "Cześć,"),
    body: "Otrzymaliśmy prośbę o zresetowanie hasła do Nunvio.",
    cta: "Zresetuj hasło",
    ignore: "Jeśli to nie Ty, zignoruj tę wiadomość.",
  },
  hu: {
    subject: "Nunvio jelszó visszaállítása",
    greeting: (name) => (name ? `Szia ${name},` : "Szia,"),
    body: "Kérést kaptunk a Nunvio jelszó visszaállítására.",
    cta: "Jelszó visszaállítása",
    ignore: "Ha nem Ön kérte, hagyja figyelmen kívül ezt az e-mailt.",
  },
  ru: {
    subject: "Сброс пароля Nunvio",
    greeting: (name) => (name ? `Здравствуйте, ${name}!` : "Здравствуйте!"),
    body: "Мы получили запрос на сброс пароля Nunvio.",
    cta: "Сбросить пароль",
    ignore: "Если это были не вы, просто проигнорируйте письмо.",
  },
  uk: {
    subject: "Скидання пароля Nunvio",
    greeting: (name) => (name ? `Вітаємо, ${name}!` : "Вітаємо!"),
    body: "Ми отримали запит на скидання пароля Nunvio.",
    cta: "Скинути пароль",
    ignore: "Якщо це були не ви, просто проігноруйте лист.",
  },
  zh: {
    subject: "重置您的 Nunvio 密码",
    greeting: (name) => (name ? `您好 ${name}，` : "您好，"),
    body: "我们收到了重置 Nunvio 密码的请求。",
    cta: "重置密码",
    ignore: "如果不是您本人操作，请忽略此邮件。",
  },
  ja: {
    subject: "Nunvioパスワードのリセット",
    greeting: (name) => (name ? `${name}様` : "こんにちは"),
    body: "Nunvioパスワードのリセットリクエストを受け取りました。",
    cta: "パスワードをリセット",
    ignore: "心当たりがない場合はこのメールを無視してください。",
  },
};

export async function sendPasswordResetEmail(opts: {
  to: string;
  name?: string | null;
  locale: string;
  resetUrl: string;
}): Promise<{ sent: boolean; logged: boolean }> {
  const locale = normalizeLocale(opts.locale);
  const copy = RESET_COPY[locale] ?? RESET_COPY.en;
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
