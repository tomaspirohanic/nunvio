// ============================================
// LOCALE LAYOUT
// ============================================
// Layout for localized routes
// Wraps content with next-intl provider and session provider
// ============================================

import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales } from "@/i18n";
import Providers from "../providers";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Load messages for the locale
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider messages={messages}>
      <Providers>
        <Header />
        <main className="w-full min-h-screen bg-white text-gray-900">
          {children}
        </main>
        <Footer />
      </Providers>
    </NextIntlClientProvider>
  );
}
