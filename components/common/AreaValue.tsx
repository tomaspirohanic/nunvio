"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { formatArea } from "@/lib/formatters";

export default function AreaValue({ areaSqm }: { areaSqm: number }) {
  const locale = useLocale();
  const [units, setUnits] = useState<string>("metric");

  useEffect(() => {
    function getCookie(name: string): string | null {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(";").shift() || null;
      }
      return null;
    }

    const update = () => {
      const u = getCookie("NEXT_UNITS_OVERRIDE") ?? getCookie("NEXT_UNITS");
      if (u) setUnits(u);
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, []);

  return <>{formatArea(areaSqm, units, locale)}</>;
}

