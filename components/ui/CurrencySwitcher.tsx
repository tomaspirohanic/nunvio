"use client";

// ============================================
// CURRENCY SWITCHER COMPONENT
// ============================================
// Dropdown component for switching between currencies
// Reads from NEXT_CURRENCY cookie and updates it on change
// ============================================

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  supportedCurrencies,
  currencyInfo,
  type Currency,
} from "@/lib/currency";

export default function CurrencySwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const [currentCurrency, setCurrentCurrency] = useState<Currency>("EUR");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Read currency from cookie on mount
  useEffect(() => {
    function getCookie(name: string): string | null {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(";").shift() || null;
      }
      return null;
    }

    const cookieCurrency = getCookie("NEXT_CURRENCY");
    if (cookieCurrency && supportedCurrencies.includes(cookieCurrency as Currency)) {
      setCurrentCurrency(cookieCurrency as Currency);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCurrencyChange = (newCurrency: Currency) => {
    // Set cookie
    document.cookie = `NEXT_CURRENCY=${newCurrency}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    
    // Update state
    setCurrentCurrency(newCurrency);
    setIsOpen(false);

    // Refresh page to apply currency changes
    router.refresh();
  };

  const currentCurrencyInfo = currencyInfo[currentCurrency];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors rounded-md hover:bg-gray-100"
        aria-label="Change currency"
      >
        <span className="text-lg">{currentCurrencyInfo.symbol}</span>
        <span className="uppercase">{currentCurrency}</span>
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

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1" role="menu">
            {supportedCurrencies.map((currency) => {
              const info = currencyInfo[currency];
              const isSelected = currentCurrency === currency;

              return (
                <button
                  key={currency}
                  onClick={() => handleCurrencyChange(currency)}
                  className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                    isSelected
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  role="menuitem"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{info.symbol}</span>
                      <div>
                        <div className="font-medium">{info.name}</div>
                        <div className="text-xs text-gray-500 uppercase">
                          {currency}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <svg
                        className="w-4 h-4 text-blue-600"
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
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
