# Local Development Setup

This guide walks you through running **VoteChain** on your own machine after downloading the code from Replit.

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

The **backend** (`artifacts/api-server`) and **frontend** (`artifacts/dao-governance`) are deliberately kept as separate workspace packages inside a single pnpm monorepo. They share typed contracts through the `lib/` packages, so you only need one repo to run the whole app.

---

## Prerequisites

| Tool | Minimum version | How to install |
|---|---|---|
| **Node.js** | 24 | https://nodejs.org or `nvm install 24` |
| **pnpm** | 10 | `npm install -g pnpm` |
| **PostgreSQL** | 14+ | https://www.postgresql.org/download/ or Docker (see below) |

### Quick PostgreSQL via Docker (optional)

If you don't have Postgres installed locally, spin one up in seconds:

```bash
docker run -d \
  --name votechain-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=votechain \
  -p 5432:5432 \
  postgres:16-alpine
```

Your connection string will then be:
```
postgresql://postgres:postgres@localhost:5432/votechain
```

---

## Step-by-step setup

### 1. Clone / download the code

Download the project from Replit (Files → Download as zip), then unzip and open the folder:

```bash
unzip votechain.zip
cd votechain
```

Or if you connected Replit to GitHub, clone normally:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

---

### 2. Install dependencies

```bash
pnpm install
```

This installs everything — backend, frontend, and all shared libraries — in one command.

---

### 3. Configure environment variables

#### Option A — `.env` files (recommended)

Copy the example files and edit them:

```bash
# Root env (read by the API server at dev time)
cp .env.example .env

# Frontend env
cp artifacts/dao-governance/.env.example artifacts/dao-governance/.env
```

Open `.env` in your editor and fill in your values:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/votechain
SESSION_SECRET=any-long-random-string
```

Generate a secure `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The `artifacts/dao-governance/.env` file already has sensible defaults (`PORT=5173`, `BASE_PATH=/`) — you don't need to change it unless you want a different port.

#### Option B — shell exports

If you'd rather not use `.env` files, export the variables in each terminal before running the servers:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/votechain"
export SESSION_SECRET="any-long-random-string"
```

---

### 4. Build the shared libraries

The `lib/` packages must be compiled before you can use them:

```bash
pnpm run typecheck:libs
```

This runs `tsc --build` for all composite libraries (`lib/db`, `lib/api-spec`, `lib/api-client-react`, `lib/api-zod`).

---

### 5. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

This creates all tables in your PostgreSQL database using Drizzle. You'll see output listing each table as it's created.

> **Note:** If you change `lib/db/src/schema/index.ts` later, run this command again to apply the changes.

---

### 6. Run the backend

Open **Terminal 1**:

```bash
# If using .env files, load them first
export $(grep -v '^#' .env | xargs)

# Start the API server on port 8080
PORT=8080 pnpm --filter @workspace/api-server run dev
```

You should see:
```
Server listening  port: 8080
Seeding demo data...
Demo seed complete
```

The API is now available at `http://localhost:8080/api`.

**Test it:**
```bash
curl http://localhost:8080/api/healthz
# → {"status":"ok"}

curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo1234"}'
# → {"token":"...","user":{...}}
```

---

### 7. Run the frontend

Open **Terminal 2**:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/dao-governance run dev
```

Or if you have `artifacts/dao-governance/.env` configured:

```bash
pnpm --filter @workspace/dao-governance run dev
```

You should see:
```
VITE v7.x.x  ready in 1234 ms
➜  Local:   http://localhost:5173/
```

Open your browser at **http://localhost:5173** — the full app is running.

---

## Demo accounts

The API server seeds two accounts on first startup:

| Role | Email | Password |
|---|---|---|
| Admin (org owner) | `admin@demo.com` | `demo1234` |
| Voter | `voter@demo.com` | `demo1234` |

---

## How the two services talk to each other

In production (and on Replit), a reverse proxy routes `/api/*` traffic to the API server and everything else to the frontend. Locally, **Vite handles this automatically** — its dev proxy forwards any request to `/api/...` from your browser to `http://localhost:8080`, so the frontend just uses plain `/api/...` paths with no special config needed.

---

## Useful commands

| Command | What it does |
|---|---|
| `pnpm install` | Install / update all dependencies |
| `pnpm run typecheck` | Full TypeScript check across all packages |
| `pnpm run typecheck:libs` | Rebuild shared library declarations only |
| `pnpm --filter @workspace/db run push` | Apply DB schema changes |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks & Zod schemas from `openapi.yaml` |
| `pnpm --filter @workspace/api-server run typecheck` | TypeScript check for backend only |
| `pnpm --filter @workspace/dao-governance run typecheck` | TypeScript check for frontend only |

---

## Making API contract changes

The app is **contract-first**: the OpenAPI spec at `lib/api-spec/openapi.yaml` is the single source of truth.

1. Edit `lib/api-spec/openapi.yaml`
2. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
3. Update backend routes in `artifacts/api-server/src/routes/`
4. The frontend hooks in `lib/api-client-react/src/generated/` are already updated — use them

---

## Troubleshooting

**`DATABASE_URL` not found error on startup**
→ Make sure you exported the env var or the `.env` file is in the project root and sourced before running.

**`PORT` or `BASE_PATH` not provided (Vite error)**
→ Pass them explicitly: `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/dao-governance run dev`

**Tables don't exist / DB errors**
→ Run `pnpm --filter @workspace/db run push` to create the schema.

**Frontend shows blank page**
→ Check that the API server is running on port 8080. The Vite proxy (`/api → localhost:8080`) requires the backend to be up.

**Type errors after editing `lib/` files**
→ Run `pnpm run typecheck:libs` to rebuild declarations, then re-check.
