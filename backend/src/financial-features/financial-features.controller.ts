import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FinancialFeaturesService } from './financial-features.service';

@Controller('financial-features')
@UseGuards(JwtAuthGuard)
export class FinancialFeaturesController {
  constructor(
    private readonly financialFeaturesService: FinancialFeaturesService,
  ) {}

  @Get('health')
  getFinancialHealth(
    @Request() req,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.financialFeaturesService.getFinancialHealth(
      req.user.id,
      dateFrom,
      dateTo,
    );
  }
}