# Cholo (চলো)

A ride-sharing platform for Bangladesh, built as a learning project by two people. Node.js/Express + PostgreSQL backend, React frontend — see `docs/` for the full design blueprint (ER diagrams, normalization proof, API contracts, build order).

**Working on this repo?** Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) first — it explains the workflow and how the two of us (plus whichever AI coding agent either of us is using) stay in sync via [`AGENTS.md`](./AGENTS.md).

**Deciding what to build next?** Open [`docs/cholo-feature-roadmap.html`](./docs/cholo-feature-roadmap.html) in a browser — it's the 24-step build order from `docs/13-14`, broken into per-feature prompts (one to build it, one to make your agent explain it back to you), with a personal checklist. Progress is saved per-browser only; GitHub Issues is still the shared source of truth for who's doing what.

## Quickstart (5 minutes)

**Prerequisite:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```bash
git clone <this-repo-url>
cd cholo
cp .env.example .env
docker compose up -d
```

That starts PostgreSQL 16 in a container and loads `database/schema.sql` into it automatically (only on first boot — see [Resetting the database](#resetting-the-database) below).

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
├── client/                # React SPA (not built yet — see docs/13-14)
├── server/                # Express API (not built yet — see docs/13-14)
├── database/
│   └── schema.sql         # full DDL: 54 tables, triggers, views — generated from docs/01–03
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

Following the milestone plan in `docs/13-14`. Currently: **M0 — Foundation** (this quickstart + `schema.sql`). Server and client scaffolding come next.
