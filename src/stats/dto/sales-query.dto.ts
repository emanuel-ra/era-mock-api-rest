import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches } from 'class-validator';

export enum SalesGroupBy {
  Day = 'day',
  Month = 'month',
}

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export class SalesQueryDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'First day included (UTC). Defaults to 29 days before `to`.',
  })
  @IsOptional()
  @Matches(DATE_FORMAT, { message: 'from must be a date in YYYY-MM-DD format' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-01-31',
    description: 'Last day included (UTC). Defaults to today.',
  })
  @IsOptional()
  @Matches(DATE_FORMAT, { message: 'to must be a date in YYYY-MM-DD format' })
  to?: string;

  @ApiPropertyOptional({ enum: SalesGroupBy, default: SalesGroupBy.Day })
  @IsOptional()
  @IsEnum(SalesGroupBy)
  groupBy: SalesGroupBy = SalesGroupBy.Day;
}
