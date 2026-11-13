---
name: start-work
description: Start and run a unit of work in this repo — a new feature, a bug fix, a docs change or a refactor — from a new git worktree branched off `dev` to a reviewed PR into `dev`. Use when the user asks to build a feature (e.g. "add endpoints for categories"), fix a bug, document something or refactor code, or invokes /start-work.
---

# Start work

Every unit of work lives in its own git worktree under `.claude/worktrees/`, branches from `origin/dev` and goes back to `dev` through its own PR (see `.claude/rules/git-workflow.md`). Several worktrees can be open at once, one per Claude session.

Run these steps in order. Do not skip the review gate in step 9.

## 1. Classify the work

Pick the Conventional Commits type that describes the main change:

| Request | Type |
|---------|------|
| New endpoint, module or user-facing behavior | `feat` |
| Something works incorrectly | `fix` |
| Documentation only | `docs` |
| Code restructuring with no behavior change | `refactor` |
| Tooling, config, dependencies | `chore` / `build` / `ci` |

If the request mixes types (e.g. a feature that also fixes a bug), use the main one for the branch and split the commits by type.

## 2. Link a GitHub issue (fixes only)

- If the user gave an issue number, read it with `gh issue view <n>`.
- If not, draft an issue (title + body with steps to reproduce, expected and actual behavior) and show it to the user. Run `gh issue create` only after they explicitly approve it, then use the returned number.
- Other types do not need an issue unless the user gives one.

## 3. Create the worktree

**Already inside a worktree?** If the session started inside `.claude/worktrees/<folder>` (the user opened Claude there, see "New terminal" below), skip this step: the worktree exists and the session is in it. Continue with step 4 if `node_modules` is missing, otherwise with step 5.

Pick the branch name following `.claude/rules/git-workflow.md` and tell the user. The worktree folder is the branch name with `/` replaced by `-` (`feat/orders-crud` → `.claude/worktrees/feat-orders-crud`).

Run from the main checkout (the repo root, which stays on `dev`):

```bash
git fetch origin --prune
git worktree add --no-track -b <branch> .claude/worktrees/<folder> origin/dev
```

- `--no-track` keeps the new branch from tracking `origin/dev`; its upstream is set on the first push.
- If `origin/dev` does not exist, stop and tell the user: `dev` must be created once from `main` (with their approval for the push).
- If the branch or the folder already exists, stop and ask whether to continue that work or pick another name.

Then ask the user where the work continues:

- **This session:** move the session into the worktree with the `EnterWorktree` tool (`path`: the absolute worktree path). Never `cd` into a worktree: only `EnterWorktree` records where the session came from, so `ExitWorktree` can bring it back. Run every later command from the worktree.
- **New terminal** (to keep this session free, e.g. to start another piece of work in parallel): give the user the command to open Claude in the worktree, with the request and the decisions made so far, and stop here. That new session continues from step 4.

  ```bash
  cd <absolute worktree path> && claude "/start-work <request and decisions so far>"
  ```

## 4. Set up the worktree

A worktree is a fresh checkout: it has no `node_modules` and no `.env` (gitignored). Find the main checkout (the parent folder of the shared git dir), copy its `.env` if it has one, and install the dependencies. Run each command on its own: in an `EnterWorktree` session Claude Code refuses git commands nested inside `$(...)`.

```bash
git rev-parse --path-format=absolute --git-common-dir   # → <main checkout>/.git
cp <main checkout>/.env .env                            # only if that file exists
npm ci
```

Tests do not need `.env` (config has fallbacks). If the user wants to run `npm run start:dev` in more than one worktree at a time, each one needs a different `PORT` in its `.env`.

## 5. Prepare before coding

- **feat:** confirm the requirements are complete: entity fields (required, defaults, unique, enums), endpoints, roles per endpoint, filters and seed data. Ask about anything missing in a single round of questions. For a new resource, follow `docs/adding-a-resource.md`.
- **fix:** reproduce the bug or trace it in the code and explain the root cause to the user before changing anything.
- **docs / refactor / chore:** state the scope in one or two lines.

## 6. Implement

Keep the change focused on the request. Match the existing patterns in the codebase.

## 7. Verify

```bash
npm run type-check
npm run lint
npm test
npm run test:e2e
```

All four must pass. Add or update unit tests (`*.spec.ts` next to the changed file) for new or changed service, repository or guard logic. For new or changed endpoints, roles or validation, add or update e2e tests in `test/<module>.e2e-spec.ts`. CI runs the same checks on the PR.

## 8. Document, commit and sync with dev

- If endpoints, modules, fields, roles or filters changed, update `docs/features.md` (see `.claude/rules/feature-docs.md`).
- Update other `docs/` files if architecture, seed data or the add-a-resource steps changed.
- Commit with Conventional Commits (see `.claude/rules/git-conventions.md`), in small focused commits. For fixes, add a `Refs: #<issue>` footer. PRs are merged with a merge commit, so these commits stay in `dev`'s history.
- Bring in what other PRs merged into `dev` meanwhile, so conflicts show up here and not in the PR:

  ```bash
  git fetch origin
  git rebase origin/dev
  ```

  If there are conflicts, resolve them and tell the user which files and how. Shared hotspots: `docs/features.md`, `src/app.module.ts`, `src/seed/seed.service.ts`. If the rebase brought new commits, run step 7 again.

## 9. Review gate — stop here

Show the user:

1. The branch name and worktree folder.
2. The commits: `git log --oneline origin/dev..HEAD`.
3. The changed files: `git diff --stat origin/dev...HEAD` (offer the full diff).
4. Verification results from step 7.
5. The proposed PR title (Conventional Commits style) and body: summary, test plan, and `Closes #<issue>` for fixes.

Then ask whether to push and open the PR. **Do not run `git push` or `gh pr create` until the user explicitly approves.** If they ask for changes, apply them, commit, and show the gate again.

## 10. Push and open the PR into dev (after approval)

```bash
git push -u origin <branch>
gh pr create --base dev --head <branch> --title "<title>" --body-file <file>
```

Write the body to a file in the session's temp directory and pass it with `--body-file`. Report the PR URL and remind the user:

- Merge it on GitHub with **Create a merge commit** (not squash). GitHub deletes the remote branch after the merge.
- Then run `/finish-work` to remove the worktree and update the local `dev`.

## After the PR is open

If review or CI asks for changes, keep working in the same worktree: commit, run step 7, show what changed, and push after the user approves. Do not rebase a branch that is already pushed; to pick up new `dev` changes, use `git merge origin/dev` instead, so no force push is needed.
