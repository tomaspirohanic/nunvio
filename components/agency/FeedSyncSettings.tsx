"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type FeedStatus = {
  feedUrl: string | null;
  feedSyncEnabled: boolean;
  feedOffset: number;
  feedLastSyncedAt: string | null;
  feedLastError: string | null;
  feedLastResult: string | null;
};

type Props = {
  initial: FeedStatus;
  updateAgencyFeedSettings: (input: {
    feedUrl: string;
    feedSyncEnabled: boolean;
  }) => Promise<{ success: true }>;
  syncAgencyFeedNow: () => Promise<{
    created: number;
    updated: number;
    errors: number;
    total: number;
    imagesUploaded: number;
    imagesFailed: number;
    processedInChunk?: number;
    nextOffset?: number;
    feedComplete?: boolean;
    errorMessages: string[];
  }>;
};

export default function FeedSyncSettings({
  initial,
  updateAgencyFeedSettings,
  syncAgencyFeedNow,
}: Props) {
  const router = useRouter();
  const t = useTranslations("FeedSync");
  const locale = useLocale();
  const [feedUrl, setFeedUrl] = useState(initial.feedUrl ?? "");
  const [enabled, setEnabled] = useState(initial.feedSyncEnabled);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        await updateAgencyFeedSettings({
          feedUrl,
          feedSyncEnabled: enabled,
        });
        setInfo(t("saved"));
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t("saveFailed"));
      }
    });
  }

  function handleSyncNow() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const result = await syncAgencyFeedNow();
        const done = result.feedComplete
          ? t("feedComplete")
          : t("continuesAt", { offset: result.nextOffset ?? 0 });
        setInfo(
          t("syncResult", {
            created: result.created,
            updated: result.updated,
            processed: result.processedInChunk ?? 0,
            total: result.total,
          }) +
            " " +
            done
        );
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t("syncFailed"));
      }
    });
  }

  let lastResultPretty: string | null = null;
  if (initial.feedLastResult) {
    try {
      lastResultPretty = JSON.stringify(
        JSON.parse(initial.feedLastResult),
        null,
        2
      );
    } catch {
      lastResultPretty = initial.feedLastResult;
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {t.rich("intro", {
            code: (chunks) => (
              <code className="rounded bg-white px-1">{chunks}</code>
            ),
            link: (chunks) => (
              <a href={`/${locale}/partners`} className="text-emerald-800 underline">
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label
            htmlFor="feedUrl"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t("urlLabel")}
          </label>
          <input
            id="feedUrl"
            type="url"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder="https://partner.example.com/feeds/nunvio.xml"
            disabled={pending}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={pending}
            className="h-4 w-4 rounded border-gray-300 text-emerald-600"
          />
          {t("enable")}
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {pending ? t("saving") : t("save")}
          </button>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={pending || !feedUrl.trim()}
            className="rounded-md border border-emerald-700 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
          >
            {t("syncNow")}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {info}
        </div>
      )}

      <dl className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-gray-500">{t("lastSync")}</dt>
          <dd>
            {initial.feedLastSyncedAt
              ? new Date(initial.feedLastSyncedAt).toLocaleString(locale)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">{t("offset")}</dt>
          <dd>{initial.feedOffset}</dd>
        </div>
        {initial.feedLastError && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-red-600">{t("lastError")}</dt>
            <dd className="text-red-800">{initial.feedLastError}</dd>
          </div>
        )}
        {lastResultPretty && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-gray-500">{t("lastResult")}</dt>
            <dd>
              <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs text-gray-600">
                {lastResultPretty}
              </pre>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
