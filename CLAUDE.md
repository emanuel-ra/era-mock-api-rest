# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev    # start with hot reload (development)
npm run start        # start without watch
npm run build        # compile via NestJS CLI (output: dist/)
npm run lint         # ESLint over src/ and test/
npm run type-check   # tsc --noEmit
npm test             # Jest unit tests (src/**/*.spec.ts)
npm run test:watch   # unit tests in watch mode
npm run test:cov     # unit tests with coverage report (output: coverage/)
npm run test:e2e     # e2e tests over HTTP (test/**/*.e2e-spec.ts)
npx jest src/customers   # run a single folder or file
```

Unit tests live next to the code they test as `*.spec.ts`. They cover services, repositories, `paginate`, `RolesGuard` and `JwtStrategy`; controllers are covered by the e2e tests instead.

E2E tests live in `test/` and use Supertest against the full `AppModule`, booted by `createApp()` in `test/helpers.ts` with the same global setup as the server (`setupApp()` in `src/app.setup.ts`). Each e2e file gets its own app instance, so in-memory data is not shared between files. `tsconfig.build.json` keeps spec files and `test/` out of `dist/`.

CI (`.github/workflows/ci.yml`, GitHub Actions, Node 24) runs lint, type-check, unit tests, e2e tests and build on every pull request and push to `main`. It runs without a `.env` file, so the app must keep working with the config fallbacks.

## Overview

NestJS REST API that runs entirely **in memory** — no database. All data is lost on restart and re-seeded on boot via `SeedModule`. Modules: `AuthModule` (JWT + roles `admin`/`user`/`viewer`), `CustomersModule`, `ProductsModule`, `SeedModule`. Swagger is served at `/api/docs`.

## Environment

Copy `.env.example` to `.env`. Required variables:

```
PORT=3000
JWT_SECRET=...
JWT_EXPIRES_IN=1h
```

## Detailed docs

- Features catalog (modules, endpoints, access, filters): @docs/features.md
- Architecture (data layer, modules, auth, pagination): @docs/architecture.md
- Seed data and default credentials: @docs/seed-data.md
- Steps to add a new resource: @docs/adding-a-resource.md

Working rules in `.claude/rules/` (loaded automatically): git workflow and branch naming, commit conventions, and keeping `docs/features.md` up to date. The `/start-work` skill (`.claude/skills/start-work/`) runs the full branch → implement → review → PR workflow.
