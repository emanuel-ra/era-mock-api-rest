import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createApp, login } from './helpers';

describe('Seed (e2e)', () => {
  let app: INestApplication;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /seed/status is public and returns the counts', async () => {
    const res = await http().get('/seed/status').expect(200);

    expect(res.body).toEqual({ users: 3, categories: 7, customers: 30, products: 30 });
  });

  it('POST /seed/reset discards changes and keeps issued tokens valid', async () => {
    const token = await login(app, 'admin');
    await http()
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Temporary', email: 'temporary@example.com' })
      .expect(201);
    expect((await http().get('/seed/status')).body.customers).toBe(31);

    const res = await http().post('/seed/reset').expect(200);

    expect(res.body).toEqual({
      message: 'Data re-seeded successfully',
      users: 3,
      categories: 7,
      customers: 30,
      products: 30,
    });
    // Seeded users keep fixed ids, so a token issued before the reset still works.
    await http().get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  });
});
