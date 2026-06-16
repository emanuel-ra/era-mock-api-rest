# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev    # start with hot reload (development)
npm run start        # start without watch
npm run build        # compile via NestJS CLI (output: dist/)
npm run lint         # ESLint over src/
npm run type-check   # tsc --noEmit (no test runner is configured)
```

No test suite is set up; `type-check` is the only automated correctness check available.

## Architecture

NestJS REST API that runs entirely **in memory** — no database. All data is lost on restart and re-seeded on boot via `SeedModule`.

### Data layer

`InMemoryRepository<T>` ([src/core/repositories/in-memory.repository.ts](src/core/repositories/in-memory.repository.ts)) is the single generic base class for all storage. It wraps a `Map<string, T>` and provides `findAll` (with optional partial-match filtering), `findById`, `findByIdOrFail`, `create` (auto-assigns UUID + timestamps), `update`, `delete`, `count`, and `clear`. Domain repositories extend this class and add any entity-specific lookups (e.g. `findByEmail` on `UsersRepository`).

### Modules

| Module | Routes | Auth |
|--------|--------|------|
| `AuthModule` | `POST /auth/login`, `GET /auth/me` | login is public; `/me` requires JWT |
| `CustomersModule` | `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id` | JWT required; DELETE is Admin-only |
| `ProductsModule` | same shape as customers | JWT required; POST/PATCH need Admin or User; DELETE is Admin-only |
| `SeedModule` | `POST /seed/reset`, `GET /seed/status` | public |

### Auth & roles

JWT is issued by `AuthService.login`. The strategy (`JwtStrategy`) extracts `{ id, email, role }` from the token payload into `req.user`. Two guards exist:
- `JwtAuthGuard` — validates the token.
- `RolesGuard` — reads the `@Roles(...)` decorator and checks `req.user.role`. Used together with `JwtAuthGuard`.

Roles enum: `admin`, `user`, `viewer` (defined in [src/core/decorators/roles.decorator.ts](src/core/decorators/roles.decorator.ts)).

### Seed data (auto-loaded on boot)

`SeedService.onModuleInit` populates three fixed users and 30 faker-generated customers and products. Default credentials (all share password `password123`):

| email | role |
|-------|------|
| admin@mock.dev | admin |
| user@mock.dev | user |
| viewer@mock.dev | viewer |

Calling `POST /seed/reset` clears all stores and re-runs the seed.

### Pagination & filtering

`PaginationDto` (`page`, `limit`) and entity-specific `FilterXxxDto` are composed together on list endpoints. The `paginate()` helper ([src/core/dto/pagination.dto.ts](src/core/dto/pagination.dto.ts)) slices the already-filtered array and returns `{ data, meta: { total, page, limit, totalPages } }`.

### Swagger

Served at `/api/docs` with Bearer auth configured.

## Environment

Copy `.env.example` to `.env`. Required variables:

```
PORT=3000
JWT_SECRET=...
JWT_EXPIRES_IN=1h
```

## Adding a new resource

1. Create `src/<resource>/<resource>.entity.ts` extending `BaseEntity`.
2. Create `src/<resource>/<resource>.repository.ts` extending `InMemoryRepository<Entity>`.
3. Add DTOs (create, update, filter) — filter should extend `PaginationDto`.
4. Create service + controller following the existing customers/products pattern.
5. Register everything in a new module and import it in `AppModule`.
6. Inject the new repository into `SeedService` and add a seed method.


## GitHub conventions

Use Conventional Commits 1.0.0 for commit messages.

Commit format:

```text
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

Rules:

- Use `feat` for new user-facing features.
- Use `fix` for bug fixes.
- Other accepted types: `build`, `chore`, `ci`, `docs`, `style`, `refactor`, `perf`, `test`, `revert`.
- Use an optional lowercase scope when it adds useful context, for example `feat(auth): add session refresh`.
- Keep the description short, imperative, and lowercase unless it contains a proper noun.
- Add a blank line before an optional body. Use the body to explain why the change was needed or any important implementation context.
- Mark breaking changes with `!` before the colon, a `BREAKING CHANGE: <description>` footer, or both.
- Footer tokens use git trailer style, for example `Refs: #123`, `Reviewed-by: Name`, or `BREAKING CHANGE: config shape changed`.
- Prefer small, focused commits. If one change fits multiple commit types, split it when practical.

Examples:

```text
feat(ui): add compact navigation
fix(api): handle expired access tokens
docs: update setup instructions
refactor(forms): simplify validation schema
feat(auth)!: replace legacy session format