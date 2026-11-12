# Features

Catalog of the API's modules and endpoints. Keep it in sync with the code (see `.claude/rules/feature-docs.md`).

Conventions shared by all modules:

- **Auth:** "JWT" means the endpoint needs an `Authorization: Bearer <token>` header from `POST /auth/login`. Roles are `admin`, `user` and `viewer`.
- **Validation:** request bodies and query params are validated globally (`whitelist` + `forbidNonWhitelisted`), so unknown fields are rejected with `400`.
- **List endpoints:** accept `page` (default 1) and `limit` (default 10, max 100) and return `{ data, meta: { total, page, limit, totalPages } }`.
- **Text filters:** fields marked *substring* match partially (case-insensitive). Other string filters must match exactly (case-insensitive).
- **Errors:** unknown ids return `404`, duplicates on unique fields return `409`.
- **Swagger:** interactive docs at `/api/docs`.

## Auth

Login and identity of the current user. Users are seeded and cannot be created through the API.

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/auth/login` | Public | Validates `email` + `password` and returns `{ accessToken, user: { id, email, name, role } }`. Invalid credentials return `401`. |
| GET | `/auth/me` | JWT (any role) | Returns the authenticated user without the password. |

Tokens are rejected if their user no longer exists.

## Customers

CRUD for customer records.

Fields: `name` (required, min 2), `email` (required, unique), `phone`, `address`, `city`, `country`, `company`, `isActive` (default `true`).

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/customers` | JWT (any role) | Paginated list. Filters: `name` (substring), `city` (substring), `country` (exact), `isActive` (boolean). |
| GET | `/customers/:id` | JWT (any role) | Get one customer. |
| POST | `/customers` | admin, user | Create a customer. `409` if the email already exists. |
| PATCH | `/customers/:id` | admin, user | Partial update. `409` if the new email belongs to another customer. |
| DELETE | `/customers/:id` | admin | Delete a customer. Returns `204`. |

## Products

CRUD for the product catalog.

Fields: `name` (required, min 2), `price` (required, positive, max 2 decimals), `description`, `sku` (unique when set), `stock` (int ≥ 0, default 0), `category` (default `Uncategorized`), `status` (`active` | `inactive` | `out_of_stock`, default `active`), `imageUrl` (URL).

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/products` | JWT (any role) | Paginated list. Filters: `name` (substring), `category` (exact), `status` (enum). |
| GET | `/products/:id` | JWT (any role) | Get one product. |
| POST | `/products` | admin, user | Create a product. `409` if the SKU already exists. |
| PATCH | `/products/:id` | admin, user | Partial update. `409` if the new SKU belongs to another product. |
| DELETE | `/products/:id` | admin | Delete a product. Returns `204`. |

## Seed

Manage the in-memory mock data. Data is seeded automatically on boot (see [seed-data.md](seed-data.md)).

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/seed/reset` | Public | Clears all stores and re-seeds them with fresh Faker data. Returns a message plus the record counts. |
| GET | `/seed/status` | Public | Returns the record count per module: `{ users, customers, products }`. |
