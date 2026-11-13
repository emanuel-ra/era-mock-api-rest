# Seed data

Seed data is auto-loaded on boot. `SeedService.onModuleInit` populates three fixed users, seven categories (Electronics, Clothing, Food, Books, Tools, Furniture, Sports), 30 faker-generated customers and products, and 20 orders. Every seeded product is linked to one of the seeded categories, and every order to a seeded customer and 1–4 seeded products, with a random status and a random `createdAt` within the last 90 days (so `GET /stats/sales` has a meaningful series).

Default credentials (all share password `password123`):

| email | role |
|-------|------|
| admin@mock.dev | admin |
| user@mock.dev | user |
| viewer@mock.dev | viewer |

The seeded users have fixed ids, so JWTs issued for them stay valid across restarts and `POST /seed/reset`.

Calling `POST /seed/reset` clears all stores and re-runs the seed.
