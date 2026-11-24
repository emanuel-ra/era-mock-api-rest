import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CustomersRepository } from '../customers/customers.repository';
import { OrderItem, OrderStatus } from '../orders/entities/order.entity';
import { OrdersRepository } from '../orders/orders.repository';
import { ProductStatus } from '../products/entities/product.entity';
import { ProductsRepository } from '../products/products.repository';
import { SalesGroupBy } from './dto/sales-query.dto';
import { StatsService } from './stats.service';

describe('StatsService', () => {
  let service: StatsService;
  let customersRepo: CustomersRepository;
  let productsRepo: ProductsRepository;
  let ordersRepo: OrdersRepository;

  const createCustomer = (isActive: boolean) =>
    customersRepo.create({
      name: 'Jane Doe',
      email: `jane-${Math.random()}@example.com`,
      phone: '',
      address: '',
      city: '',
      country: '',
      company: '',
      isActive,
    });

  const createProduct = (stock: number, status = ProductStatus.Active) =>
    productsRepo.create({
      name: 'Product',
      description: '',
      price: 10,
      sku: '',
      stock,
      categoryId: null,
      status,
      imageUrl: '',
    });

  const line = (productId: string, productName: string, quantity: number, unitPrice: number): OrderItem => ({
    productId,
    productName,
    quantity,
    unitPrice,
    subtotal: Math.round(quantity * unitPrice * 100) / 100,
  });

  /** Stores an order directly, with the given status and creation date. */
  const createOrder = (status: OrderStatus, createdAt: string, items: OrderItem[]) =>
    ordersRepo.create(
      {
        customerId: 'customer',
        items,
        total: Math.round(items.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100,
        status,
        notes: '',
      },
      undefined,
      new Date(createdAt),
    );

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [StatsService, CustomersRepository, ProductsRepository, OrdersRepository],
    }).compile();

    service = moduleRef.get(StatsService);
    customersRepo = moduleRef.get(CustomersRepository);
    productsRepo = moduleRef.get(ProductsRepository);
    ordersRepo = moduleRef.get(OrdersRepository);
  });

  describe('summary', () => {
    it('returns zeros for every status when there is no data', () => {
      expect(service.summary()).toEqual({
        customers: { total: 0, active: 0 },
        products: { total: 0, outOfStock: 0, lowStock: 0 },
        orders: {
          total: 0,
          byStatus: { pending: 0, paid: 0, shipped: 0, delivered: 0, cancelled: 0 },
        },
        revenue: { total: 0 },
      });
    });

    it('counts customers, products and orders, and sums revenue of paid, shipped and delivered orders', () => {
      createCustomer(true);
      createCustomer(true);
      createCustomer(false);
      createProduct(0, ProductStatus.OutOfStock);
      createProduct(4);
      createProduct(5);
      const item = (price: number) => [line('p', 'P', 1, price)];
      createOrder(OrderStatus.Pending, '2026-01-01', item(100));
      createOrder(OrderStatus.Paid, '2026-01-01', item(0.1));
      createOrder(OrderStatus.Shipped, '2026-01-01', item(0.2));
      createOrder(OrderStatus.Delivered, '2026-01-01', item(10));
      createOrder(OrderStatus.Cancelled, '2026-01-01', item(200));

      expect(service.summary()).toEqual({
        customers: { total: 3, active: 2 },
        products: { total: 3, outOfStock: 1, lowStock: 2 },
        orders: {
          total: 5,
          byStatus: { pending: 1, paid: 1, shipped: 1, delivered: 1, cancelled: 1 },
        },
        revenue: { total: 10.3 },
      });
    });
  });

  describe('sales', () => {
    beforeEach(() => {
      const item = (price: number) => [line('p', 'P', 1, price)];
      createOrder(OrderStatus.Paid, '2026-01-01T00:00:00Z', item(10));
      createOrder(OrderStatus.Delivered, '2026-01-01T23:59:59Z', item(5.5));
      createOrder(OrderStatus.Shipped, '2026-01-03T12:00:00Z', item(20));
      createOrder(OrderStatus.Pending, '2026-01-02T12:00:00Z', item(99));
      createOrder(OrderStatus.Cancelled, '2026-01-02T12:00:00Z', item(99));
      createOrder(OrderStatus.Paid, '2026-02-15T12:00:00Z', item(7));
      createOrder(OrderStatus.Paid, '2026-01-04T00:00:00Z', item(1000)); // the day after `to`
    });

    it('groups sales by day, including days without sales and the whole last day', () => {
      expect(service.sales({ from: '2026-01-01', to: '2026-01-03', groupBy: SalesGroupBy.Day })).toEqual([
        { period: '2026-01-01', orders: 2, revenue: 15.5 },
        { period: '2026-01-02', orders: 0, revenue: 0 },
        { period: '2026-01-03', orders: 1, revenue: 20 },
      ]);
    });

    it('groups sales by month', () => {
      expect(
        service.sales({ from: '2026-01-02', to: '2026-03-10', groupBy: SalesGroupBy.Month }),
      ).toEqual([
        { period: '2026-01', orders: 2, revenue: 1020 },
        { period: '2026-02', orders: 1, revenue: 7 },
        { period: '2026-03', orders: 0, revenue: 0 },
      ]);
    });

    it('returns the last 30 days up to today by default', () => {
      const result = service.sales({ groupBy: SalesGroupBy.Day });

      expect(result).toHaveLength(30);
      expect(result[29].period).toBe(new Date().toISOString().slice(0, 10));
    });

    it('accepts a single-day range', () => {
      expect(service.sales({ from: '2026-01-03', to: '2026-01-03', groupBy: SalesGroupBy.Day })).toEqual([
        { period: '2026-01-03', orders: 1, revenue: 20 },
      ]);
    });

    it('rejects from after to', () => {
      expect(() =>
        service.sales({ from: '2026-01-05', to: '2026-01-01', groupBy: SalesGroupBy.Day }),
      ).toThrow(BadRequestException);
    });

    it('rejects days that do not exist', () => {
      expect(() =>
        service.sales({ from: '2026-02-30', to: '2026-03-01', groupBy: SalesGroupBy.Day }),
      ).toThrow(BadRequestException);
    });

    it('rejects daily ranges longer than 366 days but allows them by month', () => {
      const query = { from: '2024-01-01', to: '2026-01-01' };

      expect(() => service.sales({ ...query, groupBy: SalesGroupBy.Day })).toThrow(BadRequestException);
      expect(service.sales({ ...query, groupBy: SalesGroupBy.Month })).toHaveLength(25);
    });
  });

  describe('topProducts', () => {
    it('ranks products by quantity sold, ignoring pending and cancelled orders', () => {
      createOrder(OrderStatus.Paid, '2026-01-01', [line('a', 'Mouse', 2, 10), line('b', 'Cable', 5, 1)]);
      createOrder(OrderStatus.Delivered, '2026-01-02', [line('a', 'Mouse', 4, 10)]);
      createOrder(OrderStatus.Pending, '2026-01-02', [line('b', 'Cable', 50, 1)]);
      createOrder(OrderStatus.Cancelled, '2026-01-02', [line('c', 'Desk', 50, 1)]);

      expect(service.topProducts({ limit: 5 })).toEqual([
        { productId: 'a', productName: 'Mouse', quantity: 6, revenue: 60 },
        { productId: 'b', productName: 'Cable', quantity: 5, revenue: 5 },
      ]);
    });

    it('includes products that no longer exist, with the name from their latest order', () => {
      createOrder(OrderStatus.Paid, '2026-01-05', [line('gone', 'New name', 1, 10)]);
      createOrder(OrderStatus.Paid, '2026-01-01', [line('gone', 'Old name', 1, 10)]);

      expect(service.topProducts({ limit: 5 })).toEqual([
        { productId: 'gone', productName: 'New name', quantity: 2, revenue: 20 },
      ]);
    });

    it('breaks ties by revenue and applies the limit', () => {
      createOrder(OrderStatus.Paid, '2026-01-01', [
        line('a', 'Cheap', 3, 1),
        line('b', 'Pricey', 3, 100),
        line('c', 'Few', 1, 1),
      ]);

      expect(service.topProducts({ limit: 2 }).map((p) => p.productId)).toEqual(['b', 'a']);
    });
  });
});
