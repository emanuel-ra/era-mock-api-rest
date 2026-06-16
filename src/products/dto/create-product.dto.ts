import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';
import { ProductStatus } from '../entities/product.entity';

export class CreateProductDto {
  @ApiProperty({ example: 'Wireless Mouse' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Ergonomic wireless mouse' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 29.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ example: 'WM-001' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 'Electronics' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.Active })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
