import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createApp, loginAll, SeededRole } from './helpers';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let tokens: Record<SeededRole, string>;
  let counter = 0;

  const http = () => request(app.getHttpServer());
  const auth = (role: SeededRole) => ({ Authorization: `Bearer ${tokens[role]}` });
  const uniqueSku = () => `E2E-${++counter}`;

  async function createProduct(body: Record<string, unknown> = {}) {
    const res = await http()
      .post('/products')
      .set(auth('admin'))
      .send({ name: 'Wireless Mouse', price: 29.99, ...body })
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
      return http().get('/products').expect(401);
    });

    it('returns 403 when a viewer tries to create', () => {
      return http()
        .post('/products')
        .set(auth('viewer'))
        .send({ name: 'Wireless Mouse', price: 10 })
        .expect(403);
    });

    it('returns 403 when a user tries to delete', async () => {
      const product = await createProduct();

      await http().delete(`/products/${product.id}`).set(auth('user')).expect(403);
    });
  });

  describe('GET /products', () => {
    it('returns a paginated list of the seeded products', async () => {
      const res = await http().get('/products?limit=100').set(auth('viewer')).expect(200);

      expect(res.body.meta.total).toBeGreaterThanOrEqual(30);
      expect(res.body.data.length).toBe(res.body.meta.total);
    });

    it('filters by status exactly', async () => {
      const res = await http().get('/products?status=active&limit=100').set(auth('viewer')).expect(200);

      expect(res.body.data.every((p: { status: string }) => p.status === 'active')).toBe(true);
    });

    it('filters by category and name', async () => {
      await createProduct({ name: 'Qwerty Gadget', category: 'E2E Category' });

      const res = await http()
        .get('/products?category=e2e%20category&name=qwerty')
        .set(auth('viewer'))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Qwerty Gadget');
    });

    it('returns 400 for an invalid status', () => {
      return http().get('/products?status=sold').set(auth('viewer')).expect(400);
    });
  });

  describe('POST /products', () => {
    it('creates a product with defaults', async () => {
      const res = await http()
        .post('/products')
        .set(auth('user'))
        .send({ name: 'Wireless Mouse', price: 29.99 })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Wireless Mouse',
        price: 29.99,
        stock: 0,
        category: 'Uncategorized',
        status: 'active',
      });
    });

    it.each([
      ['a negative price', { price: -1 }],
      ['more than 2 decimals', { price: 1.999 }],
      ['a negative stock', { price: 10, stock: -1 }],
      ['an unknown status', { price: 10, status: 'sold' }],
      ['an invalid image url', { price: 10, imageUrl: 'not-a-url' }],
    ])('returns 400 for %s', (_label, body) => {
      return http()
        .post('/products')
        .set(auth('admin'))
        .send({ name: 'Wireless Mouse', ...body })
        .expect(400);
    });

    it('returns 409 for a duplicated SKU', async () => {
      const sku = uniqueSku();
      await createProduct({ sku });

      await http()
        .post('/products')
        .set(auth('admin'))
        .send({ name: 'Other', price: 1, sku })
        .expect(409);
    });
  });

  describe('GET, PATCH and DELETE /products/:id', () => {
    it('returns 404 for an unknown id', () => {
      return http().get('/products/unknown-id').set(auth('viewer')).expect(404);
    });

    it('updates only the fields sent', async () => {
      const product = await createProduct({ stock: 5 });

      const res = await http()
        .patch(`/products/${product.id}`)
        .set(auth('user'))
        .send({ stock: 50 })
        .expect(200);

      expect(res.body).toMatchObject({ name: 'Wireless Mouse', stock: 50 });
    });

    it('returns 409 when updating to a SKU of another product', async () => {
      const takenSku = uniqueSku();
      await createProduct({ sku: takenSku });
      const product = await createProduct({ sku: uniqueSku() });

      await http()
        .patch(`/products/${product.id}`)
        .set(auth('admin'))
        .send({ sku: takenSku })
        .expect(409);
    });

    it('deletes as admin with 204, then the product is gone', async () => {
      const product = await createProduct();

      await http().delete(`/products/${product.id}`).set(auth('admin')).expect(204);
      await http().get(`/products/${product.id}`).set(auth('admin')).expect(404);
    });
  });
});
