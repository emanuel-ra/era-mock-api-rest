import { NotFoundException } from '@nestjs/common';
import { InMemoryRepository } from './in-memory.repository';

interface Item {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  status: string;
  stock: number;
  isActive: boolean;
}

// InMemoryRepository is abstract, so tests use a minimal concrete subclass.
class ItemsRepository extends InMemoryRepository<Item> {
  protected readonly searchableFields: ReadonlyArray<keyof Item> = ['name'];
}

type NewItem = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>;

const item = (overrides: Partial<NewItem> = {}): NewItem => ({
  name: 'Wireless Mouse',
  status: 'active',
  stock: 10,
  isActive: true,
  ...overrides,
});

describe('InMemoryRepository', () => {
  let repo: ItemsRepository;

  beforeEach(() => {
    repo = new ItemsRepository();
  });

  describe('create', () => {
    it('assigns a uuid and timestamps', () => {
      const created = repo.create(item());

      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toEqual(created.createdAt);
      expect(repo.findById(created.id)).toEqual(created);
    });

    it('uses the given id when provided', () => {
      const created = repo.create(item(), 'fixed-id');

      expect(created.id).toBe('fixed-id');
      expect(repo.findById('fixed-id')).toBeDefined();
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      repo.create(item({ name: 'Wireless Mouse', status: 'active', stock: 10 }));
      repo.create(item({ name: 'Gaming Mouse', status: 'inactive', stock: 0, isActive: false }));
      repo.create(item({ name: 'Keyboard', status: 'active', stock: 5 }));
    });

    it('returns everything without filters', () => {
      expect(repo.findAll()).toHaveLength(3);
      expect(repo.findAll({})).toHaveLength(3);
    });

    it('matches searchable fields by case-insensitive substring', () => {
      const result = repo.findAll({ name: 'MOUSE' });

      expect(result.map((i) => i.name)).toEqual(['Wireless Mouse', 'Gaming Mouse']);
    });

    it('matches other string fields exactly, so "active" does not match "inactive"', () => {
      const result = repo.findAll({ status: 'ACTIVE' });

      expect(result.map((i) => i.name)).toEqual(['Wireless Mouse', 'Keyboard']);
    });

    it('matches non-string values with strict equality', () => {
      expect(repo.findAll({ stock: 0 }).map((i) => i.name)).toEqual(['Gaming Mouse']);
      expect(repo.findAll({ isActive: false })).toHaveLength(1);
    });

    it('ignores undefined and null filter values', () => {
      expect(repo.findAll({ name: undefined, status: null as unknown as string })).toHaveLength(3);
    });

    it('combines filters with AND', () => {
      const result = repo.findAll({ name: 'mouse', status: 'active' });

      expect(result.map((i) => i.name)).toEqual(['Wireless Mouse']);
    });
  });

  describe('findByIdOrFail', () => {
    it('returns the entity when it exists', () => {
      const created = repo.create(item());

      expect(repo.findByIdOrFail(created.id)).toEqual(created);
    });

    it('throws NotFoundException when it does not exist', () => {
      expect(() => repo.findByIdOrFail('missing')).toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('merges the data and refreshes updatedAt', () => {
      jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
      const created = repo.create(item());
      jest.setSystemTime(new Date('2026-01-02T00:00:00Z'));

      const updated = repo.update(created.id, { stock: 99 });

      expect(updated).toMatchObject({ name: created.name, stock: 99 });
      expect(updated?.createdAt).toEqual(created.createdAt);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
      jest.useRealTimers();
    });

    it('does not let the data overwrite id or createdAt', () => {
      const created = repo.create(item());

      const updated = repo.update(created.id, {
        id: 'hacked',
        createdAt: new Date(0),
      } as Partial<Item>);

      expect(updated?.id).toBe(created.id);
      expect(updated?.createdAt).toEqual(created.createdAt);
    });

    it('returns undefined for an unknown id', () => {
      expect(repo.update('missing', { stock: 1 })).toBeUndefined();
    });
  });

  describe('delete, count and clear', () => {
    it('deletes by id and reports whether something was removed', () => {
      const created = repo.create(item());

      expect(repo.delete(created.id)).toBe(true);
      expect(repo.delete(created.id)).toBe(false);
      expect(repo.count()).toBe(0);
    });

    it('counts and clears the store', () => {
      repo.create(item());
      repo.create(item());
      expect(repo.count()).toBe(2);

      repo.clear();

      expect(repo.count()).toBe(0);
    });
  });
});
