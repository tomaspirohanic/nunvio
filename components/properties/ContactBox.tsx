"use client";

import { FormEvent, useMemo, useState } from "react";
import { Phone } from "lucide-react";
import PropertyPrice from "@/components/properties/PropertyPrice";
import type { Currency as PrismaCurrency } from "@prisma/client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/routing";
import { submitPropertyInquiry } from "@/actions/inquiries";

type ContactBoxProperty = {
  id: string;
  title: string;
  price: number;
  currency: PrismaCurrency;
  contactPhone?: string | null;
};

export type ContactBoxAgency = {
  id: string;
  name: string;
  city: string;
  country: string;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  website?: string | null;
};

export type ContactBoxOwner = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function ContactBox({
  property,
  agency,
  owner,
}: {
  property: ContactBoxProperty;
  agency?: ContactBoxAgency | null;
  owner?: ContactBoxOwner | null;
}) {
  const t = useTranslations("ContactBox");
  const locale = useLocale();
  const [showPhone, setShowPhone] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(t("defaultMessage"));

  const phoneNumber =
    property.contactPhone?.trim() ||
    agency?.phone?.trim() ||
    owner?.phone?.trim() ||
    null;

  const display = useMemo(() => {
    if (agency) {
      return {
        initials: initialsFromName(agency.name),
        name: agency.name,
        subtitle: `${agency.city}, ${agency.country}`,
        logoUrl: agency.logoUrl ?? null,
        agencyId: agency.id,
      };
    }
    return {
      initials: initialsFromName(owner?.name || "Nunvio"),
      name: owner?.name || "Nunvio",
      subtitle: t("privateSeller"),
      logoUrl: null as string | null,
      agencyId: null as string | null,
    };
  }, [agency, owner, t]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await submitPropertyInquiry({
        propertyId: property.id,
        name,
        email,
        phone: phone || undefined,
        message,
        locale,
      });
      if (result.ok === false) {
        setError(t(`errors.${result.error}` as "errors.generic"));
        return;
      }
      setSubmitted(true);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
      <div>
        <div className="text-xs font-medium text-gray-500">{t("priceLabel")}</div>
        <div className="mt-2">
          <PropertyPrice
            price={property.price}
            originalCurrency={property.currency}
            size="xl"
            className="text-gray-950"
          />
        </div>
      </div>

      <div className="my-6 h-px bg-gray-200" />

      <div className="my-6 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-sm font-bold text-gray-700">
          {display.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={display.logoUrl}
              alt={display.name}
              className="h-full w-full object-cover"
            />
          ) : (
            display.initials
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold text-gray-950">{display.name}</div>
          <div className="truncate text-sm text-gray-500">{display.subtitle}</div>
          {display.agencyId && (
            <Link
              href={`/agencies/${display.agencyId}`}
              className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              {t("viewAgency")} →
            </Link>
          )}
        </div>
      </div>

      {!showPhone ? (
        <button
          type="button"
          onClick={() => setShowPhone(true)}
          disabled={!phoneNumber}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Phone className="h-5 w-5" />
          {phoneNumber ? t("showNumber") : t("noPhone")}
        </button>
      ) : (
        <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">{t("phoneLabel")}</div>
          <a
            href={`tel:${phoneNumber}`}
            className="text-sm font-semibold text-gray-900 hover:text-blue-600"
          >
            {phoneNumber}
          </a>
        </div>
      )}

      <div className="my-6 h-px bg-gray-200" />

      {submitted ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t("success")}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="contact-name">
              {t("nameLabel")}
            </label>
            <input
              id="contact-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              placeholder={t("namePlaceholder")}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="contact-email">
              {t("emailLabel")}
            </label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="contact-phone">
              {t("yourPhoneLabel")}
            </label>
            <input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              placeholder={t("yourPhonePlaceholder")}
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="contact-message">
              {t("messageLabel")}
            </label>
            <textarea
              id="contact-message"
              required
              minLength={10}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-red-600 py-3 font-bold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:opacity-60"
          >
            {pending ? t("sending") : t("sendButton")}
          </button>

          <div className="text-xs leading-relaxed text-gray-500">
            {t.rich("finePrint", {
              title: property.title,
              strong: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </div>
        </form>
      )}
    </div>
  );
}
