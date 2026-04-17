export interface ParsedTransaction {
  txnDate: Date;
  description: string;
  reference?: string;
  debitAmount?: number;
  creditAmount?: number;
  balance?: number;
  suggestedCategory?: string; // e.g., 'salary', 'food', etc.
  classificationReason?: string; // e.g., 'accenture_keyword_match'
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
