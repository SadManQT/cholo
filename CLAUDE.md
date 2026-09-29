# CLAUDE.md

Cholo (চলো) is a ride-sharing platform for Bangladesh: passenger app, driver app and admin console.

## Layout

- `client/` — React 19 + TypeScript + Vite + Tailwind, Leaflet/MapLibre maps, Socket.io client. English and Bangla strings live in `client/src/i18n/`.
- `server/` — Node 20+ Express API in plain JavaScript (ES modules), PostgreSQL via `pg`, Socket.io, Zod validators. Layers: `routes/` → `controllers/` → `services/` → `repositories/`.
- `database/` — `schema.sql` (base schema), numbered `migrations/NNNN_*.sql` (applied in order by `server/scripts/db-init.js`), `seeds/`.
- `docs/` — HTML product and technical docs.
- `simulator/` — Dhaka Digital Twin, a Python agent-based simulator (`dhaka_twin` package). It runs locally against an in-process model of the platform, or live against the real API and sockets. See `simulator/README.md`.

## Commands

```bash
# Postgres for local work
cp .env.example .env && docker compose up -d postgres

# API
cd server && npm ci && npm run db:init && npm run dev
cd server && npm test            # node:test, needs DATABASE_URL pointing at a migrated database

# Web app
cd client && npm ci && npm run dev
cd client && npm run lint        # oxlint
cd client && npm run build       # tsc -b && vite build
```

```bash
# Simulator
cd simulator && pip install -e ".[dev,osm]"
pytest -q
dhaka-twin compare --scenario weekday          # dispatch policies on the same seed
dhaka-twin run --scenario friday --dashboard   # live map at http://127.0.0.1:8765
```

CI (`.github/workflows/ci.yml`) runs server tests against Postgres 16, client lint + build, and the simulator's tests plus a short policy comparison.

When dispatch, fares, offer timing or trip transitions change on the server, update the mirror in `simulator/dhaka_twin/backends/local.py` and `dispatch/policies.py` (`cholo-v1`) so local simulations stay faithful.

## Conventions

- New database changes go in a new numbered file in `database/migrations/`; never edit an applied migration.
- Keep user-facing text translatable in both English and Bangla.
- Match the style of the surrounding code; the server has no TypeScript.

## ECC (Everything Claude Code)

[ECC](https://github.com/affaan-m/ECC) v2.2.2 is installed per-project in `.claude/` using the installer's `claude-project` target. The selection lives in `.claude/ecc-install.json` (the `minimal` profile plus stack-specific skills). Hooks are **not** installed.

- Rules: `.claude/rules/ecc/` — `common/` always applies; language packs are path-scoped (`typescript/`, `react/` and `web/` match this repo).
- Agents: `.claude/agents/`. This is a project install, not the plugin, so call them without the `ecc:` prefix the rules mention (for example `subagent_type: "planner"`, `"code-reviewer"`, `"security-reviewer"`, `"database-reviewer"`, `"typescript-reviewer"`, `"react-reviewer"`).
- Commands and skills: `.claude/commands/`, `.claude/skills/` (for example `/plan`, `/code-review`, `/build-fix`, `/quality-gate`, `/react-review`, and the `tdd-workflow` and `verification-loop` skills).
- `coding-standards`, `frontend-patterns` and `backend-patterns` were copied from ECC by hand, because the installer can only add them together with large unrelated modules. ECC's install-state does not track them.

To update or change the selection, edit `.claude/ecc-install.json` and re-run the installer from a fresh ECC checkout:

```bash
git clone --depth 1 https://github.com/affaan-m/ECC /tmp/ECC
(cd /tmp/ECC && npm install --ignore-scripts --no-audit --no-fund)
node /tmp/ECC/scripts/install-apply.js --config .claude/ecc-install.json --no-hooks
node /tmp/ECC/scripts/ecc.js doctor
```
