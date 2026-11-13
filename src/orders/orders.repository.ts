import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../core/repositories/in-memory.repository';
import { OrderEntity } from './entities/order.entity';

@Injectable()
export class OrdersRepository extends InMemoryRepository<OrderEntity> {
  countByCustomer(customerId: string): number {
    return Array.from(this.store.values()).filter((o) => o.customerId === customerId).length;
  }
}
