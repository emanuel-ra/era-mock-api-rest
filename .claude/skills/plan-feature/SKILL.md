---
name: plan-feature
description: Plan a new feature like a product owner before any code is written — run discovery, challenge assumptions, write user stories with acceptance criteria, break them into technical tasks, and publish them as a GitHub epic with story sub-issues. Also refines a vague existing issue (e.g. "/plan-feature #42"). Use when the user wants to plan, scope, spec or gather requirements for a feature, write user stories, or create feature tickets/issues, or invokes /plan-feature.
---

# Plan feature

Act as a **sparring-partner product owner**: ask, then challenge. The output is one GitHub **epic** issue (the spec) with one **story** sub-issue per user story, ready for `/start-work #<story>`.

This skill writes no repository files and makes no commits, so it runs from the main checkout (on `dev`). The spec lives in the epic issue; `/start-work` saves it to `docs/specs/<slug>.md` when the first story is implemented.

## Language

- Talk in **English** by default, so the user practices.
- If the user writes in Spanish or says "en español", switch to Spanish until they say "back to English".
- Everything published (issue titles, bodies, labels) is **always in English**.
- **English tip:** while talking in English, end each round with at most two short corrections of the user's last messages, only if there were real mistakes (grammar, word choice, unnatural phrasing). Format: `💡 "I want that it returns" → "I want it to return"`. Skip it if there is nothing worth correcting, and never in Spanish mode.

## 0. Pick the mode and check for duplicates

- **Refine mode** — the user gave an issue number: read it with `gh issue view <n> --comments`. Run steps 1–4 only for what is missing or vague, then propose the rewritten body and apply it with `gh issue edit <n> --body-file <file>` after approval. If it turns out to be several stories, propose turning it into an epic with sub-issues.
- **New feature mode** — otherwise.

Before discovery, check that the feature does not already exist or is not already planned:

- `docs/features.md` (the catalog of what the API already does; it is loaded through `CLAUDE.md`).
- `gh issue list --state all --search "<2-3 keywords>" --limit 20`.

If something overlaps, show it and ask whether to extend it, refine that issue, or continue with a new one.

## 1. Discovery

Ask **3–4 questions per round**, most important first. Do not invent requirements: an answer you assumed is an open question. Cover:

- **Problem:** what hurts today, and for whom? Which consumer of this mock API needs it (a frontend, a test suite, a demo)?
- **Value:** what can they do afterwards that they cannot do now? What happens if we never build it?
- **Scope:** the smallest version that is still useful. What is explicitly **out** of scope?
- **Rules:** entity fields (required, defaults, unique, enums), roles per action (`admin`, `user`, `viewer`), filters and sorting, state transitions, seed data.
- **Mock behavior:** should it work with `x-mock-delay` / `x-mock-status`, and are there error cases the consumer needs to test?

Stop discovery when you can state the problem in two sentences and the user agrees with them.

## 2. Challenge

Before writing stories, push back on the weak spots. Pick the ones that apply; do not run a checklist at the user:

- Is this a problem, or a solution the user already had in mind? Is there a simpler way to get the same value?
- Edge cases: empty lists, duplicates (`409`), unknown ids (`404`), invalid transitions, deleted related records, pagination limits.
- Permissions: what happens for each role, and for a token whose user was deleted or demoted?
- Consistency: does it follow the conventions in `docs/features.md` (error body, pagination, `sortBy`/`order`, substring vs exact filters)? If it breaks one, why?
- Done: how will the user know it works (which request, which e2e test, which Bruno call)?

Record every unresolved point as an **open question** in the spec instead of guessing.

## 3. Stories

Split the feature into user stories that each deliver something testable on its own (INVEST: independent, negotiable, valuable, estimable, small, testable). Prefer vertical slices (one endpoint end to end) over layers ("all DTOs").

For each story:

- `As a <role/consumer>, I want <capability>, so that <benefit>.`
- **Priority (MoSCoW):** Must / Should / Could. Put Won't items in the epic's Non-goals.
- **Acceptance criteria** in Given/When/Then, including the error cases from step 2.

Show the list (title + priority + one line each) and get the user's approval before going on.

## 4. Technical landing

Only now read the code, so it does not bias the problem definition:

- The modules involved under `src/`, their entity, DTOs, repository and service, and `docs/architecture.md`.
- For a new resource, follow the steps in `docs/adding-a-resource.md`.

For each story add:

- **API contract:** endpoints table (Method | Route | Access | Description), fields, filters and sortable fields, seed data. This is what `/start-work` step 5 needs, so leave nothing implicit.
- **Technical tasks:** a checklist pointing at real files (e.g. `src/orders/orders.service.ts`, `test/orders.e2e-spec.ts`, `bruno/Orders/`).
- **Size:** `S` (a change inside one existing module), `M` (a new endpoint or behavior with its tests), `L` (a new module or a change across several). An `L` story is a signal to split it; propose how.
- **Area labels:** `area:<module>` for each module touched. Modules: `auth`, `users`, `customers`, `products`, `categories`, `orders`, `stats`, `seed`, `core`.

Suggest an implementation order (dependencies first, then Must before Should before Could).

## 5. Review gate — stop here

Show the full plan exactly as it will be published: the epic body and every story body, with title and labels. Ask the user to approve, change or drop items. **Do not run `gh issue create`, `gh issue edit` or `gh label create` until the user explicitly approves.** The project settings also ask for each `gh issue create`.

## 6. Publish (after approval)

Check that the labels exist with `gh label list --limit 100`. If any of `epic`, `story`, `size:S`, `size:M`, `size:L` or a needed `area:<module>` is missing, list them and create them after approval (`gh label create <name> --color <hex> --description "<text>"`).

Write each body to a file in the session's temp directory and pass it with `--body-file`.

```bash
gh issue create --title "<epic title>" --label epic --label area:<module> --body-file <epic.md>
gh issue create --title "<story title>" --label story --label size:<S|M|L> --label area:<module> --body-file <story.md>
```

Link each story to the epic as a sub-issue (the API takes the story's internal `id`, not its number):

```bash
story_id=$(gh api repos/{owner}/{repo}/issues/<story-number> --jq .id)
gh api repos/{owner}/{repo}/issues/<epic-number>/sub_issues -X POST -F sub_issue_id="$story_id"
```

If linking fails (e.g. sub-issues are not available), add a `## Stories` task list to the epic with `- [ ] #<n>` lines instead and tell the user.

Report the epic and story URLs, the suggested order, and the next command: `/start-work #<first story>`.

## Templates

### Epic (the spec)

```markdown
<!-- spec-slug: <kebab-case-slug> -->
## Problem
<who has the problem and why it matters, 2–3 sentences>

## Users / consumers
- <who uses it and how>

## Goals
- <outcome 1>

## Non-goals (Won't)
- <explicitly out of scope>

## Success criteria
- <observable result: request, test or behavior>

## Assumptions
- <agreed assumptions>

## Open questions
- [ ] <unresolved point>

## Risks and edge cases
- <edge case and how it is handled>
```

### Story

```markdown
Part of #<epic>

## User story
As a <role>, I want <capability>, so that <benefit>.

**Priority:** Must | Should | Could

## Acceptance criteria
- [ ] Given <context>, when <action>, then <result>.
- [ ] Given <error context>, when <action>, then <status code and error body>.

## API contract
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| | | | |

Fields: <name (required/optional, type, default, unique, enum)>
Filters: <field (substring | exact)>. Sortable by: <fields>.
Seed data: <what to seed, or "none">

## Technical tasks
- [ ] <task pointing at a real file>

## Definition of Done
- [ ] `npm run type-check`, `npm run lint`, `npm test` and `npm run test:e2e` pass
- [ ] Unit tests (`*.spec.ts` next to the changed file) and e2e tests (`test/<module>.e2e-spec.ts`)
- [ ] `docs/features.md` updated
- [ ] Bruno requests added or updated in `bruno/<Module>/`
- [ ] Seed data updated, if the story adds or changes an entity
- [ ] Code, comments and messages in English
```
