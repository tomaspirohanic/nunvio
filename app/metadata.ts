import type { Metadata } from "next";

export const siteMetadata: Metadata = {
  title: {
    default: "Nunvio",
    template: "%s | Nunvio",
  },
  description: "Global real estate platform",
  metadataBase: new URL("https://nunvio.com"),

  openGraph: {
    title: "Nunvio",
    description: "Global real estate platform",
    siteName: "Nunvio",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Nunvio",
    description: "Global real estate platform",
  },
};
