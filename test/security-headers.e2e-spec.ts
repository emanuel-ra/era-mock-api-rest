import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from './helpers';

describe('Security headers (e2e)', () => {
  let app: INestApplication;
  let csp: string;

  beforeAll(async () => {
    app = await createApp();
    const res = await request(app.getHttpServer()).get('/seed/status').expect(200);
    csp = res.headers['content-security-policy'];
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not ask browsers to upgrade to https, so Swagger loads over plain http', () => {
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('keeps the rest of the default helmet policy', () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
  });
});
