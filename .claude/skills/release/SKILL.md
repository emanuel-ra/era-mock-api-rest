---
name: release
description: Open the release PR from `dev` into `main` with a changelog built from the PRs merged since the last release. Use when the user wants to release, ship `dev` to `main`, or invokes /release.
---

# Release

`main` only receives changes through a release PR from `dev`. Run these steps from the main checkout.

## 1. Check what would be released

```bash
git fetch origin --prune
git log --oneline --first-parent origin/main..origin/dev
```

- If the list is empty, stop: there is nothing to release.
- If a release PR from `dev` into `main` is already open (`gh pr list --base main --head dev`), show it instead of opening another one.

## 2. Check that dev is green

```bash
gh run list --branch dev --workflow CI --limit 1
```

The latest CI run on `dev` must have passed. If it failed or is still running, stop and tell the user.

## 3. Build the changelog

List the PRs merged into `dev` since the last release, from the merge commits:

```bash
git log --first-parent --merges --format='%s' origin/main..origin/dev
```

For each PR number, get its title with `gh pr view <n> --json number,title`. Group them by the Conventional Commits type of the title:

- **Features** (`feat`)
- **Fixes** (`fix`)
- **Other** (everything else: `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`)

Mark breaking changes (`!` in the title, or a `BREAKING CHANGE` footer in any commit of the range) at the top.

## 4. Review gate — stop here

Show the user:

1. The PRs that will be released, grouped as above.
2. `git diff --stat origin/main...origin/dev`.
3. The CI result from step 2.
4. The proposed PR title, `chore(release): <YYYY-MM-DD>`, and body: the changelog, and a test plan saying CI must pass on this PR.

**Do not run `gh pr create` until the user explicitly approves.**

## 5. Open the PR (after approval)

```bash
gh pr create --base main --head dev --title "<title>" --body-file <file>
```

Report the PR URL and remind the user to merge it with **Create a merge commit**. `dev` is protected, so GitHub does not delete it after the merge.
