import { Injectable, Logger } from '@nestjs/common';
// pdf-parse uses CommonJS default export; use require() for compatibility
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
import * as fs from 'fs';
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

  async parseFile(filePath: string): Promise<ParseResult> {
    this.logger.log(`Parsing file: ${filePath}`);

    const fileBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(fileBuffer);
    const text = pdfData.text;

    this.logger.debug(`Extracted ${text.length} characters from PDF`);

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
