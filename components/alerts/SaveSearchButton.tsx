"use client";

// "Save this search" on the search page: e-mail alerts for new listings and
// price drops matching the current filters.

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Bell, X } from "lucide-react";
import { saveSearchAction } from "@/actions/saved-searches";

type Status = "idle" | "saved" | "confirm" | "error";

export default function SaveSearchButton({ className = "" }: { className?: string }) {
  const t = useTranslations("SavedSearch");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState("INSTANT");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const effectiveEmail = email || session?.user?.email || "";

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await saveSearchAction({
        email: effectiveEmail,
        query: searchParams.toString(),
        locale,
        frequency,
      });
      if (r.ok === true) setStatus(r.needsConfirmation ? "confirm" : "saved");
      else {
        setStatus("error");
        setError(t(`errors.${r.error}`));
      }
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setStatus("idle");
        }}
        className={`inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 ${className}`}
      >
        <Bell className="h-4 w-4" />
        {t("saveButton")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("dialogTitle")}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-bold text-gray-950">{t("dialogTitle")}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("close")}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {status === "saved" || status === "confirm" ? (
              <div className="mt-4">
                <p className="text-gray-700">
                  {status === "saved" ? t("savedBody") : t("confirmBody", { email: effectiveEmail })}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-6 w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700"
                >
                  {t("done")}
                </button>
              </div>
            ) : (
              <form
                className="mt-4 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <p className="text-sm text-gray-600">{t("dialogBody")}</p>
                <label className="block text-sm font-medium text-gray-900">
                  {t("emailLabel")}
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={effectiveEmail}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-900">
                  {t("frequencyLabel")}
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base"
                  >
                    <option value="INSTANT">{t("frequency.INSTANT")}</option>
                    <option value="DAILY">{t("frequency.DAILY")}</option>
                    <option value="WEEKLY">{t("frequency.WEEKLY")}</option>
                  </select>
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {pending ? t("saving") : t("submit")}
                </button>
                <p className="text-xs text-gray-500">{t("privacyNote")}</p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
