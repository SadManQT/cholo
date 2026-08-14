# M8 Launch Guide

This guide is the production handoff for Cholo. It complements the local
quickstart in `README.md`; no real secret belongs in this repository.

## 1. Preflight

Run the release proof from a PostgreSQL-backed checkout:

```bash
npm run setup
npm run db:init
npm test
docker compose config --quiet
docker compose up -d --build
curl --fail http://localhost:3000/health
curl --fail http://localhost:4173/healthz
```

`npm test` is the one-command gate: backend unit/integration/API suites,
frontend lint, TypeScript compilation, and the production Vite build.

## 2. Production topology

- Vercel serves `client/dist` as a static SPA. Set the Vercel project root to
  `client`; `client/vercel.json` supplies the history fallback.
- Render runs the API from `server/Dockerfile`; `render.yaml` creates a
  Singapore-region web service and PostgreSQL 16 declaration.
- The API container runs `npm run db:init` before starting. On an empty
  database it loads `schema.sql` and reference data. On an existing database
  it applies only unrecorded numbered migrations.
- Socket.io shares the API origin and process, so `VITE_SOCKET_URL` must point
  to the Render service, not Vercel.

## 3. Environment contracts

Set these in the Render dashboard:

- `DATABASE_URL` — injected by managed PostgreSQL.
- `CLIENT_ORIGIN` — the exact Vercel HTTPS origin, no trailing slash.
- `PUBLIC_API_ORIGIN` — the exact Render HTTPS origin used for payment IPNs.
- `JWT_SECRET` — generated 32+ character secret.
- `SSLCOMMERZ_STORE_ID` and `SSLCOMMERZ_STORE_PASSWORD` — sandbox or live
  credentials for the selected environment.

Set these in Vercel before building:

- `VITE_API_URL=https://<render-host>/api/v1`
- `VITE_SOCKET_URL=https://<render-host>`

All `VITE_*` values are public by definition. Never put a secret in one.

## 4. Deploy order

1. Create/approve the Render PostgreSQL and API resources from `render.yaml`.
2. Confirm `https://<render-host>/health` returns `{"db":true}`.
3. Create the Vercel project with root directory `client`, set both `VITE_*`
   variables, and deploy.
4. Set Render's `CLIENT_ORIGIN` to the final Vercel domain and redeploy API.
5. Register `PUBLIC_API_ORIGIN` with SSLCommerz and replay a sandbox IPN to
   prove webhook idempotency.
6. Do not load `seed.dev.sql` into production. Create real staff identities
   through a controlled bootstrap process.

## 5. Release smoke test

On the live URLs: register Nusrat-equivalent passenger → approve a driver →
go online → book/accept → arrive/start/complete → pay → inspect receipt,
wallet, earnings, dashboard, audit log, support ticket, and SOS acknowledge.
Repeat the payment webhook and confirm balances do not move a second time.

Platform credentials are intentionally not automated from a developer laptop;
deployment requires the owners' Vercel/Render/SSLCommerz accounts.
