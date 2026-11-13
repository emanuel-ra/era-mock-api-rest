import { Injectable, OnModuleInit } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../auth/repositories/users.repository';
import { CategoriesRepository } from '../categories/categories.repository';
import { toCents } from '../core/utils/money';
import { slugify } from '../core/utils/slugify';
import { CustomersRepository } from '../customers/customers.repository';
import { OrderStatus } from '../orders/entities/order.entity';
import { OrdersRepository } from '../orders/orders.repository';
import { ProductsRepository } from '../products/products.repository';
import { Role } from '../core/decorators/roles.decorator';
import { ProductStatus } from '../products/entities/product.entity';
import { applyStockDelta } from '../products/product-stock';

/** Seeded orders get a random creation date within this many days before now. */
const ORDER_HISTORY_DAYS = 90;

/** Order statuses that have taken their items out of stock. */
const SOLD_STATUSES: readonly OrderStatus[] = [OrderStatus.Paid, OrderStatus.Shipped, OrderStatus.Delivered];

const STOCK_BY_STATUS: Record<ProductStatus, () => number> = {
  [ProductStatus.Active]: () => faker.number.int({ min: 1, max: 200 }),
  [ProductStatus.Inactive]: () => faker.number.int({ min: 0, max: 200 }),
  [ProductStatus.OutOfStock]: () => 0,
};

const CATEGORY_NAMES = ['Electronics', 'Clothing', 'Food', 'Books', 'Tools', 'Furniture', 'Sports'];

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly categoriesRepo: CategoriesRepository,
    private readonly customersRepo: CustomersRepository,
    private readonly productsRepo: ProductsRepository,
    private readonly ordersRepo: OrdersRepository,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async reset() {
    this.usersRepo.clear();
    this.categoriesRepo.clear();
    this.customersRepo.clear();
    this.productsRepo.clear();
    this.ordersRepo.clear();
    await this.seed();
  }

  status() {
    return {
      users: this.usersRepo.count(),
      categories: this.categoriesRepo.count(),
      customers: this.customersRepo.count(),
      products: this.productsRepo.count(),
      orders: this.ordersRepo.count(),
    };
  }

  private async seed() {
    await this.seedUsers();
    this.seedCategories();
    this.seedCustomers();
    this.seedProducts();
    this.seedOrders();
  }

  private async seedUsers() {
    const password = await bcrypt.hash('password123', 10);

    // Fixed ids keep issued JWTs valid across restarts and POST /seed/reset.
    const users = [
      { id: '00000000-0000-4000-8000-000000000001', email: 'admin@mock.dev', name: 'Admin User', role: Role.Admin },
      { id: '00000000-0000-4000-8000-000000000002', email: 'user@mock.dev', name: 'Regular User', role: Role.User },
      { id: '00000000-0000-4000-8000-000000000003', email: 'viewer@mock.dev', name: 'Viewer User', role: Role.Viewer },
    ];

    for (const { id, ...u } of users) {
      this.usersRepo.create({ ...u, password }, id);
    }
  }

  private seedCategories() {
    for (const name of CATEGORY_NAMES) {
      this.categoriesRepo.create({
        name,
        slug: slugify(name),
        description: faker.commerce.productDescription(),
        isActive: true,
      });
    }
  }

  private seedCustomers() {
    for (let i = 0; i < 30; i++) {
      this.customersRepo.create({
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.number(),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        country: faker.location.countryCode('alpha-2'),
        company: faker.company.name(),
        isActive: faker.datatype.boolean({ probability: 0.85 }),
      });
    }
  }

  private seedProducts() {
    const categoryIds = this.categoriesRepo.findAll().map((c) => c.id);
    const statuses = [
      ProductStatus.Active,
      ProductStatus.Active,
      ProductStatus.Active,
      ProductStatus.Inactive,
      ProductStatus.OutOfStock,
    ];

    for (let i = 0; i < 30; i++) {
      const status = faker.helpers.arrayElement(statuses);
      this.productsRepo.create({
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        price: parseFloat(faker.commerce.price({ min: 5, max: 500 })),
        sku: faker.string.alphanumeric(8).toUpperCase(),
        // Stock matches the status: out_of_stock has none, active has some.
        stock: STOCK_BY_STATUS[status](),
        categoryId: faker.helpers.arrayElement(categoryIds),
        status,
        imageUrl: faker.image.url(),
      });
    }
  }

  /**
   * Orders are created oldest first, and the sold ones (paid, shipped, delivered)
   * take their quantities out of the product stock, as PATCH /orders/:id/status does.
   * A sold order whose products do not have enough stock left stays pending.
   */
  private seedOrders() {
    const customerIds = this.customersRepo.findAll().map((c) => c.id);
    const products = this.productsRepo.findAll();
    const statuses = Object.values(OrderStatus);
    const now = new Date();
    const from = new Date(now.getTime() - ORDER_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const dates = Array.from({ length: 20 }, () => faker.date.between({ from, to: now })).sort(
      (a, b) => a.getTime() - b.getTime(),
    );

    for (const createdAt of dates) {
      // arrayElements returns distinct products, so no product repeats inside an order.
      const items = faker.helpers
        .arrayElements(products, { min: 1, max: 4 })
        .map((p) => {
          const quantity = faker.number.int({ min: 1, max: 5 });
          return {
            productId: p.id,
            productName: p.name,
            unitPrice: p.price,
            quantity,
            subtotal: toCents(p.price * quantity),
          };
        });

      let status = faker.helpers.arrayElement(statuses);
      if (SOLD_STATUSES.includes(status)) {
        const current = items.map((item) => this.productsRepo.findById(item.productId)!);
        if (items.every((item, i) => current[i].stock >= item.quantity)) {
          items.forEach((item, i) =>
            this.productsRepo.update(item.productId, applyStockDelta(current[i], -item.quantity)),
          );
        } else {
          status = OrderStatus.Pending;
        }
      }

      this.ordersRepo.create(
        {
          customerId: faker.helpers.arrayElement(customerIds),
          items,
          total: toCents(items.reduce((sum, item) => sum + item.subtotal, 0)),
          status,
          notes: faker.datatype.boolean({ probability: 0.3 }) ? faker.lorem.sentence() : '',
        },
        undefined,
        createdAt,
      );
    }
  }
}
