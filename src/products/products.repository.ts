import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../core/repositories/in-memory.repository';
import { ProductEntity } from './entities/product.entity';

@Injectable()
export class ProductsRepository extends InMemoryRepository<ProductEntity> {
  protected readonly searchableFields: ReadonlyArray<keyof ProductEntity> = ['name'];

  countByCategory(categoryId: string): number {
    return Array.from(this.store.values()).filter((p) => p.categoryId === categoryId).length;
  }

  findBySku(sku: string): ProductEntity | undefined {
    return Array.from(this.store.values()).find(
      (p) => p.sku?.toLowerCase() === sku.toLowerCase(),
    );
  }
}
