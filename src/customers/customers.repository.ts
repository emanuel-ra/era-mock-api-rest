import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../core/repositories/in-memory.repository';
import { CustomerEntity } from './entities/customer.entity';

@Injectable()
export class CustomersRepository extends InMemoryRepository<CustomerEntity> {
  protected readonly searchableFields: ReadonlyArray<keyof CustomerEntity> = ['name', 'city'];

  findByEmail(email: string): CustomerEntity | undefined {
    return Array.from(this.store.values()).find(
      (c) => c.email.toLowerCase() === email.toLowerCase(),
    );
  }
}
