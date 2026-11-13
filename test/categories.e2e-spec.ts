import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createApp, loginAll, SeededRole } from './helpers';

describe('Categories (e2e)', () => {
  let app: INestApplication;
  let tokens: Record<SeededRole, string>;
  let counter = 0;

  const http = () => request(app.getHttpServer());
  const auth = (role: SeededRole) => ({ Authorization: `Bearer ${tokens[role]}` });
  const uniqueName = () => `E2E Category ${++counter}`;

  async function createCategory(body: Record<string, unknown> = {}) {
    const res = await http()
      .post('/categories')
      .set(auth('admin'))
      .send({ name: uniqueName(), ...body })
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
      return http().get('/categories').expect(401);
    });

    it('returns 403 when a viewer tries to create', () => {
      return http().post('/categories').set(auth('viewer')).send({ name: uniqueName() }).expect(403);
    });

    it('returns 403 when a user tries to delete', async () => {
      const category = await createCategory();

      await http().delete(`/categories/${category.id}`).set(auth('user')).expect(403);
    });
  });

  describe('GET /categories', () => {
    it('lists the 7 seeded categories with their slugs', async () => {
      const res = await http().get('/categories?limit=100').set(auth('viewer')).expect(200);

      expect(res.body.meta.total).toBeGreaterThanOrEqual(7);
      expect(res.body.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Electronics', slug: 'electronics' })]),
      );
    });

    it('filters by name substring and isActive', async () => {
      await createCategory({ name: 'Zyxwv Inactive', isActive: false });

      const res = await http()
        .get('/categories?name=zyxwv&isActive=false')
        .set(auth('viewer'))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ name: 'Zyxwv Inactive', isActive: false });
    });
  });

  describe('POST /categories', () => {
    it('creates a category and generates its slug', async () => {
      const res = await http()
        .post('/categories')
        .set(auth('user'))
        .send({ name: 'Home & Garden' })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Home & Garden',
        slug: 'home-garden',
        description: '',
        isActive: true,
      });
    });

    it.each([
      ['a short name', { name: 'A' }],
      ['an invalid slug', { name: 'Valid Name', slug: 'Not A Slug' }],
      ['an unknown field', { name: 'Valid Name', color: 'red' }],
      ['a name without letters or numbers', { name: '&& !!' }],
    ])('returns 400 for %s', (_label, body) => {
      return http().post('/categories').set(auth('admin')).send(body).expect(400);
    });

    it('returns 409 for a duplicated name or slug', async () => {
      const existing = await createCategory();

      await http()
        .post('/categories')
        .set(auth('admin'))
        .send({ name: existing.name.toUpperCase(), slug: 'some-new-slug' })
        .expect(409);
      await http()
        .post('/categories')
        .set(auth('admin'))
        .send({ name: uniqueName(), slug: existing.slug })
        .expect(409);
    });
  });

  describe('GET, PATCH and DELETE /categories/:id', () => {
    it('returns 404 for an unknown id', () => {
      return http().get('/categories/unknown-id').set(auth('viewer')).expect(404);
    });

    it('updates the name without changing the slug', async () => {
      const category = await createCategory();

      const res = await http()
        .patch(`/categories/${category.id}`)
        .set(auth('user'))
        .send({ name: uniqueName() })
        .expect(200);

      expect(res.body.slug).toBe(category.slug);
    });

    it('returns 409 when deleting a category that products use', async () => {
      const category = await createCategory();
      await http()
        .post('/products')
        .set(auth('admin'))
        .send({ name: 'Linked Product', price: 10, categoryId: category.id })
        .expect(201);

      await http().delete(`/categories/${category.id}`).set(auth('admin')).expect(409);
      await http().get(`/categories/${category.id}`).set(auth('admin')).expect(200);
    });

    it('deletes an unused category as admin with 204', async () => {
      const category = await createCategory();

      await http().delete(`/categories/${category.id}`).set(auth('admin')).expect(204);
      await http().get(`/categories/${category.id}`).set(auth('admin')).expect(404);
    });
  });
});
