#!/usr/bin/env bash
# PreToolUse hook: block editing repo files or committing while on `main`.
# Exit code 2 blocks the tool call and sends stderr back to Claude.

set -euo pipefail

input="$(cat)"
project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"

branch="$(git -C "$project_dir" branch --show-current 2>/dev/null || true)"
[[ "$branch" == "main" ]] || exit 0

tool="$(jq -r '.tool_name // empty' <<<"$input")"

block() {
  echo "Blocked: you are on 'main'. $1 Create a working branch first (see .claude/rules/git-workflow.md or run /start-work)." >&2
  exit 2
}

case "$tool" in
  Edit|Write|MultiEdit|NotebookEdit)
    file="$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$input")"
    # Only guard files inside this repo (memory, scratchpad, etc. stay writable).
    if [[ -n "$file" && "$file" == "$project_dir"/* ]]; then
      block "Editing repository files on main is not allowed."
    fi
    ;;
  Bash)
    cmd="$(jq -r '.tool_input.command // empty' <<<"$input")"
    if grep -Eq '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit([[:space:]]|$)' <<<"$cmd"; then
      block "Committing on main is not allowed."
    fi
    ;;
esac

exit 0
