export interface ParsedTransaction {
  txnDate: Date;
  description: string;
  reference?: string;
  debitAmount?: number;
  creditAmount?: number;
  balance?: number;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  bankName?: string;
  statementPeriodStart?: Date;
  statementPeriodEnd?: Date;
  warnings: string[];
  errors: string[];
  skippedLines: string[];
}

export interface BankParser {
  name: string;
  /** Returns true if this parser can handle the given text */
  canHandle(text: string): boolean;
  parse(text: string): ParseResult;
}
