# Contributing to Cholo

Two people work on this repo, often with different AI coding agents
(Claude Code, Codex, etc.). This file is the 2-minute orientation; the real
rules live in the files it points to.

## First time here

1. Follow the quickstart in `README.md` (clone → `.env` → `docker compose up`).
2. Read `AGENTS.md` — the shared project conventions, stack, and git workflow.
   **Every AI agent in this repo follows that file**, regardless of which
   tool you're prompting with, so behavior stays consistent no matter who's
   driving. If you use Claude Code, it auto-loads `AGENTS.md` via the
   `@AGENTS.md` import in `CLAUDE.md`. If you use Codex or another tool that
   reads `AGENTS.md` natively, it picks it up directly. Nothing to configure
   either way.
3. Read `docs/13-14-development-plan-build-order.md` for the milestone order
   we're building in — don't jump ahead of the current milestone (see
   `README.md`'s Status section for where we are).

## Workflow

- One branch per feature, PR into `main`.
- Commit messages: `type: what` (e.g. `feat: offer accept race guard`).
- Before starting work, `git log` / check open branches — the other
  contributor may already be mid-feature in the same area.
- Read the relevant `docs/` file before changing schema, API shape, or
  architecture — the blueprint is the source of truth, not whoever's
  prompting at the time.

## If AGENTS.md and CLAUDE.md ever disagree

They shouldn't — `CLAUDE.md` just imports `AGENTS.md`. If you're editing
project conventions, edit `AGENTS.md` only.
