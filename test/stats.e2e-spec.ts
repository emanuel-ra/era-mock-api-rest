import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, loginAll, SeededRole } from './helpers';

describe('Stats (e2e)', () => {
  let app: INestApplication;
  let tokens: Record<SeededRole, string>;
  let counter = 0;

  const http = () => request(app.getHttpServer());
  const auth = (role: SeededRole) => ({ Authorization: `Bearer ${tokens[role]}` });
  const today = () => new Date().toISOString().slice(0, 10);

  /** Creates a customer, a product and an order for it, and moves the order to `paid`. */
  async function createPaidOrder(productName: string, price: number, quantity: number) {
    const customer = await http()
      .post('/customers')
      .set(auth('admin'))
      .send({ name: 'Stats Customer', email: `e2e-stats-${++counter}@example.com` })
      .expect(201);
    const product = await http()
      .post('/products')
      .set(auth('admin'))
      .send({ name: productName, price, stock: quantity })
      .expect(201);
    const order = await http()
      .post('/orders')
      .set(auth('admin'))
      .send({ customerId: customer.body.id, items: [{ productId: product.body.id, quantity }] })
      .expect(201);
    await http()
      .patch(`/orders/${order.body.id}/status`)
      .set(auth('admin'))
      .send({ status: 'paid' })
      .expect(200);
    return { productId: product.body.id as string, total: order.body.total as number };
  }

  beforeAll(async () => {
    app = await createApp();
    tokens = await loginAll(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it.each(['/stats/summary', '/stats/sales', '/stats/top-products'])(
      'returns 401 on %s without a token',
      (path) => http().get(path).expect(401),
    );

    it.each<SeededRole>(['admin', 'user', 'viewer'])('lets %s read every endpoint', async (role) => {
      await http().get('/stats/summary').set(auth(role)).expect(200);
      await http().get('/stats/sales').set(auth(role)).expect(200);
      await http().get('/stats/top-products').set(auth(role)).expect(200);
    });
  });

  describe('GET /stats/summary', () => {
    it('matches the seeded data and adds paid orders to the revenue', async () => {
      const before = await http().get('/stats/summary').set(auth('viewer')).expect(200);
      const status = await http().get('/seed/status').expect(200);

      expect(before.body.customers.total).toBe(status.body.customers);
      expect(before.body.products.total).toBe(status.body.products);
      expect(before.body.orders.total).toBe(status.body.orders);
      expect(Object.keys(before.body.orders.byStatus).sort()).toEqual(
        ['cancelled', 'delivered', 'paid', 'pending', 'shipped'],
      );

      const { total } = await createPaidOrder('Summary Product', 12.34, 2);
      const after = await http().get('/stats/summary').set(auth('viewer')).expect(200);

      expect(after.body.orders.total).toBe(before.body.orders.total + 1);
      expect(after.body.orders.byStatus.paid).toBe(before.body.orders.byStatus.paid + 1);
      expect(after.body.revenue.total).toBeCloseTo(before.body.revenue.total + total, 2);
    });
  });

  describe('GET /stats/sales', () => {
    it('returns the last 30 days by day by default', async () => {
      const res = await http().get('/stats/sales').set(auth('viewer')).expect(200);

      expect(res.body).toHaveLength(30);
      expect(res.body[29].period).toBe(today());
      expect(res.body[0]).toEqual({
        period: expect.any(String),
        orders: expect.any(Number),
        revenue: expect.any(Number),
      });
    });

    it('includes a new paid order in today\'s period', async () => {
      const query = { from: today(), to: today() };
      const before = await http().get('/stats/sales').query(query).set(auth('viewer')).expect(200);

      const { total } = await createPaidOrder('Sales Product', 5, 3);
      const after = await http().get('/stats/sales').query(query).set(auth('viewer')).expect(200);

      expect(after.body[0].orders).toBe(before.body[0].orders + 1);
      expect(after.body[0].revenue).toBeCloseTo(before.body[0].revenue + total, 2);
    });

    it('groups by month', async () => {
      const res = await http()
        .get('/stats/sales')
        .query({ from: '2026-01-15', to: '2026-03-01', groupBy: 'month' })
        .set(auth('viewer'))
        .expect(200);

      expect(res.body.map((p: { period: string }) => p.period)).toEqual(['2026-01', '2026-02', '2026-03']);
    });

    it.each([
      ['from after to', { from: '2026-02-01', to: '2026-01-01' }],
      ['a bad date format', { from: '01-01-2026' }],
      ['a day that does not exist', { from: '2026-02-30', to: '2026-03-01' }],
      ['an unknown groupBy', { groupBy: 'week' }],
      ['a daily range over 366 days', { from: '2024-01-01', to: '2026-01-01' }],
      ['an unknown query param', { foo: 'bar' }],
    ])('returns 400 for %s', (_, query) =>
      http().get('/stats/sales').query(query).set(auth('viewer')).expect(400),
    );
  });

  describe('GET /stats/top-products', () => {
    it('returns 5 products by default, sorted by quantity', async () => {
      const res = await http().get('/stats/top-products').set(auth('viewer')).expect(200);

      expect(res.body.length).toBeLessThanOrEqual(5);
      const quantities = res.body.map((p: { quantity: number }) => p.quantity);
      expect(quantities).toEqual([...quantities].sort((a, b) => b - a));
    });

    it('keeps a deleted product in the ranking with its name', async () => {
      const { productId } = await createPaidOrder('Best Seller', 1, 1000);
      await http().delete(`/products/${productId}`).set(auth('admin')).expect(204);

      const res = await http().get('/stats/top-products').query({ limit: 1 }).set(auth('viewer')).expect(200);

      expect(res.body).toEqual([
        { productId, productName: 'Best Seller', quantity: 1000, revenue: 1000 },
      ]);
    });

    it.each([0, 51, 'abc'])('returns 400 for limit=%s', (limit) =>
      http().get('/stats/top-products').query({ limit }).set(auth('viewer')).expect(400),
    );
  });
});
