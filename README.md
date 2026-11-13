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

To check an image the same way CI does:

```bash
docker build -t era-mock-api-rest:local .
scripts/docker-smoke-test.sh era-mock-api-rest:local
```

## Tests

```bash
npm test           # unit tests
npm run test:e2e   # e2e tests over HTTP
```

CI runs lint, type-check, both test suites and the build on every pull request and every push to `main` or `dev`, and builds and smoke-tests the Docker image.

## Development workflow

### Branches

```text
main  ◀── release PR (dev → main) ──┐
                                    │
dev   ◀── PR ── feat/orders-crud    │
      ◀── PR ── fix/12-email-case ──┘
      ◀── PR ── docs/readme-git-workflow
```

- `dev` is the default and integration branch. Every feature, fix, docs change or refactor branches from `dev` and goes back to `dev` through its own pull request.
- `main` holds released code and only receives release PRs from `dev`. Urgent fixes also go through `dev`.
- Branch names follow `<type>/<short-description>` (`feat/orders-crud`), and fixes include the issue number (`fix/12-customer-email-conflict`). Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- `main` and `dev` are protected: no direct pushes, no force pushes, no deletion, and a PR can only be merged when both CI jobs pass. PRs into `dev` must also be up to date with `dev`.
- PRs are merged with **Create a merge commit** (the only merge type enabled), so each branch's commits stay in the history. GitHub deletes the work branch after the merge.

### Worktrees

Each piece of work lives in its own [git worktree](https://git-scm.com/docs/git-worktree): a separate folder with its own branch, sharing the same repository. This lets several features move forward in parallel without switching branches or stashing.

```text
era-mock-api-rest/                              ← main checkout, always on dev
└── .claude/worktrees/                          ← gitignored
    ├── feat-orders-crud/                       ← branch feat/orders-crud
    └── fix-12-email-case/                      ← branch fix/12-email-case
```

A worktree starts without `node_modules` or `.env`, so each one needs `npm ci` (and a copy of `.env` to run the API). To run `npm run start:dev` in two worktrees at once, give each `.env` a different `PORT`. Tests do not need `.env`.

### Running it with Claude Code

The project ships three skills in `.claude/skills/` that run the whole cycle:

| Command | Run from | What it does |
|---------|----------|--------------|
| `/start-work <request>` | main checkout | Creates the worktree from `origin/dev`, sets it up, asks for missing requirements, implements, runs type-check, lint and tests, commits, rebases on `origin/dev`, and stops at a review gate. After you approve, it pushes and opens the PR into `dev`. |
| `/finish-work` | the session that worked on it | After you merge the PR on GitHub: checks it is merged, leaves and removes the worktree, deletes the local branch and pulls `dev`. |
| `/release` | main checkout | Checks that `dev` is green, builds a changelog from the merged PRs and, after you approve, opens the release PR from `dev` into `main`. |

Claude never pushes or opens a PR without asking first. A hook (`.claude/hooks/protect-branches.sh`) blocks it from editing files or committing in any checkout that is on `main` or `dev`.

After creating the worktree, `/start-work` asks where to continue:

- **This session:** Claude moves into the worktree (`EnterWorktree`) and later leaves it with `ExitWorktree` during `/finish-work`.
- **New terminal:** Claude prints a command to open a new session inside the worktree and stops, so the first session stays free to start other work:

  ```bash
  cd .claude/worktrees/feat-orders-crud && claude "/start-work <request>"
  ```

  When that PR is merged, close that session and run `/finish-work feat/orders-crud` from the main checkout session.

A typical cycle:

```text
/start-work add endpoints for invoices   → review → approve → PR #N into dev
  (merge PR #N on GitHub with "Create a merge commit")
/finish-work                              → worktree removed, dev updated
  ... more features ...
/release                                  → PR dev → main
```

### Without Claude

The same steps by hand:

```bash
# start
git fetch origin --prune
git worktree add --no-track -b feat/my-change .claude/worktrees/feat-my-change origin/dev
cd .claude/worktrees/feat-my-change
cp ../../../.env .env && npm ci
# ...work, commit...
git fetch origin && git rebase origin/dev     # before the first push
npm run type-check && npm run lint && npm test && npm run test:e2e
git push -u origin feat/my-change
gh pr create --base dev

# finish (after the PR is merged), from the main checkout
git checkout dev && git pull --prune
git worktree remove .claude/worktrees/feat-my-change
git branch -d feat/my-change

# release
gh pr create --base main --head dev
```

Once a branch is pushed, update it with `git merge origin/dev` instead of rebasing, so no force push is needed. The full rules are in [.claude/rules/git-workflow.md](.claude/rules/git-workflow.md).
