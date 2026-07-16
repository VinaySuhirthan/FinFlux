import { BankParser, ParseResult, ParsedTransaction } from '../interfaces/parser.interface';
import { GenericParser } from './generic.strategy';

/**
 * HDFC Bank statement parser.
 *
 * HDFC text statements typically have the format:
 *   Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance
 *
 * Limitations:
 * - Works with HDFC Net Banking downloaded statements (not mobile app PDFs)
 * - Multi-line narrations may be partially captured
 * - Some HDFC PDFs use image-based rendering; this parser handles text-based only
 */
export class HdfcParser implements BankParser {
  name = 'HDFC';
  private generic = new GenericParser();

  canHandle(text: string): boolean {
    // Accept both HDFC bank and credit card statements
    return /hdfc\s+bank|hdfc\s+credit\s+card|withdrawal\s+amt|payment\s+due|statement\s+date/i.test(text);
  }

  parse(text: string): ParseResult {
    const result: ParseResult = {
      transactions: [],
      warnings: [],
      errors: [],
      skippedLines: [],
      bankName: 'HDFC Bank',
    };

    // Try to detect period (bank or credit card)
    let periodMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (!periodMatch) {
      periodMatch = text.match(/Statement\s+Period\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i);
    }
    if (periodMatch) {
      result.statementPeriodStart = this.generic.parseDate(periodMatch[1]);
      result.statementPeriodEnd = this.generic.parseDate(periodMatch[2]);
    }

    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    // Find header line (bank or credit card)
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/date.*narration.*withdrawal|date.*chq.*ref|date.*transaction.*amount.*balance|date.*description.*amount/i.test(lines[i])) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      result.warnings.push('HDFC header not found; falling back to generic parser');
      const fallback = this.generic.parse(text);
      return { ...fallback, bankName: 'HDFC Bank' };
    }

    // Parse lines after header
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];

      if (/opening\s+balance|closing\s+balance|total\s+withdrawal/i.test(line)) {
        result.skippedLines.push(line);
        continue;
      }

      const txn = this.parseHdfcLine(line, lines, i) || this.parseHdfcCreditCardLine(line);
      if (txn) {
        result.transactions.push(txn);
      } else if (line.length > 5) {
        result.skippedLines.push(line);
      }
    }

    if (result.transactions.length === 0) {
      result.errors.push('No HDFC transactions parsed; falling back to generic parser');
      try {
        const fallback = this.generic.parse(text);
        return { ...fallback, bankName: 'HDFC Bank' };
      } catch (e) {
        result.errors.push('Generic parser also failed: ' + (e instanceof Error ? e.message : String(e)));
        return result;
      }
    }

    return result;
  }

  /**
   * HDFC line format (tab or multi-space separated):
   * DD/MM/YY  Narration  RefNo  ValueDate  WithdrawalAmt  DepositAmt  ClosingBalance
   */
  private parseHdfcLine(line: string, lines: string[], idx: number): ParsedTransaction | null {
    // Split by 2+ spaces or tabs
    const parts = line.split(/\s{2,}|\t/).map((p) => p.trim()).filter((p) => p.length > 0);

    // Minimum: date, narration, and at least one amount
    if (parts.length < 3) return null;

    const dateStr = parts[0];
    const dateMatch = dateStr.match(/^\d{2}\/\d{2}\/\d{2,4}$/);
    if (!dateMatch) return null;

    const txnDate = this.generic.parseDate(dateStr);
    if (isNaN(txnDate.getTime())) return null;

    // Narration is part[1], ref is part[2] if non-numeric, value date part[3]
    let narration = parts[1] || '';
    let reference: string | undefined;
    let withdrawalAmt: number | undefined;
    let depositAmt: number | undefined;
    let balance: number | undefined;

    // Try to find amounts from right side
    const amounts: number[] = [];
    let amountStartIdx = parts.length;

    for (let j = parts.length - 1; j >= 2; j--) {
      const cleaned = parts[j].replace(/,/g, '');
      if (/^\d+\.?\d{0,2}$/.test(cleaned)) {
        amounts.unshift(parseFloat(cleaned));
        amountStartIdx = j;
      } else {
        break;
      }
    }

    // Middle parts (between narration and amounts) could be ref and value date
    const middleParts = parts.slice(2, amountStartIdx);
    if (middleParts.length > 0 && !/^\d{2}\/\d{2}\/\d{2,4}$/.test(middleParts[0])) {
      reference = middleParts[0];
    }

    if (amounts.length === 3) {
      withdrawalAmt = amounts[0] || undefined;
      depositAmt = amounts[1] || undefined;
      balance = amounts[2];
    } else if (amounts.length === 2) {
      // Could be withdrawal + balance or deposit + balance
      withdrawalAmt = amounts[0];
      balance = amounts[1];
    } else if (amounts.length === 1) {
      balance = amounts[0];
    }

    // Check next line for continuation of narration (common in HDFC)
    if (idx + 1 < lines.length) {
      const nextLine = lines[idx + 1];
      if (!/^\d{2}\/\d{2}\/\d{2,4}/.test(nextLine) && nextLine.length > 0 && nextLine.length < 80) {
        narration = `${narration} ${nextLine}`.trim();
      }
    }

    if (!narration) return null;

    return {
      txnDate,
      description: narration.substring(0, 300),
      reference,
      debitAmount: withdrawalAmt,
      creditAmount: depositAmt,
      balance,
    };
  }

  /**
   * HDFC Credit Card line format (tab or multi-space separated):
   * Date  Description  Amount
   */
  private parseHdfcCreditCardLine(line: string): ParsedTransaction | null {
    const parts = line.split(/\s{2,}|\t/).map((p) => p.trim()).filter((p) => p.length > 0);
    if (parts.length < 3) return null;
    // Try DD/MM/YYYY or DD/MM/YY
    const dateStr = parts[0];
    const dateMatch = dateStr.match(/^\d{2}\/\d{2}\/\d{2,4}$/);
    if (!dateMatch) return null;
    const txnDate = this.generic.parseDate(dateStr);
    if (isNaN(txnDate.getTime())) return null;
    const description = parts[1];
    // Amount is always positive for credit card, direction inferred from description
    const amount = parseFloat(parts[2].replace(/,/g, ''));
    if (isNaN(amount)) return null;
    // Infer debit/credit from keywords
    let debitAmount: number | undefined;
    let creditAmount: number | undefined;
    if (/payment|refund|reversal/i.test(description)) {
      creditAmount = amount;
    } else {
      debitAmount = amount;
    }
    return {
      txnDate,
      description: description.substring(0, 300),
      debitAmount,
      creditAmount,
    };
  }
}
