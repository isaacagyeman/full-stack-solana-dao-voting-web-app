---
name: drizzle-kit push interactive prompts
description: How to handle drizzle-kit push getting stuck on an interactive truncate-table confirmation when adding NOT NULL/unique columns to a non-empty table.
---

`pnpm --filter @workspace/db run push` (drizzle-kit push) shows an interactive arrow-key prompt ("Do you want to truncate table?") when adding a NOT NULL or unique constraint to a table that already has rows. This prompt cannot be answered by piping text/echo into the command — it needs real arrow-key/stdin interaction that the sandboxed shell can't provide.

**Why:** Blindly truncating would destroy existing data; blindly proceeding leaves the push hanging forever in a non-interactive shell.

**How to apply:** Skip drizzle-kit push for this kind of change. Instead: (1) inspect existing rows with a direct SQL `SELECT`, (2) run raw `ALTER TABLE ... ADD COLUMN` (nullable first), (3) `UPDATE` to backfill real values for existing rows, (4) `ALTER TABLE ... SET NOT NULL` / `ADD CONSTRAINT ... UNIQUE` via SQL. Afterward, re-run drizzle-kit push once to confirm it reports "No changes detected".
