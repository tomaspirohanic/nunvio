"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/routing";
import { requestPasswordReset } from "@/actions/auth";

export default function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setInfo(null);

    try {
      const result = await requestPasswordReset({ email, locale });
      if (result.ok === false) {
        setError(t(`errors.${result.error}` as "errors.invalidEmail"));
        return;
      }

      setInfo(
        result.message === "googleAccount"
          ? t("forgotGoogleAccount")
          : result.emailLogged
            ? t("forgotSuccessDev")
            : t("forgotSuccess")
      );
    } catch {
      setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full space-y-5">
      <form onSubmit={onSubmit} className="space-y-4">
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

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? t("pleaseWait") : t("sendResetLink")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600">
        <Link
          href="/login"
          className="font-semibold text-blue-600 hover:text-blue-700"
        >
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
