import { NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { IRepository } from '../interfaces/base-repository.interface';

export abstract class InMemoryRepository<
  T extends { id: string; createdAt: Date; updatedAt: Date },
> implements IRepository<T>
{
  protected store: Map<string, T> = new Map();

  findAll(filters?: Partial<Omit<T, 'id'>>): T[] {
    const all = Array.from(this.store.values());
    if (!filters || Object.keys(filters).length === 0) return all;

    return all.filter((item) =>
      Object.entries(filters).every(([key, value]) => {
        if (value === undefined || value === null) return true;
        const itemValue = (item as Record<string, unknown>)[key];
        if (typeof value === 'string') {
          return String(itemValue).toLowerCase().includes(value.toLowerCase());
        }
        return itemValue === value;
      }),
    );
  }

  findById(id: string): T | undefined {
    return this.store.get(id);
  }

  findByIdOrFail(id: string): T {
    const entity = this.store.get(id);
    if (!entity) throw new NotFoundException(`Resource with id "${id}" not found`);
    return entity;
  }

  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): T {
    const now = new Date();
    const entity = { ...data, id: uuidv4(), createdAt: now, updatedAt: now } as unknown as T;
    this.store.set(entity.id, entity);
    return entity;
  }

  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): T | undefined {
    const existing = this.store.get(id);
    if (!existing) return undefined;
    const updated: T = { ...existing, ...data, id, createdAt: existing.createdAt, updatedAt: new Date() };
    this.store.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  count(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
