import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, formatDatabaseUrl } from '@subham/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Refusing to start without an explicit database connection.');
    }
    const url = formatDatabaseUrl(process.env.DATABASE_URL);

    super({
      datasources: { db: { url } },
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    (this as any).$on('error', (e: any) => {
      const msg = typeof e === 'string' ? e : e?.message || '';
      if (
        msg.includes('kind: Closed') ||
        msg.includes('Closed, cause: None') ||
        msg.includes('Server has closed the connection')
      ) {
        return;
      }
      console.error('prisma:error', msg || e);
    });

    (this as any).$on('warn', (e: any) => {
      const msg = typeof e === 'string' ? e : e?.message || '';
      console.warn('prisma:warn', msg || e);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
