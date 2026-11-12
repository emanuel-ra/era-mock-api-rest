# Git workflow

Never change code or commit on `main`. Before starting any feature, bug fix, docs change or refactor, create a working branch from an up-to-date `main` (`/start-work` runs the full workflow).

## Branch names

```text
<type>/<short-description-in-kebab-case>
fix/<issue-number>-<short-description>
```

- `<type>` is the Conventional Commits type of the main change: `feat`, `fix`, `docs`, `refactor`, `chore`, `perf`, `test`, `build`, `ci`.
- Bug fixes include the GitHub issue number: `fix/12-customer-email-conflict`.
- The description says what changes, in 2–5 lowercase words: `feat/categories-crud`, `docs/features-catalog`, `refactor/repository-filters`.
- Avoid vague names such as `fix/bugs`, `feat/update` or `chore/changes`.

## Push, PRs and issues

Never run `git push`, `gh pr create` or `gh issue create` without the user's explicit approval for that specific action. First show what will be sent (commits, diff summary, PR or issue title and body) and wait for the user to confirm.
