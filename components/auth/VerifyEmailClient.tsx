"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/src/i18n/routing";
import { verifyEmailToken } from "@/actions/auth";

export default function VerifyEmailClient() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        if (!cancelled) {
          setStatus("error");
          setMessage(t("errors.invalidToken"));
        }
        return;
      }

      const result = await verifyEmailToken(token);
      if (cancelled) return;

      if (result.ok === false) {
        setStatus("error");
        setMessage(t(`errors.${result.error}` as "errors.invalidToken"));
        return;
      }

      setStatus("ok");
      setMessage(t("verifiedSuccess"));
      window.setTimeout(() => {
        router.push("/login?verified=1");
        router.refresh();
      }, 1500);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token, t, router, locale]);

  return (
    <div className="text-center">
      {status === "loading" && (
        <p className="text-sm text-gray-600">{t("verifying")}</p>
      )}
      {status === "ok" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {status === "error" && (
        <div className="space-y-4">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {message}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {t("backToLogin")}
          </Link>
        </div>
      )}
    </div>
  );
}
