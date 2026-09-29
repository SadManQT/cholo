# Demo data for presentations

`seed.demo.sql` fills the database with about 5 months of realistic activity, most of it in the last 60 days:

- 68 users: 40 passengers, 25 drivers and 3 admins.
- 738 trips: 685 completed, 47 cancelled and 6 live right now.
- Payments, wallets, driver earnings and withdrawals.
- Ratings, promos, referrals, disputes, support tickets, SOS alerts, notifications and audit logs.
- Three cities: Dhaka, Chattogram and Sylhet.

All dates are relative to the moment you run it, so the data always looks fresh. The money balances exactly: every wallet balance equals the sum of its transactions.

## Accounts (password `DemoPass123` for all)

| Role | Phone | Who |
|---|---|---|
| Admin (super) | 01510009993 | Ayesha |
| Admin (finance) | 01510009994 | Rezwana Karim |
| Admin (support) | 01510009995 | Imtiaz Ahmed |
| Passenger | 01710000001 | Nusrat (about 60 trips, free to book live) |
| Passenger | 01711482930 | Tanvir Hasan |
| Driver | 01810000002 | Rafiq (about 60 trips, starts offline, free to accept live) |
| Driver | 01816778890 | Rubel Mia (busiest driver) |
| Driver (pending review) | 01826667789 | Liton Das |
| Suspended passenger | 01914675964 | Sohel Rana |
| Suspended driver | 01829990012 | Babul Mia |

## Option A: Supabase SQL editor (no tools needed)

1. Open your project on supabase.com, then **SQL Editor** and **New query**.
2. For each file below, paste its full contents into the editor and click **Run**. Run them in this order, and wait for "Success" each time before moving on:
   1. `database/schema.sql`. Skip this on a database that already has the tables.
   2. `database/seeds/seed.reference.sql`
   3. `database/migrations/0001_m4_ride_request_guards.sql`
   4. `database/migrations/0002_audit_log_actor_restrict.sql`
   5. Skip `0003_fn_current_commission.sql`, because `schema.sql` already creates that function and running 0003 would fail.
   6. `0004` through `0013`, in number order.
   7. `database/seeds/seed.demo.sql`
3. If Supabase shows a warning like "this query has destructive operations", click **Run this query**. The seed only switches two triggers off and back on during the run.
4. Check that it worked by running `select count(*) from trips;`. It should return about 738.

Running `seed.demo.sql` again is safe. It notices the data is already there, prints a notice and changes nothing.

If your Supabase database was already set up by the app's deploy, where the Docker start command runs `db-init.js`, the schema and migrations are already applied. In that case, only do step 2.7 (`seed.demo.sql`).

## Option B: command line

You need `psql` on your computer and your Supabase connection string. Get it from **Project Settings → Database → Connection string**. Use the **Session pooler** (port 5432) or **Direct** string, not the Transaction pooler (6543).

```bash
export DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"

cd server && npm run db:init && cd ..

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seeds/seed.demo.sql
```

`npm run db:init` applies the schema, reference data and all migrations in the right order, skipping 0003 automatically. The `psql` line then loads the demo data.

## Server settings for Supabase

| Variable | Value |
|---|---|
| `DATABASE_URL` | Session pooler (5432) or direct connection string. Not 6543: the Dhaka time zone setting doesn't stick there, and day-based reports would shift. |
| `DATABASE_SSL` | `true` |
| `JWT_SECRET` | any random string of 32+ characters |
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | your frontend URL, e.g. `https://cholo-cholo7.vercel.app` |
| `PUBLIC_API_ORIGIN` | your API URL |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | only needed for document or photo uploads |

## Good things to show

- **Admin → Commissions:** pick "Last 30 days" or "This month". Dhaka Bike and Sylhet use a 12% commission, so the rates are mixed.
- **Admin → Dashboard / Analytics:** revenue trend, leaderboard, peak hours.
- **Admin → Drivers:** the verification queue has 3 pending drivers and 4 pending vehicles.
- **Admin → Payouts:** 6 requested withdrawals are waiting to approve or reject.
- **Admin → Disputes, Support, SOS:** each has a mix of open and resolved items, and one SOS is active on a live trip.
- **Passenger (Nusrat):** trip history, receipts and wallet. Book a live ride, then accept it as Rafiq in another browser.
- **Driver (Rafiq):** earnings, statements, withdrawals.

## Notes

- Supabase's Security Advisor will say "RLS disabled" on the tables. That is expected: the app connects only as `postgres`, and migration 0006 removes Supabase's public API access to these tables.
- To start over, run `drop schema public cascade; create schema public; grant all on schema public to postgres, service_role;` in the SQL editor. That deletes everything. Then repeat Option A from step 1.
