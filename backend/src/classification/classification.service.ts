import { Injectable, Logger } from '@nestjs/common';
import { ClassificationReason, PatternType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface ClassificationInput {
  normalizedDescription: string;
  debitAmount?: number;
  creditAmount?: number;
}

interface ClassificationResult {
  categoryId: string | null;
  reason: ClassificationReason;
}

interface RuleRow {
  id: string;
  pattern: string;
  patternType: PatternType;
  categoryId: string;
  priority: number;
}

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(private prisma: PrismaService) {}

  async classifyTransaction(input: ClassificationInput): Promise<ClassificationResult> {
    const rules = await this.getActiveRules();
    return this.applyRules(input, rules);
  }

  async classifyBatch(
    inputs: ClassificationInput[],
  ): Promise<ClassificationResult[]> {
    const rules = await this.getActiveRules();
    return inputs.map((input) => this.applyRules(input, rules));
  }

  private async getActiveRules(): Promise<RuleRow[]> {
    return this.prisma.classificationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
      select: { id: true, pattern: true, patternType: true, categoryId: true, priority: true },
    });
  }

  private applyRules(input: ClassificationInput, rules: RuleRow[]): ClassificationResult {
    const text = input.normalizedDescription;

    for (const rule of rules) {
      if (rule.patternType === PatternType.KEYWORD) {
        if (text.includes(rule.pattern.toLowerCase())) {
          return { categoryId: rule.categoryId, reason: ClassificationReason.EXACT_KEYWORD };
        }
      } else if (rule.patternType === PatternType.REGEX) {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          if (regex.test(text)) {
            return { categoryId: rule.categoryId, reason: ClassificationReason.REGEX_MATCH };
          }
        } catch (e) {
          this.logger.warn(`Invalid regex pattern "${rule.pattern}": ${e.message}`);
        }
      }
    }

    return { categoryId: null, reason: ClassificationReason.FALLBACK_UNCATEGORIZED };
  }

  async reprocessStatement(statementId: string): Promise<number> {
    const transactions = await this.prisma.transaction.findMany({
      where: { statementId, isManualOverride: false },
      select: { id: true, normalizedDescription: true, debitAmount: true, creditAmount: true },
    });

    const rules = await this.getActiveRules();
    let updated = 0;

    for (const txn of transactions) {
      const result = this.applyRules(
        {
          normalizedDescription: txn.normalizedDescription,
          debitAmount: txn.debitAmount ? parseFloat(txn.debitAmount.toString()) : undefined,
          creditAmount: txn.creditAmount ? parseFloat(txn.creditAmount.toString()) : undefined,
        },
        rules,
      );

      await this.prisma.transaction.update({
        where: { id: txn.id },
        data: {
          categoryId: result.categoryId,
          autoCategoryId: result.categoryId,
          classificationReason: result.reason,
        },
      });
      updated++;
    }

    return updated;
  }

  /** Get uncategorized category id */
  async getUncategorizedId(): Promise<string | null> {
    const cat = await this.prisma.category.findFirst({
      where: { name: 'Uncategorized' },
    });
    return cat?.id ?? null;
  }
}
