# era-mock-api-rest

Reusable mock REST API for frontend testing, built with NestJS. All data lives **in memory** and is re-seeded with Faker on every start.

- Swagger: `http://localhost:3000/api/docs`
- Default users (password `password123`): `admin@mock.dev`, `user@mock.dev`, `viewer@mock.dev`
- Endpoints and roles: [docs/features.md](docs/features.md)

## Run with Node

Requires Node 24.

```bash
cp .env.example .env
npm install
npm run start:dev
```

## Run with Docker

```bash
docker compose up --build        # add -d to run in the background
docker compose down              # stop and remove the container
```

The API is published on `http://localhost:${PORT:-3000}`. Compose reads `.env` when it exists; otherwise it uses the defaults in `compose.yaml`. Set a real `JWT_SECRET` before exposing the container anywhere.

Without Compose:

```bash
docker build -t era-mock-api-rest .
docker run --rm -p 3000:3000 -e JWT_SECRET=change-me era-mock-api-rest
```

The image is a two-stage build on `node:24-alpine`: it compiles TypeScript in the first stage and ships only production dependencies and `dist/`, running as the unprivileged `node` user. A healthcheck polls `GET /seed/status`, so `docker ps` shows the container as `healthy` once the API answers.

## Tests

```bash
npm test           # unit tests
npm run test:e2e   # e2e tests over HTTP
```

CI runs lint, type-check, both test suites and the build on every pull request.
