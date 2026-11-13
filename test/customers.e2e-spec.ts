import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, loginAll, SeededRole } from './helpers';

describe('Customers (e2e)', () => {
  let app: INestApplication;
  let tokens: Record<SeededRole, string>;
  let counter = 0;

  const http = () => request(app.getHttpServer());
  const auth = (role: SeededRole) => ({ Authorization: `Bearer ${tokens[role]}` });
  const uniqueEmail = () => `e2e-customer-${++counter}@example.com`;

  async function createCustomer(body: Record<string, unknown> = {}) {
    const res = await http()
      .post('/customers')
      .set(auth('admin'))
      .send({ name: 'Jane Doe', email: uniqueEmail(), ...body })
      .expect(201);
    return res.body;
  }

  beforeAll(async () => {
    app = await createApp();
    tokens = await loginAll(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication and roles', () => {
    it('returns 401 without a token', () => {
      return http().get('/customers').expect(401);
    });

    it.each<SeededRole>(['admin', 'user', 'viewer'])('lets %s list customers', (role) => {
      return http().get('/customers').set(auth(role)).expect(200);
    });

    it('returns 403 when a viewer tries to create', () => {
      return http()
        .post('/customers')
        .set(auth('viewer'))
        .send({ name: 'Jane Doe', email: uniqueEmail() })
        .expect(403);
    });

    it('returns 403 when a user tries to delete', async () => {
      const customer = await createCustomer();

      await http().delete(`/customers/${customer.id}`).set(auth('user')).expect(403);
    });
  });

  describe('GET /customers', () => {
    it('returns a paginated list of the seeded customers', async () => {
      const res = await http().get('/customers').set(auth('viewer')).expect(200);

      expect(res.body.data).toHaveLength(10);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 10 });
      expect(res.body.meta.total).toBeGreaterThanOrEqual(30);
    });

    it('converts page and limit from the query string', async () => {
      const res = await http().get('/customers?page=2&limit=5').set(auth('viewer')).expect(200);

      expect(res.body.data).toHaveLength(5);
      expect(res.body.meta).toMatchObject({ page: 2, limit: 5 });
    });

    it('filters by name substring and isActive', async () => {
      await createCustomer({ name: 'Zyxwv Unique', isActive: false });

      const res = await http()
        .get('/customers?name=zyxwv&isActive=false')
        .set(auth('viewer'))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ name: 'Zyxwv Unique', isActive: false });
    });

    it.each(['limit=101', 'page=0', 'unknown=1'])('returns 400 for ?%s', (query) => {
      return http().get(`/customers?${query}`).set(auth('viewer')).expect(400);
    });
  });

  describe('POST /customers', () => {
    it('creates a customer with defaults', async () => {
      const email = uniqueEmail();

      const res = await http()
        .post('/customers')
        .set(auth('user'))
        .send({ name: 'Jane Doe', email })
        .expect(201);

      expect(res.body).toMatchObject({ id: expect.any(String), name: 'Jane Doe', email, isActive: true });
    });

    it('returns 400 for invalid fields', () => {
      return http()
        .post('/customers')
        .set(auth('admin'))
        .send({ name: 'J', email: 'not-an-email' })
        .expect(400);
    });

    it('returns 400 for unknown fields', () => {
      return http()
        .post('/customers')
        .set(auth('admin'))
        .send({ name: 'Jane Doe', email: uniqueEmail(), age: 30 })
        .expect(400);
    });

    it('returns 409 for a duplicated email', async () => {
      const existing = await createCustomer();

      await http()
        .post('/customers')
        .set(auth('admin'))
        .send({ name: 'Other', email: existing.email })
        .expect(409);
    });
  });

  describe('GET, PATCH and DELETE /customers/:id', () => {
    it('gets one customer', async () => {
      const customer = await createCustomer();

      const res = await http().get(`/customers/${customer.id}`).set(auth('viewer')).expect(200);

      expect(res.body.email).toBe(customer.email);
    });

    it('returns 404 for an unknown id', () => {
      return http().get('/customers/unknown-id').set(auth('viewer')).expect(404);
    });

    it('updates only the fields sent', async () => {
      const customer = await createCustomer({ city: 'Lima' });

      const res = await http()
        .patch(`/customers/${customer.id}`)
        .set(auth('user'))
        .send({ city: 'Monterrey' })
        .expect(200);

      expect(res.body).toMatchObject({ name: 'Jane Doe', city: 'Monterrey' });
    });

    it('returns 409 when updating to an email of another customer', async () => {
      const taken = await createCustomer();
      const customer = await createCustomer();

      await http()
        .patch(`/customers/${customer.id}`)
        .set(auth('admin'))
        .send({ email: taken.email })
        .expect(409);
    });

    it('deletes as admin with 204, then the customer is gone', async () => {
      const customer = await createCustomer();

      await http().delete(`/customers/${customer.id}`).set(auth('admin')).expect(204);
      await http().get(`/customers/${customer.id}`).set(auth('admin')).expect(404);
    });
  });
});
