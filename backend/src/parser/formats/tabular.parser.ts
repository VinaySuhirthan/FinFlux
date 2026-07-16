import { ParseResult, ParsedTransaction } from '../interfaces/parser.interface';

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tryParseDate(s: string): Date | null {
  if (!s) return null;
  s = s.trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{2})[-\/]?(\d{2})[-\/]?(\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`);
  return null;
}

function tryParseAmount(s: any): number | null {
  if (s === undefined || s === null) return null;
  if (typeof s === 'number') return s;
  const st = String(s).replace(/[^0-9.\-]/g, '');
  if (st === '') return null;
  const v = parseFloat(st);
  return isNaN(v) ? null : v;
}

export function parseTabularText(text: string, source = 'import'): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { transactions: [], warnings: ['Empty input'], errors: [], skippedLines: [] } as ParseResult;
  }

  const first = lines[0];
  let delim = ',';
  if (first.includes('|')) delim = '|';
  else if (first.includes('\t')) delim = '\t';
  else if (first.includes(';')) delim = ';';

  const header = lines[0].split(delim).map((h) => normalizeHeader(h));
  const hasHeader = header.some((h) => /date|desc|description|amount|category|source/.test(h));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const result: ParseResult = { transactions: [], warnings: [], errors: [], skippedLines: [] } as ParseResult;

  for (const line of dataLines) {
    const cols = line.split(delim).map((c) => c.trim());
    const row: any = {};
    if (hasHeader) {
      for (let i = 0; i < header.length; i++) {
        row[header[i]] = cols[i] ?? '';
      }
    } else {
      row['date'] = cols[0] ?? '';
      row['description'] = cols[1] ?? '';
      row['amount'] = cols[2] ?? '';
    }

    const txnDate = tryParseDate(row['date'] || row['transactiondate'] || row['txn_date'] || '');
    const description = row['description'] || row['desc'] || row['narration'] || '';
    const category = row['category'] || '';
    const amount = tryParseAmount(row['amount'] || row['amt'] || row['debit'] || row['credit']);

    if (!txnDate || amount === null) {
      result.skippedLines.push(line);
      continue;
    }

    const debitAmount = amount < 0 ? Math.abs(amount) : undefined;
    const creditAmount = amount > 0 ? amount : undefined;

    const txn: ParsedTransaction = {
      txnDate,
      description: String(description).substring(0, 300),
      reference: undefined,
      debitAmount: debitAmount ?? undefined,
      creditAmount: creditAmount ?? undefined,
      balance: undefined,
    };
    result.transactions.push(txn);
  }

  if (result.transactions.length === 0) result.warnings.push('No transactions parsed from tabular input');
  return result;
}
