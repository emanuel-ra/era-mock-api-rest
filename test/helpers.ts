import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

export const PASSWORD = 'password123';

export const USERS = {
  admin: 'admin@mock.dev',
  user: 'user@mock.dev',
  viewer: 'viewer@mock.dev',
} as const;

export type SeededRole = keyof typeof USERS;

/**
 * Boots the full AppModule with the same global pipes as main.ts.
 * Each test file gets its own app, so in-memory data is not shared between files.
 */
export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  setupApp(app);
  await app.init(); // runs onModuleInit, so the seed data is loaded
  return app;
}

export async function login(app: INestApplication, role: SeededRole): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: USERS[role], password: PASSWORD })
    .expect(201);
  return res.body.accessToken;
}

/** Logs in every seeded user and returns a token per role. */
export async function loginAll(app: INestApplication): Promise<Record<SeededRole, string>> {
  const [admin, user, viewer] = await Promise.all([
    login(app, 'admin'),
    login(app, 'user'),
    login(app, 'viewer'),
  ]);
  return { admin, user, viewer };
}

/** Comparators matching how the API sorts each kind of field (see src/core/utils/sort.ts). */
export const compareBy = {
  text: (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }),
  number: (a: number, b: number) => a - b,
  date: (a: string, b: string) => Date.parse(a) - Date.parse(b),
};

/** Asserts that `values` are already in `order` according to `compare`. */
export function expectSorted<T>(
  values: T[],
  order: 'asc' | 'desc',
  compare: (a: T, b: T) => number,
): void {
  const direction = order === 'desc' ? -1 : 1;
  expect(values.length).toBeGreaterThan(1);
  expect(values).toEqual([...values].sort((a, b) => compare(a, b) * direction));
}
