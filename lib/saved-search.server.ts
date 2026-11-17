// ============================================
// SAVED SEARCHES + NEW-LISTING ALERTS (SERVER-ONLY)
// ============================================
// A visitor saves the filters of a search; Nunvio e-mails them new matching
// listings and price drops. Works without an account (double opt-in by
// e-mail); for signed-in users with a verified e-mail it is active at once.
//
// The alert job (/api/cron/send-alerts) runs after the feed sync and the
// duplicate finder, so an alert never shows the same flat twice.
// ============================================

import "server-only";
import { randomBytes } from "node:crypto";
import { AlertFrequency, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { escapeHtml, normalizeLocale, sendMailMessage } from "@/lib/mail";
import { getAppBaseUrl } from "@/lib/listing";
import { buildListingWhere } from "@/lib/listing-search.server";
import {
  filtersForSaving,
  listingSearchQuery,
  type ListingSearchParams,
} from "@/lib/listing-search-params";

/** Max active saved searches per e-mail address (anti-abuse). */
export const MAX_SAVED_SEARCHES_PER_EMAIL = 20;
/** Listings shown in one e-mail; the rest is behind "show all". */
const LISTINGS_PER_EMAIL = 10;

const FREQUENCY_GAP_MS: Record<AlertFrequency, number> = {
  INSTANT: 0,
  DAILY: 20 * 60 * 60 * 1000,
  WEEKLY: 6.5 * 24 * 60 * 60 * 1000,
};

// ------------------------------------------------------------
// Texts (pre-translated messages/<locale>.json, English fallback)
// ------------------------------------------------------------

type Texts = Record<string, string>;

async function loadTexts(locale: string, namespace: string): Promise<Texts> {
  const en = ((await import("../messages/en.json")).default as unknown as Record<string, Texts>)[namespace] ?? {};
  if (locale === "en") return en;
  try {
    const loc = (await import(`../messages/${locale}.json`)).default as unknown as Record<string, Texts>;
    return { ...en, ...(loc[namespace] ?? {}) };
  } catch {
    return en;
  }
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function money(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

/** Short human description of the filters, in the visitor's language. */
export async function describeFilters(f: ListingSearchParams, locale: string): Promise<string> {
  const t = await loadTexts(locale, "SavedSearch");
  const parts: string[] = [];
  const kinds = new Set<string>();
  for (const ty of f.types ?? []) kinds.add(ty.split("_")[0]);
  if (f.type) kinds.add(f.type.toLowerCase().replace("apartment", "flat"));
  const kindWords = Array.from(kinds)
    .map((k) => t[`kind_${k}`])
    .filter(Boolean);
  parts.push(kindWords.length > 0 ? kindWords.join(", ") : t.kind_any);
  if (f.offer === "buy") parts.push(t.offer_buy);
  if (f.offer === "rent") parts.push(t.offer_rent);
  if (f.location) parts.push(f.location);
  if (f.minPrice != null && f.maxPrice != null) {
    parts.push(fill(t.priceRange, { min: f.minPrice.toLocaleString(locale), max: f.maxPrice.toLocaleString(locale) }));
  } else if (f.maxPrice != null) {
    parts.push(fill(t.priceMax, { max: f.maxPrice.toLocaleString(locale) }));
  } else if (f.minPrice != null) {
    parts.push(fill(t.priceMin, { min: f.minPrice.toLocaleString(locale) }));
  }
  if (f.minArea != null) parts.push(fill(t.areaMin, { min: f.minArea }));
  if (f.maxArea != null) parts.push(fill(t.areaMax, { max: f.maxArea }));
  if (f.keyword) parts.push(`„${f.keyword}“`);
  if (f.isNewBuild) parts.push(t.newBuild);
  if (f.reduced) parts.push(t.reduced);
  return parts.join(" · ").slice(0, 300);
}

// ------------------------------------------------------------
// Create / confirm / unsubscribe
// ------------------------------------------------------------

export type CreateSavedSearchResult =
  | { ok: true; needsConfirmation: boolean }
  | { ok: false; error: "invalidEmail" | "tooMany" | "emptyFilters" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function createSavedSearch(input: {
  email: string;
  filters: ListingSearchParams;
  locale: string;
  frequency: AlertFrequency;
  /** Signed-in user (verified e-mail) — no confirmation e-mail needed */
  user?: { id: string; email: string; emailVerified: boolean } | null;
}): Promise<CreateSavedSearchResult> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, error: "invalidEmail" };
  const filters = filtersForSaving(input.filters);
  if (Object.keys(filters).length === 0) return { ok: false, error: "emptyFilters" };
  const locale = normalizeLocale(input.locale);

  const active = await prisma.savedSearch.count({ where: { email, active: true } });
  if (active >= MAX_SAVED_SEARCHES_PER_EMAIL) return { ok: false, error: "tooMany" };

  const trusted =
    !!input.user && input.user.emailVerified && input.user.email.toLowerCase() === email;

  const search = await prisma.savedSearch.create({
    data: {
      email,
      userId: trusted ? input.user!.id : null,
      filters: filters as Prisma.InputJsonValue,
      label: await describeFilters(filters, locale),
      locale,
      frequency: input.frequency,
      token: randomBytes(24).toString("hex"),
      confirmedAt: trusted ? new Date() : null,
    },
  });

  if (!trusted) await sendConfirmationEmail(search);
  return { ok: true, needsConfirmation: !trusted };
}

function alertUrls(token: string, locale: string) {
  const base = getAppBaseUrl();
  return {
    confirm: `${base}/${locale}/alerts/confirm?token=${token}`,
    unsubscribe: `${base}/${locale}/alerts/unsubscribe?token=${token}`,
    oneClick: `${base}/api/alerts/unsubscribe?token=${token}`,
  };
}

function emailShell(locale: string, inner: string, footer: string) {
  return `<!DOCTYPE html>
<html lang="${locale}">
<body style="font-family: system-ui, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
  <table width="100%" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
    <tr><td>
      <div style="font-size:20px;font-weight:700;">Nunvio</div>
      ${inner}
      <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;">${footer}</p>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendConfirmationEmail(s: { email: string; token: string; locale: string; label: string }) {
  const t = await loadTexts(s.locale, "AlertEmail");
  const urls = alertUrls(s.token, s.locale);
  const subject = t.confirmSubject;
  const text = `${t.confirmBody}\n\n${s.label}\n\n${t.confirmCta}: ${urls.confirm}\n\n${t.confirmIgnore}\n\n— Nunvio`;
  const html = emailShell(
    s.locale,
    `<p style="margin:20px 0 8px;">${escapeHtml(t.confirmBody)}</p>
     <p style="margin:0 0 20px;font-weight:600;">${escapeHtml(s.label)}</p>
     <a href="${escapeHtml(urls.confirm)}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">${escapeHtml(t.confirmCta)}</a>`,
    escapeHtml(t.confirmIgnore)
  );
  await sendMailMessage({ to: s.email, subject, text, html, logLabel: `alert confirmation ${urls.confirm}` });
}

export async function confirmSavedSearch(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const s = await prisma.savedSearch.findUnique({ where: { token } });
  if (!s) return null;
  if (!s.confirmedAt || !s.active) {
    // Start counting "new" from now, not from the moment it was saved.
    return prisma.savedSearch.update({
      where: { id: s.id },
      data: { confirmedAt: s.confirmedAt ?? new Date(), active: true, lastCheckedAt: new Date() },
    });
  }
  return s;
}

export async function unsubscribeSavedSearch(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const s = await prisma.savedSearch.findUnique({ where: { token } });
  if (!s) return null;
  return prisma.savedSearch.update({ where: { id: s.id }, data: { active: false } });
}

// ------------------------------------------------------------
// Alert job
// ------------------------------------------------------------

type AlertListing = {
  id: string;
  title: string;
  city: string;
  price: number;
  currency: string;
  previousPrice: number | null;
  areaSqm: number;
  image: string | null;
  isNew: boolean;
};

/** Listings that are new or got cheaper since `since`. */
export async function findAlertMatches(filters: ListingSearchParams, since: Date) {
  const where: Prisma.PropertyWhereInput = {
    AND: [
      buildListingWhere(filters),
      {
        OR: [
          { createdAt: { gt: since } },
          { priceChangedAt: { gt: since }, previousPrice: { not: null } },
        ],
      },
    ],
  };
  const [rows, total] = await Promise.all([
    prisma.property.findMany({
      where,
      select: {
        id: true,
        title: true,
        city: true,
        price: true,
        currency: true,
        previousPrice: true,
        areaSqm: true,
        images: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: LISTINGS_PER_EMAIL,
    }),
    prisma.property.count({ where, take: 500 }),
  ]);
  const listings: AlertListing[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    city: r.city,
    price: Number(r.price),
    currency: r.currency,
    previousPrice: r.previousPrice != null ? Number(r.previousPrice) : null,
    areaSqm: r.areaSqm,
    image: r.images[0] ?? null,
    isNew: r.createdAt > since,
  }));
  return { listings, total };
}

async function sendAlertEmail(
  s: { email: string; token: string; locale: string; label: string; filters: ListingSearchParams },
  listings: AlertListing[],
  total: number
) {
  const t = await loadTexts(s.locale, "AlertEmail");
  const base = getAppBaseUrl();
  const urls = alertUrls(s.token, s.locale);
  const searchUrl = `${base}/${s.locale}/properties?${listingSearchQuery(s.filters)}`;
  const subject = fill(total === 1 ? t.alertSubjectOne : t.alertSubjectMany, { count: total, label: s.label }).slice(0, 180);

  const lines = listings.map((l) => {
    const url = `${base}/${s.locale}/properties/${l.id}`;
    const price = money(l.price, l.currency, s.locale);
    const drop =
      !l.isNew && l.previousPrice
        ? ` (${t.priceDropped} ${money(l.previousPrice, l.currency, s.locale)})`
        : "";
    return { url, price, drop, l };
  });

  const text = [
    fill(t.alertIntro, { label: s.label }),
    "",
    ...lines.map(({ url, price, drop, l }) => `${l.title} — ${price}${drop}\n${url}`),
    "",
    `${t.showAll}: ${searchUrl}`,
    "",
    `${t.unsubscribe}: ${urls.unsubscribe}`,
  ].join("\n");

  const cards = lines
    .map(
      ({ url, price, drop, l }) => `
      <tr><td style="padding:12px 0;border-top:1px solid #e2e8f0;">
        <a href="${escapeHtml(url)}" style="text-decoration:none;color:#0f172a;">
          ${l.image ? `<img src="${escapeHtml(l.image)}" alt="" width="160" style="float:left;margin:0 12px 0 0;border-radius:8px;max-width:160px;height:auto;">` : ""}
          <div style="font-weight:600;">${escapeHtml(l.title)}</div>
          <div style="color:#475569;font-size:14px;">${escapeHtml(l.city)}${l.areaSqm ? ` · ${l.areaSqm} m²` : ""}</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px;">${escapeHtml(price)}</div>
          ${drop ? `<div style="color:#15803d;font-size:13px;">${escapeHtml(drop.trim())}</div>` : ""}
          ${l.isNew ? `<div style="color:#dc2626;font-size:12px;font-weight:700;text-transform:uppercase;">${escapeHtml(t.newBadge)}</div>` : ""}
        </a>
      </td></tr>`
    )
    .join("");

  const html = emailShell(
    s.locale,
    `<p style="margin:20px 0 12px;">${escapeHtml(fill(t.alertIntro, { label: s.label }))}</p>
     <table width="100%" cellspacing="0" cellpadding="0">${cards}</table>
     <p style="margin:20px 0 0;"><a href="${escapeHtml(searchUrl)}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">${escapeHtml(fill(t.showAllCount, { count: total }))}</a></p>`,
    `<a href="${escapeHtml(urls.unsubscribe)}" style="color:#94a3b8;">${escapeHtml(t.unsubscribe)}</a>`
  );

  return sendMailMessage({
    to: s.email,
    subject,
    text,
    html,
    logLabel: `alert to ${s.email} (${total})`,
    headers: {
      "List-Unsubscribe": `<${urls.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

/**
 * Time-boxed: handles the searches that waited longest first; whatever does
 * not fit is picked up by the next run.
 */
export async function sendSearchAlerts(opts: { deadline: number }) {
  const runStartedAt = new Date();
  const dueBefore = (f: AlertFrequency) => new Date(runStartedAt.getTime() - FREQUENCY_GAP_MS[f]);
  let checked = 0;
  let emailed = 0;
  const failedIds: string[] = [];

  while (Date.now() < opts.deadline) {
    const batch = await prisma.savedSearch.findMany({
      where: {
        active: true,
        confirmedAt: { not: null },
        // Daily / weekly searches wait until their digest is due and then
        // report everything since the previous e-mail.
        OR: [
          { frequency: AlertFrequency.INSTANT, lastCheckedAt: { lt: runStartedAt } },
          { frequency: AlertFrequency.DAILY, lastCheckedAt: { lt: dueBefore(AlertFrequency.DAILY) } },
          { frequency: AlertFrequency.WEEKLY, lastCheckedAt: { lt: dueBefore(AlertFrequency.WEEKLY) } },
        ],
        ...(failedIds.length > 0 ? { id: { notIn: failedIds } } : {}),
      },
      orderBy: { lastCheckedAt: "asc" },
      take: 100,
    });
    if (batch.length === 0) break;

    for (const s of batch) {
      if (Date.now() >= opts.deadline) break;
      checked++;
      try {
        const filters = s.filters as ListingSearchParams;
        const { listings, total } = await findAlertMatches(filters, s.lastCheckedAt);
        if (total > 0) {
          await sendAlertEmail({ ...s, filters }, listings, total);
          emailed++;
        }
        await prisma.savedSearch.update({
          where: { id: s.id },
          data: {
            lastCheckedAt: runStartedAt,
            ...(total > 0 ? { lastNotifiedAt: runStartedAt } : {}),
          },
        });
      } catch (err) {
        failedIds.push(s.id);
        console.error(`[alerts] saved search ${s.id} failed`, err);
      }
    }
  }

  return { checked, emailed, failed: failedIds.length };
}

/** Saved searches of a signed-in user (by account or by their e-mail). */
export async function listSavedSearchesForUser(user: { id: string; email: string }) {
  return prisma.savedSearch.findMany({
    where: {
      OR: [{ userId: user.id }, { email: user.email.toLowerCase(), confirmedAt: { not: null } }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
