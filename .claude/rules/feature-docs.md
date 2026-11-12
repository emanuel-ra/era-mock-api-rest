# Keep the feature catalog up to date

`docs/features.md` is the source of truth for "what features does this API have?". Answer that kind of question from the file, without re-reading the code, unless the user asks you to verify it.

Whenever you add, change or remove an endpoint or module (e.g. a new `categories` resource), update `docs/features.md` in the same branch, before you finish the feature:

- New module: add a `## <Module>` section with a one-line purpose, its fields (required ones, defaults, unique constraints, enums) and an endpoints table with **Method | Route | Access | Description** columns.
- New or changed endpoint: add or update its row. The Access column lists the roles from `@Roles(...)`, or "JWT (any role)" / "Public".
- List endpoints: say which filters exist and whether each matches by substring (`searchableFields`) or exactly.
- Removed endpoint or module: delete its row or section.
- Behavior shared by all modules goes in the conventions list at the top, not in each section.

If the change also affects architecture, seed data or the steps to add a resource, update the matching file in `docs/` too.

Commit the docs update with the feature, or as a separate `docs:` commit in the same branch.
