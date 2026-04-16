import * as XLSX from 'xlsx';
import { parseTabularText } from './tabular.parser';
import { ParseResult } from '../interfaces/parser.interface';

export function parseXlsxBuffer(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return parseTabularText(csv, 'xlsx');
}
