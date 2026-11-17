import { revalidatePath, revalidateTag } from "next/cache";
import { locales } from "@/i18n";

/** Cache tag shared by all cached public listing queries. */
export const LISTINGS_CACHE_TAG = "listings";

/**
 * Invalidate cached public listing data after a create / update / delete / import.
 * - Search results + homepage use `unstable_cache` tagged with LISTINGS_CACHE_TAG.
 * - Detail pages are ISR; pass ids to refresh them immediately in every locale.
 */
export function revalidateListings(propertyIds: string[] = []) {
  try {
    revalidateTag(LISTINGS_CACHE_TAG, { expire: 0 });
    if (propertyIds.length > 10) {
      // Bulk change (feed import): refresh all detail pages lazily in one call.
      revalidatePath("/[locale]/properties/[id]", "page");
      return;
    }
    for (const id of propertyIds) {
      for (const loc of locales) {
        revalidatePath(`/${loc}/properties/${id}`);
      }
    }
  } catch (err) {
    // revalidate* throws when called outside a request/action context (e.g. scripts)
    console.warn("[revalidateListings] skipped:", err);
  }
}
