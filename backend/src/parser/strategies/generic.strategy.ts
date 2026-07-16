import { BankParser, ParseResult, ParsedTransaction } from '../interfaces/parser.interface';

/**
 * Generic heuristic parser for bank statements.
 *
 * Strategy:
 * 1. Split text into lines
 * 2. Find header row (contains date/narration/debit/credit keywords)
 * 3. Parse subsequent lines using positional or regex heuristics
 * 4. Skip opening/closing balance lines
 *
 * Limitations:
 * - Works best with simple single-page text statements
 * - Multi-column alignment may produce incorrect field mapping
 * - Does not handle wrapped description lines in all cases
 */
export class GenericParser implements BankParser {
  name = 'Generic';

  // Regex to detect a date at the start or within a line
  private datePatterns = [
    /\b(\d{2}[-\/]\d{2}[-\/]\d{4})\b/,   // DD-MM-YYYY or DD/MM/YYYY
    /\b(\d{4}[-\/]\d{2}[-\/]\d{2})\b/,   // YYYY-MM-DD
    /\b(\d{2}\s+\w{3}\s+\d{4})\b/,       // DD Mon YYYY
    /\b(\d{2}[-\/]\d{2}[-\/]\d{2})\b/,   // DD-MM-YY
  ];

  // Lines matching these patterns are NOT transactions
  private skipPatterns = [
    /opening\s+balance/i,
    /closing\s+balance/i,
    /brought\s+forward/i,
    /carried\s+forward/i,
    /^total\b/i,
    /^\s*page\s+\d+/i,
    /statement\s+of\s+account/i,
    /account\s+number/i,
    /account\s+holder/i,
    /ifsc/i,
    /branch\s+name/i,
  ];

  // Regex to find an amount (handles commas and decimals)
  private amountRegex = /[\d,]+\.?\d{0,2}/g;

  canHandle(_text: string): boolean {
    // Generic parser is the fallback - always returns true
    return true;
  }

  parse(text: string): ParseResult {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const result: ParseResult = {
      transactions: [],
      warnings: [],
      errors: [],
      skippedLines: [],
    };

    // Try to detect statement period from top of document
    const periodMatch = text.match(
      /(?:from|period)[:\s]+(\d{2}[-\/]\d{2}[-\/]\d{4})\s+(?:to|[-])\s+(\d{2}[-\/]\d{2}[-\/]\d{4})/i,
    );
    if (periodMatch) {
      result.statementPeriodStart = this.parseDate(periodMatch[1]);
      result.statementPeriodEnd = this.parseDate(periodMatch[2]);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (this.shouldSkip(line)) {
        result.skippedLines.push(line);
        continue;
      }

      const txn = this.parseLine(line, lines, i);
      if (txn) {
        result.transactions.push(txn);
      }
    }

    if (result.transactions.length === 0) {
      result.warnings.push('No transactions could be parsed. The format may not be supported.');
    }

    return result;
  }

  private shouldSkip(line: string): boolean {
    return this.skipPatterns.some((p) => p.test(line));
  }

  private parseLine(line: string, _lines: string[], _idx: number): ParsedTransaction | null {
    // Must contain a date
    let txnDate: Date | null = null;
    let dateStr = '';
    for (const pattern of this.datePatterns) {
      const m = line.match(pattern);
      if (m) {
        dateStr = m[1];
        txnDate = this.parseDate(dateStr);
        break;
      }
    }
    if (!txnDate) return null;

    // Remove date from line to isolate description and amounts
    const lineWithoutDate = line.replace(dateStr, '').trim();

    // Extract all numeric amounts from the line
    const amounts = this.extractAmounts(lineWithoutDate);
    if (amounts.length === 0) return null;

    // Determine debit/credit/balance
    // Common formats:
    //   desc  debit  credit  balance
    //   desc  amount  DR/CR  balance
    //   NEFT CR-code  amount  balance
    let debitAmount: number | undefined;
    let creditAmount: number | undefined;
    let balance: number | undefined;
    let description = lineWithoutDate;

    // Enhanced detection for CR/DR indicators:
    // 1. Look for CR/DR with amounts: "amount CR/DR balance" or "CR/DR amount balance"
    // 2. Look for CR/DR as standalone keywords in the narration: "NEFT CR", "CR-", "-DR", etc.
    // This handles formats like:
    //   - "68,700.00 CR 533,686.39" (amount then CR then balance)
    //   - "CR 68,700.00 533,686.39" (CR then amount then balance)
    //   - "NEFT CR-BOFA... 68,700.00 533,686.39" (CR in narration with amounts following)
    const crdrIndicatorMatch = lineWithoutDate.match(/\b(CR|DR)\b|\bCR-|CR\s|-DR\b|DR-/i);
    let transactionType: 'CR' | 'DR' | undefined = undefined;
    
    if (crdrIndicatorMatch) {
      const indicator = crdrIndicatorMatch[0].toUpperCase();
      transactionType = indicator.includes('CR') ? 'CR' : 'DR';
    }

    // Try amount + CR/DR pattern first
    const drMatch = lineWithoutDate.match(/(\b[\d,]+\.?\d{0,2})\s*([-\s]*)(?:cr|dr)([-\s]*)/i);
    if (drMatch) {
      const amt = this.parseAmount(drMatch[1]);
      const type = drMatch[0].toLowerCase();
      if (type.includes('dr')) debitAmount = amt;
      else if (type.includes('cr')) creditAmount = amt;
      description = lineWithoutDate.replace(drMatch[0], '').trim();
    } else if (transactionType && amounts.length >= 2) {
      // CR/DR indicator found but no amount+indicator pattern
      // Assume last 2 amounts are transaction amount and balance
      const transAmount = amounts[amounts.length - 2];
      const balanceAmount = amounts[amounts.length - 1];
      if (transactionType === 'CR') {
        creditAmount = transAmount;
      } else {
        debitAmount = transAmount;
      }
      balance = balanceAmount;
    } else if (amounts.length >= 3) {
      // Assume last = balance, second-to-last = credit or debit
      balance = amounts[amounts.length - 1];
      // Infer direction from balance change is not possible without previous balance
      // Put second-to-last in debit slot as heuristic; user can correct
      debitAmount = amounts[amounts.length - 2];
    } else if (amounts.length === 2) {
      debitAmount = amounts[0];
      balance = amounts[1];
    } else if (amounts.length === 1) {
      debitAmount = amounts[0];
    }

    // Extract description (text before the amounts)
    description = this.extractDescription(lineWithoutDate);

    // Try to extract reference number (alphanumeric, 8-20 chars)
    const refMatch = description.match(/\b([A-Z0-9]{8,20})\b/);
    const reference = refMatch ? refMatch[1] : undefined;

    if (!description || description.length < 3) return null;

    const txn: ParsedTransaction = {
      txnDate,
      description: description.substring(0, 300),
      reference,
      debitAmount,
      creditAmount,
      balance,
    };

    // Auto-classify based on description patterns
    this.autoClassify(txn);

    return txn;
  }

  /**
   * Auto-classify transactions based on description patterns.
   * Currently handles:
   * - Salary detection for 'Accenture' (credits to account, typically salary)
   */
  private autoClassify(txn: ParsedTransaction): void {
    const normalizedDesc = txn.description.toLowerCase();

    // Accenture salary detection
    if (normalizedDesc.includes('accenture')) {
      // Only auto-classify as salary if it's a credit (income)
      // Don't override if user has reason to classify differently
      if (txn.creditAmount !== undefined && txn.creditAmount > 0) {
        txn.suggestedCategory = 'salary';
        txn.classificationReason = 'accenture_keyword_match';
      }
    }
  }

  private extractAmounts(text: string): number[] {
    const matches = text.matchAll(/[\d,]+\.\d{2}/g);
    const amounts: number[] = [];
    for (const m of matches) {
      amounts.push(this.parseAmount(m[0]));
    }
    return amounts;
  }

  private extractDescription(text: string): string {
    // Remove amounts and keep the text portion
    return text
      .replace(/[\d,]+\.\d{2}/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private parseAmount(str: string): number {
    return parseFloat(str.replace(/,/g, ''));
  }

  parseDate(str: string): Date {
    // Try DD-MM-YYYY or DD/MM/YYYY
    let m = str.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`);

    // Try YYYY-MM-DD
    m = str.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
    if (m) return new Date(str);

    // Try DD-MM-YY
    m = str.match(/^(\d{2})[-\/](\d{2})[-\/](\d{2})$/);
    if (m) {
      const year = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`;
      return new Date(`${year}-${m[2]}-${m[1]}`);
    }

    // Try DD Mon YYYY
    m = str.match(/^(\d{2})\s+(\w{3})\s+(\d{4})$/);
    if (m) return new Date(`${m[1]} ${m[2]} ${m[3]}`);

    return new Date(str);
  }
}
