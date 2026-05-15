# DAOvote

A decentralized DAO governance platform built on Solana — connect your wallet, browse DAOs, create proposals, and cast on-chain votes with live results tracking.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- Solana: @solana/wallet-adapter-react (Phantom + Solflare)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/index.ts` — DB schema (daos, proposals, votes, activity tables)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all contracts)
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks + Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers (daos, proposals, votes, stats)
- `artifacts/dao-governance/src/pages/` — React pages (Home, DaoList, DaoDetail, ProposalList, ProposalDetail, CreateProposal)
- `artifacts/dao-governance/src/lib/wallet.tsx` — Solana ConnectionProvider + WalletProvider (Phantom, Solflare)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed hooks used by both server (Zod validation) and client (React Query).
- Wallet-gated actions: voting and proposal creation require a connected Solana wallet; wallet address stored as `voterAddress` / `creatorAddress` on each record.
- Duplicate vote prevention: server enforces one vote per (proposalId, voterAddress) pair.
- `zod/v3` used in `CreateProposal.tsx` form validation to avoid type conflict with `@hookform/resolvers` which bundles its own zod v3 types.
- Solana RPC points to devnet; txSignature is stored but actual on-chain submission is optional (UI works without it).

## Product

- **Dashboard** — live stats (DAOs, proposals, votes, voters) + active proposal feed + recent activity
- **DAO browser** — list all DAOs, drill into each for stats and filtered proposal list
- **Proposals** — filterable list by status (active/pending/succeeded/defeated/executed)
- **Proposal detail** — vote bar, countdown timer, For/Against/Abstain buttons, wallet-gated voting
- **Create proposal** — wallet-gated form to submit a new governance proposal to any DAO

## User preferences

- Clean blue/white government-portal aesthetic (blue primary, white/light-gray backgrounds)

## Gotchas

- Do NOT import from `zod/v4` in files that use `@hookform/resolvers/zod` — use plain field-level validation instead (see CreateProposal.tsx).
- Solana wallet adapters emit a `buffer` browser-compatibility warning in dev mode — harmless, suppressed by `global: "globalThis"` in vite.config.ts.
- Run `pnpm run typecheck:libs` after editing any `lib/*` schema to rebuild declarations before typechecking artifacts.
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
