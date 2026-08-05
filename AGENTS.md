# Cholo — instructions for AI coding agents

This file is the single source of truth for any AI agent working in this
repo (Claude Code, Codex, Cursor, etc.) — whichever tool a contributor is
using, follow these rules the same way. If your tool reads a differently-
named file (e.g. `CLAUDE.md`), that file just points back here; edit this
one.

Ride-sharing platform (Bangladesh-first), built as a learning project by two
people. Full design blueprint lives in `docs/` — **read the relevant doc
before proposing changes to schema, API shape, or architecture; don't invent
conventions that conflict with it.** The blueprint, not whichever contributor
is currently prompting, is the source of truth for design decisions — that's
what keeps two people (and two different AI agents) from drifting apart.

## How to work with us
- This is a learning project for both contributors. Prefer explaining an
  approach and showing a small example over silently writing a full feature.
- For anything flagged as a "checkpoint" in `docs/05-06-07` (learning
  roadmap), ask whether the person wants to attempt it themselves before
  implementing it.
- Keep changes scoped to one milestone at a time (`docs/13-14` has the
  milestone list and exact build order — follow that order). Don't jump
  ahead to a later milestone's features.
- Explain *why*, not just *what*, especially for SQL constraints,
  transactions, and the accept-race logic in dispatch.
- Before starting work, check recent git history (`git log`) and open
  branches — the other contributor (human or agent-assisted) may already
  have work in progress on the same area.

## Stack
- `server/`: Node.js + Express + Socket.io, PostgreSQL via `pg` (parameterized
  queries only, no ORM)
- `database/`: `schema.sql` + migrations, PostgreSQL 16 (run via
  `docker compose up -d` — see `README.md`)
- `client/`: React + TypeScript + Vite + Tailwind

## Conventions (see `docs/05-06-07` for full detail)
- Folders = layers (`routes/`, `controllers/`, `services/`, `repositories/`),
  files = features (`rides.service.js`)
- SQL lives only in `repositories/`
- Money: `NUMERIC`, never float. Time: `TIMESTAMPTZ`, never naive timestamp.

## Git workflow (see `docs/13-14` §3.1 for the full compendium)
- One branch per feature/issue, PR into `main`, merge only when the demo
  works.
- Commit messages: `type: what` (e.g. `feat: offer accept race guard`).
- Never force-push `main`; never skip hooks.
- `.env` is git-ignored — copy `.env.example` and never commit real secrets.
