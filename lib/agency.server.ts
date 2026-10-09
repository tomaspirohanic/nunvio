// ============================================
// AGENCY SERVER ACTIONS (SERVER-ONLY)
// ============================================
// Server-side functions for agency management
// - Agency creation and onboarding
// - Team management (adding agents)
// - All operations require authentication
// ============================================

"use server";

import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

const getAuthenticatedUserId = async (): Promise<string | null> => {
  const session = await getServerSession(authConfig);

  if (session?.user?.id) {
    return session.user.id;
  }

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

  if (token?.userId) {
    return token.userId as string;
  }

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
  const session = await getServerSession(authConfig);
  const userId = await getAuthenticatedUserId();

  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, agencyId: true, email: true },
  });

  return user;
};

export interface CreateAgencyInput {
  name: string;
  companyId: string;
  address: string;
  city: string;
  country: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
}

/**
 * Create a new agency and link the current user as AGENCY_ADMIN
 */
export async function createAgency(input: CreateAgencyInput) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized");

    // Check if user already has an agency
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agencyId: true },
    });

    if (user?.agencyId) {
      throw new Error("User already belongs to an agency");
    }

    // Validate required fields
    if (!input.name || !input.companyId || !input.address || !input.city || !input.country) {
      throw new Error("Missing required fields");
    }

    // Check if companyId already exists
    const existingAgency = await prisma.agency.findUnique({
      where: { companyId: input.companyId },
    });

    if (existingAgency) {
      throw new Error("Agency with this Company ID already exists");
    }

    // Create agency and update user in a transaction
    const agency = await prisma.$transaction(async (tx) => {
      // Create the agency
      const newAgency = await tx.agency.create({
        data: {
          name: input.name,
          companyId: input.companyId,
          address: input.address,
          city: input.city,
          country: input.country,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          website: input.website || null,
          logoUrl: input.logoUrl || null,
        },
      });

      // Update user to be AGENCY_ADMIN and link to agency
      await tx.user.update({
        where: { id: userId },
        data: {
          role: UserRole.AGENCY_ADMIN,
          agencyId: newAgency.id,
        },
      });

      return newAgency;
    });

    // Revalidate dashboard pages
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/agency");

    return { success: true, agency };
  } catch (error) {
    console.error("createAgency failed:", error);
    throw error;
  }
}

/**
 * Get the current user's agency (if they are an admin)
 */
export async function getAgency() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) throw new Error("Unauthorized");

    if (!user.agencyId) {
      return null;
    }

    const agency = await prisma.agency.findUnique({
      where: { id: user.agencyId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    return agency;
  } catch (error) {
    console.error("getAgency failed:", error);
    throw error;
  }
}

/**
 * Get all agents in the current user's agency
 */
export async function getAgencyAgents() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) throw new Error("Unauthorized");

    if (user.role !== UserRole.AGENCY_ADMIN) {
      throw new Error("Only agency admins can view team members");
    }

    if (!user.agencyId) {
      throw new Error("User is not part of an agency");
    }

    const agents = await prisma.user.findMany({
      where: {
        agencyId: user.agencyId,
        role: UserRole.AGENT,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return agents;
  } catch (error) {
    console.error("getAgencyAgents failed:", error);
    throw error;
  }
}

/**
 * Add an agent to the current user's agency by email
 */
export async function addAgent(email: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) throw new Error("Unauthorized");

    if (user.role !== UserRole.AGENCY_ADMIN) {
      throw new Error("Only agency admins can add agents");
    }

    if (!user.agencyId) {
      throw new Error("User is not part of an agency");
    }

    // Validate email
    if (!email || !email.includes("@")) {
      throw new Error("Invalid email address");
    }

    // Find or create user by email
    const targetUser = await prisma.user.upsert({
      where: { email },
      update: {
        role: UserRole.AGENT,
        agencyId: user.agencyId,
      },
      create: {
        email,
        role: UserRole.AGENT,
        agencyId: user.agencyId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // Revalidate team page
    revalidatePath("/dashboard/agency/team");

    return { success: true, agent: targetUser };
  } catch (error) {
    console.error("addAgent failed:", error);
    throw error;
  }
}
