import { PrismaClient } from './generated/client';

export * from './generated/client';

// Global singleton pattern to prevent multiple connections in dev hot-reload
declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

const NEON_DATABASE_URL = "postgresql://neondb_owner:npg_1aZq9IghyRre@ep-red-bread-b4ddqxah-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require";
const dbUrl = process.env.DATABASE_URL || NEON_DATABASE_URL;
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = NEON_DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: ['error', 'warn'],
    });
  }
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
export default prisma;
