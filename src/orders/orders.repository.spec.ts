import { OrderEntity, OrderStatus } from './entities/order.entity';
import { OrdersRepository } from './orders.repository';

describe('OrdersRepository', () => {
  let repo: OrdersRepository;

  const order = (
    overrides: Partial<OrderEntity> = {},
  ): Omit<OrderEntity, 'id' | 'createdAt' | 'updatedAt'> => ({
    customerId: 'customer-1',
    items: [],
    total: 0,
    status: OrderStatus.Pending,
    notes: '',
    ...overrides,
  });

  beforeEach(() => {
    repo = new OrdersRepository();
  });

  it('counts the orders of a customer', () => {
    repo.create(order());
    repo.create(order());
    repo.create(order({ customerId: 'customer-2' }));

    expect(repo.countByCustomer('customer-1')).toBe(2);
    expect(repo.countByCustomer('customer-3')).toBe(0);
  });

  it('filters customerId and status exactly', () => {
    repo.create(order());
    repo.create(order({ status: OrderStatus.Paid }));

    expect(repo.findAll({ customerId: 'customer' })).toHaveLength(0);
    expect(repo.findAll({ status: OrderStatus.Paid })).toHaveLength(1);
  });
});
