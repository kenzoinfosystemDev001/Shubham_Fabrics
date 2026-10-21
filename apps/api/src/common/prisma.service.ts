import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, formatDatabaseUrl } from '@subham/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const NEON_DATABASE_URL =
      'postgresql://neondb_owner:npg_3h1GKCDxtAeX@ep-jolly-tree-b5ebsnbj-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
    const url = formatDatabaseUrl(process.env.DATABASE_URL || NEON_DATABASE_URL);

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
