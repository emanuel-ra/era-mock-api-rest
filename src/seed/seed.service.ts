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
      this.productsRepo.create({
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        price: parseFloat(faker.commerce.price({ min: 5, max: 500 })),
        sku: faker.string.alphanumeric(8).toUpperCase(),
        stock: faker.number.int({ min: 0, max: 200 }),
        categoryId: faker.helpers.arrayElement(categoryIds),
        status: faker.helpers.arrayElement(statuses),
        imageUrl: faker.image.url(),
      });
    }
  }

  private seedOrders() {
    const customerIds = this.customersRepo.findAll().map((c) => c.id);
    const products = this.productsRepo.findAll();
    const statuses = Object.values(OrderStatus);

    for (let i = 0; i < 20; i++) {
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

      this.ordersRepo.create({
        customerId: faker.helpers.arrayElement(customerIds),
        items,
        total: toCents(items.reduce((sum, item) => sum + item.subtotal, 0)),
        status: faker.helpers.arrayElement(statuses),
        notes: faker.datatype.boolean({ probability: 0.3 }) ? faker.lorem.sentence() : '',
      });
    }
  }
}
