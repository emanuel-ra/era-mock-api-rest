# Git conventions

Use Conventional Commits 1.0.0 for commit messages.

Commit format:

```text
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

Rules:

- Use `feat` for new user-facing features.
- Use `fix` for bug fixes.
- Other accepted types: `build`, `chore`, `ci`, `docs`, `style`, `refactor`, `perf`, `test`, `revert`.
- Use an optional lowercase scope when it adds useful context, for example `feat(auth): add session refresh`.
- Keep the description short, imperative, and lowercase unless it contains a proper noun.
- Add a blank line before an optional body. Use the body to explain why the change was needed or any important implementation context.
- Mark breaking changes with `!` before the colon, a `BREAKING CHANGE: <description>` footer, or both.
- Footer tokens use git trailer style, for example `Refs: #123`, `Reviewed-by: Name`, or `BREAKING CHANGE: config shape changed`.
- Prefer small, focused commits. If one change fits multiple commit types, split it when practical.

Examples:

```text
feat(ui): add compact navigation
fix(api): handle expired access tokens
docs: update setup instructions
refactor(forms): simplify validation schema
feat(auth)!: replace legacy session format
```
