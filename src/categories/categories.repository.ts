import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../core/repositories/in-memory.repository';
import { CategoryEntity } from './entities/category.entity';

@Injectable()
export class CategoriesRepository extends InMemoryRepository<CategoryEntity> {
  protected readonly searchableFields: ReadonlyArray<keyof CategoryEntity> = ['name'];

  findByName(name: string): CategoryEntity | undefined {
    return Array.from(this.store.values()).find(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
  }

  findBySlug(slug: string): CategoryEntity | undefined {
    return Array.from(this.store.values()).find(
      (c) => c.slug.toLowerCase() === slug.toLowerCase(),
    );
  }
}
