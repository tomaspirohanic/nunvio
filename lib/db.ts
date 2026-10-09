// ============================================
// PRISMA CLIENT SINGLETON
// ============================================
// Architecture: Prevents multiple PrismaClient instances
// - Development: Caches instance globally (prevents connection exhaustion)
// - Production: Creates new instance per serverless function
// - Logging: Errors only (reduce noise in production)
// ============================================

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
