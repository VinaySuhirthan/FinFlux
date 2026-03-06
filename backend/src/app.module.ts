import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StatementsModule } from './statements/statements.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ParserModule } from './parser/parser.module';
import { ClassificationModule } from './classification/classification.module';
import { RulesModule } from './rules/rules.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    StatementsModule,
    TransactionsModule,
    ParserModule,
    ClassificationModule,
    RulesModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
