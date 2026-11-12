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

## Overview

NestJS REST API that runs entirely **in memory** — no database. All data is lost on restart and re-seeded on boot via `SeedModule`. Modules: `AuthModule` (JWT + roles `admin`/`user`/`viewer`), `CustomersModule`, `ProductsModule`, `SeedModule`. Swagger is served at `/api/docs`.

## Environment

Copy `.env.example` to `.env`. Required variables:

```
PORT=3000
JWT_SECRET=...
JWT_EXPIRES_IN=1h
```

## Detailed docs

- Features catalog (modules, endpoints, access, filters): @docs/features.md
- Architecture (data layer, modules, auth, pagination): @docs/architecture.md
- Seed data and default credentials: @docs/seed-data.md
- Steps to add a new resource: @docs/adding-a-resource.md

Working rules in `.claude/rules/` (loaded automatically): git/commit conventions and keeping `docs/features.md` up to date.
