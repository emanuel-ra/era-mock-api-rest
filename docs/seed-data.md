# Seed data

Seed data is auto-loaded on boot. `SeedService.onModuleInit` populates three fixed users and 30 faker-generated customers and products.

Default credentials (all share password `password123`):

| email | role |
|-------|------|
| admin@mock.dev | admin |
| user@mock.dev | user |
| viewer@mock.dev | viewer |

The seeded users have fixed ids, so JWTs issued for them stay valid across restarts and `POST /seed/reset`.

Calling `POST /seed/reset` clears all stores and re-runs the seed.
