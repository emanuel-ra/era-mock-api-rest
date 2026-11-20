# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. The project overview, commands, conventions and critical rules are shared with other tools in `AGENTS.md`:

@AGENTS.md

Below is only what is specific to Claude Code.

## Detailed docs (loaded into context)

- Features catalog (modules, endpoints, access, filters): @docs/features.md
- Architecture (data layer, modules, auth, pagination): @docs/architecture.md
- Seed data and default credentials: @docs/seed-data.md
- Steps to add a new resource: @docs/adding-a-resource.md

Manual testing with Bruno ([docs/manual-testing.md](docs/manual-testing.md)) and CI/Docker ([docs/ci-and-docker.md](docs/ci-and-docker.md)) are read on demand.

Working rules in `.claude/rules/` are loaded automatically: git workflow and branch naming, commit conventions, and keeping `docs/features.md` and `bruno/` up to date.

## Skills

Skills in `.claude/skills/` run the git flow (`dev` integration branch, one worktree and PR per unit of work):

- `/start-work`: worktree from `origin/dev` → implement → verify → review → PR into `dev`.
- `/finish-work`: after the merge, removes the worktree and local branch and updates `dev`.
- `/release`: PR from `dev` into `main` with a changelog.

## Worktrees

Each unit of work runs in its own git worktree under `.claude/worktrees/` (gitignored). In the same session, move in with the `EnterWorktree` tool and leave with `ExitWorktree`; never `cd` in or out. For parallel work, the user opens a new terminal with `cd <worktree> && claude`. Details in `.claude/rules/git-workflow.md`.

## Hooks

Configured in `.claude/settings.json`:

- `.claude/hooks/protect-branches.sh` (PreToolUse) blocks editing files or committing in any checkout that is on `main` or `dev`.
- `.claude/hooks/related-tests.sh` (PostToolUse) runs `jest --findRelatedTests` after every edit of a `.ts` file and reports failures back to Claude.

## Permissions

`.claude/settings.json` sets `git push`, `gh pr create` and `gh issue create` to `ask`, so each one needs the user's approval even when other commands are allowed.

## Subagents

In `.claude/agents/`:

- `test-runner`: runs `npm run test:all:report`, re-runs failures to spot flaky tests, classifies each failure's cause and writes `reports/diagnostico-<date>.html`. It only writes inside `reports/` (gitignored).
