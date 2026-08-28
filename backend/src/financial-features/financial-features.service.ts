import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class FinancialFeaturesService {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async getFinancialHealth(
    userId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const summary = await this.analyticsService.getSummary(
      userId,
      dateFrom,
      dateTo,
    );

    const totalIncome = summary.totalIncome;
    const totalExpense = summary.totalExpense;
    const netCashFlow = summary.netFlow;

    const savingsAmount = netCashFlow;

    const savingsRate =
      totalIncome > 0
        ? (savingsAmount / totalIncome) * 100
        : 0;

    const expenseToIncomeRatio =
      totalIncome > 0
        ? (totalExpense / totalIncome) * 100
        : 0;

    return {
      totalIncome,
      totalExpense,
      netCashFlow,
      savingsAmount,
      savingsRate,
      expenseToIncomeRatio,
    };
  }
}