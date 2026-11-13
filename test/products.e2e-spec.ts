import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { compareBy, createApp, expectSorted, loginAll, SeededRole } from './helpers';

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

  async function createCategory(): Promise<string> {
    const res = await http()
      .post('/categories')
      .set(auth('admin'))
      .send({ name: `E2E Products Category ${++counter}` })
      .expect(201);
    return res.body.id;
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

    it('filters by categoryId and name', async () => {
      const categoryId = await createCategory();
      await createProduct({ name: 'Qwerty Gadget', categoryId });
      await createProduct({ name: 'Qwerty Other' });

      const res = await http()
        .get(`/products?categoryId=${categoryId}&name=qwerty`)
        .set(auth('viewer'))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ name: 'Qwerty Gadget', categoryId });
    });

    it('returns 400 when categoryId is not a uuid', () => {
      return http().get('/products?categoryId=electronics').set(auth('viewer')).expect(400);
    });

    it('lists seeded products linked to seeded categories', async () => {
      const [products, categories] = await Promise.all([
        http().get('/products?limit=100').set(auth('viewer')),
        http().get('/categories?limit=100').set(auth('viewer')),
      ]);
      const categoryIds = new Set(categories.body.data.map((c: { id: string }) => c.id));
      // Other tests in this file create products without a category, so only check linked ones.
      const linked = products.body.data.filter((p: { categoryId: string | null }) => p.categoryId);

      expect(linked.length).toBeGreaterThanOrEqual(30);
      expect(linked.every((p: { categoryId: string }) => categoryIds.has(p.categoryId))).toBe(true);
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
        categoryId: null,
        status: 'active',
      });
    });

    it.each([
      ['a negative price', { price: -1 }],
      ['more than 2 decimals', { price: 1.999 }],
      ['a negative stock', { price: 10, stock: -1 }],
      ['an unknown status', { price: 10, status: 'sold' }],
      ['an invalid image url', { price: 10, imageUrl: 'not-a-url' }],
      ['a categoryId that is not a uuid', { price: 10, categoryId: 'electronics' }],
      ['an unknown categoryId', { price: 10, categoryId: '11111111-1111-4111-8111-111111111111' }],
      ['the removed category field', { price: 10, category: 'Electronics' }],
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

    it('changes and removes the category', async () => {
      const categoryId = await createCategory();
      const product = await createProduct();

      const assigned = await http()
        .patch(`/products/${product.id}`)
        .set(auth('user'))
        .send({ categoryId })
        .expect(200);
      expect(assigned.body.categoryId).toBe(categoryId);

      const removed = await http()
        .patch(`/products/${product.id}`)
        .set(auth('user'))
        .send({ categoryId: null })
        .expect(200);
      expect(removed.body.categoryId).toBeNull();
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

  describe('GET /products sorting', () => {
    const list = async (query: string) => {
      const res = await http().get(`/products?limit=100&${query}`).set(auth('viewer')).expect(200);
      expect(res.body.data.length).toBe(res.body.meta.total);
      return res.body.data as Array<{ id: string; name: string; price: number; stock: number }>;
    };

    it('sorts by price ascending by default', async () => {
      const data = await list('sortBy=price');
      expectSorted(
        data.map((p) => p.price),
        'asc',
        compareBy.number,
      );
    });

    it('sorts by stock descending', async () => {
      const data = await list('sortBy=stock&order=desc');
      expectSorted(
        data.map((p) => p.stock),
        'desc',
        compareBy.number,
      );
    });

    it('sorts by name ignoring case', async () => {
      await createProduct({ name: 'aaa lowercase first' });
      const data = await list('sortBy=name&order=asc');
      expectSorted(
        data.map((p) => p.name),
        'asc',
        compareBy.text,
      );
      expect(data[0].name).toBe('aaa lowercase first');
    });

    it('keeps the default order without sortBy, even with order', async () => {
      const unsorted = await list('');
      const withOrder = await list('order=desc');
      expect(withOrder.map((p) => p.id)).toEqual(unsorted.map((p) => p.id));
    });

    it.each(['sku', 'description', 'unknown'])('returns 400 for sortBy=%s', (field) => {
      return http().get(`/products?sortBy=${field}`).set(auth('viewer')).expect(400);
    });

    it('returns 400 for an invalid order', () => {
      return http().get('/products?sortBy=name&order=up').set(auth('viewer')).expect(400);
    });
  });
});
