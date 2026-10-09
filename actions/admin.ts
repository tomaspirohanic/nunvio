"use server";

import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

function assertNonEmptyString(name: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${name}`);
  }
  return value.trim();
}

async function assertSuperadmin(): Promise<void> {
  const session = await getServerSession(authConfig);
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role === "SUPERADMIN") return;

  // Fallback: ensure role is correct even if session is stale
  if (session.user.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
    if (dbUser?.role === UserRole.SUPERADMIN) return;
  }

  throw new Error("Forbidden");
}

export async function changeUserRole(userId: string, newRole: string) {
  await assertSuperadmin();

  const id = assertNonEmptyString("userId", userId);
  const roleRaw = assertNonEmptyString("newRole", newRole).toUpperCase();

  if (!(Object.values(UserRole) as string[]).includes(roleRaw)) {
    throw new Error("Invalid role");
  }

  const role = roleRaw as UserRole;

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: {
      id: true,
      role: true,
      email: true,
      name: true,
      agencyId: true,
      createdAt: true,
    },
  });

  return updated;
}

