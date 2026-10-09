// ============================================
// I18N ROUTING CONFIGURATION
// ============================================
// Configuration for next-intl routing
// Provides localized Link, usePathname, useRouter hooks
// For next-intl v4, we use the standard navigation exports
// ============================================

import { createNavigation } from "next-intl/navigation";
import { locales } from "@/i18n";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation({
    locales,
  });
