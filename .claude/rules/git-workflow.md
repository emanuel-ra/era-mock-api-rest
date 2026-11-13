# Git workflow

## Branches

- `main`: released code. It only changes through a release PR from `dev` (`/release`).
- `dev`: integration branch and the repo's default branch. It only changes through PRs from work branches.
- Work branches: one per feature, fix, docs change or refactor. They branch from `origin/dev` and go back to `dev` through their own PR.

Never change code or commit on `main` or `dev`. Fixes, including urgent ones, also go through `dev` and reach `main` with the next release.

## Worktrees

Every work branch lives in its own git worktree under `.claude/worktrees/<branch-with-dashes>` (gitignored), so several pieces of work can run in parallel. The main checkout (repo root) stays on `dev` and is only used to create, update and remove worktrees.

- `/start-work`: creates the worktree from `origin/dev`, implements, verifies and opens the PR into `dev`.
- `/finish-work`: after the PR is merged, removes the worktree and the local branch and updates `dev`.
- `/release`: opens the PR from `dev` into `main`.

A Claude session works in a worktree in one of two ways:

- **Same session:** it moves in with the `EnterWorktree` tool and leaves with `ExitWorktree`. Never `cd` in or out.
- **One terminal per worktree** (for parallel work): the user runs `cd <worktree> && claude` in a new terminal. `/finish-work` for that worktree then runs from the session in the main checkout.

Before the review gate, rebase the branch on `origin/dev` so conflicts with other merged PRs are resolved in the branch. Once the branch is pushed, use `git merge origin/dev` instead of rebasing, to avoid force pushes.

## Branch names

```text
<type>/<short-description-in-kebab-case>
fix/<issue-number>-<short-description>
```

- `<type>` is the Conventional Commits type of the main change: `feat`, `fix`, `docs`, `refactor`, `chore`, `perf`, `test`, `build`, `ci`.
- Bug fixes include the GitHub issue number: `fix/12-customer-email-conflict`.
- The description says what changes, in 2–5 lowercase words: `feat/categories-crud`, `docs/features-catalog`, `refactor/repository-filters`.
- Avoid vague names such as `fix/bugs`, `feat/update` or `chore/changes`.

## Merging

PRs are merged on GitHub with **Create a merge commit** (not squash), so the Conventional Commits of each branch stay in the history. GitHub deletes the work branch after the merge; `main` and `dev` are protected and are never deleted.

## Push, PRs and issues

Never run `git push`, `gh pr create` or `gh issue create` without the user's explicit approval for that specific action. First show what will be sent (commits, diff summary, PR or issue title and body) and wait for the user to confirm.
