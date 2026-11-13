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
npm run test:all:report   # unit + e2e with JSON and HTML reports (output: reports/)
npx jest src/customers   # run a single folder or file
docker compose up --build   # run the API in Docker (port from .env PORT, default 3000)
```

Unit tests live next to the code they test as `*.spec.ts`. They cover services, repositories, `paginate`, `RolesGuard` and `JwtStrategy`; controllers are covered by the e2e tests instead.

E2E tests live in `test/` and use Supertest against the full `AppModule`, booted by `createApp()` in `test/helpers.ts` with the same global setup as the server (`setupApp()` in `src/app.setup.ts`). Each e2e file gets its own app instance, so in-memory data is not shared between files. `tsconfig.build.json` keeps spec files and `test/` out of `dist/`.

CI (`.github/workflows/ci.yml`, GitHub Actions, Node 24) runs lint, type-check, unit tests, e2e tests and build on every pull request and push to `main` or `dev` (job "Lint, type-check, tests and build"). A second job, "Docker image", builds the image with layer caching and runs `scripts/docker-smoke-test.sh` against it (healthy status, `/seed/status`, Swagger, login, 401 without token, runs as `node`, no `.env` or `src/` in the image). It runs without a `.env` file, so the app must keep working with the config fallbacks.

Docker: `Dockerfile` is a two-stage build on `node:24-alpine` (build with dev deps → runtime with `npm ci --omit=dev` + `dist/`, user `node`, healthcheck on `GET /seed/status`). `compose.yaml` maps `${PORT:-3000}` to the container's port 3000 and passes `JWT_SECRET`/`JWT_EXPIRES_IN` from `.env` or defaults. `.dockerignore` keeps `.env`, tests and docs out of the build context. If a new runtime file is needed (e.g. assets), copy it in the Dockerfile runtime stage.

## Overview

NestJS REST API that runs entirely **in memory** — no database. All data is lost on restart and re-seeded on boot via `SeedModule`. Modules: `AuthModule` (JWT + roles `admin`/`user`/`viewer`), `CategoriesModule`, `CustomersModule`, `ProductsModule` (products reference categories by `categoryId`), `OrdersModule` (orders reference a customer and products; status flow `pending → paid → shipped → delivered` or `cancelled`), `SeedModule`. Swagger is served at `/api/docs`.

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

Working rules in `.claude/rules/` (loaded automatically): git workflow and branch naming, commit conventions, and keeping `docs/features.md` up to date.

Git flow: `dev` is the default and integration branch; `main` only receives release PRs from `dev`. Each unit of work runs in its own git worktree under `.claude/worktrees/` (gitignored) and reaches `dev` through its own PR, merged with a merge commit. Skills in `.claude/skills/`:

- `/start-work`: worktree from `origin/dev` → implement → verify → review → PR into `dev`.
- `/finish-work`: after the merge, removes the worktree and local branch and updates `dev`.
- `/release`: PR from `dev` into `main` with a changelog.

The `.claude/hooks/protect-branches.sh` hook blocks editing files or committing in any checkout that is on `main` or `dev`. The `.claude/hooks/related-tests.sh` hook runs `jest --findRelatedTests` after every edit of a `.ts` file and reports failures back to Claude.

Subagents in `.claude/agents/`:

- `test-runner`: runs `npm run test:all:report`, re-runs failures to spot flaky tests, classifies each failure's cause and writes `reports/diagnostico-<date>.html`. It only writes inside `reports/` (gitignored).
