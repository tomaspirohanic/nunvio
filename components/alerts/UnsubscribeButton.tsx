"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { unsubscribeAction } from "@/actions/saved-searches";

export default function UnsubscribeButton({ token, alreadyOff }: { token: string; alreadyOff: boolean }) {
  const t = useTranslations("SavedSearch");
  const [done, setDone] = useState(alreadyOff);
  const [pending, start] = useTransition();

  if (done) return <p className="text-gray-700">{t("unsubscribed")}</p>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await unsubscribeAction(token);
          if (r.ok) setDone(true);
        })
      }
      className="inline-flex rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
    >
      {t("unsubscribeCta")}
    </button>
  );
}
