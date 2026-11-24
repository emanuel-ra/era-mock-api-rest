import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../core/dto/pagination.dto';
import { CategoryEntity } from '../entities/category.entity';

export const CATEGORY_SORT_FIELDS = ['name', 'createdAt'] as const satisfies ReadonlyArray<
  keyof CategoryEntity
>;

export class FilterCategoriesDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: CATEGORY_SORT_FIELDS,
    description: 'Field to sort by. Without it the default order is kept.',
  })
  @IsOptional()
  @IsIn(CATEGORY_SORT_FIELDS)
  sortBy?: (typeof CATEGORY_SORT_FIELDS)[number];
}
