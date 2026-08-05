# Cholo — Day 1 Kickoff Guide

You already have all 14 blueprint documents (ER design, normalization, schema,
data dictionary, learning roadmap, architecture, folder structure, backend,
API, auth, frontend, UI/UX, dev plan, build order). Almost nobody starting a
student project has this much groundwork done before writing a line of code.
This guide turns that blueprint into an actual first session.

The name: doc 01 already lists "Jatra" as a **working name, rename freely** —
this was never locked in. Every doc in `docs/` in this folder has been
re-saved with `Jatra → Cholo` (and `যাত্রা → চলো`) already applied, so you
don't need to hunt-and-replace anything yourself.

---

## 0. The one rule that matters most

**Don't let Claude Code write the whole app while you watch.** That gets you
a project you can't explain in the viva. The pattern that actually teaches
you (from doc 05 §1):

> Learn ~70% of a topic → attempt the checkpoint yourself → get stuck on
> something *specific* → ask Claude Code that specific question → understand
> the answer → type the fix yourself.

Claude Code is best used as a **pair programmer who explains**, not a vending
machine for code. Concretely: ask it to explain the plan before it edits
files, review its diffs line by line, and type out the parts doc 05 flags as
checkpoints yourself instead of accepting a generated version.

---

## 1. Install what you need (one-time setup)

Check what you already have:

```bash
node -v      # need 18+
git --version
psql --version   # optional if you use Docker for Postgres instead
docker --version  # recommended — avoids installing Postgres natively
```

If anything is missing:

| Tool | macOS | Linux | Windows |
|---|---|---|---|
| **Node.js 18+** | `brew install node` | `sudo apt install nodejs npm` (or nvm) | Use **WSL2** (Ubuntu), then the Linux command |
| **Docker Desktop** | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) | `sudo apt install docker.io docker-compose-plugin` | Docker Desktop, with WSL2 backend |
| **Git** | `brew install git` | `sudo apt install git` | comes with WSL2 |
| **VS Code** | [code.visualstudio.com](https://code.visualstudio.com/) | same | same, install the "WSL" extension too |

**Windows note:** install WSL2 first (`wsl --install` in an admin PowerShell,
then restart) and do everything else — Node, Docker, Git, Claude Code — from
inside the Ubuntu terminal it gives you. Trying to juggle native Windows
paths against a Linux-style toolchain is a common source of wasted hours;
WSL2 sidesteps it entirely.

### Install Claude Code

```bash
# Requires Node 18+
npm install -g @anthropic-ai/claude-code
```

or the native installer (macOS/Linux/WSL):

```bash
curl -fsSL claude.ai/install.sh | bash
```

Verify:

```bash
claude --version
```

First time you run `claude` inside a project folder, it opens your browser to
log in with your Claude.ai account (or a Console/API key for headless use).

---

## 2. Scaffold the repo (Milestone M0, doc 13 §2 / doc 14 §1 step 1–2)

```bash
mkdir cholo && cd cholo
git init

mkdir -p client server database docs
```

Copy the cleaned-up blueprint into `docs/` — these are the files in this
delivery (`01-...md` through `13-14-...md`). Put them at `cholo/docs/`. This
matters for two reasons: it's your own reference while building, and it's
context Claude Code can read directly when you ask it questions — markdown
is far cheaper for it to read than the styled HTML versions you started with.

Then, in the `cholo/` root, create one more file: **`CLAUDE.md`**. This is
the file Claude Code reads automatically at the start of every session in
this folder — it's how you tell it the ground rules once instead of
repeating them every time.

```markdown
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
```

Commit:

```bash
cd cholo
git add .
git commit -m "chore: project skeleton + blueprint docs"
```

---

## 3. Start Claude Code and do the rest of M0 together

```bash
claude
```

Then, instead of "build the project," start narrow — this is the actual
first thing to type at the prompt:

> I'm starting milestone M0 from docs/13-14 — repo skeleton, .gitignore,
> .env.example, and a docker-compose.yml that boots PostgreSQL 16 and loads
> database/schema.sql automatically. Before writing anything, walk me
> through what each file needs to do and why, then we'll build them one
> at a time.

You still need `database/schema.sql` itself — that's your actual table
definitions, which live in the ER/normalization docs (`docs/01` and
`docs/02-03`) you already have. Point Claude Code at them:

> Read docs/01 and docs/02-03 and assemble the full schema.sql from the
> CREATE TABLE / constraint / trigger definitions in there — don't invent
> new tables, use exactly what's designed.

M0 is done when, per doc 13: `git clone` (of your own repo, on a second
folder or ask a friend) + `docker compose up` gets you a running Postgres
with all the tables, and the verification queries in doc 03 §11 pass.

---

## 4. The rhythm from here (doc 05 §10, condensed)

| Weeks | Study (doc 05 phase) | Build (doc 13 milestone) |
|---|---|---|
| 1–2 | Phase 0 — JS, Git, terminal | M0 — repo + Docker + Postgres booting |
| 3–4 | Phase 1 — SQL & Postgres | Explore schema in `psql`, 20 practice queries |
| 5–7 | Phase 2 — Node & Express | M1 skeleton → M2 auth API in Postman |
| 8–10 | Phase 3 — React & TS | M3 driver onboarding, M5 frontend shell |
| 11–12 | Phase 4 — Realtime & Maps | M4 dispatch/ride core, M6 two-browser demo |
| 13–14 | Phase 5 — Docker/Testing/Deploy | M7 money, M8 hardening + launch |

Full detail, checkpoints, and free-resource links for each phase are in
`docs/05-06-07-...md`. Full milestone specs (goal / features / demo script /
done-when checklist) are in `docs/13-14-...md`.

## 5. How to ask Claude Code for help without losing the learning

- **Before a feature:** "Explain how X should work per the docs before you
  write it" — read the explanation, ask questions, *then* let it code.
- **After it edits files:** ask `/diff`-style review — read every changed
  line. If something looks unfamiliar, ask "why this way and not X?"
  instead of just accepting it.
- **At a checkpoint** (doc 05 marks these explicitly): try it yourself
  first, even badly. Then ask Claude Code to review what you wrote rather
  than replace it.
- **When stuck:** describe the specific error or confusion, not "it doesn't
  work" — Claude Code (and any dev) is far more useful with a precise
  question than a vague one.
