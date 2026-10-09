"use client";

// ============================================
// PROPERTY PRICE COMPONENT
// ============================================
// Client component for displaying property price with currency conversion
// Reads currency from cookie and converts/formats price dynamically
// ============================================

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  convertPrice,
  formatPrice,
  isSupportedCurrency,
  type Currency,
} from "@/lib/currency";
import type { Currency as PrismaCurrency } from "@prisma/client";

interface PropertyPriceProps {
  price: number | { toString(): string };
  originalCurrency: PrismaCurrency;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function PropertyPrice({
  price,
  originalCurrency,
  className = "",
  size = "md",
}: PropertyPriceProps) {
  const locale = useLocale();
  const [targetCurrency, setTargetCurrency] = useState<Currency>("EUR");

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
    if (isSupportedCurrency(cookieCurrency)) {
      setTargetCurrency(cookieCurrency);
    }

    // Listen for currency changes (when cookie is updated)
    const interval = setInterval(() => {
      const updatedCurrency = getCookie("NEXT_CURRENCY");
      if (isSupportedCurrency(updatedCurrency)) {
        setTargetCurrency(updatedCurrency);
      }
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, []);

  const normalized = typeof price === "number" ? price : Number(price.toString());
  const convertedAmount = convertPrice(normalized, originalCurrency, targetCurrency);
  const formattedPrice = formatPrice(convertedAmount, targetCurrency, locale);
  const converted = originalCurrency !== targetCurrency;

  const sizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-4xl",
  };

  return (
    <span className={`inline-flex flex-col ${className}`}>
      <span className={`font-semibold text-gray-900 ${sizeClasses[size]}`}>
        {formattedPrice}
      </span>
      {converted && (
        <span className="mt-0.5 text-[11px] font-normal text-gray-400">
          ≈ indicative conversion
        </span>
      )}
    </span>
  );
}
