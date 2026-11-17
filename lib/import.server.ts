// ============================================
// XML IMPORT SERVER ACTION (MANUAL FILE UPLOAD)
// ============================================
// Bulk property import for AGENCY_ADMIN users.
// - Parses Nunvio XML (+ SK/CZ CRM aliases via lib/import-xml)
// - The actual import engine lives in lib/feed-import.server.ts (server-only,
//   not callable from the browser).
// ============================================

"use server";

import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { normalizeXmlProperty, parseXmlProperties } from "@/lib/import-xml";
import {
  importNormalizedProperties,
  type XmlImportResult,
} from "@/lib/feed-import.server";

export type { XmlImportResult };

const MAX_PROPERTIES_PER_IMPORT = 500;

const getAuthenticatedUserId = async (): Promise<string | null> => {
  const session = await getServerSession(authConfig);

  if (session?.user?.id) return session.user.id;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  const token = await getToken({
    req: { headers: { cookie: cookies().toString() } } as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token?.userId) return token.userId as string;

  if (token?.email) {
    const user = await prisma.user.findUnique({
      where: { email: token.email as string },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  return null;
};

const getAuthenticatedUser = async () => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, agencyId: true },
  });
};

export async function processXmlImport(
  formData: FormData
): Promise<XmlImportResult> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) throw new Error("Unauthorized");
    if (user.role !== UserRole.AGENCY_ADMIN) {
      throw new Error("Len administrátor agentúry môže importovať inzeráty.");
    }
    if (!user.agencyId) {
      throw new Error("Najprv vytvorte agentúru.");
    }

    const agency = await prisma.agency.findUnique({
      where: { id: user.agencyId },
      select: { country: true },
    });

    const file = formData.get("file") as File | null;
    if (!file) throw new Error("Nebol vybraný žiadny súbor.");
    if (!file.name.toLowerCase().endsWith(".xml")) {
      throw new Error("Podporované sú len súbory .xml");
    }

    const fileContent = await file.text();
    if (!fileContent.trim()) throw new Error("XML súbor je prázdny.");

    const rawProperties = parseXmlProperties(fileContent);

    if (rawProperties.length === 0) {
      throw new Error("XML neobsahuje žiadne inzeráty.");
    }
    if (rawProperties.length > MAX_PROPERTIES_PER_IMPORT) {
      throw new Error(
        `Príliš veľa inzerátov naraz (max ${MAX_PROPERTIES_PER_IMPORT}). Použite automatický feed URL alebo rozdeľte súbor.`
      );
    }

    const normalized = rawProperties.map((p, i) =>
      normalizeXmlProperty(p, i, { defaultCountry: agency?.country })
    );

    return importNormalizedProperties({
      agencyId: user.agencyId,
      ownerId: user.id,
      properties: normalized,
    });
  } catch (error) {
    console.error("processXmlImport failed:", error);
    throw error;
  }
}

