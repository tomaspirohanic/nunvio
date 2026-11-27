"use client";

// Mortgage calculator on the listing page (sale listings only).
// Starting values come from lib/country-config.ts; everything is editable.

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { monthlyPayment } from "@/lib/country-config";

export default function MortgageCalculator({
  price,
  currency,
  defaults,
}: {
  price: number;
  currency: string;
  defaults: { rate: number; downPayment: number; years: number };
}) {
  const t = useTranslations("Mortgage");
  const locale = useLocale();
  const [down, setDown] = useState(defaults.downPayment);
  const [rate, setRate] = useState(defaults.rate);
  const [years, setYears] = useState(defaults.years);

  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

  const { loan, monthly, interest } = useMemo(() => {
    const loan = Math.max(0, price * (1 - down / 100));
    const monthly = monthlyPayment(loan, rate, years);
    return { loan, monthly, interest: Math.max(0, monthly * years * 12 - loan) };
  }, [price, down, rate, years]);

  const field = (
    label: string,
    value: number,
    set: (n: number) => void,
    opts: { min: number; max: number; step: number; suffix: string }
  ) => (
    <label className="block">
      <span className="flex justify-between text-sm text-gray-600">
        <span>{label}</span>
        <span className="font-semibold text-gray-900">
          {/* Locale decimals: "3,9 %" in Slovak, "3.9 %" in English */}
          {value.toLocaleString(locale, { maximumFractionDigits: 1 })}
          {opts.suffix}
        </span>
      </span>
      <input
        type="range"
        min={opts.min}
        max={opts.max}
        step={opts.step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="mt-2 w-full accent-red-600"
      />
    </label>
  );

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-gray-950">{t("title")}</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-3">
        {field(t("downPayment"), down, setDown, { min: 0, max: 90, step: 5, suffix: " %" })}
        {field(t("rate"), rate, setRate, { min: 0.5, max: 12, step: 0.1, suffix: " %" })}
        {field(t("years"), years, setYears, { min: 5, max: 40, step: 1, suffix: ` ${t("yearsShort")}` })}
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 rounded-xl bg-gray-50 p-4">
        <div>
          <div className="text-sm text-gray-500">{t("monthly")}</div>
          <div className="text-3xl font-bold text-gray-950">{money(monthly)}</div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-gray-500">{t("loan")}</dt>
          <dd className="text-right font-medium text-gray-900">{money(loan)}</dd>
          <dt className="text-gray-500">{t("ownFunds")}</dt>
          <dd className="text-right font-medium text-gray-900">{money(price - loan)}</dd>
          <dt className="text-gray-500">{t("totalInterest")}</dt>
          <dd className="text-right font-medium text-gray-900">{money(interest)}</dd>
        </dl>
      </div>
      <p className="mt-3 text-xs text-gray-500">{t("disclaimer")}</p>
    </div>
  );
}
