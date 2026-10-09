import { NextRequest, NextResponse } from "next/server";
import {
  MAX_FEED_XML_BYTES,
  validateXmlFeedContent,
} from "@/lib/import-xml";

export const runtime = "nodejs";
export const maxDuration = 30;

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".local") ||
    h === "metadata.google.internal"
  ) {
    return true;
  }
  // Basic private / link-local IP blocks
  if (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0)/.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
  ) {
    return true;
  }
  return false;
}

/**
 * Partner dry-run: POST { feedUrl?: string, xml?: string, defaultCountry?: string }
 * Validates XML shape without writing to the DB.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      feedUrl?: string;
      xml?: string;
      defaultCountry?: string;
    };

    let xml = typeof body.xml === "string" ? body.xml : "";

    if (!xml && body.feedUrl) {
      let url: URL;
      try {
        url = new URL(body.feedUrl.trim());
      } catch {
        return NextResponse.json(
          { ok: false, error: "Neplatná feed URL." },
          { status: 400 }
        );
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return NextResponse.json(
          { ok: false, error: "Povolené sú len http(s) URL." },
          { status: 400 }
        );
      }
      if (isBlockedHostname(url.hostname)) {
        return NextResponse.json(
          { ok: false, error: "Táto hostname nie je povolená." },
          { status: 400 }
        );
      }

      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "Nunvio-FeedValidate/1.0",
          Accept: "application/xml,text/xml,*/*",
        },
        signal: AbortSignal.timeout(45_000),
        cache: "no-store",
      });
      if (!response.ok) {
        return NextResponse.json(
          { ok: false, error: `Feed vrátil HTTP ${response.status}` },
          { status: 400 }
        );
      }
      xml = await response.text();
    }

    if (!xml.trim()) {
      return NextResponse.json(
        { ok: false, error: "Chýba XML alebo feedUrl." },
        { status: 400 }
      );
    }
    if (xml.length > MAX_FEED_XML_BYTES) {
      return NextResponse.json(
        { ok: false, error: "XML je príliš veľký (max 40 MB)." },
        { status: 400 }
      );
    }

    const result = validateXmlFeedContent(xml, {
      defaultCountry: body.defaultCountry,
    });

    return NextResponse.json({
      ...result,
      hint:
        result.missingExternalId > 0
          ? "Niektoré inzeráty nemajú externalId — pri syncu riskujete duplicity. Pridajte unikátne ID z CRM."
          : undefined,
    });
  } catch (error: unknown) {
    console.error("[partners/validate-feed]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Validácia zlyhala",
      },
      { status: 400 }
    );
  }
}
