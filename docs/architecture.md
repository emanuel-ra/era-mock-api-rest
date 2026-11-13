# Architecture

NestJS REST API that runs entirely **in memory** — no database. All data is lost on restart and re-seeded on boot via `SeedModule` (see [seed-data.md](seed-data.md)).

## Data layer

`InMemoryRepository<T>` ([src/core/repositories/in-memory.repository.ts](../src/core/repositories/in-memory.repository.ts)) is the single generic base class for all storage. It wraps a `Map<string, T>` and provides `findAll` (with optional filtering: string fields match exactly, case-insensitive, unless listed in the subclass's `searchableFields`, which match by substring), `findById`, `findByIdOrFail`, `create` (auto-assigns UUID + timestamps; the seed can pass a fixed id or a past `createdAt`), `update`, `delete`, `count`, and `clear`. Domain repositories extend this class and add any entity-specific lookups (e.g. `findByEmail` on `UsersRepository`).

## Modules

| Module | Routes | Auth |
|--------|--------|------|
| `AuthModule` | `POST /auth/login`, `GET /auth/me` | login is public; `/me` requires JWT |
| `UsersModule` | `GET/POST /users`, `GET/PATCH/DELETE /users/:id` | JWT required; Admin-only |
| `CategoriesModule` | `GET/POST /categories`, `GET/PATCH/DELETE /categories/:id` | JWT required; POST/PATCH need Admin or User; DELETE is Admin-only |
| `CustomersModule` | `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id` | JWT required; POST/PATCH need Admin or User; DELETE is Admin-only |
| `ProductsModule` | same shape as customers | JWT required; POST/PATCH need Admin or User; DELETE is Admin-only |
| `OrdersModule` | same shape as customers, plus `PATCH /orders/:id/status` | JWT required; POST/PATCH need Admin or User; DELETE is Admin-only |
| `StatsModule` | `GET /stats/summary`, `GET /stats/sales`, `GET /stats/top-products` | JWT required; any role (read-only) |
| `SeedModule` | `POST /seed/reset`, `GET /seed/status` | public |

`ProductsModule` and `CategoriesModule` import each other with `forwardRef`: `ProductsService` uses `CategoriesRepository` to validate `categoryId`, and `CategoriesService` uses `ProductsRepository` to block deleting a category that products still use. Only the modules are circular; no provider depends on itself.

`OrdersModule` and `CustomersModule` follow the same pattern: `OrdersService` uses `CustomersRepository` to validate `customerId`, and `CustomersService` uses `OrdersRepository` to block deleting a customer that has orders. `OrdersModule` also imports `ProductsModule` to read product names and prices.

`UsersModule` imports `AuthModule` and reuses its `UsersRepository`, which login and `JwtStrategy` also read, so users created, changed or deleted through `/users` take effect for auth at once. `UsersService` strips `password` from every response.

`StatsModule` only reads: it imports `CustomersModule`, `ProductsModule` and `OrdersModule` and aggregates their repositories in memory. Nothing imports it back, so it needs no `forwardRef`.

## Auth & roles

JWT is issued by `AuthService.login`. The strategy (`JwtStrategy`) extracts `{ id, email, role }` from the token payload into `req.user`. Two guards exist:

- `JwtAuthGuard` — validates the token.
- `RolesGuard` — reads the `@Roles(...)` decorator and checks `req.user.role`. Used together with `JwtAuthGuard`.

Roles enum: `admin`, `user`, `viewer` (defined in [src/core/decorators/roles.decorator.ts](../src/core/decorators/roles.decorator.ts)).

## Pagination, filtering & sorting

`PaginationDto` (`page`, `limit`, `order`) and entity-specific `FilterXxxDto` are composed together on list endpoints. Each `FilterXxxDto` also declares `sortBy`, validated with `@IsIn` against its own whitelist (`XXX_SORT_FIELDS`, typed as keys of the entity), so a field that is not sortable returns `400`.

Each service's `findAll` runs the same three steps:

1. `repo.findAll(filters)` filters the store (insertion order).
2. `sortItems(items, sortBy, order)` ([src/core/utils/sort.ts](../src/core/utils/sort.ts)) returns a sorted copy: strings with case-insensitive `localeCompare`, numbers and dates by value, empty values (`null`, `undefined`, `''`) last in both orders, ties in their original order. Without `sortBy` it returns the items unchanged.
3. `paginate()` ([src/core/dto/pagination.dto.ts](../src/core/dto/pagination.dto.ts)) slices the array and returns `{ data, meta: { total, page, limit, totalPages } }`.

Sorting lives in the service, not in `InMemoryRepository`, so the repository stays a plain store and sorting stays next to pagination, which it must run before.

## Simulated latency and errors

`MockBehaviorInterceptor` ([src/core/interceptors/mock-behavior.interceptor.ts](../src/core/interceptors/mock-behavior.interceptor.ts)) is a global interceptor registered in `setupApp()` ([src/app.setup.ts](../src/app.setup.ts)), so the server and the e2e tests both use it. Its options come from `mockBehaviorOptionsFromConfig()`, which reads `MOCK_DELAY_MS` and `MOCK_ERROR_RATE` through `ConfigService` (default 0, invalid values throw on boot).

For each HTTP request it validates the `x-mock-delay` / `x-mock-status` headers (`400` if invalid), waits for the delay with an RxJS `timer` (skipped when the delay is 0), then throws the forced status or a random `500`, or calls the handler. Because Nest runs guards before interceptors and pipes after them, auth errors win over a forced status, and a forced status skips validation and the handler. Routes Nest does not handle (unknown routes, Swagger UI) never reach the interceptor; `GET /seed/status` and `/api/docs*` are also exempt from the env delay and random errors.

## Swagger

Served at `/api/docs` with Bearer auth configured. `main.ts` adds `x-mock-delay` and `x-mock-status` as global header parameters, so they show up on every endpoint.
