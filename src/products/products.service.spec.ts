import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductStatus } from './entities/product.entity';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: ProductsRepository;

  const dto = (overrides: Partial<CreateProductDto> = {}): CreateProductDto => ({
    name: 'Wireless Mouse',
    price: 29.99,
    ...overrides,
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ProductsService, ProductsRepository],
    }).compile();

    service = moduleRef.get(ProductsService);
    repo = moduleRef.get(ProductsRepository);
  });

  describe('create', () => {
    it('fills the optional fields with their defaults', () => {
      const created = service.create(dto());

      expect(created).toMatchObject({
        name: 'Wireless Mouse',
        price: 29.99,
        description: '',
        sku: '',
        stock: 0,
        category: 'Uncategorized',
        status: ProductStatus.Active,
        imageUrl: '',
      });
      expect(repo.findById(created.id)).toBeDefined();
    });

    it('rejects a duplicated SKU, ignoring case', () => {
      service.create(dto({ sku: 'WM-001' }));

      expect(() => service.create(dto({ sku: 'wm-001' }))).toThrow(ConflictException);
    });

    it('allows several products without SKU', () => {
      service.create(dto());

      expect(() => service.create(dto())).not.toThrow();
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      service.create(dto({ name: 'Wireless Mouse', category: 'Electronics' }));
      service.create(dto({ name: 'Gaming Mouse', category: 'Electronics', status: ProductStatus.Inactive }));
      service.create(dto({ name: 'Running Shoes', category: 'Sports', status: ProductStatus.OutOfStock }));
    });

    it('filters name by substring', () => {
      expect(service.findAll({ page: 1, limit: 10, name: 'mouse' }).meta.total).toBe(2);
    });

    it('filters category exactly', () => {
      expect(service.findAll({ page: 1, limit: 10, category: 'electronics' }).meta.total).toBe(2);
      expect(service.findAll({ page: 1, limit: 10, category: 'Elec' }).meta.total).toBe(0);
    });

    it('filters status exactly, so "active" does not match "inactive"', () => {
      const result = service.findAll({ page: 1, limit: 10, status: ProductStatus.Active });

      expect(result.data.map((p) => p.name)).toEqual(['Wireless Mouse']);
    });

    it('paginates the results', () => {
      expect(service.findAll({ page: 1, limit: 2 }).meta).toEqual({
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.findOne('missing')).toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('applies a partial update', () => {
      const created = service.create(dto());

      expect(service.update(created.id, { stock: 5 })).toMatchObject({ name: 'Wireless Mouse', stock: 5 });
    });

    it('allows keeping the same SKU', () => {
      const created = service.create(dto({ sku: 'WM-001' }));

      expect(() => service.update(created.id, { sku: 'WM-001' })).not.toThrow();
    });

    it('rejects a SKU that belongs to another product', () => {
      service.create(dto({ sku: 'TAKEN' }));
      const created = service.create(dto({ sku: 'WM-001' }));

      expect(() => service.update(created.id, { sku: 'TAKEN' })).toThrow(ConflictException);
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.update('missing', { stock: 1 })).toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the product', () => {
      const created = service.create(dto());

      service.remove(created.id);

      expect(repo.count()).toBe(0);
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.remove('missing')).toThrow(NotFoundException);
    });
  });
});
