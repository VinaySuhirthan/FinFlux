import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FinancialFeaturesService } from './financial-features.service';
import { FinancialFeaturesController } from './financial-features.controller';

@Module({
  imports: [AnalyticsModule],
  providers: [FinancialFeaturesService],
  controllers: [FinancialFeaturesController],
  exports: [FinancialFeaturesService],
})
export class FinancialFeaturesModule {}