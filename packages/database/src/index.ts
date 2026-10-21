import { PrismaClient } from './generated/client';

export * from './generated/client';

// Global singleton pattern to prevent multiple connections in dev hot-reload
declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

// Base Neon cloud connection string
const NEON_DATABASE_URL =
  'postgresql://neondb_owner:npg_3h1GKCDxtAeX@ep-jolly-tree-b5ebsnbj-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

/**
 * Optimizes the PostgreSQL connection URL for Neon Serverless / PgBouncer connection pooling.
 * Automatically injects pgbouncer=true, connection_limit, and timeouts to prevent dropped connections.
 */
export function formatDatabaseUrl(rawUrl: string): string {
  let url = rawUrl;
  if (url.includes('-pooler') && !url.includes('pgbouncer=true')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}pgbouncer=true`;
  }
  if (!url.includes('connect_timeout=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}connect_timeout=30`;
  }
  if (!url.includes('pool_timeout=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}pool_timeout=30`;
  }
  if (!url.includes('connection_limit=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}connection_limit=10`;
  }
  return url;
}

const dbUrl = formatDatabaseUrl(process.env.DATABASE_URL || NEON_DATABASE_URL);
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = dbUrl;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const client = new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // Handle and filter log events to prevent terminal spam from idle socket drops
    (client as any).$on('error', (e: any) => {
      const msg = typeof e === 'string' ? e : e?.message || '';
      // Suppress idle TCP socket closure from remote Neon / PgBouncer pooler
      if (
        msg.includes('kind: Closed') ||
        msg.includes('Closed, cause: None') ||
        msg.includes('Server has closed the connection')
      ) {
        return;
      }
      console.error('prisma:error', msg || e);
    });

    (client as any).$on('warn', (e: any) => {
      const msg = typeof e === 'string' ? e : e?.message || '';
      console.warn('prisma:warn', msg || e);
    });

    globalForPrisma.prisma = client;
  }
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
export default prisma;
