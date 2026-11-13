import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { SLUG_PATTERN } from '../../core/utils/slugify';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Home & Garden' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({
    example: 'home-garden',
    description: 'Generated from the name when omitted.',
  })
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'slug must contain only lowercase letters, numbers and single dashes',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'Furniture, decoration and gardening tools' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
