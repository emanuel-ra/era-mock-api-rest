# Copilot instructions for era-mock-api-rest

## Repository context

This repo is a NestJS REST API that keeps all state in memory. There is no database layer or persistent storage: all records live in in-memory repositories and are reset/re-seeded on startup via `SeedModule`.

The app is assembled in `src/app.module.ts` with these modules:

- `AuthModule`: JWT login and identity endpoints
- `CustomersModule`: customer CRUD
- `ProductsModule`: product CRUD
- `SeedModule`: reset/status endpoints and bootstrap seeding

The service is designed for frontend testing, not long-lived production data.

## Commands

Use the repository scripts from the project root:

```bash
cp .env.example .env
npm install
npm run start:dev    # watch mode
npm run start        # single-process mode
npm run build        # NestJS production build
npm run lint         # ESLint over src/ and test/
npm run type-check  # TypeScript compile check with noEmit
npm test            # Jest unit tests (src/**/*.spec.ts)
npm run test:cov    # unit tests with coverage
npm run test:e2e    # e2e tests over HTTP (test/**/*.e2e-spec.ts)
npx jest src/customers/customers.service.spec.ts   # single test file
```

Unit tests use Jest + ts-jest and live next to the code as `*.spec.ts`. E2E tests live in `test/*.e2e-spec.ts` and use Supertest against the full `AppModule` (see `test/helpers.ts`). Validation is via `npm run lint`, `npm run type-check`, `npm test` and `npm run test:e2e`.

## High-level architecture

- `src/main.ts` bootstraps NestJS, enables CORS, applies `ValidationPipe` globally with `whitelist` and `forbidNonWhitelisted`, and serves Swagger at `/api/docs`.
- `src/core/repositories/in-memory.repository.ts` is the shared storage abstraction. It wraps a `Map<string, T>`, exposes CRUD and collection helpers, and is the base for domain repositories.
- Domain repositories extend the generic in-memory repository to add entity-specific queries (for example, email-based lookup for users).
- `docs/features.md` is the source of truth for the API contract. If a route or module changes, update the feature catalog in the same change.
- `docs/adding-a-resource.md` documents the standard pattern for adding new resources: entity, repository, DTOs, service, controller, module registration, and seed implementation.

## Auth and access rules

- JWT is issued by `AuthService.login` and validated by `JwtStrategy`.
- The app uses role-based access:
  - `admin`
  - `user`
  - `viewer`
- Guard pattern: `JwtAuthGuard` + `RolesGuard` together.
- Public endpoints are intentionally not protected; protected routes require a bearer token and the correct role set.

## Request/response conventions

- Validation is global and strict (`whitelist: true`, `forbidNonWhitelisted: true`): unknown fields are rejected with `400`.
- List endpoints generally use `page` and `limit`, and return data in the shape `{ data, meta: { total, page, limit, totalPages } }`.
- Search filters are case-insensitive; substring filters are used for specific searchable fields, while exact matches are used for other string filters.
- Duplicate unique keys are rejected with `409`; missing records with `404`.
- Swagger docs are available at `/api/docs` and include Bearer auth configuration.

## Seed and data behavior

- Data is seeded automatically on boot; no database migration or persistence step exists.
- `SeedModule` and `SeedService` are responsible for resetting and repopulating in-memory data.
- `POST /seed/reset` clears all stores and reseeds them with fresh mock data.
- `GET /seed/status` returns counts for the seeded collections.

## Code conventions specific to this repo

- Prefer the existing repository/service/controller patterns of `CustomersModule` and `ProductsModule` when adding similar CRUD features.
- Keep in-memory data handling inside the repository layer rather than scattering state management across controllers or services.
- Preserve the existing DTO pattern: create/update/filter DTOs are used consistently, and filters extend pagination DTOs when needed.
- If you change the API surface (routes, fields, auth, or module behavior), update `docs/features.md` in the same branch.
- If you change architecture or seeding behavior, keep the matching docs under `docs/` in sync.

## Git and commit conventions

Follow the repo’s existing AI workflow conventions in `.claude/rules/`:

- Never change code or commit on `main`.
- Use branch names like `feat/<short-description>` or `fix/<issue-number>-<short-description>`.
- Use Conventional Commits (`feat`, `fix`, `docs`, `refactor`, etc.).

## When in doubt

Before answering product/API questions, check `docs/features.md` first. It is the canonical source for what the API exposes and how access is enforced.
