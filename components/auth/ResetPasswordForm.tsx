"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/src/i18n/routing";
import { resetPasswordWithToken } from "@/actions/auth";

export default function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("Auth");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setInfo(null);

    if (password !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      setPending(false);
      return;
    }

    try {
      const result = await resetPasswordWithToken({ token, password });
      if (result.ok === false) {
        const code = result.error;
        if (code === "resetInvalid" || code === "resetExpired") {
          setError(t(`errors.${code}`));
        } else if (code === "passwordTooShort") {
          setError(t("errors.passwordTooShort"));
        } else {
          setError(t("errors.generic"));
        }
        return;
      }

      setInfo(t("resetSuccess"));
      window.setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1500);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("errors.resetInvalid")}
        </p>
        <Link
          href="/forgot-password"
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          {t("sendResetLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">
            {t("newPassword")}
          </span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="••••••••"
          />
          <span className="text-xs text-gray-500">{t("passwordHint")}</span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">
            {t("confirmPassword")}
          </span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="••••••••"
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
          {pending ? t("pleaseWait") : t("resetSubmit")}
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
