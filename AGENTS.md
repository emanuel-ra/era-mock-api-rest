# Repository Guidelines

## Project Structure & Module Organization

This is a NestJS REST API. Application code lives in `src/`, organized by feature: `auth`, `categories`, `customers`, `products`, and `seed`. Shared guards, decorators, DTOs, entities, repositories, interfaces, and utilities are under `src/core/`. Keep feature-specific controllers, services, repositories, DTOs, entities, and unit specs together in their module directory. End-to-end tests and helpers live in `test/`; generated output goes to `dist/` and coverage to `coverage/`.

## Build, Test, and Development Commands

- `npm ci` installs the locked dependencies.
- `npm run start:dev` starts the API with watch mode; `npm start` runs it normally.
- `npm run build` compiles the NestJS application.
- `npm run lint` checks `src/` and `test/` with ESLint; `npm run type-check` runs TypeScript without emitting files.
- `npm test` runs unit tests; `npm run test:watch` watches them; `npm run test:cov` collects coverage.
- `npm run test:e2e` runs the end-to-end suite. CI runs lint, type-check, unit tests, e2e tests, and build for pull requests and pushes to `main`.

## Coding Style & Naming Conventions

Use TypeScript and follow the existing NestJS patterns. Use two-space indentation, single quotes, and semicolons. Name files in kebab-case with role suffixes, such as `customers.service.ts`, `create-product.dto.ts`, and `products.repository.spec.ts`. Use PascalCase for classes and DTOs, and camelCase for methods and variables. ESLint is configured in `eslint.config.mjs`; resolve lint and type errors before submitting.

## Testing Guidelines

Unit tests use Jest and `ts-jest`; name them `*.spec.ts` beside the code they cover. End-to-end tests use `*.e2e-spec.ts` under `test/` and the config in `test/jest-e2e.json`. Add or update tests with behavior changes, including relevant success and error cases. Run `npm test` and `npm run test:e2e`; run the full CI checks locally when practical. No fixed coverage threshold is configured.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`, and `ci:`; use imperative, specific summaries (for example, `feat(categories): add category filters`). Mark breaking changes with `!` where appropriate. Pull requests should explain the behavior change, note relevant API or configuration impact, link related issues, and include test evidence. Update `README.md` when public API behavior or usage changes.

## Security & Configuration Tips

Load configuration through environment variables and Nest's `ConfigModule`; never commit secrets. Seed/reset endpoints can replace in-memory data, so use them only in appropriate development or test environments.
