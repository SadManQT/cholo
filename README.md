# Cholo (চলো)

A ride-sharing platform for Bangladesh, built as a learning project by two people. Node.js/Express + PostgreSQL backend, React frontend — see `docs/` for the full design blueprint (ER diagrams, normalization proof, API contracts, build order).

**Working on this repo?** Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) first — it explains the workflow and how the two of us (plus whichever AI coding agent either of us is using) stay in sync via [`AGENTS.md`](./AGENTS.md).

**Deciding what to build next?** Open **https://sadmanqt.github.io/cholo/docs/cholo-feature-roadmap.html** — it's the 24-step build order from `docs/13-14`, broken into per-feature prompts (one to build it, one to make your agent explain it back to you), with a shared checklist: checking a step off commits the change to `docs/roadmap-progress.json` via the GitHub API, so both of you see it update within seconds. Viewing needs nothing; checking things off needs a one-time GitHub token (the page's "Set up write access" button explains how — a fine-grained token scoped to just this repo, kept only in your own browser).

## Quickstart (5 minutes)

**Prerequisite:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```bash
git clone <this-repo-url>
cd cholo
cp .env.example .env
docker compose up -d
```

That starts PostgreSQL 16 in a container and loads `database/schema.sql` plus
the required roles and vehicle categories from `database/seeds/` automatically
(only on first boot — see [Resetting the database](#resetting-the-database)
below).

Install and start the API in a second terminal:

```bash
cd server
npm install
npm run dev
```

Verify that the API can reach PostgreSQL:

```bash
curl http://localhost:3000/health
```

It should return `{"db":true}`.

The first versioned API endpoint lists active operating cities through the
full route → controller → service → repository pipeline:

```bash
curl http://localhost:3000/api/v1/cities
```

Run the backend regression suite:

```bash
cd server
npm test
```

The M1 infrastructure also provides validated CORS, structured request logs,
Zod request validation, async error forwarding, PostgreSQL error translation,
standard 404 responses, and one centralized error handler.

Install and start the frontend in a third terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Open the URL Vite prints (`http://localhost:5173` by default). `VITE_API_URL`
in `client/.env` already points at the API from the steps above — no further
setup needed. During local development SMS delivery is intentionally mocked:
after registration, copy the six-digit code from the API terminal's
`Mock SMS sent` log into the OTP screen.

Run the frontend's own checks from `client/`:

```bash
npx tsc -b      # type-check
npx oxlint      # lint
npm run build   # production build
```

### M6 two-browser demo

Open one normal window as a passenger and one incognito window as an approved
driver. On the driver Home screen, go online and allow location access. Book a
ride from the passenger window; the 15-second offer appears for the driver.
Accept it, then use the driver trip screen to mark arrival, start, send GPS
updates, chat, and complete. The passenger window follows status/location in
real time and falls back to REST polling during a socket reconnect.

### Updating required reference data

Docker initialization scripts run only when the database volume is first
created. After pulling a milestone that adds roles, categories, or other
required reference rows, apply the idempotent seed without deleting your data:

```bash
docker compose up -d
docker compose exec postgres psql -U cholo -d cholo \
  -f /docker-entrypoint-initdb.d/02-seed-reference.sql
```

After pulling changes that add files under `database/migrations/`, apply them
in order to upgrade an existing persistent volume without deleting its data:

```bash
for migration in database/migrations/*.sql; do
  docker compose exec -T postgres sh -c \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$migration"
done
```

### Verify it worked

Wait a few seconds for the healthcheck, then:

```bash
docker compose ps
```

`postgres` should show `healthy`. Then check the schema actually loaded:

```bash
docker compose exec postgres psql -U cholo -d cholo -c "\dt"
```

You should see **54 tables** listed. To double-check the count directly:

```bash
docker compose exec postgres psql -U cholo -d cholo -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
```

should print `54`.

### Stopping

```bash
docker compose down
```

Data persists in a Docker volume between runs — your database survives a stop/start.

### Resetting the database

The schema only loads on an **empty** data directory. If you edit `database/schema.sql` and want the container to pick up the change, you have to wipe the volume and let it re-initialize:

```bash
docker compose down -v
docker compose up -d
```

### Port already in use?

The default host port is `5433` (not Postgres's usual `5432`) precisely because `5432` is commonly already taken by a local Postgres install. If `5433` is *also* taken on your machine, set a different one in your `.env`:

```
POSTGRES_PORT=5434
```

and re-run `docker compose up -d`. The container's internal port doesn't change — only how you reach it from the host.

## Project structure

```
cholo/
├── client/                # React + TypeScript + Vite SPA (auth screens, ui/ kit, role-based routing)
├── server/                # Express API (auth, accounts, driver onboarding/fleet, pricing/dispatch/rides, sockets)
├── database/
│   ├── schema.sql         # full DDL: 54 tables, triggers, views — generated from docs/01–03
│   ├── migrations/        # numbered, append-only upgrades for persistent databases
│   └── seeds/             # idempotent reference rows required by the API
├── docs/                  # the design blueprint (read before changing schema/API/architecture)
├── docker-compose.yml     # PostgreSQL 16, auto-loads schema.sql
├── .env.example           # every env var this project needs, with fake values
├── AGENTS.md              # shared conventions for any AI coding agent (Claude Code, Codex, ...)
├── CLAUDE.md              # imports AGENTS.md, so Claude Code stays in sync
├── CONTRIBUTING.md        # workflow + how the two agents/contributors stay in sync
└── README.md              # this file
```

## Where things are documented

- `docs/01-er-diagram-database-architecture.md` — entities, relationships, why each design decision was made
- `docs/02-03-normalization-schema-transactions.md` — normalization proof + the SQL/constraint/trigger design behind `schema.sql`
- `docs/04-data-dictionary.md` — every table, every column
- `docs/05-06-07-learning-roadmap-architecture-folders.md` — folder conventions and the learning path
- `docs/08-09-10-backend-api-auth.md` — REST API + auth design
- `docs/11-12-frontend-react-ui-ux.md` — frontend design
- `docs/13-14-development-plan-build-order.md` — the milestone-by-milestone build order this project follows

## Status

Following the milestone plan in `docs/13-14`. **M0 — Foundation** through
**M7 — Money** are complete: auth, driver onboarding/fleet,
pricing/dispatch/ride lifecycle, the real passenger and driver apps with
Leaflet maps, Socket.io offers/tracking/status, reconnect fallback, chat,
SOS, and trip history/detail/receipt views, and the full money path — wallet
+ ledger, cash and wallet-paid trips, an SSLCommerz sandbox gateway with an
idempotent webhook, driver earnings, payout accounts + withdrawals (finance-
admin approval), and promo validation/redemption + auto-generated receipts.
The next milestone is **M8 — Admin, Hardening & Launch**.
