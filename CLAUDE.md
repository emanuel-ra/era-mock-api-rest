# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev    # start with hot reload (development)
npm run start        # start without watch
npm run build        # compile via NestJS CLI (output: dist/)
npm run lint         # ESLint over src/
npm run type-check   # tsc --noEmit
npm test             # Jest unit tests (src/**/*.spec.ts)
npm run test:watch   # unit tests in watch mode
npm run test:cov     # unit tests with coverage report (output: coverage/)
npx jest src/customers   # run a single folder or file
```

Unit tests live next to the code they test as `*.spec.ts`. They cover services, repositories, `paginate`, `RolesGuard` and `JwtStrategy`; controllers are not unit-tested (e2e tests are not set up yet). `tsconfig.build.json` keeps spec files out of `dist/`.

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
