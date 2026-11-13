import { PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

/** Only allowed while the order is `pending`. Sending `items` replaces the whole list. */
export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
