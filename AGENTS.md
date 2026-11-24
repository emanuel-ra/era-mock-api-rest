# AGENTS.md

Guidance for AI coding agents and contributors working in this repository, whatever the tool. Details live in `docs/` and `.claude/rules/`; this file links to them.

## Overview

NestJS REST API for frontend testing that runs entirely **in memory**: no database. All data is lost on restart and re-seeded with Faker on boot by `SeedModule`. Swagger is served at `/api/docs`.

Modules:

- `AuthModule`: JWT login, roles `admin` / `user` / `viewer`.
- `UsersModule`: admin-only user CRUD over the same users store.
- `CategoriesModule`, `CustomersModule`, `ProductsModule`: CRUD; products reference categories by `categoryId`.
- `OrdersModule`: orders reference a customer and products; status flow `pending → paid → shipped → delivered` or `cancelled`.
- `StatsModule`: read-only dashboard aggregates over customers, products and orders.
- `SeedModule`: seeds on boot, plus reset and status endpoints.

## Commands

```bash
npm ci                     # install the locked dependencies
npm run start:dev          # start with hot reload
npm run start              # start without watch
npm run build              # compile via NestJS CLI (output: dist/)
npm run lint               # ESLint over src/ and test/
npm run type-check         # tsc --noEmit
npm test                   # Jest unit tests (src/**/*.spec.ts)
npm run test:watch         # unit tests in watch mode
npm run test:cov           # unit tests with coverage (output: coverage/)
npm run test:e2e           # e2e tests over HTTP (test/**/*.e2e-spec.ts)
npm run test:all:report    # unit + e2e with JSON reports (output: reports/)
npx jest src/customers     # run a single folder or file
docker compose up --build  # run the API in Docker (port from .env PORT, default 3000)
```

## Environment

Copy `.env.example` to `.env`. Required: `PORT` (default 3000), `JWT_SECRET`, `JWT_EXPIRES_IN` (e.g. `1h`). Optional: `JWT_REFRESH_EXPIRES_IN` (refresh token lifetime, same format, default `7d`; an invalid value stops the app on boot), `MOCK_DELAY_MS` (base latency, integer 0–10000) and `MOCK_ERROR_RATE` (chance 0–1 of a random `500`); both default to 0 when unset, and an invalid value stops the app on boot. CI and Docker run without `.env`, so the config fallbacks must keep working. Load configuration through environment variables and Nest's `ConfigModule`; never commit secrets.

## Project structure

- `src/<feature>/`: one folder per module (`auth`, `users`, `categories`, `customers`, `products`, `orders`, `stats`, `seed`) with its controller, service, repository, DTOs, entity and unit specs.
- `src/core/`: shared guards, decorators, DTOs, entities, repositories (`InMemoryRepository<T>`), interceptors, filters, interfaces and utilities. `src/app.setup.ts` holds the global setup shared by the server and the e2e tests.
- `test/`: e2e tests and helpers. `docs/`: project docs. `bruno/`: manual testing collection. Generated output: `dist/`, `coverage/`, `reports/`.

## Coding conventions

- TypeScript following the existing NestJS patterns; two-space indentation, single quotes, semicolons. ESLint config in `eslint.config.mjs`; fix lint and type errors before submitting.
- Files in kebab-case with role suffixes (`customers.service.ts`, `create-product.dto.ts`, `products.repository.spec.ts`); PascalCase for classes and DTOs, camelCase for methods and variables.
- Follow the customers/products pattern for new CRUD resources and keep in-memory state inside the repository layer. Steps: [docs/adding-a-resource.md](docs/adding-a-resource.md).

## Testing

- Unit tests (Jest + `ts-jest`) live next to the code as `*.spec.ts`. They cover services, repositories, `paginate`, `JwtAuthGuard`, `RolesGuard`, `JwtStrategy`, the mock behavior interceptor, the exceptions filter and the utilities in `src/core/utils/`; controllers are covered by the e2e tests.
- E2E tests live in `test/*.e2e-spec.ts` (config `test/jest-e2e.json`) and use Supertest against the full `AppModule`, booted by `createApp()` in `test/helpers.ts` with the same global setup as the server (`setupApp()`). Each e2e file gets its own app instance, so in-memory data is not shared between files. `tsconfig.build.json` keeps specs and `test/` out of `dist/`.
- Add or update tests with every behavior change, including success and error cases. No coverage threshold is configured.
- Before a PR, run `npm run type-check`, `npm run lint`, `npm test` and `npm run test:e2e`. CI runs the same plus the build and a Docker smoke test: [docs/ci-and-docker.md](docs/ci-and-docker.md).

## Critical rules

- Branch from `origin/dev`, one branch per unit of work, named `<type>/<short-description>` (fixes: `fix/<issue>-<short-description>`).
- Open PRs into `dev` (merged with a merge commit); `main` only receives release PRs from `dev`. A PR explains the behavior change, its API or config impact, related issues and test evidence.
- Never change files or commit on `main` or `dev`.
- Never `git push`, open a PR or create an issue without the user's explicit approval for that action.
- Keep `docs/features.md` and the `bruno/` collection in sync with every endpoint or module change, in the same branch.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, …; `!` for breaking changes).
- Answer "what does the API do?" questions from `docs/features.md`.
- `POST /seed/reset` replaces all in-memory data; use it only in development or test environments.

## Detailed docs

- [docs/features.md](docs/features.md): modules, endpoints, access, filters and shared API conventions (source of truth for the API contract).
- [docs/architecture.md](docs/architecture.md): data layer, modules, auth, pagination, error format.
- [docs/seed-data.md](docs/seed-data.md): seed data and default credentials.
- [docs/adding-a-resource.md](docs/adding-a-resource.md): steps to add a new resource.
- [docs/manual-testing.md](docs/manual-testing.md): the Bruno collection.
- [docs/ci-and-docker.md](docs/ci-and-docker.md): CI jobs, Docker image, line endings.
- [docs/deploy.md](docs/deploy.md): deploy to a server in the local network, checks and rollback.
- [.claude/rules/git-workflow.md](.claude/rules/git-workflow.md): branches, worktrees, merging, push and PR approval.
- [.claude/rules/git-conventions.md](.claude/rules/git-conventions.md): commit message format.
- [.claude/rules/feature-docs.md](.claude/rules/feature-docs.md): keeping `docs/features.md` and `bruno/` in sync.
