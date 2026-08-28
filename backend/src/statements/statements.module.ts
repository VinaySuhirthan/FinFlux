import { Module } from '@nestjs/common';
import { StatementsService } from './statements.service';
import { StatementsController } from './statements.controller';
import { ParserModule } from '../parser/parser.module';
import { ClassificationModule } from '../classification/classification.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [ParserModule, ClassificationModule, AnalyticsModule],
  providers: [StatementsService],
  controllers: [StatementsController],
})
export class StatementsModule {}
