import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @ApiProperty({ format: 'uuid', description: 'Id of an existing product.' })
  @IsUUID('4')
  productId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ format: 'uuid', description: 'Id of an existing customer.' })
  @IsUUID('4')
  customerId: string;

  @ApiProperty({ type: [OrderItemDto], description: 'At least one item; each product only once.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: OrderItemDto) => item.productId, {
    message: 'items must not repeat the same productId',
  })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({ example: 'Leave at the front desk' })
  @IsOptional()
  @IsString()
  notes?: string;
}
