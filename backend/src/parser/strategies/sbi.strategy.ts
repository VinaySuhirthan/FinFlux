import { BankParser, ParseResult, ParsedTransaction } from '../interfaces/parser.interface';
import { GenericParser } from './generic.strategy';

/**
 * SBI Bank statement parser.
 *
 * SBI statements typically have:
 *   Txn Date | Value Date | Description | Ref No./Cheque No. | Debit | Credit | Balance
 *
 * Limitations:
 * - Only handles text-extractable PDFs
 * - Merged/overlapping columns may cause incorrect field assignment
 */
export class SbiParser implements BankParser {
  name = 'SBI';
  private generic = new GenericParser();

  canHandle(text: string): boolean {
    return /state\s+bank\s+of\s+india/i.test(text) || /\bsbi\b.*account/i.test(text);
  }

  parse(text: string): ParseResult {
    const result: ParseResult = {
      transactions: [],
      warnings: [],
      errors: [],
      skippedLines: [],
      bankName: 'State Bank of India',
    };

    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/txn\s+date.*value\s+date.*description|date.*narration.*debit.*credit/i.test(lines[i])) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      result.warnings.push('SBI header not found; falling back to generic parser');
      const fallback = this.generic.parse(text);
      return { ...fallback, bankName: 'State Bank of India' };
    }

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];

      if (/opening\s+balance|closing\s+balance|total\b/i.test(line)) {
        result.skippedLines.push(line);
        continue;
      }

      const txn = this.parseSbiLine(line);
      if (txn) {
        result.transactions.push(txn);
      } else if (line.length > 5) {
        result.skippedLines.push(line);
      }
    }

    if (result.transactions.length === 0) {
      result.warnings.push('No SBI transactions parsed; falling back to generic parser');
      const fallback = this.generic.parse(text);
      return { ...fallback, bankName: 'State Bank of India' };
    }

    return result;
  }

  private parseSbiLine(line: string): ParsedTransaction | null {
    const parts = line.split(/\s{2,}|\t/).map((p) => p.trim()).filter((p) => p);
    if (parts.length < 3) return null;

    const dateMatch = parts[0].match(/^\d{2}\/\d{2}\/\d{4}$|^\d{2}-\d{2}-\d{4}$/);
    if (!dateMatch) return null;

    const txnDate = this.generic.parseDate(parts[0]);
    if (isNaN(txnDate.getTime())) return null;

    // Skip value date if present (second date-like token)
    let descStart = 1;
    if (parts[1] && /^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(parts[1])) {
      descStart = 2;
    }

    // Find amounts from end
    const amounts: number[] = [];
    let amountStart = parts.length;
    for (let j = parts.length - 1; j >= descStart; j--) {
      const cleaned = parts[j].replace(/,/g, '');
      if (/^\d+\.?\d{0,2}$/.test(cleaned)) {
        amounts.unshift(parseFloat(cleaned));
        amountStart = j;
      } else {
        break;
      }
    }

    const descParts = parts.slice(descStart, amountStart);
    let description = descParts.join(' ').trim();
    let reference: string | undefined;

    // Last desc part might be a ref number
    if (descParts.length > 1) {
      const lastPart = descParts[descParts.length - 1];
      if (/^[A-Z0-9]{8,20}$/.test(lastPart)) {
        reference = lastPart;
        description = descParts.slice(0, -1).join(' ').trim();
      }
    }

    let debitAmount: number | undefined;
    let creditAmount: number | undefined;
    let balance: number | undefined;

    if (amounts.length === 3) {
      debitAmount = amounts[0] || undefined;
      creditAmount = amounts[1] || undefined;
      balance = amounts[2];
    } else if (amounts.length === 2) {
      debitAmount = amounts[0];
      balance = amounts[1];
    } else if (amounts.length === 1) {
      debitAmount = amounts[0];
    }

    if (!description) return null;

    return { txnDate, description: description.substring(0, 300), reference, debitAmount, creditAmount, balance };
  }
}
