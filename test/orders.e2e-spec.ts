import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { compareBy, createApp, expectSorted, loginAll, SeededRole } from './helpers';

const UNKNOWN_ID = '11111111-1111-4111-8111-111111111111';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let tokens: Record<SeededRole, string>;
  let counter = 0;

  const http = () => request(app.getHttpServer());
  const auth = (role: SeededRole) => ({ Authorization: `Bearer ${tokens[role]}` });

  async function createCustomer(): Promise<string> {
    const res = await http()
      .post('/customers')
      .set(auth('admin'))
      .send({ name: 'Order Customer', email: `e2e-order-${++counter}@example.com` })
      .expect(201);
    return res.body.id;
  }

  async function createProduct(price: number): Promise<string> {
    const res = await http()
      .post('/products')
      .set(auth('admin'))
      .send({ name: `Order Product ${++counter}`, price })
      .expect(201);
    return res.body.id;
  }

  async function createOrder(body: Record<string, unknown> = {}) {
    const customerId = body.customerId ?? (await createCustomer());
    const items = body.items ?? [{ productId: await createProduct(10), quantity: 1 }];
    const res = await http()
      .post('/orders')
      .set(auth('admin'))
      .send({ ...body, customerId, items })
      .expect(201);
    return res.body;
  }

  const setStatus = (id: string, status: string) =>
    http().patch(`/orders/${id}/status`).set(auth('user')).send({ status });

  beforeAll(async () => {
    app = await createApp();
    tokens = await loginAll(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication and roles', () => {
    it('returns 401 without a token', () => {
      return http().get('/orders').expect(401);
    });

    it.each<SeededRole>(['admin', 'user', 'viewer'])('lets %s list orders', (role) => {
      return http().get('/orders').set(auth(role)).expect(200);
    });

    it('returns 403 when a viewer tries to create, edit or change status', async () => {
      const order = await createOrder();

      await http().post('/orders').set(auth('viewer')).send({}).expect(403);
      await http().patch(`/orders/${order.id}`).set(auth('viewer')).send({ notes: 'x' }).expect(403);
      await http()
        .patch(`/orders/${order.id}/status`)
        .set(auth('viewer'))
        .send({ status: 'paid' })
        .expect(403);
    });

    it('returns 403 when a user tries to delete', async () => {
      const order = await createOrder();

      await http().delete(`/orders/${order.id}`).set(auth('user')).expect(403);
    });
  });

  describe('GET /orders', () => {
    it('returns a paginated list of the seeded orders', async () => {
      const res = await http().get('/orders').set(auth('viewer')).expect(200);

      expect(res.body.data).toHaveLength(10);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(20);
    });

    it('filters by customerId and status', async () => {
      const customerId = await createCustomer();
      const paid = await createOrder({ customerId });
      await setStatus(paid.id, 'paid').expect(200);
      await createOrder({ customerId });

      const byCustomer = await http()
        .get(`/orders?customerId=${customerId}`)
        .set(auth('viewer'))
        .expect(200);
      const byBoth = await http()
        .get(`/orders?customerId=${customerId}&status=paid`)
        .set(auth('viewer'))
        .expect(200);

      expect(byCustomer.body.meta.total).toBe(2);
      expect(byBoth.body.data.map((o: { id: string }) => o.id)).toEqual([paid.id]);
    });

    it.each([
      ['a customerId that is not a uuid', 'customerId=abc'],
      ['an unknown status', 'status=lost'],
    ])('returns 400 for %s', (_label, query) => {
      return http().get(`/orders?${query}`).set(auth('viewer')).expect(400);
    });
  });

  describe('POST /orders', () => {
    it('creates a pending order with copied prices and a computed total', async () => {
      const customerId = await createCustomer();
      const a = await createProduct(19.99);
      const b = await createProduct(5.5);

      const res = await http()
        .post('/orders')
        .set(auth('user'))
        .send({
          customerId,
          items: [
            { productId: a, quantity: 2 },
            { productId: b, quantity: 1 },
          ],
        })
        .expect(201);

      expect(res.body).toMatchObject({ customerId, status: 'pending', notes: '', total: 45.48 });
      expect(res.body.items[0]).toMatchObject({ productId: a, unitPrice: 19.99, subtotal: 39.98 });
    });

    it('returns 400 for an unknown customer or product', async () => {
      const customerId = await createCustomer();
      const productId = await createProduct(10);

      await http()
        .post('/orders')
        .set(auth('admin'))
        .send({ customerId: UNKNOWN_ID, items: [{ productId, quantity: 1 }] })
        .expect(400);
      await http()
        .post('/orders')
        .set(auth('admin'))
        .send({ customerId, items: [{ productId: UNKNOWN_ID, quantity: 1 }] })
        .expect(400);
    });

    it.each([
      ['no items', { items: [] }],
      ['a zero quantity', { items: [{ productId: UNKNOWN_ID, quantity: 0 }] }],
      ['a decimal quantity', { items: [{ productId: UNKNOWN_ID, quantity: 1.5 }] }],
      ['a productId that is not a uuid', { items: [{ productId: 'abc', quantity: 1 }] }],
      ['an unknown item field', { items: [{ productId: UNKNOWN_ID, quantity: 1, price: 1 }] }],
      [
        'a repeated product',
        {
          items: [
            { productId: UNKNOWN_ID, quantity: 1 },
            { productId: UNKNOWN_ID, quantity: 2 },
          ],
        },
      ],
      ['a status on create', { status: 'paid' }],
      ['a total on create', { total: 1 }],
    ])('returns 400 for %s', async (_label, body) => {
      const customerId = await createCustomer();

      await http()
        .post('/orders')
        .set(auth('admin'))
        .send({ customerId, items: [{ productId: UNKNOWN_ID, quantity: 1 }], ...body })
        .expect(400);
    });
  });

  describe('GET, PATCH and DELETE /orders/:id', () => {
    it('returns 404 for an unknown id', async () => {
      await http().get('/orders/unknown-id').set(auth('viewer')).expect(404);
      await http().patch('/orders/unknown-id').set(auth('admin')).send({ notes: 'x' }).expect(404);
      await setStatus('unknown-id', 'paid').expect(404);
      await http().delete('/orders/unknown-id').set(auth('admin')).expect(404);
    });

    it('edits items and notes of a pending order and recomputes the total', async () => {
      const order = await createOrder({ notes: 'first' });
      const productId = await createProduct(12.5);

      const res = await http()
        .patch(`/orders/${order.id}`)
        .set(auth('user'))
        .send({ items: [{ productId, quantity: 4 }], notes: 'second' })
        .expect(200);

      expect(res.body).toMatchObject({ customerId: order.customerId, notes: 'second', total: 50 });
      expect(res.body.items).toHaveLength(1);
    });

    it('returns 409 when editing an order that is not pending', async () => {
      const order = await createOrder();
      await setStatus(order.id, 'paid').expect(200);

      await http().patch(`/orders/${order.id}`).set(auth('user')).send({ notes: 'x' }).expect(409);
    });

    it('returns 400 when editing the status through PATCH /orders/:id', async () => {
      const order = await createOrder();

      await http().patch(`/orders/${order.id}`).set(auth('user')).send({ status: 'paid' }).expect(400);
    });

    it('moves through the status flow and rejects invalid transitions', async () => {
      const order = await createOrder();

      await setStatus(order.id, 'shipped').expect(409);
      await setStatus(order.id, 'paid').expect(200);
      await setStatus(order.id, 'shipped').expect(200);
      await setStatus(order.id, 'cancelled').expect(409);
      const res = await setStatus(order.id, 'delivered').expect(200);

      expect(res.body.status).toBe('delivered');
    });

    it('returns 400 for an unknown status', async () => {
      const order = await createOrder();

      await setStatus(order.id, 'lost').expect(400);
    });

    it('keeps the order when its product is deleted', async () => {
      const productId = await createProduct(10);
      const order = await createOrder({ items: [{ productId, quantity: 1 }] });

      await http().delete(`/products/${productId}`).set(auth('admin')).expect(204);

      const res = await http().get(`/orders/${order.id}`).set(auth('viewer')).expect(200);
      expect(res.body.items[0]).toMatchObject({ productId, unitPrice: 10 });
    });

    it('deletes as admin with 204, then the order is gone', async () => {
      const order = await createOrder();

      await http().delete(`/orders/${order.id}`).set(auth('admin')).expect(204);
      await http().get(`/orders/${order.id}`).set(auth('admin')).expect(404);
    });
  });

  describe('GET /orders sorting', () => {
    const list = async (query: string) => {
      const res = await http().get(`/orders?limit=100&${query}`).set(auth('viewer')).expect(200);
      expect(res.body.data.length).toBe(res.body.meta.total);
      return res.body.data as Array<{ total: number; status: string; createdAt: string }>;
    };

    it('sorts by total ascending', async () => {
      const data = await list('sortBy=total');
      expectSorted(
        data.map((o) => o.total),
        'asc',
        compareBy.number,
      );
    });

    it('sorts by total descending', async () => {
      const data = await list('sortBy=total&order=desc');
      expectSorted(
        data.map((o) => o.total),
        'desc',
        compareBy.number,
      );
    });

    it('sorts by status and createdAt', async () => {
      const byStatus = await list('sortBy=status&order=desc');
      expectSorted(
        byStatus.map((o) => o.status),
        'desc',
        compareBy.text,
      );

      const byDate = await list('sortBy=createdAt&order=asc');
      expectSorted(
        byDate.map((o) => o.createdAt),
        'asc',
        compareBy.date,
      );
    });

    it.each(['customerId', 'notes', 'unknown'])('returns 400 for sortBy=%s', (field) => {
      return http().get(`/orders?sortBy=${field}`).set(auth('viewer')).expect(400);
    });

    it('returns 400 for an invalid order', () => {
      return http().get('/orders?sortBy=total&order=1').set(auth('viewer')).expect(400);
    });
  });
});
