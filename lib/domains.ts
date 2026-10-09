// ============================================
// PRODUCTION DOMAINS
// ============================================

/** Canonical marketing / auth / Stripe host */
export const CANONICAL_HOST = "nunvio.eu";

/** Hosts that serve the same Next.js app (no redirect) */
export const APP_HOSTS = ["nunvio.eu", "www.nunvio.eu", "nunvio.com", "www.nunvio.com"] as const;

/** Country TLDs that 301-redirect to the canonical host */
export const REDIRECT_TO_CANONICAL_HOSTS = [
  "nunvio.sk",
  "www.nunvio.sk",
  "nunvio.cz",
  "www.nunvio.cz",
] as const;

export function getCanonicalOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    `https://${CANONICAL_HOST}`
  );
}
