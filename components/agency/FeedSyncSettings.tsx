"use client";

import { useState, useTransition } from "react";
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
        setInfo("Nastavenia feedu boli uložené.");
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Uloženie zlyhalo.");
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
          ? "Celý feed je spracovaný (offset sa resetuje)."
          : `Ďalší beh pokračuje od pozície ${result.nextOffset}.`;
        setInfo(
          `Sync OK: +${result.created} nových, ${result.updated} aktualizovaných` +
            ` (chunk ${result.processedInChunk ?? "?"} z ${result.total}). ${done}`
        );
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Sync zlyhal.");
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
          Automatický XML feed (CRM / multi-posting)
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Vložte HTTPS URL vášho XML exportu. Nunvio ho bude sťahovať po častiach
          (každých ~15 min), takže aj desiatky tisíc inzerátov sa postupne
          naimportujú bez timeoutu. Každý inzerát musí mať{" "}
          <code className="rounded bg-white px-1">externalId</code>. Špecifikácia
          pre CRM (Softreal, Urbium, backOFFICE…):{" "}
          <a href="/sk/partners" className="text-emerald-800 underline">
            /partners
          </a>
          .
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label
            htmlFor="feedUrl"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Feed URL
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
          Zapnúť automatický sync (cron)
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {pending ? "Ukladám…" : "Uložiť nastavenia"}
          </button>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={pending || !feedUrl.trim()}
            className="rounded-md border border-emerald-700 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
          >
            Synchronizovať teraz (1 dávka)
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
          <dt className="font-medium text-gray-500">Posledný sync</dt>
          <dd>
            {initial.feedLastSyncedAt
              ? new Date(initial.feedLastSyncedAt).toLocaleString("sk-SK")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Offset vo feede</dt>
          <dd>{initial.feedOffset}</dd>
        </div>
        {initial.feedLastError && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-red-600">Posledná chyba</dt>
            <dd className="text-red-800">{initial.feedLastError}</dd>
          </div>
        )}
        {lastResultPretty && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-gray-500">Posledný výsledok</dt>
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
