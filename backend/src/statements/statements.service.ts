import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ParseStatus, Direction, ClassificationReason } from '@prisma/client';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';
import { ParserService } from '../parser/parser.service';
import { ClassificationService } from '../classification/classification.service';
import { AnalyticsService } from '../analytics/analytics.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(
    private prisma: PrismaService,
    private parser: ParserService,
    private classification: ClassificationService,
    private analytics: AnalyticsService,
  ) {}

  private async runIncomePrediction() {
    const scriptPath = path.resolve(process.cwd(), 'income.py');
    const pythonCommand = process.env.PYTHON_EXECUTABLE || 'python';

    try {
      const result = await execFileAsync(pythonCommand, [scriptPath], {
        cwd: process.cwd(),
        timeout: 120000,
      });
      this.logger.log(`Income prediction completed: ${result.stdout.trim()}`);
    } catch (err: any) {
      this.logger.warn(`Income prediction failed: ${err.message}`);
    }
  }

  async createUpload(userId: string, file: Express.Multer.File, pdfPassword?: string) {
    const statement = await this.prisma.statementUpload.create({
      data: {
        userId,
        fileName: file.originalname,
        filePath: file.path,
        parseStatus: ParseStatus.PENDING,
      },
    });

    // Try to open file immediately to check for password/error
    try {
      await this.parser.parseFile(file.path, pdfPassword);
    } catch (err: any) {
      const msg = (err && err.message) ? err.message.toLowerCase() : '';
      const looksLikePasswordIssue = msg.includes('password') || msg.includes('incorrect') || msg.includes('encrypted') || msg.includes('decryption') || msg.includes('failed to decrypt') || msg.includes('no password');
      if (looksLikePasswordIssue) {
        // Delete the statement record if password is missing/incorrect
        await this.prisma.statementUpload.delete({ where: { id: statement.id } });
        throw new BadRequestException('PDF is password-protected or the provided password is incorrect');
      }
      throw err;
    }

    // Process asynchronously (fire and forget for MVP; in production use a queue)
    this.processStatement(statement.id, file.path, pdfPassword).catch((err) => {
      this.logger.error(`Failed to process statement ${statement.id}:`, err);
    });

    return statement;
  }

  /**
   * Create statement from pasted/imported data (JSON rows or raw tabular text)
   */
  async createFromImport(userId: string, payload: { text?: string; rows?: any[]; fileName?: string }) {
    const fileName = payload.fileName || 'imported-data';
    const statement = await this.prisma.statementUpload.create({
      data: {
        userId,
        fileName,
        filePath: '',
        parseStatus: ParseStatus.PENDING,
      },
    });

    await this.prisma.statementUpload.update({ where: { id: statement.id }, data: { parseStatus: ParseStatus.PROCESSING } });

    try {
      let parseResult;
      if (payload.rows && Array.isArray(payload.rows)) {
        // Convert rows to parseResult
        const transactions = payload.rows.map((r: any) => {
          const txnDate = r.date ? new Date(r.date) : null;
          const amount = parseFloat(String(r.amount ?? r.amt ?? r.value ?? 0));
          const debit = amount < 0 ? Math.abs(amount) : undefined;
          const credit = amount > 0 ? amount : undefined;
          return {
            txnDate,
            description: (r.description || r.desc || r.narration || '').substring(0, 300),
            reference: r.reference || r.ref || undefined,
            debitAmount: debit ?? undefined,
            creditAmount: credit ?? undefined,
            balance: undefined,
          };
        });
        parseResult = { transactions, warnings: [], errors: [], skippedLines: [] };
      } else if (payload.text) {
        parseResult = this.parser.parseText(payload.text);
      } else {
        throw new BadRequestException('No rows or text provided for import');
      }

      // Log warnings and errors
      for (const warn of parseResult.warnings) {
        await this.prisma.parseLog.create({ data: { statementId: statement.id, level: 'WARN', message: warn } });
      }
      for (const err of parseResult.errors) {
        await this.prisma.parseLog.create({ data: { statementId: statement.id, level: 'ERROR', message: err } });
      }
      for (const line of parseResult.skippedLines.slice(0, 50)) {
        await this.prisma.parseLog.create({ data: { statementId: statement.id, level: 'DEBUG', message: 'Skipped line', rawLine: line } });
      }

      if (parseResult.transactions.length === 0) {
        await this.prisma.statementUpload.update({ where: { id: statement.id }, data: { parseStatus: ParseStatus.FAILED, errorMessage: 'No transactions could be extracted from the provided input.' } });
        return statement;
      }

      const uncategorized = await this.classification.getUncategorizedId();
      const inputs = parseResult.transactions.map((t) => ({ normalizedDescription: this.parser.normalizeDescription(t.description), debitAmount: t.debitAmount, creditAmount: t.creditAmount }));
      const classifications = await this.classification.classifyBatch(inputs);

      const txnData = parseResult.transactions.map((t: any, idx: number) => {
        const cl = classifications[idx];
        const hasDebit = t.debitAmount && t.debitAmount > 0;
        const hasCredit = t.creditAmount && t.creditAmount > 0;
        const direction = hasCredit ? Direction.CREDIT : Direction.DEBIT;
        const amountSigned = hasCredit ? (t.creditAmount ?? 0) : -(t.debitAmount ?? 0);
        const categoryId = cl.categoryId ?? uncategorized;

        return {
          statementId: statement.id,
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

      await this.prisma.statementUpload.update({ where: { id: statement.id }, data: { parseStatus: ParseStatus.COMPLETED } });
      await this.analytics.refreshStoredAnalytics(userId);
      await this.runIncomePrediction();
      this.logger.log(`Imported statement ${statement.id} processed: ${txnData.length} transactions`);
      return statement;
    } catch (err: any) {
      this.logger.error(`Error importing statement ${statement.id}:`, err);
      await this.prisma.statementUpload.update({ where: { id: statement.id }, data: { parseStatus: ParseStatus.FAILED, errorMessage: err.message || 'Unknown error during import' } });
      return statement;
    }
  }

  private async processStatement(statementId: string, filePath: string, pdfPassword?: string) {
    await this.prisma.statementUpload.update({
      where: { id: statementId },
      data: { parseStatus: ParseStatus.PROCESSING },
    });

    try {
      const parseResult = await this.parser.parseFile(filePath, pdfPassword);

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

      const statement = await this.prisma.statementUpload.findUnique({
        where: { id: statementId },
        select: { userId: true },
      });
      if (statement) {
        await this.analytics.refreshStoredAnalytics(statement.userId);
        await this.runIncomePrediction();
      }

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
    await this.analytics.refreshStoredAnalytics(userId);
    return { deleted: true };
  }
}
