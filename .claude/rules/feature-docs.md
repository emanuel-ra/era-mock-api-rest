# Keep the feature catalog up to date

`docs/features.md` is the source of truth for "what features does this API have?". Answer that kind of question from the file, without re-reading the code, unless the user asks you to verify it.

Whenever you add, change or remove an endpoint or module (e.g. a new `categories` resource), update `docs/features.md` in the same branch, before you finish the feature:

- New module: add a `## <Module>` section with a one-line purpose, its fields (required ones, defaults, unique constraints, enums) and an endpoints table with **Method | Route | Access | Description** columns.
- New or changed endpoint: add or update its row. The Access column lists the roles from `@Roles(...)`, or "JWT (any role)" / "Public".
- List endpoints: say which filters exist and whether each matches by substring (`searchableFields`) or exactly.
- Removed endpoint or module: delete its row or section.
- Behavior shared by all modules goes in the conventions list at the top, not in each section.

If the change also affects architecture, seed data or the steps to add a resource, update the matching file in `docs/` too.

## Keep the Bruno collection in sync

`bruno/` is the manual testing collection (see "Manual testing (Bruno)" in `CLAUDE.md`). In the same branch:

- New module: add a `bruno/<Module>/` folder with a `folder.bru` (`meta { name, seq }`, placed before `Mock simulation` and `Seed`) and its requests: list (with filter, pagination and `sortBy`/`order` examples), get, create, update, delete, plus any extra action.
- New or changed endpoint: add or update its `.bru` file (route, body, query params, expected status in `assert`). Removed endpoint: delete its file.
- Requests use `auth: inherit` (collection-level `Bearer {{token}}`) unless the route is public (`auth: none`). Create requests save the new id with `bru.setVar("<resource>Id", res.body.id)` for the get / update / delete requests; use `{{$timestamp}}` in unique fields (email, name, SKU) so the collection can run more than once.
- Never commit tokens or other secrets: `token` stays a `vars:secret` in `environments/local.bru`.
- If the server can run, check it with `cd bruno && npx @usebruno/cli run --env local`.

Commit the docs and Bruno updates with the feature, or as separate `docs:` / `chore:` commits in the same branch.
