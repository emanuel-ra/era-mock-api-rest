import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../core/dto/pagination.dto';
import { OrderEntity, OrderStatus } from '../entities/order.entity';

export const ORDER_SORT_FIELDS = ['total', 'status', 'createdAt'] as const satisfies ReadonlyArray<
  keyof OrderEntity
>;

export class FilterOrdersDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: ORDER_SORT_FIELDS,
    description: 'Field to sort by. Without it the default order is kept.',
  })
  @IsOptional()
  @IsIn(ORDER_SORT_FIELDS)
  sortBy?: (typeof ORDER_SORT_FIELDS)[number];
}
