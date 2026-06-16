import { Injectable, OnModuleInit } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../auth/repositories/users.repository';
import { CustomersRepository } from '../customers/customers.repository';
import { ProductsRepository } from '../products/products.repository';
import { Role } from '../core/decorators/roles.decorator';
import { ProductStatus } from '../products/entities/product.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly customersRepo: CustomersRepository,
    private readonly productsRepo: ProductsRepository,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async reset() {
    this.usersRepo.clear();
    this.customersRepo.clear();
    this.productsRepo.clear();
    await this.seed();
  }

  status() {
    return {
      users: this.usersRepo.count(),
      customers: this.customersRepo.count(),
      products: this.productsRepo.count(),
    };
  }

  private async seed() {
    await this.seedUsers();
    this.seedCustomers();
    this.seedProducts();
  }

  private async seedUsers() {
    const password = await bcrypt.hash('password123', 10);

    const users = [
      { email: 'admin@mock.dev', name: 'Admin User', role: Role.Admin },
      { email: 'user@mock.dev', name: 'Regular User', role: Role.User },
      { email: 'viewer@mock.dev', name: 'Viewer User', role: Role.Viewer },
    ];

    for (const u of users) {
      this.usersRepo.create({ ...u, password });
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
    const categories = ['Electronics', 'Clothing', 'Food', 'Books', 'Tools', 'Furniture', 'Sports'];
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
        category: faker.helpers.arrayElement(categories),
        status: faker.helpers.arrayElement(statuses),
        imageUrl: faker.image.url(),
      });
    }
  }
}
