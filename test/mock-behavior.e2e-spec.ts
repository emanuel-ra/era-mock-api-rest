import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, login } from './helpers';

describe('Mock latency and errors (e2e)', () => {
  let app: INestApplication;
  let token: string;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    token = await login(app, 'admin');
  });

  afterAll(async () => {
    await app.close();
  });

  it('delays the response by x-mock-delay', async () => {
    const start = Date.now();
    await http()
      .get('/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-mock-delay', '300')
      .expect(200);

    expect(Date.now() - start).toBeGreaterThanOrEqual(290);
  });

  it('responds the x-mock-status code with the Nest error format', async () => {
    const res = await http()
      .get('/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-mock-status', '503')
      .expect(503);

    expect(res.body).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Simulated error (x-mock-status)',
    });
  });

  it('does not run the handler when the status is forced', async () => {
    const before = await http().get('/seed/status').expect(200);

    await http()
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-mock-status', '422')
      .send({ name: 'Never Saved', email: 'never-saved@example.com' })
      .expect(422);

    const after = await http().get('/seed/status').expect(200);
    expect(after.body.customers).toBe(before.body.customers);
  });

  it('skips body validation when the status is forced', async () => {
    await http()
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('x-mock-status', '500')
      .send({ unknown: 'field' })
      .expect(500);
  });

  it('works on public routes', async () => {
    await http().get('/seed/status').set('x-mock-status', '404').expect(404);
  });

  it.each(['abc', '-5', '10001'])('rejects x-mock-delay "%s" with 400', async (value) => {
    const res = await http().get('/seed/status').set('x-mock-delay', value).expect(400);
    expect(res.body.message).toMatch(/x-mock-delay/);
  });

  it.each(['200', '600', 'abc'])('rejects x-mock-status "%s" with 400', async (value) => {
    const res = await http().get('/seed/status').set('x-mock-status', value).expect(400);
    expect(res.body.message).toMatch(/x-mock-status/);
  });
});

describe('Mock latency and errors from env (e2e)', () => {
  let app: INestApplication;
  const saved = {
    delay: process.env.MOCK_DELAY_MS,
    rate: process.env.MOCK_ERROR_RATE,
  };

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.MOCK_DELAY_MS = '200';
    process.env.MOCK_ERROR_RATE = '1';
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    for (const [key, value] of [
      ['MOCK_DELAY_MS', saved.delay],
      ['MOCK_ERROR_RATE', saved.rate],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('responds 500 at random with MOCK_ERROR_RATE=1 after the base delay', async () => {
    const start = Date.now();
    const res = await http().post('/auth/login').send({}).expect(500);

    expect(Date.now() - start).toBeGreaterThanOrEqual(190);
    expect(res.body).toMatchObject({
      statusCode: 500,
      message: 'Simulated random error (MOCK_ERROR_RATE)',
    });
  });

  it('keeps GET /seed/status healthy and fast', async () => {
    const start = Date.now();
    await http().get('/seed/status').expect(200);
    expect(Date.now() - start).toBeLessThan(150);
  });
});
