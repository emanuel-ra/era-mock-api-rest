import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { compareBy, createApp, expectSorted, loginAll, SeededRole } from './helpers';

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';
const VIEWER_ID = '00000000-0000-4000-8000-000000000003';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let tokens: Record<SeededRole, string>;
  let counter = 0;

  const http = () => request(app.getHttpServer());
  const auth = (role: SeededRole) => ({ Authorization: `Bearer ${tokens[role]}` });
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const uniqueEmail = () => `e2e-user-${++counter}@mock.dev`;

  async function createUser(body: Record<string, unknown> = {}) {
    const res = await http()
      .post('/users')
      .set(auth('admin'))
      .send({ name: 'Jane Doe', email: uniqueEmail(), password: 'secret123', ...body })
      .expect(201);
    return res.body;
  }

  async function loginAs(email: string, password: string): Promise<string> {
    const res = await http().post('/auth/login').send({ email, password }).expect(201);
    return res.body.accessToken;
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
      return http().get('/users').expect(401);
    });

    it.each<SeededRole>(['user', 'viewer'])('returns 403 when %s lists users', (role) => {
      return http().get('/users').set(auth(role)).expect(403);
    });

    it.each<SeededRole>(['user', 'viewer'])('returns 403 when %s creates a user', (role) => {
      return http()
        .post('/users')
        .set(auth(role))
        .send({ name: 'Jane Doe', email: uniqueEmail(), password: 'secret123' })
        .expect(403);
    });

    it('returns 403 when a user tries to delete', () => {
      return http().delete(`/users/${VIEWER_ID}`).set(auth('user')).expect(403);
    });
  });

  describe('GET /users', () => {
    it('lists the seeded users with their fixed ids and without passwords', async () => {
      const res = await http().get('/users').set(auth('admin')).expect(200);

      expect(res.body.meta).toMatchObject({ page: 1, limit: 10 });
      const ids = res.body.data.map((u: { id: string }) => u.id);
      expect(ids).toEqual(expect.arrayContaining([ADMIN_ID, USER_ID, VIEWER_ID]));
      res.body.data.forEach((u: object) => expect(u).not.toHaveProperty('password'));
    });

    it('filters by role exactly', async () => {
      const res = await http().get('/users?role=viewer').set(auth('admin')).expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach((u: { role: string }) => expect(u.role).toBe('viewer'));
    });

    it('filters by name and email substring', async () => {
      const created = await createUser({ name: 'Qwxyz Person' });

      const byName = await http().get('/users?name=QWXYZ').set(auth('admin')).expect(200);
      expect(byName.body.data.map((u: { id: string }) => u.id)).toEqual([created.id]);

      const byEmail = await http()
        .get(`/users?email=${created.email.slice(0, 12)}`)
        .set(auth('admin'))
        .expect(200);
      expect(byEmail.body.data.map((u: { id: string }) => u.id)).toContain(created.id);
    });

    it('sorts by name descending', async () => {
      const res = await http()
        .get('/users?sortBy=name&order=desc&limit=100')
        .set(auth('admin'))
        .expect(200);

      expectSorted(
        res.body.data.map((u: { name: string }) => u.name),
        'desc',
        compareBy.text,
      );
    });

    it('returns 400 for an unknown role or sortBy', async () => {
      await http().get('/users?role=root').set(auth('admin')).expect(400);
      await http().get('/users?sortBy=password').set(auth('admin')).expect(400);
    });
  });

  describe('GET /users/:id', () => {
    it('returns one user without the password', async () => {
      const res = await http().get(`/users/${USER_ID}`).set(auth('admin')).expect(200);

      expect(res.body).toMatchObject({ id: USER_ID, email: 'user@mock.dev', role: 'user' });
      expect(res.body).not.toHaveProperty('password');
    });

    it('returns 404 for an unknown id', () => {
      return http().get('/users/does-not-exist').set(auth('admin')).expect(404);
    });
  });

  describe('POST /users', () => {
    it('creates a user with role user by default, who can then log in', async () => {
      const email = uniqueEmail();
      const created = await createUser({ email });

      expect(created).toMatchObject({ name: 'Jane Doe', email, role: 'user' });
      expect(created).not.toHaveProperty('password');
      await loginAs(email, 'secret123');
    });

    it('returns 409 when the email already exists', () => {
      return http()
        .post('/users')
        .set(auth('admin'))
        .send({ name: 'Copy', email: 'ADMIN@mock.dev', password: 'secret123' })
        .expect(409);
    });

    it('returns 400 for invalid or unknown fields', async () => {
      await http()
        .post('/users')
        .set(auth('admin'))
        .send({ name: 'J', email: 'not-an-email', password: '123' })
        .expect(400);
      await http()
        .post('/users')
        .set(auth('admin'))
        .send({ name: 'Jane', email: uniqueEmail(), password: 'secret123', role: 'root' })
        .expect(400);
      await http()
        .post('/users')
        .set(auth('admin'))
        .send({ name: 'Jane', email: uniqueEmail(), password: 'secret123', id: 'x' })
        .expect(400);
    });
  });

  describe('PATCH /users/:id', () => {
    it('updates the user and the new password works for login', async () => {
      const created = await createUser();

      const res = await http()
        .patch(`/users/${created.id}`)
        .set(auth('admin'))
        .send({ name: 'Renamed', password: 'newpass1', role: 'viewer' })
        .expect(200);

      expect(res.body).toMatchObject({ name: 'Renamed', role: 'viewer' });
      expect(res.body).not.toHaveProperty('password');
      await loginAs(created.email, 'newpass1');
      await http()
        .post('/auth/login')
        .send({ email: created.email, password: 'secret123' })
        .expect(401);
    });

    it('applies a role change to existing tokens at once', async () => {
      const created = await createUser({ role: 'admin' });
      const token = await loginAs(created.email, 'secret123');
      await http().get('/users').set(bearer(token)).expect(200);

      await http()
        .patch(`/users/${created.id}`)
        .set(auth('admin'))
        .send({ role: 'viewer' })
        .expect(200);

      await http().get('/users').set(bearer(token)).expect(403);
    });

    it('returns 409 when the email belongs to another user', async () => {
      const created = await createUser();

      await http()
        .patch(`/users/${created.id}`)
        .set(auth('admin'))
        .send({ email: 'viewer@mock.dev' })
        .expect(409);
    });

    it('returns 409 when an admin removes their own admin role', async () => {
      await http()
        .patch(`/users/${ADMIN_ID}`)
        .set(auth('admin'))
        .send({ role: 'user' })
        .expect(409);

      const me = await http().get('/auth/me').set(auth('admin')).expect(200);
      expect(me.body.role).toBe('admin');
    });

    it('returns 404 for an unknown id', () => {
      return http()
        .patch('/users/does-not-exist')
        .set(auth('admin'))
        .send({ name: 'Nobody' })
        .expect(404);
    });
  });

  describe('DELETE /users/:id', () => {
    it('deletes a user and rejects their existing token', async () => {
      const created = await createUser();
      const token = await loginAs(created.email, 'secret123');
      await http().get('/auth/me').set(bearer(token)).expect(200);

      await http().delete(`/users/${created.id}`).set(auth('admin')).expect(204);

      await http().get(`/users/${created.id}`).set(auth('admin')).expect(404);
      await http().get('/auth/me').set(bearer(token)).expect(401);
    });

    it('returns 409 when an admin deletes themselves', async () => {
      await http().delete(`/users/${ADMIN_ID}`).set(auth('admin')).expect(409);
      await http().get(`/users/${ADMIN_ID}`).set(auth('admin')).expect(200);
    });

    it('returns 404 for an unknown id', () => {
      return http().delete('/users/does-not-exist').set(auth('admin')).expect(404);
    });
  });
});
