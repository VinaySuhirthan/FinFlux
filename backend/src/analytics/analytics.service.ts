import { Injectable } from '@nestjs/common';
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

  async getSummary(userId: string, dateFrom?: string, dateTo?: string) {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const where: any = { statement: { userId } };
    if (dateFilter) where.txnDate = dateFilter;

    const [totalExpense, totalIncome, uncategorizedCount, txnCount] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...where, direction: Direction.DEBIT },
        _sum: { debitAmount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { ...where, direction: Direction.CREDIT },
        _sum: { creditAmount: true },
        _count: true,
      }),
      this.prisma.transaction.count({
        where: {
          ...where,
          category: { name: 'Uncategorized' },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      totalExpense: Number(totalExpense._sum.debitAmount ?? 0),
      totalIncome: Number(totalIncome._sum.creditAmount ?? 0),
      netFlow:
        Number(totalIncome._sum.creditAmount ?? 0) - Number(totalExpense._sum.debitAmount ?? 0),
      transactionCount: txnCount,
      uncategorizedCount,
    };
  }

  async getCategoryBreakdown(userId: string, dateFrom?: string, dateTo?: string) {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const where: any = { statement: { userId }, direction: Direction.DEBIT };
    if (dateFilter) where.txnDate = dateFilter;

    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { debitAmount: true },
      _count: true,
      orderBy: { _sum: { debitAmount: 'desc' } },
    });

    const categoryIds = rows.map((r) => r.categoryId).filter(Boolean) as string[];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    return rows.map((r) => ({
      category: r.categoryId ? catMap[r.categoryId] : null,
      total: Number(r._sum.debitAmount ?? 0),
      count: r._count,
    }));
  }

  async getMonthlyTrend(userId: string, dateFrom?: string, dateTo?: string) {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const where: any = { statement: { userId } };
    if (dateFilter) where.txnDate = dateFilter;

    const transactions = await this.prisma.transaction.findMany({
      where,
      select: { txnDate: true, debitAmount: true, creditAmount: true, direction: true },
      orderBy: { txnDate: 'asc' },
    });

    const monthMap = new Map<
      string,
      { month: string; expense: number; income: number }
    >();

    for (const txn of transactions) {
      const d = new Date(txn.txnDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, { month: key, expense: 0, income: 0 });
      }
      const entry = monthMap.get(key)!;
      if (txn.direction === Direction.DEBIT) {
        entry.expense += Number(txn.debitAmount ?? 0);
      } else {
        entry.income += Number(txn.creditAmount ?? 0);
      }
    }

    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }

  async getTopMerchants(userId: string, dateFrom?: string, dateTo?: string, limit = 10) {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const where: any = { statement: { userId }, direction: Direction.DEBIT };
    if (dateFilter) where.txnDate = dateFilter;

    const txns = await this.prisma.transaction.findMany({
      where,
      select: { description: true, debitAmount: true },
    });

    const merchantMap = new Map<string, { name: string; total: number; count: number }>();
    for (const t of txns) {
      // Use first 40 chars of description as merchant key
      const key = t.description.substring(0, 40).trim();
      if (!merchantMap.has(key)) {
        merchantMap.set(key, { name: key, total: 0, count: 0 });
      }
      const entry = merchantMap.get(key)!;
      entry.total += Number(t.debitAmount ?? 0);
      entry.count++;
    }

    return Array.from(merchantMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }
}
