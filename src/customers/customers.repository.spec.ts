import { CustomersRepository } from './customers.repository';
import { CustomerEntity } from './entities/customer.entity';

describe('CustomersRepository', () => {
  let repo: CustomersRepository;

  const customer = (
    overrides: Partial<CustomerEntity> = {},
  ): Omit<CustomerEntity, 'id' | 'createdAt' | 'updatedAt'> => ({
    name: 'Jane Doe',
    email: 'Jane@Example.com',
    phone: '',
    address: '',
    city: 'New York',
    country: 'US',
    company: '',
    isActive: true,
    ...overrides,
  });

  beforeEach(() => {
    repo = new CustomersRepository();
  });

  it('finds a customer by email ignoring case', () => {
    repo.create(customer());

    expect(repo.findByEmail('jane@example.com')?.name).toBe('Jane Doe');
    expect(repo.findByEmail('other@example.com')).toBeUndefined();
  });

  it('searches name and city by substring, and other fields exactly', () => {
    repo.create(customer());

    expect(repo.findAll({ name: 'doe' })).toHaveLength(1);
    expect(repo.findAll({ city: 'york' })).toHaveLength(1);
    expect(repo.findAll({ country: 'U' })).toHaveLength(0);
  });
});
