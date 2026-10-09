"use client";

import { Link, usePathname } from "@/src/i18n/routing";
import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import AddPropertyButton from "../common/AddPropertyButton";
import LocalizationSwitcher from "../ui/LocalizationSwitcher";

export default function Header() {
  const { data: session, status } = useSession();
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("Navigation");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        {/* Desktop Layout: CSS Grid with centered logo */}
        <div className="hidden md:grid md:grid-cols-3 items-center h-16">
          {/* Left: Navigation Links */}
          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-700 hover:text-blue-600 transition-colors px-3 py-2"
            >
              {t("home")}
            </Link>
            <Link
              href="/properties"
              className="text-gray-700 hover:text-blue-600 transition-colors px-3 py-2"
            >
              {t("properties")}
            </Link>
          </nav>

          {/* Center: Logo */}
          <div className="flex justify-center">
            <Link href="/" className="text-xl md:text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              Nunvio
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-4 lg:gap-6">
            {status === "loading" ? (
              <div className="w-28 h-10 bg-gray-100 rounded-lg animate-pulse shrink-0" />
            ) : session ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-700 hover:text-blue-600 transition-colors px-3 py-2 hidden lg:block whitespace-nowrap shrink-0"
                >
                  {t("dashboard")}
                </Link>
                <AddPropertyButton variant="primary" size="sm" className="px-5 py-2.5 whitespace-nowrap shrink-0">
                  {t("addProperty")}
                </AddPropertyButton>
                <button
                  onClick={() => signOut({ callbackUrl: `/${locale}/` })}
                  className="text-gray-700 hover:text-red-600 transition-colors px-3 py-2 hidden lg:block whitespace-nowrap shrink-0"
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <>
                <AddPropertyButton variant="primary" size="sm" className="px-5 py-2.5 whitespace-nowrap shrink-0">
                  {t("addProperty")}
                </AddPropertyButton>
                <Link
                  href="/login"
                  className="px-4 py-2 text-gray-700 hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
                >
                  {t("login")}
                </Link>
              </>
            )}
            <LocalizationSwitcher />
          </div>
        </div>

        {/* Mobile Layout: Hamburger Menu */}
        <div className="md:hidden flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
            Nunvio
          </Link>
          
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-700 hover:text-blue-600 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 space-y-2">
            <Link
              href="/"
              className="block px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("home")}
            </Link>
            <Link
              href="/properties"
              className="block px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("properties")}
            </Link>
            {status !== "loading" && session && (
              <>
                <Link
                  href="/dashboard"
                  className="block px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t("dashboard")}
                </Link>
                <button
                  onClick={() => {
                    signOut({ callbackUrl: `/${locale}/` });
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:text-red-600 hover:bg-gray-50 transition-colors"
                >
                  {t("logout")}
                </button>
              </>
            )}
            {status !== "loading" && !session && (
              <Link
                href="/login"
                className="block px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t("login")}
              </Link>
            )}
            <div className="px-4 py-2">
              <AddPropertyButton variant="primary" size="sm" className="w-full">
                {t("addProperty")}
              </AddPropertyButton>
            </div>
            <div className="px-4 py-2">
              <LocalizationSwitcher />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
