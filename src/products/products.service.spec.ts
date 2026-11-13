import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CategoriesRepository } from '../categories/categories.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductStatus } from './entities/product.entity';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: ProductsRepository;
  let electronicsId: string;
  let sportsId: string;

  const UNKNOWN_CATEGORY = '11111111-1111-4111-8111-111111111111';

  const dto = (overrides: Partial<CreateProductDto> = {}): CreateProductDto => ({
    name: 'Wireless Mouse',
    price: 29.99,
    ...overrides,
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ProductsService, ProductsRepository, CategoriesRepository],
    }).compile();

    service = moduleRef.get(ProductsService);
    repo = moduleRef.get(ProductsRepository);

    const categories = moduleRef.get(CategoriesRepository);
    const category = (name: string) =>
      categories.create({ name, slug: name.toLowerCase(), description: '', isActive: true }).id;
    electronicsId = category('Electronics');
    sportsId = category('Sports');
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
        categoryId: null,
        status: ProductStatus.Active,
        imageUrl: '',
      });
      expect(repo.findById(created.id)).toBeDefined();
    });

    it('accepts an existing category', () => {
      expect(service.create(dto({ categoryId: electronicsId })).categoryId).toBe(electronicsId);
    });

    it('rejects a category that does not exist', () => {
      expect(() => service.create(dto({ categoryId: UNKNOWN_CATEGORY }))).toThrow(
        BadRequestException,
      );
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
      service.create(dto({ name: 'Wireless Mouse', categoryId: electronicsId }));
      service.create(
        dto({ name: 'Gaming Mouse', categoryId: electronicsId, status: ProductStatus.Inactive }),
      );
      service.create(
        dto({ name: 'Running Shoes', categoryId: sportsId, status: ProductStatus.OutOfStock }),
      );
    });

    it('filters name by substring', () => {
      expect(service.findAll({ page: 1, limit: 10, name: 'mouse' }).meta.total).toBe(2);
    });

    it('filters by categoryId', () => {
      expect(service.findAll({ page: 1, limit: 10, categoryId: electronicsId }).meta.total).toBe(2);
      expect(service.findAll({ page: 1, limit: 10, categoryId: sportsId }).data[0].name).toBe(
        'Running Shoes',
      );
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

      expect(service.update(created.id, { stock: 5 })).toMatchObject({
        name: 'Wireless Mouse',
        stock: 5,
      });
    });

    it('changes and removes the category', () => {
      const created = service.create(dto({ categoryId: electronicsId }));

      expect(service.update(created.id, { categoryId: sportsId }).categoryId).toBe(sportsId);
      expect(service.update(created.id, { categoryId: null }).categoryId).toBeNull();
    });

    it('rejects a category that does not exist', () => {
      const created = service.create(dto());

      expect(() => service.update(created.id, { categoryId: UNKNOWN_CATEGORY })).toThrow(
        BadRequestException,
      );
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
