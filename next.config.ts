import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/**
 * Host redirects (Vercel + custom domains):
 * - nunvio.sk / nunvio.cz → https://nunvio.eu (same path)
 * - www.nunvio.eu → nunvio.eu
 * - www.nunvio.com → nunvio.com
 * nunvio.com and nunvio.eu both serve the app (same deployment).
 */
const nextConfig: NextConfig = {
  async redirects() {
    const toEu = (host: string) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://nunvio.eu/:path*",
      permanent: true,
    });

    return [
      toEu("nunvio.sk"),
      toEu("www.nunvio.sk"),
      toEu("nunvio.cz"),
      toEu("www.nunvio.cz"),
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.nunvio.eu" }],
        destination: "https://nunvio.eu/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.nunvio.com" }],
        destination: "https://nunvio.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
