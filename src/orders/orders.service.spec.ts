import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CustomersRepository } from '../customers/customers.repository';
import { ProductStatus } from '../products/entities/product.entity';
import { ProductsRepository } from '../products/products.repository';
import { OrderStatus } from './entities/order.entity';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

const UNKNOWN_ID = '11111111-1111-4111-8111-111111111111';

describe('OrdersService', () => {
  let service: OrdersService;
  let repo: OrdersRepository;
  let customersRepo: CustomersRepository;
  let productsRepo: ProductsRepository;
  let customerId: string;

  const createProduct = (name: string, price: number) =>
    productsRepo.create({
      name,
      description: '',
      price,
      sku: '',
      stock: 0,
      categoryId: null,
      status: ProductStatus.Active,
      imageUrl: '',
    });

  const createCustomer = (email: string) =>
    customersRepo.create({
      name: 'Jane Doe',
      email,
      phone: '',
      address: '',
      city: '',
      country: '',
      company: '',
      isActive: true,
    });

  /** Moves the order through the allowed transitions until it reaches `status`. */
  const createOrderWithStatus = (status: OrderStatus) => {
    const product = createProduct('Mouse', 10);
    const order = service.create({ customerId, items: [{ productId: product.id, quantity: 1 }] });
    const path: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.Pending]: [],
      [OrderStatus.Paid]: [OrderStatus.Paid],
      [OrderStatus.Shipped]: [OrderStatus.Paid, OrderStatus.Shipped],
      [OrderStatus.Delivered]: [OrderStatus.Paid, OrderStatus.Shipped, OrderStatus.Delivered],
      [OrderStatus.Cancelled]: [OrderStatus.Cancelled],
    };
    for (const next of path[status]) service.updateStatus(order.id, { status: next });
    return service.findOne(order.id);
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OrdersService, OrdersRepository, CustomersRepository, ProductsRepository],
    }).compile();

    service = moduleRef.get(OrdersService);
    repo = moduleRef.get(OrdersRepository);
    customersRepo = moduleRef.get(CustomersRepository);
    productsRepo = moduleRef.get(ProductsRepository);
    customerId = createCustomer('jane@example.com').id;
  });

  describe('create', () => {
    it('copies product name and price, computes subtotals and total, and starts pending', () => {
      const mouse = createProduct('Mouse', 19.99);
      const cable = createProduct('Cable', 0.1);

      const order = service.create({
        customerId,
        items: [
          { productId: mouse.id, quantity: 3 },
          { productId: cable.id, quantity: 3 },
        ],
      });

      expect(order).toMatchObject({
        customerId,
        status: OrderStatus.Pending,
        notes: '',
        total: 60.27,
        items: [
          { productId: mouse.id, productName: 'Mouse', unitPrice: 19.99, quantity: 3, subtotal: 59.97 },
          { productId: cable.id, productName: 'Cable', unitPrice: 0.1, quantity: 3, subtotal: 0.3 },
        ],
      });
      expect(repo.findById(order.id)).toBeDefined();
    });

    it('does not change the product stock', () => {
      const product = productsRepo.update(createProduct('Mouse', 10).id, { stock: 5 })!;

      service.create({ customerId, items: [{ productId: product.id, quantity: 4 }] });

      expect(productsRepo.findById(product.id)?.stock).toBe(5);
    });

    it('keeps the copied price when the product changes later', () => {
      const product = createProduct('Mouse', 10);
      const order = service.create({ customerId, items: [{ productId: product.id, quantity: 1 }] });

      productsRepo.update(product.id, { price: 99 });

      expect(service.findOne(order.id).items[0].unitPrice).toBe(10);
    });

    it('rejects an unknown customer or product', () => {
      const product = createProduct('Mouse', 10);

      expect(() =>
        service.create({ customerId: UNKNOWN_ID, items: [{ productId: product.id, quantity: 1 }] }),
      ).toThrow(BadRequestException);
      expect(() =>
        service.create({ customerId, items: [{ productId: UNKNOWN_ID, quantity: 1 }] }),
      ).toThrow(BadRequestException);
      expect(repo.count()).toBe(0);
    });
  });

  describe('findAll', () => {
    it('filters by customerId and status and paginates', () => {
      const other = createCustomer('other@example.com').id;
      const product = createProduct('Mouse', 10);
      const items = [{ productId: product.id, quantity: 1 }];
      const paid = service.create({ customerId, items });
      service.updateStatus(paid.id, { status: OrderStatus.Paid });
      service.create({ customerId, items });
      service.create({ customerId: other, items });

      expect(service.findAll({ page: 1, limit: 10, customerId }).meta.total).toBe(2);
      expect(service.findAll({ page: 1, limit: 10, status: OrderStatus.Paid }).data[0].id).toBe(
        paid.id,
      );
      expect(service.findAll({ page: 2, limit: 2 }).data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.findOne('missing')).toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('replaces the items and recomputes the total with current prices', () => {
      const order = createOrderWithStatus(OrderStatus.Pending);
      const keyboard = createProduct('Keyboard', 45.5);

      const updated = service.update(order.id, {
        items: [{ productId: keyboard.id, quantity: 2 }],
        notes: 'Gift',
      });

      expect(updated).toMatchObject({ total: 91, notes: 'Gift', customerId });
      expect(updated.items).toEqual([
        { productId: keyboard.id, productName: 'Keyboard', unitPrice: 45.5, quantity: 2, subtotal: 91 },
      ]);
    });

    it('changes only the fields sent', () => {
      const order = createOrderWithStatus(OrderStatus.Pending);
      const other = createCustomer('other@example.com').id;

      const updated = service.update(order.id, { customerId: other });

      expect(updated).toMatchObject({ customerId: other, items: order.items, total: order.total });
    });

    it('rejects an unknown customer or product', () => {
      const order = createOrderWithStatus(OrderStatus.Pending);

      expect(() => service.update(order.id, { customerId: UNKNOWN_ID })).toThrow(BadRequestException);
      expect(() =>
        service.update(order.id, { items: [{ productId: UNKNOWN_ID, quantity: 1 }] }),
      ).toThrow(BadRequestException);
    });

    it.each([OrderStatus.Paid, OrderStatus.Shipped, OrderStatus.Delivered, OrderStatus.Cancelled])(
      'rejects editing a %s order',
      (status) => {
        const order = createOrderWithStatus(status);

        expect(() => service.update(order.id, { notes: 'late change' })).toThrow(ConflictException);
      },
    );

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.update('missing', { notes: 'x' })).toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it.each([
      [OrderStatus.Pending, OrderStatus.Paid],
      [OrderStatus.Pending, OrderStatus.Cancelled],
      [OrderStatus.Paid, OrderStatus.Shipped],
      [OrderStatus.Paid, OrderStatus.Cancelled],
      [OrderStatus.Shipped, OrderStatus.Delivered],
    ])('allows %s -> %s', (from, to) => {
      const order = createOrderWithStatus(from);

      expect(service.updateStatus(order.id, { status: to }).status).toBe(to);
    });

    it.each([
      [OrderStatus.Pending, OrderStatus.Pending],
      [OrderStatus.Pending, OrderStatus.Shipped],
      [OrderStatus.Paid, OrderStatus.Pending],
      [OrderStatus.Shipped, OrderStatus.Cancelled],
      [OrderStatus.Delivered, OrderStatus.Cancelled],
      [OrderStatus.Cancelled, OrderStatus.Paid],
    ])('rejects %s -> %s', (from, to) => {
      const order = createOrderWithStatus(from);

      expect(() => service.updateStatus(order.id, { status: to })).toThrow(ConflictException);
      expect(service.findOne(order.id).status).toBe(from);
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.updateStatus('missing', { status: OrderStatus.Paid })).toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the order', () => {
      const order = createOrderWithStatus(OrderStatus.Delivered);

      service.remove(order.id);

      expect(repo.count()).toBe(0);
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.remove('missing')).toThrow(NotFoundException);
    });
  });
});
