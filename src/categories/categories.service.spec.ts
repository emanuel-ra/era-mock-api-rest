import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: CategoriesRepository;

  const dto = (overrides: Partial<CreateCategoryDto> = {}): CreateCategoryDto => ({
    name: 'Home & Garden',
    ...overrides,
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CategoriesService, CategoriesRepository],
    }).compile();

    service = moduleRef.get(CategoriesService);
    repo = moduleRef.get(CategoriesRepository);
  });

  describe('create', () => {
    it('generates the slug from the name and fills defaults', () => {
      const created = service.create(dto());

      expect(created).toMatchObject({
        name: 'Home & Garden',
        slug: 'home-garden',
        description: '',
        isActive: true,
      });
      expect(repo.findById(created.id)).toBeDefined();
    });

    it('keeps a slug that was sent', () => {
      expect(service.create(dto({ slug: 'garden' })).slug).toBe('garden');
    });

    it('rejects a name that cannot produce a slug', () => {
      expect(() => service.create(dto({ name: '&& !!' }))).toThrow(BadRequestException);
    });

    it('rejects a duplicated name, ignoring case', () => {
      service.create(dto());

      expect(() => service.create(dto({ name: 'HOME & GARDEN', slug: 'other' }))).toThrow(
        ConflictException,
      );
    });

    it('rejects a duplicated slug', () => {
      service.create(dto());

      // "Home Garden" is a different name but generates the same slug.
      expect(() => service.create(dto({ name: 'Home Garden' }))).toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      service.create(dto({ name: 'Electronics' }));
      service.create(dto({ name: 'Electric Tools', isActive: false }));
      service.create(dto({ name: 'Books' }));
    });

    it('filters name by substring and isActive by value', () => {
      expect(service.findAll({ page: 1, limit: 10, name: 'elect' }).meta.total).toBe(2);
      expect(service.findAll({ page: 1, limit: 10, isActive: false }).data[0].name).toBe(
        'Electric Tools',
      );
    });

    it('paginates the results', () => {
      expect(service.findAll({ page: 2, limit: 2 }).data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.findOne('missing')).toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('keeps the slug when only the name changes', () => {
      const created = service.create(dto());

      expect(service.update(created.id, { name: 'Garden' })).toMatchObject({
        name: 'Garden',
        slug: 'home-garden',
      });
    });

    it('allows keeping the same name and slug', () => {
      const created = service.create(dto());

      expect(() =>
        service.update(created.id, { name: 'Home & Garden', slug: 'home-garden' }),
      ).not.toThrow();
    });

    it('rejects a name or slug that belongs to another category', () => {
      service.create(dto({ name: 'Books' }));
      const created = service.create(dto());

      expect(() => service.update(created.id, { name: 'books' })).toThrow(ConflictException);
      expect(() => service.update(created.id, { slug: 'books' })).toThrow(ConflictException);
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.update('missing', { description: 'x' })).toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the category', () => {
      const created = service.create(dto());

      service.remove(created.id);

      expect(repo.count()).toBe(0);
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.remove('missing')).toThrow(NotFoundException);
    });
  });
});
