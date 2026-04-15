import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (e) {
      // If the database is not available (e.g., local dev without DB), log and continue in degraded mode
      // This prevents the whole Nest app from crashing during development.
      // The application should still handle DB-missing errors where operations require it.
      // eslint-disable-next-line no-console
      console.warn('Prisma failed to connect to database; continuing without DB:', e?.message ?? e);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch (e) {
      // ignore disconnect errors
    }
  }
}
