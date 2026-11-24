# CI and Docker

How the project is checked and packaged. Usage commands for humans are in the [README](../README.md#run-with-docker); deploying to a server is in [deploy.md](deploy.md).

## CI

`.github/workflows/ci.yml` (GitHub Actions, Node 24) runs on every pull request and every push to `main` or `dev`:

- **"Lint, type-check, tests and build"**: `npm run lint`, `npm run type-check`, `npm test`, `npm run test:e2e` and `npm run build`.
- **"Docker image"**: builds the image with layer caching and runs `scripts/docker-smoke-test.sh` against it. The script checks the healthy status, `GET /seed/status`, Swagger, login, `401` without a token, that the container runs as `node`, and that the image has no `.env` and no `src/`.

CI runs without a `.env` file, so the app must keep working with the config fallbacks.

## Docker

- `Dockerfile` is a two-stage build on `node:24-alpine`: build with dev dependencies → runtime with `npm ci --omit=dev` + `dist/`, user `node`, healthcheck on `GET /seed/status`.
- `compose.yaml` maps `${PORT:-3000}` to the container's port 3000 on IPv4 only (`0.0.0.0`), limits the container to 256 MB of memory and its logs to 3 files of 10 MB, and passes `JWT_SECRET`/`JWT_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` (and `MOCK_DELAY_MS`/`MOCK_ERROR_RATE`) from `.env` or defaults.
- `.dockerignore` keeps `.env`, tests, docs and `bruno/` out of the build context.
- If a new runtime file is needed (e.g. assets), copy it in the Dockerfile runtime stage.

## Line endings

`.gitattributes` forces LF line endings (`* text=auto eol=lf`, `*.sh` explicitly), so a Windows clone keeps the hooks in `.claude/hooks/` and `scripts/docker-smoke-test.sh` runnable.
