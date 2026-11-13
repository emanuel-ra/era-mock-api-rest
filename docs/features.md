# Features

Catalog of the API's modules and endpoints. Keep it in sync with the code (see `.claude/rules/feature-docs.md`).

Conventions shared by all modules:

- **Auth:** "JWT" means the endpoint needs an `Authorization: Bearer <token>` header from `POST /auth/login`. Roles are `admin`, `user` and `viewer`.
- **Validation:** request bodies and query params are validated globally (`whitelist` + `forbidNonWhitelisted`), so unknown fields are rejected with `400`.
- **List endpoints:** accept `page` (default 1) and `limit` (default 10, max 100) and return `{ data, meta: { total, page, limit, totalPages } }`.
- **Sorting:** list endpoints accept `sortBy` (one of the module's sortable fields, listed in each section) and `order` (`asc` | `desc`, default `asc`). Strings sort case-insensitively, numbers and dates by value; records with no value (empty, `null`) go last in both orders. Without `sortBy` the default order (insertion order) is kept and `order` has no effect. An unknown `sortBy` or `order` returns `400`.
- **Text filters:** fields marked *substring* match partially (case-insensitive). Other string filters must match exactly (case-insensitive).
- **Errors:** unknown ids return `404`, duplicates on unique fields return `409`. Every error (including `401`/`403`, unknown routes and simulated errors) answers the same JSON body:

  ```json
  {
    "statusCode": 404,
    "error": "Not Found",
    "message": "Resource with id \"abc\" not found",
    "path": "/customers/abc?page=1",
    "timestamp": "2026-11-13T10:00:00.000Z",
    "requestId": "3f2b8c1e-7a4d-4e9b-9c1a-2b5d6e7f8a90"
  }
  ```

  - `error` is the status reason phrase; `path` is the requested URL with its query string; `timestamp` is ISO 8601 (UTC).
  - `message` is a string, except validation errors (`400` from the body or query validation), which keep the array of messages, one per failed rule.
  - Unexpected errors answer `500` with `message: "Internal server error"`; details are only logged on the server.
- **Request id:** every response, success or error, carries an `x-request-id` header, and error bodies repeat it as `requestId`. Send your own `x-request-id` (1–128 letters, digits or `._:-`) to have it echoed back; otherwise, or if it is not valid, the server generates a uuid v4.
- **Swagger:** interactive docs at `/api/docs`. The mock headers below are listed on every endpoint.
- **Simulated latency and errors:** to test loading and error states, any request can send these optional headers:
  - `x-mock-delay: <ms>` waits that many milliseconds (integer 0–10000) before answering. It overrides `MOCK_DELAY_MS` for that request.
  - `x-mock-status: <code>` answers that 4xx/5xx code without running the handler (no data changes, no body validation), with the standard error body described above (`message: "Simulated error (x-mock-status)"`). Combined with `x-mock-delay`, the delay comes first.
  - An invalid value in either header returns `400`.
  - Auth runs first: on a protected route without a valid token you get `401`/`403`, not the forced status.
  - Env vars `MOCK_DELAY_MS` (base latency, default 0) and `MOCK_ERROR_RATE` (0–1, chance of a random `500`, default 0) apply to every request except `GET /seed/status` and `/api/docs`.

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
| GET | `/customers` | JWT (any role) | Paginated list. Filters: `name` (substring), `city` (substring), `country` (exact), `isActive` (boolean). Sortable by `name`, `email`, `city`, `createdAt`. |
| GET | `/customers/:id` | JWT (any role) | Get one customer. |
| POST | `/customers` | admin, user | Create a customer. `409` if the email already exists. |
| PATCH | `/customers/:id` | admin, user | Partial update. `409` if the new email belongs to another customer. |
| DELETE | `/customers/:id` | admin | Delete a customer. Returns `204`, or `409` if the customer has orders. |

## Categories

Product categories. Products reference them by id (`categoryId`).

Fields: `name` (required, min 2, unique case-insensitive), `slug` (unique; lowercase letters, numbers and single dashes; generated from the name when omitted, e.g. `Home & Garden` → `home-garden`, and not regenerated when the name changes), `description`, `isActive` (default `true`).

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/categories` | JWT (any role) | Paginated list. Filters: `name` (substring), `isActive` (boolean). Sortable by `name`, `createdAt`. |
| GET | `/categories/:id` | JWT (any role) | Get one category. |
| POST | `/categories` | admin, user | Create a category. `409` if the name or slug already exists; `400` if no slug can be generated from the name. |
| PATCH | `/categories/:id` | admin, user | Partial update. `409` if the new name or slug belongs to another category. |
| DELETE | `/categories/:id` | admin | Delete a category. Returns `204`, or `409` if products still use it. |

## Products

CRUD for the product catalog.

Fields: `name` (required, min 2), `price` (required, positive, max 2 decimals), `description`, `sku` (unique when set), `stock` (int ≥ 0, default 0), `categoryId` (uuid of an existing category, or `null` for no category; default `null`), `status` (`active` | `inactive` | `out_of_stock`, default `active`), `imageUrl` (URL).

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/products` | JWT (any role) | Paginated list. Filters: `name` (substring), `categoryId` (exact uuid), `status` (enum). Sortable by `name`, `price`, `stock`, `createdAt`. |
| GET | `/products/:id` | JWT (any role) | Get one product. |
| POST | `/products` | admin, user | Create a product. `409` if the SKU already exists; `400` if `categoryId` does not exist. |
| PATCH | `/products/:id` | admin, user | Partial update. `409` if the new SKU belongs to another product; `400` if `categoryId` does not exist. Send `categoryId: null` to remove the category. |
| DELETE | `/products/:id` | admin | Delete a product. Returns `204`. |

## Orders

Customer orders with one or more product lines. Creating or editing an order does not change product stock.

Fields: `customerId` (required, uuid of an existing customer), `items` (required, at least one; each is `{ productId, quantity }` with an existing product, quantity int ≥ 1, and no product repeated), `notes`. Set by the server: `status` (`pending` | `paid` | `shipped` | `delivered` | `cancelled`, starts as `pending`), `total`, and per item `productName`, `unitPrice` and `subtotal`. The product name and price are copied when the items are saved, so later product changes or deletes do not affect the order.

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/orders` | JWT (any role) | Paginated list. Filters: `customerId` (exact uuid), `status` (enum). Sortable by `total`, `status` (alphabetical), `createdAt`. |
| GET | `/orders/:id` | JWT (any role) | Get one order. |
| POST | `/orders` | admin, user | Create a `pending` order. `400` if the customer or a product does not exist. |
| PATCH | `/orders/:id` | admin, user | Partial update of `customerId`, `items` (replaces the whole list, with current product prices) or `notes`; the total is recalculated. `409` if the order is not `pending`; `400` if the customer or a product does not exist. |
| PATCH | `/orders/:id/status` | admin, user | Change the status. Allowed: `pending → paid`, `paid → shipped`, `shipped → delivered`, and `pending`/`paid → cancelled`. Any other change returns `409`. |
| DELETE | `/orders/:id` | admin | Delete an order. Returns `204`. |

## Stats

Read-only aggregates for a dashboard. Only orders with status `paid`, `shipped` or `delivered` count as sales (revenue, the sales series and top products); `pending` and `cancelled` orders do not. Amounts are rounded to cents.

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/stats/summary` | JWT (any role) | `{ customers: { total, active }, products: { total, outOfStock, lowStock }, orders: { total, byStatus: { pending, paid, shipped, delivered, cancelled } }, revenue: { total } }`. `outOfStock` counts products with status `out_of_stock`; `lowStock` counts products with `stock < 5`. |
| GET | `/stats/sales` | JWT (any role) | Time series `[{ period, orders, revenue }]` by order `createdAt`. Query: `from` and `to` (`YYYY-MM-DD`, UTC, both days included; default the last 30 days up to today) and `groupBy` (`day` → `YYYY-MM-DD` periods, `month` → `YYYY-MM`; default `day`). Periods without sales return zeros. `400` if a date is invalid, `from` is after `to`, or a `day` range is longer than 366 days. |
| GET | `/stats/top-products` | JWT (any role) | Best-selling products by quantity: `[{ productId, productName, quantity, revenue }]`, ties broken by revenue. Read from the order lines, so deleted products are included, with the name from their latest order. Query: `limit` (1–50, default 5). |

## Seed

Manage the in-memory mock data. Data is seeded automatically on boot (see [seed-data.md](seed-data.md)).

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/seed/reset` | Public | Clears all stores and re-seeds them with fresh Faker data. Returns a message plus the record counts. |
| GET | `/seed/status` | Public | Returns the record count per module: `{ users, categories, customers, products, orders }`. |
