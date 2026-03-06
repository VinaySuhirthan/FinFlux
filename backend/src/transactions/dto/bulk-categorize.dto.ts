import { IsArray, IsString } from 'class-validator';

export class BulkCategorizeDto {
  @IsArray()
  @IsString({ each: true })
  transactionIds: string[];

  @IsString()
  categoryId: string;
}
