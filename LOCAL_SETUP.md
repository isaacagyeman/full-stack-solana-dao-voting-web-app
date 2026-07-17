# Local Development Setup

This guide brings your local copy of VoteChain up to date with all recent changes and gets both servers running smoothly.

---

## Project layout

```
votechain/
├── artifacts/
│   ├── api-server/        ← Express 5 backend  (Node.js, TypeScript)
│   └── dao-governance/    ← React + Vite frontend
├── lib/
│   ├── db/                ← Drizzle ORM schema + migrations
│   ├── api-spec/          ← OpenAPI contract (openapi.yaml) + codegen config
│   ├── api-client-react/  ← Auto-generated React Query hooks (from api-spec)
│   └── api-zod/           ← Auto-generated Zod validators  (from api-spec)
├── .env.example           ← Root env template (used by the API server)
└── LOCAL_SETUP.md         ← This file
```

---

## Prerequisites

| Tool | Minimum version | How to install |
|---|---|---|
| **Node.js** | 24 | https://nodejs.org or `nvm install 24` |
| **pnpm** | 10 | `npm install -g pnpm` |
| **PostgreSQL** | 14+ | https://www.postgresql.org/download/ or Docker (see below) |

### Quick PostgreSQL via Docker (optional)

```bash
docker run -d \
  --name votechain-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=votechain \
  -p 5432:5432 \
  postgres:16-alpine
```

Connection string: `postgresql://postgres:postgres@localhost:5432/votechain`

---

## Step-by-step setup

### 1. Pull the latest code

If you cloned from GitHub:

```bash
git pull
```

If you downloaded a ZIP from Replit, re-download the latest version, unzip it, and replace your local copy.

---

### 2. Install dependencies

```bash
pnpm install
```

This installs everything — backend, frontend, and all shared libraries — in one command.

---

### 3. Configure environment variables

Copy the example files:

```bash
# Root env — read by the API server
cp .env.example .env

# Frontend env — read by Vite
cp artifacts/dao-governance/.env.example artifacts/dao-governance/.env
```

Open `.env` and fill in your values:

```dotenv
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/votechain

# Secret used to sign JWT tokens
SESSION_SECRET=your-random-string-here

# Solana payer keypair (see section 3a below)
SOLANA_PAYER_SECRET=
```

Generate a strong `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The `artifacts/dao-governance/.env` already has sensible defaults (`PORT=5173`, `BASE_PATH=/`) — no changes needed there unless you want a different port.

---

#### 3a. Copy `SOLANA_PAYER_SECRET` from Replit (new — required for on-chain voting)

Recent changes added real Solana blockchain anchoring: every vote is submitted as a transaction to Solana Devnet via the SPL Memo Program, and the transaction signature is stored in the database and shown as a clickable Solana Explorer link.

The server wallet keypair that signs and pays for these transactions is stored in Replit Secrets — it is **not** committed to the repo. To use it locally:

1. Open your Replit project
2. Go to **Tools → Secrets**
3. Find `SOLANA_PAYER_SECRET` and copy its value — it looks like a JSON array: `[139,72,216,...]` (64 numbers)
4. Paste that exact value (including the brackets) into your local `.env`:

```dotenv
SOLANA_PAYER_SECRET=[139,72,216,...]
```

> **What happens if you skip this?** Votes are still recorded in the database and everything works normally — the server degrades gracefully. You just won't get a real Solana transaction signature. The server will log a warning on startup and continue.

The payer wallet address is `4WPyFrJv4GMLqWa9CDy918QN9yaPcBES2qS1w2cXX56k`. It has been funded with 5 devnet SOL on Solana Devnet (each vote costs ~0.000005 SOL, so that covers ~1,000,000 votes).

---

### 4. Build the shared libraries

```bash
pnpm run typecheck:libs
```

This compiles all `lib/` packages so the backend and frontend can import from them.

---

### 5. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

This creates all tables in your PostgreSQL database. Type `y` when prompted. You only need to run this once, or again whenever `lib/db/src/schema/index.ts` changes.

---

### 6. Regenerate API types

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates the React Query hooks and Zod schemas from `lib/api-spec/openapi.yaml`. Run it whenever the OpenAPI spec changes (it was updated in recent sessions).

---

### 7. Run the backend

Open **Terminal 1**. Load the env file and start the API server:

```bash
# Load .env (Linux / macOS)
export $(grep -v '^#' .env | xargs)

# Start on port 8080
PORT=8080 pnpm --filter @workspace/api-server run dev
```

You should see:

```
Server listening  port: 8080
Solana payer loaded from env  pubkey: "4WPyFrJv4GMLqWa9CDy918QN9yaPcBES2qS1w2cXX56k"
Solana payer balance  solBalance: 4.999995
```

If `SOLANA_PAYER_SECRET` was not set you'll see a warning instead — that's fine, the server still starts.

**Test it:**

```bash
curl http://localhost:8080/api/healthz
# → {"status":"ok"}
```

---

### 8. Run the frontend

Open **Terminal 2**:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/dao-governance run dev
```

Or, if you have `artifacts/dao-governance/.env` configured:

```bash
pnpm --filter @workspace/dao-governance run dev
```

You should see:

```
VITE v7.x.x  ready in ~1000 ms
➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser.

> The Vite dev server automatically proxies all `/api/*` requests to `http://localhost:8080` (or whatever `API_PORT` is set to). No CORS configuration needed.

---

## What's new in the latest version

### Real Solana on-chain voting

When a voter submits a ballot, the server now:

1. Builds a SHA-256 hash of the vote (`electionId + candidateId + userId + timestamp`)
2. Submits a real Solana transaction embedding that hash as a memo via the SPL Memo Program
3. Stores the transaction signature in the database
4. Returns the signature to the frontend

After voting, the election detail page shows a clickable **Solana Explorer** link so anyone can independently verify the vote was anchored on-chain.

### Election ended state (UI)

When a voter opens an election that has passed its end time (or has been manually closed), they now see a **"Voting has ended"** screen — a lock icon, the exact closing date, and a "View results" button — instead of the candidate list. This replaces the previous behaviour where the candidate list was shown but voting silently failed with a red error.

---

## Demo accounts

The API server seeds two accounts on first startup:

| Role | Email | Password |
|---|---|---|
| Organiser | `admin@demo.com` | `demo1234` |
| Voter | `voter@demo.com` | `demo1234` |

---

## Useful commands

| Command | What it does |
|---|---|
| `pnpm install` | Install / update all workspace dependencies |
| `pnpm run typecheck` | Full TypeScript check across all packages |
| `pnpm run typecheck:libs` | Rebuild shared library declarations only |
| `pnpm --filter @workspace/db run push` | Apply DB schema changes to Postgres |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks & Zod schemas |
| `pnpm --filter @workspace/api-server run typecheck` | TypeScript check — backend only |
| `pnpm --filter @workspace/dao-governance run typecheck` | TypeScript check — frontend only |

---

## Troubleshooting

**`PORT environment variable is required` (backend or frontend)**
Both the API server and the Vite config require `PORT` to be set explicitly. Pass it inline: `PORT=8080 pnpm --filter @workspace/api-server run dev`.

**`BASE_PATH environment variable is required` (Vite)**
Set `BASE_PATH=/` for local development.

**`DATABASE_URL` not found / DB connection error**
Make sure you exported `DATABASE_URL` or loaded your `.env` before running the server, and that your Postgres instance is running (`pg_isready`).

**Tables don't exist / relation errors**
Run `pnpm --filter @workspace/db run push` to create the schema.

**Frontend shows blank page**
Check that the API server is running on the port matching `API_PORT` (default 8080). The Vite proxy requires the backend to be up.

**Type errors after editing `lib/` files**
Run `pnpm run typecheck:libs` to rebuild declarations, then re-check.

**Windows: `Missing lightningcss.win32-x64-msvc.node`**
The lockfile was generated on Linux (Replit) and doesn't include Windows-native binaries. Fix:

```powershell
Remove-Item -Recurse -Force node_modules
pnpm install
```

If the error persists:
```bash
pnpm add -D lightningcss -w
```
