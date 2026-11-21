"use client";

// One row of the "Kde:" suggestions (home page and search page).
// Data comes from /api/locations/suggest.

import { useTranslations } from "next-intl";

export interface LocationSuggestion {
  place_id: string;
  display_name: string;
  kind?: "city" | "village" | "part" | "district" | "region";
  name?: string;
  value?: string;
  context?: string[];
  listings?: number;
  address?: { city?: string; town?: string; village?: string };
}

/** Text to put into the search box when a suggestion is picked. */
export function suggestionValue(s: LocationSuggestion): string {
  return (
    s.value ||
    s.address?.city ||
    s.address?.town ||
    s.address?.village ||
    s.name ||
    s.display_name ||
    ""
  );
}

export default function LocationSuggestionRow({
  suggestion,
  onSelect,
}: {
  suggestion: LocationSuggestion;
  onSelect: (s: LocationSuggestion) => void;
}) {
  const t = useTranslations("AgencyProfile");
  const parts = String(suggestion.display_name).split(",");
  const name = suggestion.name ?? parts[0];
  const context = suggestion.context ? suggestion.context.join(", ") : parts.slice(1).join(",").trim();
  const isArea = suggestion.kind === "district" || suggestion.kind === "region";

  return (
    <li
      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer rounded-lg border-b border-gray-100 last:border-b-0"
      // mousedown, so the pick lands before the input loses focus
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(suggestion);
      }}
    >
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
        {isArea ? (
          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 6-7.5 11-7.5 11s-7.5-5-7.5-11a7.5 7.5 0 1115 0z" />
          </svg>
        )}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-semibold text-gray-800 truncate">{name}</span>
        {context && <span className="text-xs text-gray-500 truncate">{context}</span>}
      </div>
      {!!suggestion.listings && suggestion.listings > 0 && (
        <span className="shrink-0 text-xs text-gray-500 whitespace-nowrap">
          {t("listingsSubtext", { count: suggestion.listings })}
        </span>
      )}
    </li>
  );
}
