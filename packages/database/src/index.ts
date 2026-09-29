import { PrismaClient } from './generated/client';

export * from './generated/client';

// Global singleton pattern to prevent multiple connections in dev hot-reload
declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient();
  }

  if (!global.__prismaClient) {
    global.__prismaClient = new PrismaClient({
      log: ['error', 'warn'],
    });
  }
  return global.__prismaClient;
}

export const prisma = getPrismaClient();
export default prisma;
