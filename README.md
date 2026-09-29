# Cholo (চলো)

A ride-sharing platform for Bangladesh — passenger app, driver app and admin console.

**Live:** https://cholo-cholo7.vercel.app/

## Features

**Passengers**
- Sign up with phone number + OTP, full English and Bangla interface
- Book a ride with fare estimates per vehicle type, extra stops and scheduled rides
- Live map tracking of the driver, in-trip chat and SOS button
- Share a trip link with family
- Pay by cash, wallet or SSLCommerz; promo codes and referrals
- Trip history, receipts, saved places and favourites

**Drivers**
- Apply online with documents and vehicles, reviewed by admins
- Go online, get ride offers and accept them in real time
- Arrival, stops and completion only within 300 m of the place; end the trip early if the rider gets out
- Earnings, statements, payout accounts and withdrawals

**Admins**
- Dashboard and analytics
- Driver approvals, users, payouts, disputes, support queue and SOS board
- Pricing, surge, zones and promos
- Reports, exports, audit log and two-factor sign-in

**Tech:** React + TypeScript + Vite, Node.js/Express, PostgreSQL, Socket.io, Leaflet/OpenStreetMap.

## Dhaka Digital Twin

[`simulator/`](simulator/README.md) is an agent-based simulation of Dhaka. Thousands of virtual riders and drivers move on the road network, and demand follows office hours, Friday prayers, rain, the Eid exodus, cricket at Mirpur and hartals. It can:

- replay a run on a live map,
- compare dispatch policies on the same random seed,
- write trip, GPS and hexagon-demand datasets for ML,
- drive the real API and Socket.io server as a load test.

```bash
cd simulator && pip install -e ".[dev,osm]"
dhaka-twin run --scenario monsoon-rain --dashboard     # live map at http://127.0.0.1:8765
dhaka-twin compare --scenario weekday                  # cholo-v1 vs batched-eta, same riders
```

## Installation

**Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop/), or Node.js 20+ and PostgreSQL 16.

### With Docker (recommended)

```bash
git clone https://github.com/SadManQT/cholo.git
cd cholo
cp .env.example .env
docker compose up -d --build
```

Open http://localhost:4173.

### For development

```bash
git clone https://github.com/SadManQT/cholo.git
cd cholo
cp .env.example .env
docker compose up -d postgres

# API (terminal 1)
cd server
npm ci
npm run db:init
npm run dev

# Web app (terminal 2)
cd client
cp .env.example .env
npm ci
npm run dev
```

Open http://localhost:5173. In development, OTP codes are printed in the API terminal instead of sent by SMS.

### Demo accounts (optional)

```bash
docker compose exec -T postgres psql -U cholo -d cholo < database/seeds/seed.dev.sql
```

All use password `DemoPass123`: passenger `01710000001`, driver `01810000002`, admin `01510009993`.
