import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ParseStatus, Direction, ClassificationReason } from '@prisma/client';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ParserService } from '../parser/parser.service';
import { ClassificationService } from '../classification/classification.service';

@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(
    private prisma: PrismaService,
    private parser: ParserService,
    private classification: ClassificationService,
  ) {}

  async createUpload(userId: string, file: Express.Multer.File) {
    const statement = await this.prisma.statementUpload.create({
      data: {
        userId,
        fileName: file.originalname,
        filePath: file.path,
        parseStatus: ParseStatus.PENDING,
      },
    });

    // Process asynchronously (fire and forget for MVP; in production use a queue)
    this.processStatement(statement.id, file.path).catch((err) => {
      this.logger.error(`Failed to process statement ${statement.id}:`, err);
    });

    return statement;
  }

  private async processStatement(statementId: string, filePath: string) {
    await this.prisma.statementUpload.update({
      where: { id: statementId },
      data: { parseStatus: ParseStatus.PROCESSING },
    });

    try {
      const parseResult = await this.parser.parseFile(filePath);

      // Log warnings and errors
      for (const warn of parseResult.warnings) {
        await this.prisma.parseLog.create({
          data: { statementId, level: 'WARN', message: warn },
        });
      }
      for (const err of parseResult.errors) {
        await this.prisma.parseLog.create({
          data: { statementId, level: 'ERROR', message: err },
        });
      }
      for (const line of parseResult.skippedLines.slice(0, 50)) {
        await this.prisma.parseLog.create({
          data: { statementId, level: 'DEBUG', message: 'Skipped line', rawLine: line },
        });
      }

      if (parseResult.transactions.length === 0) {
        await this.prisma.statementUpload.update({
          where: { id: statementId },
          data: {
            parseStatus: ParseStatus.FAILED,
            errorMessage: 'No transactions could be extracted from this PDF.',
            bankName: parseResult.bankName,
          },
        });
        return;
      }

      // Get uncategorized category
      const uncategorized = await this.classification.getUncategorizedId();

      // Classify all transactions
      const inputs = parseResult.transactions.map((t) => ({
        normalizedDescription: this.parser.normalizeDescription(t.description),
        debitAmount: t.debitAmount,
        creditAmount: t.creditAmount,
      }));
      const classifications = await this.classification.classifyBatch(inputs);

      // Bulk insert transactions
      const txnData = parseResult.transactions.map((t, idx) => {
        const cl = classifications[idx];
        const hasDebit = t.debitAmount && t.debitAmount > 0;
        const hasCredit = t.creditAmount && t.creditAmount > 0;
        const direction = hasCredit ? Direction.CREDIT : Direction.DEBIT;
        const amountSigned = hasCredit ? (t.creditAmount ?? 0) : -(t.debitAmount ?? 0);
        const categoryId = cl.categoryId ?? uncategorized;

        return {
          statementId,
          txnDate: t.txnDate,
          description: t.description,
          normalizedDescription: this.parser.normalizeDescription(t.description),
          reference: t.reference ?? null,
          debitAmount: t.debitAmount ?? null,
          creditAmount: t.creditAmount ?? null,
          balance: t.balance ?? null,
          amountSigned,
          direction,
          categoryId,
          autoCategoryId: categoryId,
          isManualOverride: false,
          classificationReason: cl.reason,
        };
      });

      await this.prisma.transaction.createMany({ data: txnData });

      await this.prisma.statementUpload.update({
        where: { id: statementId },
        data: {
          parseStatus: ParseStatus.COMPLETED,
          bankName: parseResult.bankName,
          statementPeriodStart: parseResult.statementPeriodStart ?? null,
          statementPeriodEnd: parseResult.statementPeriodEnd ?? null,
        },
      });

      this.logger.log(`Statement ${statementId} processed: ${txnData.length} transactions`);
    } catch (err) {
      this.logger.error(`Error processing statement ${statementId}:`, err);
      await this.prisma.statementUpload.update({
        where: { id: statementId },
        data: {
          parseStatus: ParseStatus.FAILED,
          errorMessage: err.message || 'Unknown error during parsing',
        },
      });
    }
  }

  async findAll(userId: string) {
    return this.prisma.statementUpload.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        _count: { select: { transactions: true } },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const statement = await this.prisma.statementUpload.findFirst({
      where: { id, userId },
      include: {
        _count: { select: { transactions: true } },
        parseLogs: { orderBy: { createdAt: 'asc' }, take: 100 },
      },
    });
    if (!statement) throw new NotFoundException('Statement not found');
    return statement;
  }

  async deleteOne(userId: string, id: string) {
    const statement = await this.prisma.statementUpload.findFirst({
      where: { id, userId },
    });
    if (!statement) throw new NotFoundException('Statement not found');

    await this.prisma.transaction.deleteMany({ where: { statementId: id } });
    await this.prisma.parseLog.deleteMany({ where: { statementId: id } });
    await this.prisma.statementUpload.delete({ where: { id } });
    return { deleted: true };
  }
}
