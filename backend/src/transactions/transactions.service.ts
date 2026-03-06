import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassificationReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async findByStatement(
    userId: string,
    statementId: string,
    filters: {
      categoryId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      minAmount?: number;
      maxAmount?: number;
      page?: number;
      limit?: number;
    },
  ) {
    // Verify statement belongs to user
    const statement = await this.prisma.statementUpload.findFirst({
      where: { id: statementId, userId },
    });
    if (!statement) throw new NotFoundException('Statement not found');

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: any = { statementId };

    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.search) {
      where.description = { contains: filters.search, mode: 'insensitive' };
    }
    if (filters.dateFrom || filters.dateTo) {
      where.txnDate = {};
      if (filters.dateFrom) where.txnDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.txnDate.lte = new Date(filters.dateTo);
    }
    if (filters.minAmount || filters.maxAmount) {
      where.amountSigned = {};
      if (filters.minAmount) where.amountSigned.gte = filters.minAmount;
      if (filters.maxAmount) where.amountSigned.lte = filters.maxAmount;
    }

    const [total, transactions] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { txnDate: 'desc' },
        include: { category: true },
      }),
    ]);

    return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateCategory(userId: string, txnId: string, categoryId: string) {
    const txn = await this.prisma.transaction.findFirst({
      where: { id: txnId, statement: { userId } },
    });
    if (!txn) throw new NotFoundException('Transaction not found');

    return this.prisma.transaction.update({
      where: { id: txnId },
      data: {
        categoryId,
        isManualOverride: true,
        classificationReason: ClassificationReason.MANUAL_OVERRIDE,
      },
      include: { category: true },
    });
  }

  async bulkCategorize(userId: string, transactionIds: string[], categoryId: string) {
    // Only update transactions belonging to this user
    const txns = await this.prisma.transaction.findMany({
      where: { id: { in: transactionIds }, statement: { userId } },
      select: { id: true },
    });
    const validIds = txns.map((t) => t.id);

    await this.prisma.transaction.updateMany({
      where: { id: { in: validIds } },
      data: {
        categoryId,
        isManualOverride: true,
        classificationReason: ClassificationReason.MANUAL_OVERRIDE,
      },
    });

    return { updated: validIds.length };
  }

  async getCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }
}
