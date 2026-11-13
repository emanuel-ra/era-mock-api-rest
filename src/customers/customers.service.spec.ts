import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderStatus } from '../orders/entities/order.entity';
import { OrdersRepository } from '../orders/orders.repository';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

describe('CustomersService', () => {
  let service: CustomersService;
  let repo: CustomersRepository;
  let ordersRepo: OrdersRepository;

  const dto = (overrides: Partial<CreateCustomerDto> = {}): CreateCustomerDto => ({
    name: 'Jane Doe',
    email: 'jane@example.com',
    ...overrides,
  });

  beforeEach(async () => {
    // The repository is in memory, so the tests use the real one.
    const moduleRef = await Test.createTestingModule({
      providers: [CustomersService, CustomersRepository, OrdersRepository],
    }).compile();

    service = moduleRef.get(CustomersService);
    repo = moduleRef.get(CustomersRepository);
    ordersRepo = moduleRef.get(OrdersRepository);
  });

  describe('create', () => {
    it('fills the optional fields with their defaults', () => {
      const created = service.create(dto());

      expect(created).toMatchObject({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '',
        address: '',
        city: '',
        country: '',
        company: '',
        isActive: true,
      });
      expect(repo.findById(created.id)).toBeDefined();
    });

    it('keeps the values that were sent', () => {
      const created = service.create(dto({ city: 'Monterrey', isActive: false }));

      expect(created).toMatchObject({ city: 'Monterrey', isActive: false });
    });

    it('rejects a duplicated email, ignoring case', () => {
      service.create(dto());

      expect(() => service.create(dto({ email: 'JANE@example.com' }))).toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      service.create(dto({ name: 'Ana López', email: 'ana@x.com', city: 'Monterrey', country: 'MX' }));
      service.create(dto({ name: 'Analía Ruiz', email: 'analia@x.com', city: 'Lima', country: 'PE', isActive: false }));
      service.create(dto({ name: 'Bruno Díaz', email: 'bruno@x.com', city: 'Monterrey', country: 'MX' }));
    });

    it('paginates the results', () => {
      const result = service.findAll({ page: 2, limit: 2 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 3, page: 2, limit: 2, totalPages: 2 });
    });

    it('filters name and city by substring', () => {
      expect(service.findAll({ page: 1, limit: 10, name: 'ana' }).meta.total).toBe(2);
      expect(service.findAll({ page: 1, limit: 10, city: 'monte' }).meta.total).toBe(2);
    });

    it('filters country exactly and isActive by value', () => {
      expect(service.findAll({ page: 1, limit: 10, country: 'mx' }).meta.total).toBe(2);
      expect(service.findAll({ page: 1, limit: 10, country: 'M' }).meta.total).toBe(0);
      expect(service.findAll({ page: 1, limit: 10, isActive: false }).data[0].name).toBe('Analía Ruiz');
    });
  });

  describe('findOne', () => {
    it('returns the customer', () => {
      const created = service.create(dto());

      expect(service.findOne(created.id)).toEqual(created);
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.findOne('missing')).toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('applies a partial update', () => {
      const created = service.create(dto());

      expect(service.update(created.id, { city: 'Lima' })).toMatchObject({
        name: 'Jane Doe',
        city: 'Lima',
      });
    });

    it('allows keeping the same email', () => {
      const created = service.create(dto());

      expect(() => service.update(created.id, { email: 'jane@example.com' })).not.toThrow();
    });

    it('rejects an email that belongs to another customer', () => {
      service.create(dto({ email: 'taken@example.com' }));
      const created = service.create(dto());

      expect(() => service.update(created.id, { email: 'taken@example.com' })).toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.update('missing', { city: 'Lima' })).toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the customer', () => {
      const created = service.create(dto());

      service.remove(created.id);

      expect(repo.findById(created.id)).toBeUndefined();
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.remove('missing')).toThrow(NotFoundException);
    });

    it('rejects deleting a customer that has orders', () => {
      const created = service.create(dto());
      ordersRepo.create({
        customerId: created.id,
        items: [],
        total: 0,
        status: OrderStatus.Pending,
        notes: '',
      });

      expect(() => service.remove(created.id)).toThrow(ConflictException);
      expect(repo.findById(created.id)).toBeDefined();
    });
  });
});
