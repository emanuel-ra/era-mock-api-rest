import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RefreshTokensRepository } from '../src/auth/repositories/refresh-tokens.repository';
import { createApp, login, PASSWORD } from './helpers';

/** Reads the claims of a JWT without verifying it. */
function decodeJwt(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

describe('Auth (e2e)', () => {
  let app: INestApplication;

  const http = () => request(app.getHttpServer());

  const loginPair = async (email = 'admin@mock.dev', password = PASSWORD) =>
    (await http().post('/auth/login').send({ email, password }).expect(201)).body as {
      accessToken: string;
      refreshToken: string;
    };

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('returns an access token, a refresh token and the user for valid credentials', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ email: 'admin@mock.dev', password: PASSWORD })
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
      expect(res.body.user).toEqual({
        id: expect.any(String),
        email: 'admin@mock.dev',
        name: 'Admin User',
        role: 'admin',
      });
    });

    it('returns 401 for a wrong password', () => {
      return http()
        .post('/auth/login')
        .send({ email: 'admin@mock.dev', password: 'wrong-password' })
        .expect(401);
    });

    it('returns 401 for an unknown email', () => {
      return http()
        .post('/auth/login')
        .send({ email: 'nobody@mock.dev', password: PASSWORD })
        .expect(401);
    });

    it('returns 400 when the body is invalid', () => {
      return http()
        .post('/auth/login')
        .send({ email: 'not-an-email', password: '123' })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    const refresh = (refreshToken: unknown) => http().post('/auth/refresh').send({ refreshToken });

    const expectInvalid = async (refreshToken: string) => {
      const res = await refresh(refreshToken).expect(401);
      expect(res.body.message).toBe('Invalid refresh token');
    };

    it('exchanges a refresh token for a new pair without an Authorization header', async () => {
      const { refreshToken } = await loginPair();

      const res = await refresh(refreshToken).expect(200);

      expect(res.body).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: { id: expect.any(String), email: 'admin@mock.dev', name: 'Admin User', role: 'admin' },
      });
      expect(res.body.refreshToken).not.toBe(refreshToken);
      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
    });

    it('rejects a refresh token that was already exchanged', async () => {
      const { refreshToken } = await loginPair();
      await refresh(refreshToken).expect(200);

      await expectInvalid(refreshToken);
    });

    it('keeps the rotated token usable for the next refresh', async () => {
      const { refreshToken } = await loginPair();
      const first = await refresh(refreshToken).expect(200);

      await refresh(first.body.refreshToken).expect(200);
    });

    it('rejects an unknown refresh token', async () => {
      await expectInvalid('not-a-real-refresh-token');
    });

    it('rejects an expired refresh token', async () => {
      const { refreshToken } = await loginPair();
      // Expire it in the store instead of waiting JWT_REFRESH_EXPIRES_IN.
      const repo = app.get(RefreshTokensRepository);
      const stored = repo.findByToken(refreshToken)!;
      repo.update(stored.id, { expiresAt: new Date(Date.now() - 1000) });

      await expectInvalid(refreshToken);
    });

    it.each([
      ['a missing refreshToken', {}],
      ['an empty refreshToken', { refreshToken: '' }],
      ['a non-string refreshToken', { refreshToken: 123 }],
      ['extra fields', { refreshToken: 'abc', extra: true }],
    ])('returns 400 with the validation messages for %s', async (_case, body) => {
      const res = await http().post('/auth/refresh').send(body).expect(400);

      expect(res.body.message).toEqual(expect.any(Array));
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    describe('with a user managed through /users', () => {
      let adminToken: string;
      let userId: string;
      let email: string;

      beforeEach(async () => {
        adminToken = await login(app, 'admin');
        email = `refresh-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
        const res = await http()
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Refresh Tester', email, password: PASSWORD, role: 'user' })
          .expect(201);
        userId = res.body.id;
      });

      it('rejects the refresh token of a deleted user', async () => {
        const { refreshToken } = await loginPair(email);
        await http().delete(`/users/${userId}`).set('Authorization', `Bearer ${adminToken}`).expect(204);

        await expectInvalid(refreshToken);
      });

      it('issues an access token with the current role after a role change', async () => {
        const { refreshToken } = await loginPair(email);
        await http()
          .patch(`/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'viewer' })
          .expect(200);

        const res = await refresh(refreshToken).expect(200);

        expect(res.body.user.role).toBe('viewer');
        expect(decodeJwt(res.body.accessToken)).toMatchObject({ sub: userId, role: 'viewer' });
      });
    });

    it('answers a forced x-mock-status without consuming the refresh token', async () => {
      const { refreshToken } = await loginPair();

      const res = await http()
        .post('/auth/refresh')
        .set('x-mock-status', '401')
        .send({ refreshToken })
        .expect(401);

      expect(res.body.message).toBe('Simulated error (x-mock-status)');
      await refresh(refreshToken).expect(200);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user without the password', async () => {
      const token = await login(app, 'viewer');

      const res = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toMatchObject({ email: 'viewer@mock.dev', role: 'viewer' });
      expect(res.body).not.toHaveProperty('password');
    });

    it('returns 401 without a token', () => {
      return http().get('/auth/me').expect(401);
    });

    it('returns 401 with an invalid token', () => {
      return http()
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });
  });
});

describe('JWT_REFRESH_EXPIRES_IN (e2e)', () => {
  const saved = process.env.JWT_REFRESH_EXPIRES_IN;

  afterEach(() => {
    if (saved === undefined) delete process.env.JWT_REFRESH_EXPIRES_IN;
    else process.env.JWT_REFRESH_EXPIRES_IN = saved;
  });

  // The 7d default is covered in refresh-token.config.spec.ts: here a local
  // .env could set the variable, so only an explicit value is reliable.
  it('sets the refresh token lifetime', async () => {
    process.env.JWT_REFRESH_EXPIRES_IN = '2h';
    const app = await createApp();
    try {
      const before = Date.now();
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@mock.dev', password: PASSWORD })
        .expect(201);

      const stored = app.get(RefreshTokensRepository).findByToken(res.body.refreshToken)!;
      const twoHours = 2 * 60 * 60 * 1000;
      expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(before + twoHours);
      expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + twoHours);
    } finally {
      await app.close();
    }
  });

  it('stops the app on boot with an invalid value', async () => {
    process.env.JWT_REFRESH_EXPIRES_IN = 'not-a-duration';

    await expect(createApp()).rejects.toThrow(/JWT_REFRESH_EXPIRES_IN/);
  });
});
