---
name: Express 5 req.params typing
description: Why req.params.xyz sometimes fails typecheck with "string | string[] not assignable to string" in Express 5 route handlers.
---

With `express@^5` and `@types/express@^5`, `req.params[key]` is typed as `string | string[]` (to account for repeated path segments), not plain `string`.

**Why:** Passing `req.params.slug` directly into a Drizzle `eq(column, value)` call or `parseInt()` fails `tsc` because those APIs expect a plain `string`.

**How to apply:** Cast at the usage site with `req.params.slug as string` (routes in this codebase use single, non-repeating path params, so the cast is safe). Apply consistently to every `req.params.*` read in a file when fixing — it's usually not just one occurrence.
