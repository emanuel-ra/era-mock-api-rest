# Manual testing (Bruno)

`bruno/` holds the [Bruno](https://www.usebruno.com/) collection "era-mock-api", with one folder per module plus `Auth`, `Mock simulation` and `Seed`.

- Open it in Bruno with **Open Collection** → the `bruno/` folder, and select the `local` environment (`baseUrl = http://localhost:3000`).
- Run one of `Auth/Login admin|user|viewer` (password `password123`). Its post-response script saves the JWT with `bru.setEnvVar("token", ...)`, and the collection sends `Authorization: Bearer {{token}}` on every request. `token` is a secret variable, so it is never written to the committed files.
- Create requests save the new id in a runtime variable (`customerId`, `productId`, `orderId`, …) that the get / update / delete requests of the same folder reuse. Running the whole collection in order works (it ends logged in as admin); `Seed/Reset` restores the data.
- From the terminal, with the server running: `cd bruno && npx @usebruno/cli run --env local` (add `--env-var baseUrl=http://localhost:3001` for another port). The CLI is not a project dependency.
- To run the server on another port, set `PORT` in `.env`, or for one run: `PORT=3001 npm run start:dev` (macOS/Linux) or `$env:PORT=3001; npm run start:dev` (Windows PowerShell). Then change `baseUrl` in the environment to match.

When an endpoint or module changes, the collection is updated in the same branch; the rules are in [.claude/rules/feature-docs.md](../.claude/rules/feature-docs.md#keep-the-bruno-collection-in-sync).
