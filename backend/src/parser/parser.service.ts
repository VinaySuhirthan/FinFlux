import { Injectable, Logger } from '@nestjs/common';
// pdf-parse uses CommonJS default export; use require() for compatibility
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
import * as fs from 'fs';
import * as path from 'path';
import { BankParser, ParseResult } from './interfaces/parser.interface';
import { GenericParser } from './strategies/generic.strategy';
import { HdfcParser } from './strategies/hdfc.strategy';
import { SbiParser } from './strategies/sbi.strategy';

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);
  private readonly parsers: BankParser[];
  private readonly fallbackParser: GenericParser;

  constructor() {
    this.fallbackParser = new GenericParser();
    // Order matters: more specific parsers first
    this.parsers = [new HdfcParser(), new SbiParser(), this.fallbackParser];
  }

  async parseFile(filePath: string, pdfPassword?: string): Promise<ParseResult> {
    this.logger.log(`Parsing file: ${filePath}`);

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.txt') {
      const text = fs.readFileSync(filePath, 'utf-8');
      this.logger.debug(`Read ${text.length} characters from TXT file`);
      return this.parseText(text);
    }

    if (ext === '.csv') {
      const text = fs.readFileSync(filePath, 'utf-8');
      this.logger.debug(`Read ${text.length} characters from CSV file`);
      const { parseTabularText } = require('./formats/tabular.parser');
      return parseTabularText(text);
    }

    if (ext === '.xlsx' || ext === '.xls') {
      const buffer = fs.readFileSync(filePath);
      const { parseXlsxBuffer } = require('./formats/xlsx.parser');
      return parseXlsxBuffer(buffer);
    }

    if (ext === '.json') {
      const text = fs.readFileSync(filePath, 'utf-8');
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          // Assume array of rows
          const rows = data;
          const transactions = rows.map((r: any) => {
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
          return { transactions, warnings: [], errors: [], skippedLines: [] } as ParseResult;
        } else if (typeof data === 'object' && data.text) {
          return this.parseText(data.text);
        }
      } catch (e) {
        throw new Error('Invalid JSON input');
      }
    }

    // Otherwise assume PDF (existing logic)
    const fileBuffer = fs.readFileSync(filePath);

    // Quick heuristic to detect encrypted/password-protected PDFs before calling pdf-parse
    // Search in the first 64KB for the /Encrypt keyword which indicates encryption
    const head = fileBuffer.slice(0, 65536).toString('latin1').toLowerCase();
    const isEncrypted = head.includes('/encrypt') || head.includes('/encrypted');

    if (isEncrypted && !pdfPassword) {
      throw new Error('Password required: PDF appears to be encrypted');
    }

    let pdfData;
    try {
      if (pdfPassword) {
        pdfData = await pdfParse(fileBuffer, { password: pdfPassword });
      } else {
        pdfData = await pdfParse(fileBuffer);
      }
    } catch (err: any) {
      // Normalize errors related to encryption/password so callers can handle them
      const msg = (err && err.message) ? err.message.toLowerCase() : '';
      const looksLikePasswordIssue = msg.includes('password') || msg.includes('encrypted') || msg.includes('decryption') || msg.includes('failed to decrypt') || msg.includes('incorrect');
      if (looksLikePasswordIssue) {
        throw new Error('Password required or incorrect password for PDF');
      }
      throw err;
    }

    const text = pdfData.text;

this.logger.debug(`Extracted ${text.length} characters from PDF`);
this.logger.debug(`EXTRACTED PDF TEXT:\n${text}`);

return this.parseText(text);
  }

  parseText(text: string): ParseResult {
    // Find the first parser that can handle this text
    const parser = this.parsers.find((p) => p.canHandle(text)) || this.fallbackParser;
    this.logger.log(`Using parser: ${parser.name}`);

    const result = parser.parse(text);
    result.transactions = result.transactions.filter((t) => {
      const d = t.txnDate;
      return d instanceof Date && !isNaN(d.getTime());
    });

    this.logger.log(
      `Parsed ${result.transactions.length} transactions, ${result.skippedLines.length} skipped lines`,
    );

    return result;
  }

  /** Normalize a description for classification matching */
  normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')   // remove special chars
      .replace(/\s+/g, ' ')        // collapse whitespace
      .trim();
  }
}
