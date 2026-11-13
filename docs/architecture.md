# Architecture

NestJS REST API that runs entirely **in memory** — no database. All data is lost on restart and re-seeded on boot via `SeedModule` (see [seed-data.md](seed-data.md)).

## Data layer

`InMemoryRepository<T>` ([src/core/repositories/in-memory.repository.ts](../src/core/repositories/in-memory.repository.ts)) is the single generic base class for all storage. It wraps a `Map<string, T>` and provides `findAll` (with optional filtering: string fields match exactly, case-insensitive, unless listed in the subclass's `searchableFields`, which match by substring), `findById`, `findByIdOrFail`, `create` (auto-assigns UUID + timestamps), `update`, `delete`, `count`, and `clear`. Domain repositories extend this class and add any entity-specific lookups (e.g. `findByEmail` on `UsersRepository`).

## Modules

| Module | Routes | Auth |
|--------|--------|------|
| `AuthModule` | `POST /auth/login`, `GET /auth/me` | login is public; `/me` requires JWT |
| `CategoriesModule` | `GET/POST /categories`, `GET/PATCH/DELETE /categories/:id` | JWT required; POST/PATCH need Admin or User; DELETE is Admin-only |
| `CustomersModule` | `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id` | JWT required; POST/PATCH need Admin or User; DELETE is Admin-only |
| `ProductsModule` | same shape as customers | JWT required; POST/PATCH need Admin or User; DELETE is Admin-only |
| `SeedModule` | `POST /seed/reset`, `GET /seed/status` | public |

`ProductsModule` and `CategoriesModule` import each other with `forwardRef`: `ProductsService` uses `CategoriesRepository` to validate `categoryId`, and `CategoriesService` uses `ProductsRepository` to block deleting a category that products still use. Only the modules are circular; no provider depends on itself.

## Auth & roles

JWT is issued by `AuthService.login`. The strategy (`JwtStrategy`) extracts `{ id, email, role }` from the token payload into `req.user`. Two guards exist:

- `JwtAuthGuard` — validates the token.
- `RolesGuard` — reads the `@Roles(...)` decorator and checks `req.user.role`. Used together with `JwtAuthGuard`.

Roles enum: `admin`, `user`, `viewer` (defined in [src/core/decorators/roles.decorator.ts](../src/core/decorators/roles.decorator.ts)).

## Pagination & filtering

`PaginationDto` (`page`, `limit`) and entity-specific `FilterXxxDto` are composed together on list endpoints. The `paginate()` helper ([src/core/dto/pagination.dto.ts](../src/core/dto/pagination.dto.ts)) slices the already-filtered array and returns `{ data, meta: { total, page, limit, totalPages } }`.

## Swagger

Served at `/api/docs` with Bearer auth configured.
