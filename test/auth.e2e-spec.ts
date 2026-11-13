import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, login, PASSWORD } from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('returns a token and the user for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@mock.dev', password: PASSWORD })
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toEqual({
        id: expect.any(String),
        email: 'admin@mock.dev',
        name: 'Admin User',
        role: 'admin',
      });
    });

    it('returns 401 for a wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@mock.dev', password: 'wrong-password' })
        .expect(401);
    });

    it('returns 401 for an unknown email', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@mock.dev', password: PASSWORD })
        .expect(401);
    });

    it('returns 400 when the body is invalid', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: '123' })
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user without the password', async () => {
      const token = await login(app, 'viewer');

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toMatchObject({ email: 'viewer@mock.dev', role: 'viewer' });
      expect(res.body).not.toHaveProperty('password');
    });

    it('returns 401 without a token', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('returns 401 with an invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });
  });
});
