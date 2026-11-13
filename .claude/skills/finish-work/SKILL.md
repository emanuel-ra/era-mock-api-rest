---
name: finish-work
description: Clean up after a PR into `dev` is merged — remove its git worktree from `.claude/worktrees/`, delete the local branch and update the local `dev`. Use when the user says a PR was merged, asks to clean up a worktree or branch, or invokes /finish-work.
---

# Finish work

Run this after the PR of a unit of work (created by `/start-work`) is merged into `dev`.

## 1. Pick the branch

- If the user named a branch or PR, use it.
- If the session is inside a worktree under `.claude/worktrees/`, use its branch (`git branch --show-current`).
- Otherwise list the worktrees with `git worktree list` and ask which one to finish.

## 2. Check that the PR is merged

```bash
gh pr view <branch> --json number,state,baseRefName,mergedAt,url
```

- `state` must be `MERGED` and `baseRefName` must be `dev`. If not, stop and tell the user (the PR is open, closed without merging, or targets another branch). Never remove a worktree whose work is not merged.

## 3. Check for leftover work

In the worktree:

```bash
git status --porcelain
git log --oneline origin/dev..HEAD
```

- Uncommitted changes: stop and ask the user whether to discard them or keep the worktree.
- Commits not in `origin/dev` after a `git fetch origin`: they were made after the merge. Stop and ask whether they belong in a new PR.

## 4. Leave the worktree

If the session is inside the worktree, leave it first with the `ExitWorktree` tool (`action: "keep"`), so the session is back in the main checkout. All later commands run from the main checkout, which stays on `dev`.

## 5. Update dev, then remove the worktree and branch

```bash
git checkout dev
git pull --prune
git worktree remove .claude/worktrees/<folder>
git branch -d <branch>
```

- `git pull` first, so `dev` contains the merge and `git branch -d` sees the branch as merged.
- If `git branch -d` still refuses (e.g. the PR was squashed), the PR state from step 2 already proves it was merged: tell the user and use `git branch -D <branch>`.
- `--prune` drops the remote-tracking branch that GitHub deleted after the merge.

## 6. Report

Show the user the last commits on `dev` (`git log --oneline -5`) and the remaining worktrees (`git worktree list`). If other worktrees are open, remind them to run `git fetch origin && git rebase origin/dev` there before their review gate (or `git merge origin/dev` if the branch is already pushed).
