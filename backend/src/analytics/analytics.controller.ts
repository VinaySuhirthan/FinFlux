import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('summary')
  summary(
    @Request() req,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getSummary(req.user.id, dateFrom, dateTo);
  }

  @Get('category-breakdown')
  categoryBreakdown(
    @Request() req,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getCategoryBreakdown(req.user.id, dateFrom, dateTo);
  }

  @Get('monthly-trend')
  monthlyTrend(
    @Request() req,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getMonthlyTrend(req.user.id, dateFrom, dateTo);
  }

  @Get('top-merchants')
  topMerchants(
    @Request() req,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getTopMerchants(
      req.user.id,
      dateFrom,
      dateTo,
      limit ? parseInt(limit) : 10,
    );
  }
}
