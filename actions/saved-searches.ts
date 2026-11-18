"use server";

import { AlertFrequency } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import {
  createSavedSearch,
  unsubscribeSavedSearch,
  type CreateSavedSearchResult,
} from "@/lib/saved-search.server";
import { parseListingSearchParams } from "@/lib/listing-search-params";

const FREQUENCIES = Object.values(AlertFrequency) as string[];

async function currentUser() {
  const session = await getServerSession(authConfig);
  const email = session?.user?.email;
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true },
  });
  return user ? { id: user.id, email: user.email, emailVerified: !!user.emailVerified } : null;
}

/** Save the current search (query string of /properties) for e-mail alerts. */
export async function saveSearchAction(input: {
  email: string;
  query: string;
  locale: string;
  frequency: string;
}): Promise<CreateSavedSearchResult> {
  const sp = Object.fromEntries(new URLSearchParams(input.query.slice(0, 2000)));
  const frequency = FREQUENCIES.includes(input.frequency)
    ? (input.frequency as AlertFrequency)
    : AlertFrequency.INSTANT;
  return createSavedSearch({
    email: input.email,
    filters: parseListingSearchParams(sp),
    locale: input.locale,
    frequency,
    user: await currentUser(),
  });
}

async function ownedSearch(id: string) {
  const user = await currentUser();
  if (!user) return null;
  return prisma.savedSearch.findFirst({
    where: { id, OR: [{ userId: user.id }, { email: user.email.toLowerCase() }] },
    select: { id: true },
  });
}

export async function deleteSavedSearchAction(id: string) {
  const s = await ownedSearch(id);
  if (!s) return { ok: false as const };
  await prisma.savedSearch.delete({ where: { id: s.id } });
  revalidatePath("/[locale]/dashboard/alerts", "page");
  return { ok: true as const };
}

export async function updateSavedSearchAction(
  id: string,
  data: { frequency?: string; active?: boolean }
) {
  const s = await ownedSearch(id);
  if (!s) return { ok: false as const };
  await prisma.savedSearch.update({
    where: { id: s.id },
    data: {
      ...(data.frequency && FREQUENCIES.includes(data.frequency)
        ? { frequency: data.frequency as AlertFrequency }
        : {}),
      ...(typeof data.active === "boolean" ? { active: data.active } : {}),
    },
  });
  revalidatePath("/[locale]/dashboard/alerts", "page");
  return { ok: true as const };
}

/** Unsubscribe from the link in an alert e-mail (no account needed). */
export async function unsubscribeAction(token: string) {
  const s = await unsubscribeSavedSearch(token);
  return { ok: !!s };
}
