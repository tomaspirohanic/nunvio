"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/src/i18n/routing";
import {
  registerWithEmail,
  resendVerificationEmail,
  validateEmailLogin,
} from "@/actions/auth";

type Mode = "login" | "register";

export default function EmailAuthForm({
  initialMode = "login",
}: {
  initialMode?: Mode;
}) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsResend, setNeedsResend] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setInfo(null);
    setNeedsResend(false);

    try {
      if (mode === "register") {
        const result = await registerWithEmail({
          name,
          email,
          password,
          locale,
        });

        if (result.ok === false) {
          setError(t(`errors.${result.error}` as "errors.invalidEmail"));
          return;
        }

        setInfo(
          result.emailLogged
            ? t("verificationSentDev")
            : t("verificationSent")
        );
        setMode("login");
        return;
      }

      const check = await validateEmailLogin({ email, password });
      if (check.ok === false) {
        if (check.error === "emailNotVerified") {
          setError(t("errors.emailNotVerified"));
          setNeedsResend(true);
        } else {
          setError(t("errors.invalidCredentials"));
        }
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: `/${locale}/dashboard/properties`,
      });

      if (result?.error) {
        setError(t("errors.invalidCredentials"));
        return;
      }

      router.push("/dashboard/properties");
      router.refresh();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  async function onResend() {
    setPending(true);
    setError(null);
    try {
      const result = await resendVerificationEmail({ email, locale });
      if (result.ok) {
        setInfo(
          result.emailLogged
            ? t("verificationSentDev")
            : t("verificationSent")
        );
        setNeedsResend(false);
      }
    } catch {
      setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full space-y-5">
      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "register" && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">{t("name")}</span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder={t("namePlaceholder")}
            />
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">{t("email")}</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="you@example.com"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">
            {t("password")}
          </span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="••••••••"
          />
          {mode === "register" && (
            <span className="text-xs text-gray-500">{t("passwordHint")}</span>
          )}
          {mode === "login" && (
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {t("forgotPassword")}
              </Link>
            </div>
          )}
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {info}
          </p>
        )}

        {needsResend && (
          <button
            type="button"
            disabled={pending || !email}
            onClick={onResend}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {t("resendVerification")}
          </button>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending
            ? t("pleaseWait")
            : mode === "register"
              ? t("createAccount")
              : t("signInWithEmail")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600">
        {mode === "login" ? (
          <>
            {t("noAccount")}{" "}
            <button
              type="button"
              className="font-semibold text-blue-600 hover:text-blue-700"
              onClick={() => {
                setMode("register");
                setError(null);
                setInfo(null);
              }}
            >
              {t("registerLink")}
            </button>
          </>
        ) : (
          <>
            {t("hasAccount")}{" "}
            <button
              type="button"
              className="font-semibold text-blue-600 hover:text-blue-700"
              onClick={() => {
                setMode("login");
                setError(null);
                setInfo(null);
              }}
            >
              {t("loginLink")}
            </button>
          </>
        )}
      </p>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="bg-white px-3 text-gray-400">{t("or")}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          signIn("google", { callbackUrl: `/${locale}/dashboard/properties` })
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"
          />
          <path
            fill="#34A853"
            d="M6.6 14.3l-.9.7-2.5 1.9C4.8 19.7 8.1 22 12 22c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 .9-3.6.9-2.8 0-5.1-1.9-5.9-4.4z"
          />
          <path
            fill="#4A90E2"
            d="M3.2 7.1C2.4 8.7 2 10.3 2 12s.4 3.3 1.2 4.9l3.4-2.6C6.2 13.5 6 12.8 6 12s.2-1.5.5-2.2L3.2 7.1z"
          />
          <path
            fill="#FBBC05"
            d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.9 14.7 2 12 2 8.1 2 4.8 4.3 3.2 7.1l3.3 2.6C7 7.9 9.2 6 12 6z"
          />
        </svg>
        {t("continueWithGoogle")}
      </button>

      {mode === "register" && (
        <p className="text-center text-xs text-gray-400">
          {t("termsHint")}{" "}
          <Link href="/" className="underline hover:text-gray-600">
            Nunvio
          </Link>
        </p>
      )}
    </div>
  );
}
