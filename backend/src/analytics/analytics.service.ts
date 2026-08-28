import { Injectable, NotFoundException } from '@nestjs/common';
import { Direction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private buildDateFilter(dateFrom?: string, dateTo?: string) {
    if (!dateFrom && !dateTo) return undefined;

    const filter: any = {};

    if (dateFrom) filter.gte = new Date(dateFrom);
    if (dateTo) filter.lte = new Date(dateTo);

    return filter;
  }

  async getSummary(
    userId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const where: any = { statement: { userId } };

    if (dateFilter) where.txnDate = dateFilter;

    const [
      totalExpense,
      totalIncome,
      uncategorizedCount,
      txnCount,
    ] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          ...where,
          direction: Direction.DEBIT,
        },
        _sum: {
          debitAmount: true,
        },
        _count: true,
      }),

      this.prisma.transaction.aggregate({
        where: {
          ...where,
          direction: Direction.CREDIT,
        },
        _sum: {
          creditAmount: true,
        },
        _count: true,
      }),

      this.prisma.transaction.count({
        where: {
          ...where,
          category: {
            name: 'Uncategorized',
          },
        },
      }),

      this.prisma.transaction.count({
        where,
      }),
    ]);

    return {
      totalExpense: Number(
        totalExpense._sum.debitAmount ?? 0,
      ),

      totalIncome: Number(
        totalIncome._sum.creditAmount ?? 0,
      ),

      netFlow:
        Number(totalIncome._sum.creditAmount ?? 0) -
        Number(totalExpense._sum.debitAmount ?? 0),

      transactionCount: txnCount,

      uncategorizedCount,
    };
  }

  async getCategoryBreakdown(
    userId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    const where: any = {
      statement: { userId },
      direction: Direction.DEBIT,
    };

    if (dateFilter) where.txnDate = dateFilter;

    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: {
        debitAmount: true,
      },
      _count: true,
      orderBy: {
        _sum: {
          debitAmount: 'desc',
        },
      },
    });

    const categoryIds = rows
      .map((r) => r.categoryId)
      .filter(Boolean) as string[];

    const categories = await this.prisma.category.findMany({
      where: {
        id: {
          in: categoryIds,
        },
      },
    });

    const catMap = Object.fromEntries(
      categories.map((c) => [c.id, c]),
    );

    return rows.map((r) => ({
      category: r.categoryId
        ? catMap[r.categoryId]
        : null,

      total: Number(
        r._sum.debitAmount ?? 0,
      ),

      count: r._count,
    }));
  }

  async getMonthlyTrend(
    userId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const dateFilter = this.buildDateFilter(
      dateFrom,
      dateTo,
    );

    const where: any = {
      statement: { userId },
    };

    if (dateFilter) where.txnDate = dateFilter;

    const transactions =
      await this.prisma.transaction.findMany({
        where,

        select: {
          txnDate: true,
          debitAmount: true,
          creditAmount: true,
          direction: true,
        },

        orderBy: {
          txnDate: 'asc',
        },
      });

    const monthMap = new Map<
      string,
      {
        month: string;
        expense: number;
        income: number;
      }
    >();

    for (const txn of transactions) {
      const d = new Date(txn.txnDate);

      const key =
        `${d.getFullYear()}-${String(
          d.getMonth() + 1,
        ).padStart(2, '0')}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          month: key,
          expense: 0,
          income: 0,
        });
      }

      const entry = monthMap.get(key)!;

      if (txn.direction === Direction.DEBIT) {
        entry.expense += Number(
          txn.debitAmount ?? 0,
        );
      } else {
        entry.income += Number(
          txn.creditAmount ?? 0,
        );
      }
    }

    return Array.from(monthMap.values()).sort(
      (a, b) => a.month.localeCompare(b.month),
    );
  }

  async getTopMerchants(
    userId: string,
    dateFrom?: string,
    dateTo?: string,
    limit = 10,
  ) {
    const dateFilter = this.buildDateFilter(
      dateFrom,
      dateTo,
    );

    const where: any = {
      statement: { userId },
      direction: Direction.DEBIT,
    };

    if (dateFilter) where.txnDate = dateFilter;

    const txns =
      await this.prisma.transaction.findMany({
        where,

        select: {
          description: true,
          debitAmount: true,
        },
      });

    const merchantMap = new Map<
      string,
      {
        name: string;
        total: number;
        count: number;
      }
    >();

    for (const t of txns) {
      const key = t.description
        .substring(0, 40)
        .trim();

      if (!merchantMap.has(key)) {
        merchantMap.set(key, {
          name: key,
          total: 0,
          count: 0,
        });
      }

      const entry = merchantMap.get(key)!;

      entry.total += Number(
        t.debitAmount ?? 0,
      );

      entry.count++;
    }

    return Array.from(merchantMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  async getFinancialFeatures(
    userId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const [
      summary,
      categories,
      monthlyTrend,
      merchants,
    ] = await Promise.all([
      this.getSummary(
        userId,
        dateFrom,
        dateTo,
      ),

      this.getCategoryBreakdown(
        userId,
        dateFrom,
        dateTo,
      ),

      this.getMonthlyTrend(
        userId,
        dateFrom,
        dateTo,
      ),

      this.getTopMerchants(
        userId,
        dateFrom,
        dateTo,
      ),
    ]);

    return {
      summary: {
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        netFlow: summary.netFlow,
        transactionCount:
          summary.transactionCount,
      },

      categories,

      monthlyTrend,

      topMerchants: merchants,
    };
  }

  async buildStoredAnalytics(userId: string) {
    const [user, transactions] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      }),

      this.prisma.transaction.findMany({
        where: {
          statement: { userId },
        },
        select: {
          txnDate: true,
          debitAmount: true,
          creditAmount: true,
          direction: true,
          category: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          txnDate: 'asc',
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const income: Record<
      string,
      {
        income: number;
        expense: number;
      }
    > = {};

    const categoryTotals: Record<string, number> = {};
    const months = new Set<string>();

    for (const txn of transactions) {
      const d = new Date(txn.txnDate);
      const month = `${d.getFullYear()}-${String(
        d.getMonth() + 1,
      ).padStart(2, '0')}`;

      months.add(month);

      if (!income[month]) {
        income[month] = {
          income: 0,
          expense: 0,
        };
      }

      if (txn.direction === Direction.CREDIT) {
        income[month].income += Number(
          txn.creditAmount ?? 0,
        );
      } else {
        const expense = Number(txn.debitAmount ?? 0);
        income[month].expense += expense;

        const categoryName =
          txn.category?.name ?? 'Uncategorized';
        categoryTotals[categoryName] =
          (categoryTotals[categoryName] ?? 0) + expense;
      }
    }

    const monthCount = Math.max(months.size, 1);
    const categories = Object.fromEntries(
      Object.entries(categoryTotals).map(([name, total]) => [
        name,
        total / monthCount,
      ]),
    );

    return {
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt.toISOString(),
          }
        : null,
      income,
      categories,
      monthCount,
    };
  }

  async refreshStoredAnalytics(userId: string) {
    const analytics = await this.buildStoredAnalytics(userId);
    const prisma = this.prisma as any;

    return prisma.analytics.upsert({
      where: {
        userId,
      },
      update: {
        userData: analytics.user,
        income: analytics.income,
        categories: analytics.categories,
      },
      create: {
        userId,
        userData: analytics.user,
        income: analytics.income,
        categories: analytics.categories,
      },
    });
  }

  async getStoredAnalytics(userId: string) {
    const prisma = this.prisma as any;

    const rows = await prisma.$queryRaw`
      SELECT a.*, a."IncomeVolatility"
      FROM "Analytics" a
      WHERE a."userId" = ${userId}
      LIMIT 1
    `;

    const analytics = rows[0];
    if (!analytics) return null;

    const incomeData = typeof analytics.income === 'string'
      ? JSON.parse(analytics.income)
      : analytics.income ?? {};
    const monthlyIncome = Object.values(incomeData)
      .filter((entry: any) => entry && typeof entry === 'object')
      .map((entry: any) => Number(entry.income ?? 0));
    const averageIncome = monthlyIncome.length
      ? monthlyIncome.reduce((total, income) => total + income, 0) / monthlyIncome.length
      : 0;
    const predictedIncome = Number(analytics.PredictedIncome ?? 0);

    return {
      ...analytics,
      averageIncome: Number(averageIncome.toFixed(2)),
      amountSaved: Number((predictedIncome - averageIncome).toFixed(2)),
    };
  }
}
