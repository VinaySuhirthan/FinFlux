import { IsString } from 'class-validator';

export class UpdateCategoryDto {
  @IsString()
  categoryId: string;
}
