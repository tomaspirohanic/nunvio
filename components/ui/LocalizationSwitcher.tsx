"use client";

// ============================================
// UNIFIED LOCALIZATION SWITCHER
// ============================================
// Combined language and currency switcher (Airbnb-style)
// Shows current locale flag + currency symbol in trigger button
// Dropdown with searchable language list and currency list
// ============================================

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter as useI18nRouter } from "@/src/i18n/routing";
import { locales, type Locale } from "@/i18n";
import {
  supportedCurrencies,
  currencyInfo,
  type Currency,
} from "@/lib/currency";
import type { Units } from "@/lib/geo-preferences";

// Language configuration with flags and names
const languageConfig: Partial<Record<
  Locale,
  { flag: string; name: string; nativeName: string }
>> = {
  en: { flag: "🇬🇧", name: "English", nativeName: "English" },
  sk: { flag: "🇸🇰", name: "Slovak", nativeName: "Slovenčina" },
  cs: { flag: "🇨🇿", name: "Czech", nativeName: "Čeština" },
  de: { flag: "🇩🇪", name: "German", nativeName: "Deutsch" },
  fr: { flag: "🇫🇷", name: "French", nativeName: "Français" },
  es: { flag: "🇪🇸", name: "Spanish", nativeName: "Español" },
  it: { flag: "🇮🇹", name: "Italian", nativeName: "Italiano" },
  pl: { flag: "🇵🇱", name: "Polish", nativeName: "Polski" },
  hu: { flag: "🇭🇺", name: "Hungarian", nativeName: "Magyar" },
  pt: { flag: "🇵🇹", name: "Portuguese", nativeName: "Português" },
  nl: { flag: "🇳🇱", name: "Dutch", nativeName: "Nederlands" },
  ro: { flag: "🇷🇴", name: "Romanian", nativeName: "Română" },
  bg: { flag: "🇧🇬", name: "Bulgarian", nativeName: "Български" },
  hr: { flag: "🇭🇷", name: "Croatian", nativeName: "Hrvatski" },
  el: { flag: "🇬🇷", name: "Greek", nativeName: "Ελληνικά" },
  sv: { flag: "🇸🇪", name: "Swedish", nativeName: "Svenska" },
  da: { flag: "🇩🇰", name: "Danish", nativeName: "Dansk" },
  fi: { flag: "🇫🇮", name: "Finnish", nativeName: "Suomi" },
  lt: { flag: "🇱🇹", name: "Lithuanian", nativeName: "Lietuvių" },
  lv: { flag: "🇱🇻", name: "Latvian", nativeName: "Latviešu" },
  et: { flag: "🇪🇪", name: "Estonian", nativeName: "Eesti" },
  uk: { flag: "🇺🇦", name: "Ukrainian", nativeName: "Українська" },
  ru: { flag: "🇷🇺", name: "Russian", nativeName: "Русский" },
  zh: { flag: "🇨🇳", name: "Chinese", nativeName: "中文" },
  ja: { flag: "🇯🇵", name: "Japanese", nativeName: "日本語" },
};

function getLanguageConfig(loc: Locale) {
  const fallback = { flag: "🌐", name: loc.toUpperCase(), nativeName: loc.toUpperCase() };
  const cfg = languageConfig[loc];
  if (cfg) return cfg;

  // Best-effort display names (may not exist in all environments)
  try {
    // eslint-disable-next-line no-undef
    const dn = new Intl.DisplayNames([loc], { type: "language" });
    const label = dn.of(loc) || loc.toUpperCase();
    return { ...fallback, name: label, nativeName: label };
  } catch {
    return fallback;
  }
}

export default function LocalizationSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const i18nRouter = useI18nRouter();
  const pathname = usePathname();
  const t = useTranslations("Localization");
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"language" | "currency" | "units">(
    "language"
  );
  const [languageSearch, setLanguageSearch] = useState("");
  const [currentCurrency, setCurrentCurrency] = useState<Currency>("EUR");
  const [currentUnits, setCurrentUnits] = useState<Units>("metric");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Read currency/units from cookies (poll to reflect changes)
  useEffect(() => {
    function getCookie(name: string): string | null {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(";").shift() || null;
      }
      return null;
    }

    const updateCurrency = () => {
      const cookieCurrency =
        getCookie("NEXT_CURRENCY_OVERRIDE") ?? getCookie("NEXT_CURRENCY");
      if (cookieCurrency && supportedCurrencies.includes(cookieCurrency as Currency)) {
        setCurrentCurrency(cookieCurrency as Currency);
      }
    };

    const updateUnits = () => {
      const cookieUnits = getCookie("NEXT_UNITS_OVERRIDE") ?? getCookie("NEXT_UNITS");
      if (cookieUnits === "metric" || cookieUnits === "imperial") {
        setCurrentUnits(cookieUnits as Units);
      }
    };

    updateCurrency();
    updateUnits();
    const interval = setInterval(updateCurrency, 500);
    const interval2 = setInterval(updateUnits, 500);
    return () => {
      clearInterval(interval);
      clearInterval(interval2);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setLanguageSearch("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLanguageChange = (newLocale: Locale) => {
    if (newLocale === locale) {
      setIsOpen(false);
      return;
    }

    // Persist user choice globally (override has priority over Geo-IP)
    document.cookie = `NEXT_LOCALE_OVERRIDE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // Use localized router to change locale while preserving path
    i18nRouter.replace(pathname, { locale: newLocale });
    setIsOpen(false);
    setLanguageSearch("");
    router.refresh();
  };

  const handleCurrencyChange = (newCurrency: Currency) => {
    if (newCurrency === currentCurrency) {
      setIsOpen(false);
      return;
    }

    // Set cookies (override has priority over Geo-IP)
    document.cookie = `NEXT_CURRENCY_OVERRIDE=${newCurrency}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.cookie = `NEXT_CURRENCY=${newCurrency}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    
    // Update state
    setCurrentCurrency(newCurrency);
    setIsOpen(false);

    // Refresh page to apply currency changes
    router.refresh();
  };

  const handleUnitsChange = (newUnits: Units) => {
    if (newUnits === currentUnits) {
      setIsOpen(false);
      return;
    }

    // Set cookies (override has priority over Geo-IP)
    document.cookie = `NEXT_UNITS_OVERRIDE=${newUnits}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.cookie = `NEXT_UNITS=${newUnits}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    setCurrentUnits(newUnits);
    setIsOpen(false);
    router.refresh();
  };

  const currentLang = getLanguageConfig(locale);
  const currentCurrencyInfo = currencyInfo[currentCurrency];

  // Filter languages based on search
  const filteredLanguages = locales.filter((loc) => {
    const config = getLanguageConfig(loc);
    const searchLower = languageSearch.toLowerCase();
    return (
      config.name.toLowerCase().includes(searchLower) ||
      config.nativeName.toLowerCase().includes(searchLower) ||
      loc.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100 border border-gray-200"
        aria-label={t("ariaLabel")}
      >
        <span className="text-lg">{currentLang.flag}</span>
        <span className="uppercase font-semibold">{locale}</span>
        <span className="text-gray-400">|</span>
        <span className="text-lg">{currentCurrencyInfo.symbol}</span>
        <span className="uppercase font-semibold">{currentCurrency}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Modal */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("language")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "language"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {t("languageTab")}
            </button>
            <button
              onClick={() => setActiveTab("currency")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "currency"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {t("currencyTab")}
            </button>
            <button
              onClick={() => setActiveTab("units")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "units"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {t("unitsTab")}
            </button>
          </div>

          {/* Language Tab */}
          {activeTab === "language" && (
            <div className="p-4">
              {/* Search Input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder={t("searchLanguagesPlaceholder")}
                  value={languageSearch}
                  onChange={(e) => setLanguageSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Language List */}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredLanguages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    {t("noLanguagesFound")}
                  </div>
                ) : (
                  filteredLanguages.map((loc) => {
                    const config = getLanguageConfig(loc);
                    const isSelected = loc === locale;

                    return (
                      <button
                        key={loc}
                        onClick={() => handleLanguageChange(loc)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left ${
                          isSelected
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <span className="text-2xl">{config.flag}</span>
                        <div className="flex-1">
                          <div className="font-medium">{config.nativeName}</div>
                          <div className="text-xs text-gray-500">{config.name}</div>
                        </div>
                        {isSelected && (
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Currency Tab */}
          {activeTab === "currency" && (
            <div className="p-4">
              <div className="space-y-1">
                {supportedCurrencies.map((currency) => {
                  const info = currencyInfo[currency];
                  const isSelected = currentCurrency === currency;

                  return (
                    <button
                      key={currency}
                      onClick={() => handleCurrencyChange(currency)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-colors ${
                        isSelected
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{info.symbol}</span>
                        <div>
                          <div className="font-medium">{info.name}</div>
                          <div className="text-xs text-gray-500 uppercase">
                            {currency}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <svg
                          className="w-5 h-5 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Units Tab */}
          {activeTab === "units" && (
            <div className="p-4">
              <div className="space-y-1">
                {[
                  { id: "metric" as const, label: t("metricLabel") },
                  { id: "imperial" as const, label: t("imperialLabel") },
                ].map((opt) => {
                  const isSelected = currentUnits === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleUnitsChange(opt.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-colors ${
                        isSelected
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      {isSelected && (
                        <svg
                          className="w-5 h-5 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
