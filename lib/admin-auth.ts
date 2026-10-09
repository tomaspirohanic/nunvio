import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

/**
 * Server-side guard for /admin pages.
 * Middleware already checks JWT role; this re-checks DB so stale sessions can't slip through.
 */
export async function requireSuperadmin(): Promise<{
  id: string;
  email: string;
  name: string | null;
}> {
  const session = await getServerSession(authConfig);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user || user.role !== UserRole.SUPERADMIN) {
    redirect("/en/dashboard");
  }

  return { id: user.id, email: user.email, name: user.name };
}
