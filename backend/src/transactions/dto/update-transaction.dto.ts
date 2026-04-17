import { IsOptional, IsString, IsNumber, IsDateString, IsEnum } from 'class-validator';

export enum TransactionType {
  CREDIT = 'CR',
  DEBIT = 'DR',
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsDateString()
  txnDate?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
