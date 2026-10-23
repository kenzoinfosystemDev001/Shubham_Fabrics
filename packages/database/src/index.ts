import { PrismaClient } from './generated/client';

export * from './generated/client';

// Global singleton pattern to prevent multiple connections in dev hot-reload
declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

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

// DATABASE_URL must come from the environment. There is deliberately no fallback:
// a missing variable must fail loudly instead of silently connecting to another database.
const dbUrl = process.env.DATABASE_URL ? formatDatabaseUrl(process.env.DATABASE_URL) : undefined;
if (!dbUrl) {
  console.error('[database] DATABASE_URL is not set. Database queries will fail until it is configured.');
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const client = new PrismaClient({
      ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
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
