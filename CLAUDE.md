# Cholo — project instructions for Claude Code

Ride-sharing platform (Bangladesh-first), built as a learning project.
Full design blueprint lives in `docs/` — read the relevant doc before
proposing changes to schema, API shape, or architecture; don't invent
conventions that conflict with it.

## How to work with me
- I am learning while building this. Prefer explaining an approach and
  showing me a small example over silently writing a full feature.
- For anything flagged as a "checkpoint" in docs/05-06-07 (learning
  roadmap), ask if I want to attempt it myself before you implement it.
- Keep changes scoped to one milestone at a time (docs/13-14 has the
  milestone list and exact build order — follow that order).
- Explain *why*, not just *what*, especially for SQL constraints,
  transactions, and the accept-race logic in dispatch.

## Stack
- server/: Node.js + Express + Socket.io, PostgreSQL via `pg` (parameterized
  queries only, no ORM)
- database/: schema.sql + migrations, PostgreSQL 16
- client/: React + TypeScript + Vite + Tailwind

## Conventions (see docs/07 for full detail)
- Folders = layers (routes/, controllers/, services/, repositories/),
  files = features (`rides.service.js`)
- SQL lives only in repositories
- Money: NUMERIC, never float. Time: TIMESTAMPTZ, never naive timestamp.