import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../auth/repositories/users.repository';
import { CategoriesRepository } from '../categories/categories.repository';
import { Role } from '../core/decorators/roles.decorator';
import { CustomersRepository } from '../customers/customers.repository';
import { ProductsRepository } from '../products/products.repository';
import { SeedService } from './seed.service';

describe('SeedService', () => {
  let service: SeedService;
  let usersRepo: UsersRepository;
  let customersRepo: CustomersRepository;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SeedService,
        UsersRepository,
        CategoriesRepository,
        CustomersRepository,
        ProductsRepository,
      ],
    }).compile();

    service = moduleRef.get(SeedService);
    usersRepo = moduleRef.get(UsersRepository);
    customersRepo = moduleRef.get(CustomersRepository);

    // compile() does not run lifecycle hooks; call it like Nest does on boot.
    await service.onModuleInit();
  });

  it('seeds 3 users, 7 categories, 30 customers and 30 products on boot', () => {
    expect(service.status()).toEqual({ users: 3, categories: 7, customers: 30, products: 30 });
  });

  it('seeds the default users with fixed ids and the shared password', async () => {
    const admin = usersRepo.findByEmail('admin@mock.dev');

    expect(admin).toMatchObject({ id: '00000000-0000-4000-8000-000000000001', role: Role.Admin });
    expect(usersRepo.findByEmail('user@mock.dev')?.role).toBe(Role.User);
    expect(usersRepo.findByEmail('viewer@mock.dev')?.role).toBe(Role.Viewer);
    await expect(bcrypt.compare('password123', admin!.password)).resolves.toBe(true);
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

    expect(service.status()).toEqual({ users: 3, categories: 7, customers: 30, products: 30 });
    expect(customersRepo.findByEmail('extra@example.com')).toBeUndefined();
    expect(usersRepo.findById('00000000-0000-4000-8000-000000000001')).toBeDefined();
  });
});
