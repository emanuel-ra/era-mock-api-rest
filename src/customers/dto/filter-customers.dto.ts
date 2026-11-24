import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../core/dto/pagination.dto';
import { CustomerEntity } from '../entities/customer.entity';

export const CUSTOMER_SORT_FIELDS = [
  'name',
  'email',
  'city',
  'createdAt',
] as const satisfies ReadonlyArray<keyof CustomerEntity>;

export class FilterCustomersDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: CUSTOMER_SORT_FIELDS,
    description: 'Field to sort by. Without it the default order is kept.',
  })
  @IsOptional()
  @IsIn(CUSTOMER_SORT_FIELDS)
  sortBy?: (typeof CUSTOMER_SORT_FIELDS)[number];
}
