# Dhaka Digital Twin

An agent-based simulation of Dhaka for Cholo. Thousands of virtual riders and drivers move on the city's road network. Demand follows the city's rhythms: office rush hours, Friday prayers, monsoon rain, the Eid exodus, cricket at Mirpur and hartals.

It runs in two modes:

- **Local**: an in-process copy of Cholo's platform rules, fast and deterministic. Use it for dispatch and pricing experiments and to generate ML training data.
- **Live**: every simulated rider and driver is a real client of Cholo's API and Socket.io server. Use it for end-to-end and load testing.

```
dhaka-twin run --scenario monsoon-rain --drivers 5000 --daily-requests 60000 --dashboard
```

## Install

Python 3.10 or newer.

```bash
cd simulator
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev,osm]"
```

### Road network

```bash
dhaka-twin fetch-graph        # downloads the OSM drive network with osmnx, ~a few minutes
```

This saves `data/cache/dhaka_drive.npz`, which every command then uses automatically. It needs access to the Overpass API (`overpass-api.de`).

Without it, the simulator falls back to a built-in skeleton of Dhaka's main corridors: Airport Road, Mirpur Road, Rokeya Sarani, Pragati Sarani, the elevated expressway, Old Dhaka and so on. It has about 590 nodes. The skeleton is good enough for tests and demos, but routes are coarser than on real streets. Force either graph with `--graph osm` or `--graph skeleton`.

## Commands

| Command | What it does |
|---|---|
| `dhaka-twin presets` | List the built-in scenarios |
| `dhaka-twin run` | Simulate a scenario. `--dashboard` serves the live map at http://127.0.0.1:8765 |
| `dhaka-twin compare` | Run several dispatch policies on the same seed and print a comparison |
| `dhaka-twin replay <run>` | Play a recorded run on the dashboard. `<run>` is a run directory, `latest`, `today` or `yesterday` |
| `dhaka-twin fetch-graph` | Download and cache Dhaka's OSM road network |
| `dhaka-twin osrm` | Serve OSRM-compatible routes from the twin's roads, for the Cholo server |
| `dhaka-twin seed-accounts` | Create simulator riders and approved drivers in Cholo's database |

Useful `run` and `compare` options:

- `--scenario NAME|file.json`, `--date YYYY-MM-DD`, `--start HH:MM`, `--hours N`
- `--drivers N`, `--daily-requests N` (demand of a normal working day), `--seed N`
- `--policy cholo-v1|batched-eta` (local backend)
- `--speed X`: simulated seconds per wall second. The default is as fast as possible, or 30× with `--dashboard`. The speed can be changed from the dashboard.
- `--gps-every S`: also record driver GPS traces
- `--demand-from RUN`: replay the exact ride requests of an earlier run

## Scenarios

| Preset | Day | What happens |
|---|---|---|
| `weekday` | Tuesday, 06:00 to 24:00 | Morning and evening office rush, school runs, shopping, airport trips |
| `friday` | Friday, 08:00 to 23:00 | Weekly holiday: quiet morning; Jumu'ah (12:50 to 13:50) empties the roads and takes most drivers offline, then a surge leaves the mosques |
| `monsoon-rain` | Tuesday, 15:00 to 21:00 | Heavy rain from 17:00 to 19:00 hits the evening rush. Demand rises ~70%, bikes go offline, traffic slows and six known spots flood for an hour afterwards |
| `cricket-mirpur` | Thursday, 14:00 to 24:00 | Day-night T20 at Sher-e-Bangla National Cricket Stadium: the crowd arrives over two hours and leaves in a spike after the match, with gridlock around Mirpur |
| `eid-exodus` | Last working day before Eid | Residents head for Gabtoli, Sayedabad and Mohakhali bus terminals, Kamalapur station, Sadarghat and the airport; office trips fall off |
| `hartal` | Tuesday, 06:00 to 22:00 | General strike until 18:00: demand and supply collapse, roads are empty, and drivers refuse pickups around Paltan, Gulistan, Motijheel and Shahbag |

Custom scenarios are JSON files. See [`scenarios/rainy-match-friday.json`](scenarios/rainy-match-friday.json). Friday prayers are added automatically to any Friday.

## Outputs

Each run writes a directory under `runs/` (for example `runs/2026-09-29_weekday_cholo-v1_…/`):

| File | Contents |
|---|---|
| `trips.csv` | One row per ride request: purpose, vehicle, origin and destination (lat/lng and H3), outcome, time to match, pickup wait, ride time, fare, weather and events |
| `demand_hex.csv` | Requests, completions and unserved requests per H3 cell (resolution 8) per 15 minutes, ready for demand forecasting |
| `gps.csv.gz` | Driver GPS traces with `--gps-every` |
| `requests.jsonl.gz` | Every generated request, so `--demand-from` can re-run the same demand |
| `events.jsonl.gz` | Every agent event: request, offer accepted, arrived, rider done, driver online/offline |
| `frames.jsonl.gz` | City snapshots for replay |
| `summary.json` | KPIs and a 5-minute time series |

## Policy comparison

`dhaka-twin compare` runs each policy on the same scenario and seed. Demand and the driver fleet come from separate random streams, so every policy faces exactly the same riders at the same times and places. Only dispatch differs.

- `cholo-v1` reproduces `server/src/services/dispatch.service.js`. Every eligible driver within 5 km gets the offer at once and the first to accept wins. A job every 5 s re-offers with a wider radius (7.5 km, then 10 km), offers last 15 s, and requests expire after 5 minutes.
- `batched-eta` matches waiting requests to free drivers every 5 s by road travel time (an H3 cell-to-cell matrix computed on the road graph). Each request is offered to one driver at a time.

Add a policy by subclassing `DispatchPolicy` in `dhaka_twin/dispatch/policies.py` and registering it in `POLICIES`.

### First results

These runs used the offline skeleton graph, 1,000 drivers, seed 42 and the default (uncalibrated) parameters. The weekday runs 06:00 to 24:00 and the monsoon-rain run 15:00 to 21:00. Treat them as simulated, not as measurements of Cholo:

| | Weekday, `cholo-v1` | Weekday, `batched-eta` | Rain, `cholo-v1` | Rain, `batched-eta` |
|---|---:|---:|---:|---:|
| Ride requests (identical) | 11,815 | 11,815 | 6,333 | 6,333 |
| Completion rate | 61.3% | 86.1% | 37.8% | 60.0% |
| Median pickup wait | 534 s | 192 s | 576 s | 244 s |
| Offers per request | 44.5 | 1.5 | 28.7 | 1.2 |
| Accepts that lost the race | 235,249 | 14 | 68,701 | 21 |
| Empty share of driven km | 62.6% | 48.8% | 60.8% | 40.1% |

What stands out about today's dispatcher:

- Broadcasting to everyone within 5 km means the fastest responder wins, not the nearest driver. Pickups are long, and riders cancel while waiting.
- Most accepts fail because another driver got there first.
- With 5,000 drivers, every booking fans out to about 700 offers, each an offer row and a socket message.
- `batched-eta` matches a little more slowly (median 10 s against 4 s) and lets more requests expire when supply is tight. It is a trade-off to tune, not a free win.

## Live mode: drive the real Cholo stack

The simulated agents log in, open their own Socket.io connections and call the same endpoints as the web app. That covers booking, offers over `offer:new`, accept, arrive (with the 300 m check), start, rider pickup confirmation, complete, cancel and rating. Location updates go over `location:update` at the app's cadence (10 s idle, 3.5 s on a trip).

```bash
# 1. Database with Cholo's schema, plus simulator accounts
cd server && npm run db:init && cd ../simulator
dhaka-twin seed-accounts --database-url "$DATABASE_URL" --drivers 1000 --riders 3000

# 2. Routing for the server from the twin's own road graph (instead of the public OSRM demo)
dhaka-twin osrm --port 5005 &

# 3. The API, with the simulator's IP exempt from rate limits and long-lived tokens
cd ../server
OSRM_BASE_URL=http://127.0.0.1:5005 RATE_LIMIT_ALLOWLIST=127.0.0.1,::1 JWT_ACCESS_TTL=12h npm run dev &

# 4. The simulation, in real time
cd ../simulator
dhaka-twin run --backend cholo --drivers 1000 --daily-requests 12000 --rider-accounts 3000 --speed 1 --dt 1 --dashboard
```

Notes:

- **Seeded accounts.** Riders use phones `0130xxxxxxx` and drivers `0140xxxxxxx`, all with the password `DhakaTwin#2026` (change it with `--sim-password`). Drivers come approved, with an approved vehicle: 45% bikes, 15% CNG, 33% cars, 7% premium. Everyone gets a large wallet balance, so commission debt never locks a driver out. The accounts use a cheap bcrypt hash, so logging in thousands of agents costs the server almost nothing. Re-running the seed command is safe.
- **`RATE_LIMIT_ALLOWLIST`** is a server setting added for load tests. Listed client IPs skip every rate limiter. It is empty by default. Without it, one machine can book only 30 rides an hour in total.
- **Time.** The server's timers are wall-clock (15 s offers, 5 min expiry), so live runs use `--speed 1`.
- **Cleanup.** At start, every simulator driver is logged in, any leftover trip is closed and the driver is set offline, so no ghost drivers from an earlier run receive offers. On exit, open trips are closed, drivers go offline and open searches are cancelled. Rider accounts still stuck in an old ride are set aside.
- **Load-test results.** `summary.json` records every endpoint's request count, status codes and p50/p95 latency, plus socket event counts.

## How it works

```
Scenario ──► conditions_at(t) ──► DemandModel (H3 Poisson) ──► Riders ─┐
   │              │                                                    ├─ commands ─► Backend ── events ─► agents
   │              └── traffic speed, supply, no-go zones ──► Drivers ──┘        (local model | real Cholo API)
   └── events: rain, Jumu'ah, cricket, Eid, hartal
```

- **Demand** is a non-homogeneous Poisson process per trip purpose: commute, school, shopping, errands, airport, plus event purposes such as after-prayer, cricket crowds and the exodus.
  - Each purpose has an hourly profile and a share of a working day's `daily_requests`, with Friday and Saturday factors.
  - Origins are drawn over H3 resolution-8 cells, weighted by nearby places (neighbourhoods, offices, markets, universities, hospitals, terminals, mosques, stadiums) and road density.
  - Destinations follow a gravity model: the attraction of each cell times an exponential decay with distance.
- **Riders** have a patience for finding a driver, a tolerance for the pickup wait, a walk time to the car, and sometimes change their mind. All of these are drawn when the request is generated.
- **Drivers** have a vehicle, a home, shift patterns (full day, morning, evening, night, peak-only), an acceptance propensity and a reaction time.
  - They accept nearby pickups more readily.
  - When idle, they drift towards busier hexagons.
  - They drive the road graph at free-flow speed times the time-of-day congestion factor (about 40% of free flow at peak) and any local slowdowns.
- **Events** change demand, supply, traffic speed and local zones. For example, rain takes bikes offline and floods known spots, and a hartal adds no-go zones.
- **Determinism.** The same scenario and seed always produce the same run in local mode.

The parameters (shares, profiles, speeds, patience) are informed assumptions, not fitted to Cholo data yet. Once real trips exist, fit them from `trips.csv`-shaped exports and check the twin against reality.
