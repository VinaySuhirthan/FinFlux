import {
  BankParser,
  ParseResult,
  ParsedTransaction,
} from '../interfaces/parser.interface';

import { GenericParser } from './generic.strategy';

export class HdfcParser implements BankParser {
  name = 'HDFC';

  private generic = new GenericParser();

  canHandle(text: string): boolean {
    return /HDFC\s+BANK|HDFC\s+BANK\s+LIMITED/i.test(text);
  }

  parse(text: string): ParseResult {
  const result: ParseResult = {
    transactions: [], warnings: [], errors: [], skippedLines: [],
    bankName: 'HDFC Bank',
  };

  const normalized = text
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const periodMatch = normalized.match(
    /From\s*:?\s*(\d{2}\/\d{2}\/\d{4})\s*To\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
  );
  if (periodMatch) {
    result.statementPeriodStart = this.generic.parseDate(periodMatch[1]);
    result.statementPeriodEnd = this.generic.parseDate(periodMatch[2]);
  }

  // A properly-grouped decimal number: 1,234.56 or 12.34 or 8,154.05
  const numToken = '(?:\\d{1,3}(?:,\\d{3})*|\\d+)\\.\\d{2}';
  // Core anchor: 16-digit RefNo + DD/MM/YY + Amount + Balance, all glued with no separators
  const coreRegex = new RegExp(
    `(\\d{16})(\\d{2}\\/\\d{2}\\/\\d{2})(${numToken})(${numToken})`,
    'g',
  );
  const cores = [...normalized.matchAll(coreRegex)];

  if (cores.length === 0) {
    result.errors.push('No HDFC transaction rows found.');
    return result;
  }

  let prevEnd = 0;
  let previousBalance: number | null = null;
  const rawTxns: { txnDateStr: string; narration: string; ref: string; amount: number; balance: number }[] = [];

  for (const core of cores) {
    const coreStart = core.index!;
    const coreEnd = coreStart + core[0].length;
    const preText = normalized.slice(prevEnd, coreStart).trim();

    const dateMatches = [...preText.matchAll(/\d{2}\/\d{2}\/\d{2}/g)];
    if (dateMatches.length === 0) { prevEnd = coreEnd; continue; }

    const lastDate = dateMatches[dateMatches.length - 1];
    const txnDateStr = lastDate[0];
    const tailOfPrev = preText.slice(0, lastDate.index).trim();
    const headOfThis = preText.slice(lastDate.index! + txnDateStr.length).trim();

    if (tailOfPrev && rawTxns.length > 0) {
      rawTxns[rawTxns.length - 1].narration += ' ' + tailOfPrev;
    }

    rawTxns.push({
      txnDateStr,
      narration: headOfThis,
      ref: core[1],
      amount: parseFloat(core[3].replace(/,/g, '')),
      balance: parseFloat(core[4].replace(/,/g, '')),
    });

    prevEnd = coreEnd;
  }

  const finalTail = normalized.slice(prevEnd).trim();
  if (finalTail && rawTxns.length > 0 && !/STATEMENT SUMMARY|Opening Balance|Generated On/i.test(finalTail)) {
    rawTxns[rawTxns.length - 1].narration += ' ' + finalTail;
  }

  for (const t of rawTxns) {
    const txnDate = this.generic.parseDate(t.txnDateStr);
    if (!(txnDate instanceof Date) || isNaN(txnDate.getTime())) continue;

    const narration = t.narration.replace(/\s+/g, ' ').trim();
    if (narration.length < 2) continue;
    if (/statement summary|opening balance|closing balance|account branch|account no|generated on/i.test(narration)) continue;

    let debitAmount: number | undefined;
    let creditAmount: number | undefined;

    if (previousBalance !== null) {
      const diff = t.balance - previousBalance;
      if (diff < 0) debitAmount = t.amount;
      else if (diff > 0) creditAmount = t.amount;
    }
    if (!debitAmount && !creditAmount) {
      if (/salary|refund|credit|interest|cash deposit|imps from|neft from|upi\/cr/i.test(narration)) {
        creditAmount = t.amount;
      } else {
        debitAmount = t.amount;
      }
    }

    result.transactions.push({
      txnDate,
      description: narration.substring(0, 300),
      reference: t.ref.replace(/^0+/, '') || t.ref,
      debitAmount,
      creditAmount,
      balance: t.balance,
    });

    previousBalance = t.balance;
  }

  if (result.transactions.length === 0) {
    result.errors.push('HDFC detected but transaction blocks could not be parsed.');
  }

  return result;
}
}