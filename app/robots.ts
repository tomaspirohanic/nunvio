import type { MetadataRoute } from "next";
import { getCanonicalOrigin } from "@/lib/domains";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/*/dashboard"],
      },
    ],
    sitemap: `${getCanonicalOrigin()}/sitemap.xml`,
  };
}
