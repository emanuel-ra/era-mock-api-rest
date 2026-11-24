import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../core/dto/pagination.dto';
import { ProductEntity, ProductStatus } from '../entities/product.entity';

export const PRODUCT_SORT_FIELDS = [
  'name',
  'price',
  'stock',
  'createdAt',
] as const satisfies ReadonlyArray<keyof ProductEntity>;

export class FilterProductsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({
    enum: PRODUCT_SORT_FIELDS,
    description: 'Field to sort by. Without it the default order is kept.',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORT_FIELDS)
  sortBy?: (typeof PRODUCT_SORT_FIELDS)[number];
}
