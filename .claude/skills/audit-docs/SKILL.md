---
name: audit-docs
description: Audit the project documentation (README.md, AGENTS.md, CLAUDE.md, .github/copilot-instructions.md, docs/*.md) against the code and each other, with one doc-auditor subagent per file in parallel, and report PASS or FAIL. Use when the user asks to check, audit or verify the docs, before a release, or invokes /audit-docs.
---

# Audit docs

Checks that the docs match the code and that each fact lives in the file whose role it is. Read-only: it shows the result in the chat and **never writes files**, so it works from the main checkout on `dev`, where the `protect-branches.sh` hook blocks writes.

## 1. Pick the files

- Default: `README.md`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` and every `docs/*.md` (expand the glob, one entry per file).
- If the arguments name files or globs (e.g. `/audit-docs docs/features.md README.md`), audit only those. Skip any that do not exist and say so.
- If the arguments include `low` (e.g. `/audit-docs --low` or "include low"), also show low-severity findings.

## 2. Launch the auditors

Launch one `doc-auditor` subagent per file, **all in the same message** so they run in parallel. Each prompt is just the file to audit, for example:

```text
Audit docs/features.md.
```

Do not audit the files yourself and do not pass them your own opinions: each auditor reads the code and the other docs on its own.

## 3. Merge the results

When all auditors have answered:

1. Collect every row of every table.
2. Remove duplicates: the same discrepancy reported from two files (e.g. a wrong command in both `AGENTS.md` and `README.md`) becomes one row listing both locations. Keep the highest severity of the merged rows.
3. Drop `low` rows unless they were asked for. Say how many were hidden.
4. Sort by severity (`high` first, then `medium`, then `low`), then by file.
5. Collect the "Not verifiable" items in one list.

Do not re-check or soften the auditors' findings, except to drop a row whose evidence is clearly missing or does not support it (say which ones you dropped and why).

## 4. Report in the chat

```text
## Docs audit

Files: <n audited> · Findings: <high> high, <medium> medium (<low> low hidden)

| file | finding | type | severity | evidence |
|------|---------|------|----------|----------|
| ... |

Not verifiable:
- ...

Result: PASS | FAIL
```

- **PASS** when there are no `high` findings; **FAIL** otherwise.
- Do not write the report to a file and do not fix anything. If the user wants fixes, they go through `/start-work` in a `docs/` branch.
