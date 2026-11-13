import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../auth/repositories/users.repository';
import { CategoriesRepository } from '../categories/categories.repository';
import { Role } from '../core/decorators/roles.decorator';
import { CustomersRepository } from '../customers/customers.repository';
import { OrdersRepository } from '../orders/orders.repository';
import { ProductsRepository } from '../products/products.repository';
import { SeedService } from './seed.service';

describe('SeedService', () => {
  let service: SeedService;
  let usersRepo: UsersRepository;
  let customersRepo: CustomersRepository;
  let categoriesRepo: CategoriesRepository;
  let productsRepo: ProductsRepository;
  let ordersRepo: OrdersRepository;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SeedService,
        UsersRepository,
        CategoriesRepository,
        CustomersRepository,
        ProductsRepository,
        OrdersRepository,
      ],
    }).compile();

    service = moduleRef.get(SeedService);
    usersRepo = moduleRef.get(UsersRepository);
    customersRepo = moduleRef.get(CustomersRepository);
    categoriesRepo = moduleRef.get(CategoriesRepository);
    productsRepo = moduleRef.get(ProductsRepository);
    ordersRepo = moduleRef.get(OrdersRepository);

    // compile() does not run lifecycle hooks; call it like Nest does on boot.
    await service.onModuleInit();
  });

  it('seeds 3 users, 7 categories, 30 customers, 30 products and 20 orders on boot', () => {
    expect(service.status()).toEqual({ users: 3, categories: 7, customers: 30, products: 30, orders: 20 });
  });

  it('seeds the default users with fixed ids and the shared password', async () => {
    const admin = usersRepo.findByEmail('admin@mock.dev');

    expect(admin).toMatchObject({ id: '00000000-0000-4000-8000-000000000001', role: Role.Admin });
    expect(usersRepo.findByEmail('user@mock.dev')?.role).toBe(Role.User);
    expect(usersRepo.findByEmail('viewer@mock.dev')?.role).toBe(Role.Viewer);
    await expect(bcrypt.compare('password123', admin!.password)).resolves.toBe(true);
  });

  it('seeds the default categories and links every product to one of them', () => {
    const categories = categoriesRepo.findAll();
    expect(categories.map((c) => c.slug)).toEqual(
      expect.arrayContaining(['electronics', 'clothing', 'sports']),
    );

    const ids = new Set(categories.map((c) => c.id));
    expect(productsRepo.findAll().every((p) => p.categoryId !== null && ids.has(p.categoryId))).toBe(
      true,
    );
  });

  it('links every order to seeded customers and products, with a matching total', () => {
    const customerIds = new Set(customersRepo.findAll().map((c) => c.id));
    const productIds = new Set(productsRepo.findAll().map((p) => p.id));

    for (const order of ordersRepo.findAll()) {
      expect(customerIds.has(order.customerId)).toBe(true);
      expect(order.items.length).toBeGreaterThanOrEqual(1);
      expect(order.items.every((item) => productIds.has(item.productId))).toBe(true);
      const sum = order.items.reduce((total, item) => total + item.subtotal, 0);
      expect(order.total).toBeCloseTo(sum, 2);
    }
  });

  it('spreads order creation dates over the last 90 days', () => {
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    const times = ordersRepo.findAll().map((o) => o.createdAt.getTime());

    expect(times.every((t) => t >= ninetyDaysAgo && t <= now)).toBe(true);
    expect(new Set(times).size).toBeGreaterThan(1);
  });

  it('reset discards changes and re-seeds with the same user ids', async () => {
    customersRepo.create({
      name: 'Extra',
      email: 'extra@example.com',
      phone: '',
      address: '',
      city: '',
      country: '',
      company: '',
      isActive: true,
    });
    expect(service.status().customers).toBe(31);

    await service.reset();

    expect(service.status()).toEqual({ users: 3, categories: 7, customers: 30, products: 30, orders: 20 });
    expect(customersRepo.findByEmail('extra@example.com')).toBeUndefined();
    expect(usersRepo.findById('00000000-0000-4000-8000-000000000001')).toBeDefined();
  });
});
