---
name: start-work
description: Start and run a unit of work in this repo — a new feature, a bug fix, a docs change or a refactor — from branch creation to a reviewed PR. Use when the user asks to build a feature (e.g. "add endpoints for categories"), fix a bug, document something or refactor code, or invokes /start-work.
---

# Start work

Run these steps in order. Do not skip the review gate in step 8.

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

## 3. Create the branch

Follow `.claude/rules/git-workflow.md`. Tell the user the branch name, then:

```bash
git checkout main
git pull
git checkout -b <branch>
```

If the working tree has uncommitted changes, stop and ask the user what to do with them before switching branches.

## 4. Prepare before coding

- **feat:** confirm the requirements are complete: entity fields (required, defaults, unique, enums), endpoints, roles per endpoint, filters and seed data. Ask about anything missing in a single round of questions. For a new resource, follow `docs/adding-a-resource.md`.
- **fix:** reproduce the bug or trace it in the code and explain the root cause to the user before changing anything.
- **docs / refactor / chore:** state the scope in one or two lines.

## 5. Implement

Keep the change focused on the request. Match the existing patterns in the codebase.

## 6. Verify

```bash
npm run type-check
npm run lint
npm test
npm run test:e2e
```

All four must pass. Add or update unit tests (`*.spec.ts` next to the changed file) for new or changed service, repository or guard logic. For new or changed endpoints, roles or validation, add or update e2e tests in `test/<module>.e2e-spec.ts`.

## 7. Document and commit

- If endpoints, modules, fields, roles or filters changed, update `docs/features.md` (see `.claude/rules/feature-docs.md`).
- Update other `docs/` files if architecture, seed data or the add-a-resource steps changed.
- Commit with Conventional Commits (see `.claude/rules/git-conventions.md`), in small focused commits. For fixes, add a `Refs: #<issue>` footer.

## 8. Review gate — stop here

Show the user:

1. The branch name.
2. The commits: `git log --oneline main..HEAD`.
3. The changed files: `git diff --stat main...HEAD` (offer the full diff).
4. Verification results from step 6.
5. The proposed PR title (Conventional Commits style) and body: summary, test plan, and `Closes #<issue>` for fixes.

Then ask whether to push and open the PR. **Do not run `git push` or `gh pr create` until the user explicitly approves.** If they ask for changes, apply them, commit, and show the gate again.

## 9. Push and open the PR (after approval)

```bash
git push -u origin <branch>
gh pr create --base main --head <branch> --title "<title>" --body "<body>"
```

Report the PR URL.
