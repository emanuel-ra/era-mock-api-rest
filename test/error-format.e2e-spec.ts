import { INestApplication } from '@nestjs/common';
import request, { Response } from 'supertest';
import { validate as isUuid } from 'uuid';
import { createApp, loginAll, SeededRole } from './helpers';

describe('Error format (e2e)', () => {
  let app: INestApplication;
  let tokens: Record<SeededRole, string>;

  const http = () => request(app.getHttpServer());
  const auth = (role: SeededRole) => ({ Authorization: `Bearer ${tokens[role]}` });

  /** Every error body has exactly these fields, and requestId matches the header. */
  function expectErrorFormat(res: Response, statusCode: number, error: string, path: string) {
    expect(res.body).toEqual({
      statusCode,
      error,
      message: expect.anything(),
      path,
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  }

  beforeAll(async () => {
    app = await createApp();
    tokens = await loginAll(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('400: keeps the array of validation messages', async () => {
    const res = await http()
      .post('/customers')
      .set(auth('admin'))
      .send({ name: 'A', email: 'not-an-email', unknown: true })
      .expect(400);

    expectErrorFormat(res, 400, 'Bad Request', '/customers');
    expect(Array.isArray(res.body.message)).toBe(true);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'property unknown should not exist',
        'email must be an email',
        expect.stringMatching(/^name must be longer than or equal to 2/),
      ]),
    );
  });

  it('401: without a token', async () => {
    const res = await http().get('/customers').expect(401);

    expectErrorFormat(res, 401, 'Unauthorized', '/customers');
    expect(res.body.message).toBe('Unauthorized');
  });

  it('403: role not allowed', async () => {
    const res = await http()
      .post('/customers')
      .set(auth('viewer'))
      .send({ name: 'Viewer Customer', email: 'viewer-customer@mock.dev' })
      .expect(403);

    expectErrorFormat(res, 403, 'Forbidden', '/customers');
    expect(typeof res.body.message).toBe('string');
  });

  it('404: unknown id, path includes the query string', async () => {
    const res = await http().get('/customers/unknown-id?foo=bar').set(auth('viewer')).expect(404);

    expectErrorFormat(res, 404, 'Not Found', '/customers/unknown-id?foo=bar');
    expect(typeof res.body.message).toBe('string');
  });

  it('404: unknown route', async () => {
    const res = await http().get('/does-not-exist').expect(404);

    expectErrorFormat(res, 404, 'Not Found', '/does-not-exist');
  });

  it('409: duplicated email', async () => {
    const list = await http().get('/customers').set(auth('admin')).expect(200);
    const existing = list.body.data[0];

    const res = await http()
      .post('/customers')
      .set(auth('admin'))
      .send({ name: 'Duplicated', email: existing.email })
      .expect(409);

    expectErrorFormat(res, 409, 'Conflict', '/customers');
    expect(typeof res.body.message).toBe('string');
  });

  describe('requestId', () => {
    it('reuses the x-request-id header sent by the client', async () => {
      const res = await http()
        .get('/customers/unknown-id')
        .set(auth('viewer'))
        .set('x-request-id', 'client-trace-123')
        .expect(404);

      expect(res.body.requestId).toBe('client-trace-123');
      expect(res.headers['x-request-id']).toBe('client-trace-123');
    });

    it('generates a uuid when the header is missing', async () => {
      const res = await http().get('/customers/unknown-id').set(auth('viewer')).expect(404);

      expect(isUuid(res.body.requestId)).toBe(true);
    });

    it('generates a uuid when the header is not valid', async () => {
      const res = await http()
        .get('/customers/unknown-id')
        .set(auth('viewer'))
        .set('x-request-id', 'not valid!')
        .expect(404);

      expect(isUuid(res.body.requestId)).toBe(true);
    });

    it('is also returned on successful responses', async () => {
      const res = await http()
        .get('/seed/status')
        .set('x-request-id', 'ok-trace')
        .expect(200);

      expect(res.headers['x-request-id']).toBe('ok-trace');
    });
  });
});
