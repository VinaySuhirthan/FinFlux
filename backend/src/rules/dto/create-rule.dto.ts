import { IsString, IsIn, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateRuleDto {
  @IsString()
  pattern: string;

  @IsIn(['KEYWORD', 'REGEX'])
  patternType: 'KEYWORD' | 'REGEX';

  @IsString()
  categoryId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  pattern?: string;

  @IsOptional()
  @IsIn(['KEYWORD', 'REGEX'])
  patternType?: 'KEYWORD' | 'REGEX';

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
