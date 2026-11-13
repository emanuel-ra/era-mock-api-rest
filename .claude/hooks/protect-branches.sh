#!/usr/bin/env bash
# PreToolUse hook: block editing repo files or committing on a protected branch (`main`, `dev`).
# The branch is read from the checkout that holds the edited file (or where the commit runs),
# so work inside a worktree under .claude/worktrees/ is judged by that worktree's branch.
# Exit code 2 blocks the tool call and sends stderr back to Claude.

set -euo pipefail

PROTECTED_BRANCHES=(main dev)

input="$(cat)"
project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
# Resolve the repo root shared by all worktrees, so files in any worktree count as repo files.
repo_root="$(dirname "$(git -C "$project_dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "$project_dir/.git")")"

tool="$(jq -r '.tool_name // empty' <<<"$input")"
cwd="$(jq -r '.cwd // empty' <<<"$input")"
[[ -n "$cwd" ]] || cwd="$project_dir"

# Nearest existing directory, since a new file may live in a folder that does not exist yet.
existing_dir() {
  local dir="$1"
  while [[ ! -d "$dir" && "$dir" != "/" ]]; do dir="$(dirname "$dir")"; done
  echo "$dir"
}

check_branch() {
  local dir="$1" action="$2" branch
  branch="$(git -C "$dir" branch --show-current 2>/dev/null || true)"
  for protected in "${PROTECTED_BRANCHES[@]}"; do
    if [[ "$branch" == "$protected" ]]; then
      echo "Blocked: '$dir' is on '$branch'. $action on $branch is not allowed. Work in a worktree branched from dev (run /start-work, see .claude/rules/git-workflow.md)." >&2
      exit 2
    fi
  done
}

case "$tool" in
  Edit|Write|MultiEdit|NotebookEdit)
    file="$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$input")"
    # Only guard files inside this repo (memory, scratchpad, etc. stay writable).
    if [[ -n "$file" && "$file" == "$repo_root"/* ]]; then
      check_branch "$(existing_dir "$(dirname "$file")")" "Editing repository files"
    fi
    ;;
  Bash)
    cmd="$(jq -r '.tool_input.command // empty' <<<"$input")"
    if grep -Eq '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit([[:space:]]|$)' <<<"$cmd"; then
      dir="$cwd"
      # `git -C <path> commit` or a leading `cd <path> &&` decide where the commit runs.
      if [[ "$cmd" =~ git[[:space:]]+-C[[:space:]]+([^[:space:]]+)[[:space:]]+commit ]]; then
        dir="${BASH_REMATCH[1]}"
      elif [[ "$cmd" =~ ^[[:space:]]*cd[[:space:]]+([^[:space:];&]+) ]]; then
        dir="${BASH_REMATCH[1]}"
      fi
      dir="${dir%\"}"; dir="${dir#\"}"; dir="${dir%\'}"; dir="${dir#\'}"
      [[ "$dir" == /* ]] || dir="$cwd/$dir"
      check_branch "$(existing_dir "$dir")" "Committing"
    fi
    ;;
esac

exit 0
