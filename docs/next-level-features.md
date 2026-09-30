# Cholo — Next-Level Feature Roadmap

Cholo already covers what Uber and Pathao offer: booking, live tracking, driver onboarding, wallet, payouts, surge, zones, disputes and admin tooling. Adding more of the same won't get it noticed. What gets noticed is solving the problems that Uber, Grab, DiDi and Pathao employ research teams to solve, and solving a few that they haven't solved for Bangladesh.

**The pitch:** *Cholo is an AI-native mobility platform that understands how Dhaka actually moves. It runs its own map, its own traffic model, its own dispatch brain and a Bangla-speaking assistant, and it proves every algorithm in a city-scale simulator before it reaches a real rider.*

Each feature below is listed as **What** it is, **Why** it stands out, and **How** to build it.

---

## 0. Build this first: the Dhaka Digital Twin (simulator)

Most ideas in this document need data you don't have yet: millions of trips, GPS traces and demand patterns. The fix is to generate that data.

- **What:** An agent-based simulation of Dhaka. Thousands of virtual riders and drivers move on the real road network (OSM). Demand follows realistic patterns: office hours, Friday prayers, rain, Eid exodus, cricket matches at Mirpur, hartals. The simulated riders and drivers call Cholo's actual API and socket server.
- **Why:** Uber, Lyft and DiDi all test dispatch and pricing in simulators before shipping, and almost no portfolio project has one. The simulator also feeds your ML models, load-tests your backend, and makes a strong demo: a live dashboard of 5,000 cars moving around Dhaka.
- **How:** Python (Mesa or a custom event loop) or Go workers. Road graph from OSM with `osmnx`, trips drawn from a spatiotemporal Poisson process over H3 hexagons. Add a replay mode ("replay yesterday at 2x speed") and a policy comparison mode ("dispatch v1 vs v2, same random seed").

---

## 1. Signature features

If you only build a few things from this document, build these. Each one is a headline on its own.

| # | Feature | Why it's a headline |
|---|---------|--------------------|
| S1 | **Cholo Maps**: your own map stack, traffic layer and routing | Grab built GrabMaps for the same reason. Owning the map is the moat. |
| S2 | **Landmark-aware AI address search** | Bangladesh addresses are informal ("behind Rapa Plaza, lane beside the mosque"). Nobody handles this well. |
| S3 | **Bangla/Banglish voice and chat booking agent** | An LLM agent that books, changes and cancels rides, and supports low-literacy users |
| S4 | **Batched ML dispatch + demand forecasting + predictive repositioning** | This is the core problem ride-hailing companies hire PhDs to work on |
| S5 | **Flood- and monsoon-aware routing** | A problem specific to Dhaka that global apps ignore |
| S6 | **Multimodal trip planner** (Metro Rail + bus + CNG + rickshaw + Cholo) | Makes Cholo the "Google Maps for Dhaka transit" |
| S7 | **AI safety layer**: route deviation, crash detection, drowsiness, liveness ID | Shows responsibility, which matters to large companies |
| S8 | **Marketplace experimentation platform** (switchback A/B tests) | A strong signal of senior-level engineering thinking |

---

## 2. Custom maps and geospatial engine

### 2.1 Self-hosted vector map with a custom style
- **What:** Replace Leaflet raster tiles with **MapLibre GL** and your own vector tiles (OpenMapTiles or Protomaps `.pmtiles` built from Bangladesh OSM). Design a Cholo map style with Bangla-first labels, a brand color palette, dark/night mode that switches automatically at sunset, 3D building extrusions, and hillshade for Chittagong and Sylhet.
- **Why:** The map is the first thing a user sees. A custom map immediately makes the app look like a real product instead of a hobby project.
- **How:** `planetiler` builds the tiles and PMTiles on a CDN serves them (no tile server needed). Design the style in Maputnik.

### 2.2 Smooth, alive vehicle rendering
- **What:** Cars glide instead of jumping between GPS points. They rotate to their bearing, use a different icon per vehicle type (car, bike, CNG, rickshaw), animate along the route polyline, and "breathe" while waiting. The route line draws itself in and the traveled portion fades.
- **How:** Dead-reckoning plus interpolation between socket updates, `requestAnimationFrame`, and bearing from consecutive points. Snap to the road geometry so cars never cut through buildings.

### 2.3 Own routing engine with a live traffic model
- **What:** Self-host **Valhalla** or **OSRM** and feed it your own speed data. Every driver's GPS ping is a traffic probe, which gives you a **Cholo Traffic Layer** (green/yellow/red roads) built from your own fleet.
- **How:** Map-match raw GPS with a Hidden Markov Model (Valhalla Meili, or implement Newson–Krumm yourself). Aggregate speeds per road segment per 15-minute bucket and push custom speed profiles to the router.

### 2.4 Map self-healing: find what OSM is missing
- **What:** Detect roads that drivers use but that don't exist in OSM, one-way errors, and new flyovers, by clustering GPS traces that don't match the map. Show suggested edits in an admin "Map QA" tool and optionally contribute them back to OSM.
- **Why:** Map inference from GPS traces is an active research area. It is a strong portfolio piece and a real contribution to Bangladesh's open map.

### 2.5 H3 hexagon spatial platform
- **What:** Index every ping, request and trip into Uber's **H3** hex grid. Use it for heatmaps, surge cells, demand forecasting and geofencing.
- **Why:** Using Uber's own open-source spatial index shows you speak their language.

### 2.6 Smart pickup points
- **What:** Learn the best pickup spots from where trips actually started: legal to stop, reachable, and not on the wrong side of a divider. When a rider drops a pin in the middle of a building, suggest "Gate 2, Bashundhara City (riders usually meet here)".
- **How:** DBSCAN clusters of real pickup locations, ranked by success rate and wait time.

### 2.7 AR "find my ride"
- **What:** At pickup, the rider raises the phone and AR arrows point to the car. The app also recognizes the number plate through the camera (Bangla plate OCR) and confirms "This is your car ✓".
- **How:** WebXR or native ARCore/ARKit, and a small on-device OCR model trained on Bangla number plates.

---

## 3. Search and address intelligence

### 3.1 Landmark and fuzzy address understanding (S2)
- **What:** Riders type the way people talk: *"Mirpur 10 golchottor er pashe, Shopno er samne"* or *"near Dhanmondi 27 Star Kabab"*. An LLM parses this into structured parts (area, road, landmark, relation), and a hybrid search (full-text + vector embeddings + geo-distance) resolves it to coordinates.
- **Why:** This is a real, unsolved problem in South Asia. A demo of it working is memorable.
- **How:** Postgres with `pg_trgm` + `pgvector` + PostGIS, multilingual embeddings, and an LLM for query parsing. Every successful drop-off feeds back into the landmark database.

### 3.2 Banglish and phonetic search
- **What:** "gulshan", "gulsan", "গুলশান" and "gulshun" all match. Transliteration-aware and typo-tolerant.
- **How:** Normalize to a phonetic key (a custom Bangla Soundex/Metaphone), plus Avro-style transliteration in both directions.

### 3.3 Intent and semantic place search
- **What:** *"A quiet café to work near Banani"*, *"hospital with emergency open now"*, *"cheapest way to the airport before 6pm"*. The search understands intent, not just place names.
- **How:** Retrieval over a POI database with LLM re-ranking. Opening hours and categories come from OSM and are enriched by drivers and riders.

### 3.4 Predictive destinations
- **What:** Open the app at 8:45 on a weekday and the first card says "Office · 24 min · ৳180". Friday afternoon it suggests the mosque or your parents' house.
- **How:** A per-user next-destination model (time, day, location, history). A simple gradient-boosted model is enough to start.

### 3.5 Community-verified addresses ("Cholo Codes")
- **What:** Short, shareable codes for hard-to-find homes, e.g. `CHL-7K2P`. The code carries the exact gate pin, a photo of the entrance and a voice note ("blue gate, ring twice"). Drivers see all of it.
- **Why:** Solves last-50-meters navigation in Bangladeshi alleys.

---

## 4. Conversational AI

### 4.1 Bangla voice and chat booking agent (S3)
- **What:** *"আমাকে এখন বনানী নিয়ে যাও, সস্তা দেখে"* → the agent finds the cheapest option, confirms the fare out loud and books it. It can also cancel, add a stop, share the trip with Ammu, or answer "where is my driver?"
- **How:** An LLM with tool use (Claude, e.g. `claude-sonnet-5` for reasoning and `claude-haiku-4-5` for fast turns) calls your existing REST API as tools. Add Bangla speech-to-text and text-to-speech, and guardrails so the agent always confirms before spending money.

### 4.2 Book from anywhere: WhatsApp, Messenger, SMS, USSD
- **What:** The same agent runs on WhatsApp and Messenger. A basic-phone user can dial `*CHOLO#` (USSD) or send an SMS: "RIDE Mirpur10 to Motijheel".
- **Why:** Financial inclusion and reach for users without a smartphone or data. Big companies care about the "next billion users".

### 4.3 Driver hands-free copilot
- **What:** A voice assistant for drivers: "Accept", "I've arrived", "Call the rider", "How much did I earn today?" No touching the phone while driving.
- **How:** Wake word on device, a small intent classifier, and text-to-speech replies.

### 4.4 Real-time translated chat
- **What:** A foreign tourist writes in English and the driver reads Bangla, and the reverse. Quick replies are suggested in both languages.

### 4.5 AI support agent with real authority
- **What:** "I was overcharged" → the agent reads the trip GPS trace, fare breakdown and route deviation, and within policy it **issues the refund itself** with a clear explanation. It escalates to a human only when needed and hands over a summary.
- **Why:** Most "AI support" is an FAQ bot. One that can investigate and act on its own is a big step up.
- **How:** Tool-using agent with read access to the trip, pricing and wallet repositories, a policy engine with refund caps, and every action written to the audit log.

### 4.6 "Ask Cholo" for admins
- **What:** Ops staff type *"Why did cancellations spike in Uttara last Tuesday evening?"* → the system writes the SQL, draws the chart, and explains the cause ("rain started 6:10pm, supply dropped 40%").
- **How:** Text-to-SQL over a read-only replica with a semantic layer (metric definitions), plus automatic chart generation.

---

## 5. Marketplace intelligence: dispatch, pricing, ETA

### 5.1 Batched matching (S4)
- **What:** Replace "nearest free driver" with **batched global matching**. Collect requests for a 2–5 second window and solve the assignment that minimizes total pickup time across all riders at once.
- **Why:** This is how Uber and DiDi actually dispatch. It is measurably better, and you can prove it in the simulator.
- **How:** Hungarian algorithm or min-cost flow (OR-Tools). Later, **reinforcement learning dispatch** (see DiDi's KDD papers) that values a driver's *future* position, not just the current pickup.

### 5.2 Demand forecasting
- **What:** Predict requests per H3 cell for the next 15, 30 and 60 minutes. Inputs: time, weather, holidays, events, and prayer times.
- **How:** Start with LightGBM, then move to a spatiotemporal graph neural network (e.g. a Graph WaveNet style model). Show a forecast-vs-actual chart in the admin dashboard.

### 5.3 Predictive driver repositioning
- **What:** Tell idle drivers where to go: *"Go to Gulshan 1. 12 requests expected in 20 min, ~৳600 potential."* It shows as a glowing demand heatmap on the driver map.
- **Why:** Cuts rider wait time and driver idle time. Supply and demand are balanced before a surge happens.

### 5.4 Automatic, explainable, fair surge
- **What:** Surge set by a model instead of an admin. It is based on the forecast supply/demand gap, smoothed so neighboring cells don't jump, and capped. Every rider sees **why**: "1.4× because it's raining and 60% fewer drivers are online nearby."
- **Why:** Explainability and fairness are what companies worry about most with dynamic pricing.

### 5.5 ML ETA prediction
- **What:** Predict pickup and trip ETA with a model trained on your own trips. It corrects the routing engine's estimate with learned effects such as the Farmgate signal, school traffic and rain.
- **How:** Routing ETA + a residual model (Uber's DeepETA approach). Show the accuracy (MAPE) over time on the admin dashboard.

### 5.6 Shared rides (Cholo Pool)
- **What:** Match riders going the same way in real time with bounded detours, and split the fare fairly.
- **How:** Insertion heuristics over candidate routes, with limits on detour and wait. The simulator shows how much distance pooling saves.

### 5.7 Multi-stop optimizer
- **What:** "Pharmacy, then bank, then home." Cholo orders the stops optimally and quotes one fare.
- **How:** A small TSP with time windows (OR-Tools).

### 5.8 Guaranteed upfront fare with confidence
- **What:** The quoted fare is final. Cholo takes the risk, using an ML model that predicts the actual trip cost distribution.

---

## 6. Bangladesh-specific innovation

### 6.1 Flood and waterlogging-aware routing (S5)
- **What:** In monsoon, the router avoids waterlogged roads such as Mirpur Road, Shantinagar and Rajarbag. Sources: (a) fleet speed collapse combined with rainfall data, (b) one-tap driver reports ("water here"), (c) a weather API. Show a live **flood layer** on the map.
- **Why:** A problem specific to Bangladesh, solved with data. This makes a great story in an interview or talk.

### 6.2 Multimodal journey planner (S6)
- **What:** "Uttara to Motijheel: Cholo Bike to Uttara North station (8 min) → Metro Rail MRT-6 (35 min) → walk 5 min. ৳140 total, 25 min faster than a car." Covers the metro, BRTC buses, launch/ferry routes, CNG and rickshaws.
- **How:** GTFS feeds you create yourself for Dhaka Metro and major bus routes, and a RAPTOR algorithm for public-transit routing combined with Cholo legs.

### 6.3 Fair-fare meter for street hailing
- **What:** Negotiating a CNG or rickshaw fare on the street? Open Cholo, enter the destination, and see the **fair price range** from real trip data. Share it with the driver as a card.
- **Why:** Useful even to people who don't book with Cholo, which drives growth.

### 6.4 Women-safe mode
- **What:** Female riders can choose female drivers, share the trip automatically with chosen contacts, and see safer routes (well-lit, busier roads at night).

### 6.5 Festival and exodus mode
- **What:** Eid, Puja and Pohela Boishakh have known demand shocks. Cholo pre-positions supply, runs intercity booking (Dhaka to hometowns), and shows event-aware ETAs.

### 6.6 Low-bandwidth "Lite" mode
- **What:** Works on 2G: a text-first UI, compressed binary socket updates, and a static map snapshot instead of live tiles. Offline booking queues over SMS.

---

## 7. Safety and trust AI

### 7.1 Trip anomaly detection
- **What:** Real-time detection of route deviation, an unexpected long stop, or the phone going offline mid-trip. The rider gets a check-in ("Are you okay?"). If they don't respond, the case escalates to the SOS board and trusted contacts.
- **How:** Compare the live trace against the expected route corridor and dwell-time models.

### 7.2 Crash detection
- **What:** Detect a crash from the phone accelerometer (sudden deceleration followed by no movement). Auto-call support, then emergency services.

### 7.3 Driver drowsiness and distraction detection
- **What:** An on-device camera model watches eye closure and yawning, and suggests a break after long shifts.
- **How:** MediaPipe Face Mesh with the eye aspect ratio. Runs on the device only, never uploaded, which is also good for privacy.

### 7.4 Real-time ID and liveness check
- **What:** The driver takes a selfie at the start of each shift and it is matched against the approved documents to stop account sharing. Includes liveness detection (blink or head turn).

### 7.5 Driver behavior score
- **What:** Harsh braking, speeding and phone use are measured from telemetry. A weekly coaching report with tips, and good drivers get rewards or insurance discounts.

### 7.6 Optional in-trip audio recording
- **What:** Encrypted recording that only support can decrypt if a report is filed, with an audio emotion/keyword classifier running on the device.

---

## 8. Fraud and abuse defense

- **GPS spoofing detection:** impossible speeds, mock-location flags, sensor/GPS mismatch, teleport patterns.
- **Collusion detection:** fake trips between the same driver and rider to farm promos or referrals. Build a **graph** of users, devices, payment instruments and IPs and detect suspicious clusters (community detection, GNN).
- **Multi-accounting:** device fingerprinting plus graph linking.
- **Fare manipulation:** a driver taking long detours. Compare against the optimal route and refund automatically.
- **Risk score per trip** is shown in admin with the reasons listed, and nothing is auto-banned without human review.

---

## 9. AI for drivers: earnings and wellbeing

- **Earnings forecaster:** "If you drive 5–9pm today in Gulshan you'll likely earn ৳1,400–1,800."
- **AI shift planner:** the best hours and zones for this driver's goals ("I need ৳20,000 this week").
- **Fuel/CNG cost tracker and true profit view:** earnings minus fuel minus maintenance.
- **EV transition calculator:** would switching to an electric bike pay off, based on your real trips?
- **Document OCR onboarding:** photograph an NID or driving license, and Bangla OCR fills the form and flags expiry and mismatches.
- **Transparent deactivation:** every deactivation comes with the reasons and a human appeal. Worth highlighting, because platform fairness to drivers is a current industry issue.

---

## 10. Beautiful and delightful product

- **Design system:** a custom Cholo design language with motion (Framer Motion), skeleton states, haptics, and Bangla typography done properly (Hind Siliguri or Noto Sans Bengali, tuned line heights).
- **Live Activity / Dynamic Island-style trip widget** (PWA notification or native): the driver's progress in the lock screen.
- **Cinematic trip recap:** at the end of a trip, an animated replay of the route with distance, CO₂ saved versus a private car, and a shareable card.
- **"Cholo Wrapped":** a yearly summary — kilometers, favorite places, hours saved, the city you "explored".
- **Micro-interactions:** the car icon honks when it arrives, a confetti moment on the first ride, and a pulsing radar while searching.
- **Accessibility first:** screen-reader-complete flows, a voice-only mode for visually impaired riders, large-text mode and color-blind-safe map palettes.

---

## 11. Platform engineering (the "big company" signals)

These show that you can build systems at the scale these companies run.

| Area | Feature |
|------|---------|
| **Event streaming** | Every ping, request and state change goes through **Kafka/Redpanda**. Stream processing (Flink or Bytewax) produces live metrics. |
| **Analytics store** | **ClickHouse** for trip and ping analytics, so dashboards over millions of rows load in milliseconds |
| **Real-time geo store** | Redis GEO / Tile38 for driver locations with geofence webhooks |
| **Experimentation** | Feature flags + **switchback experiments** (randomize by city-cell × time block, because marketplace A/B tests interfere with each other). Include a stats dashboard with CUPED variance reduction. |
| **ML platform** | A feature store (Feast), a model registry (MLflow), shadow deployment of new models, and drift monitoring |
| **Observability** | OpenTelemetry tracing across the API, sockets and jobs, with Grafana dashboards and SLOs ("p99 match time < 3 s") |
| **Load testing** | Use the simulator to push 10k concurrent drivers and publish the results |
| **Privacy** | Phone number masking, data retention policies, and **differential privacy** on public heatmaps |
| **Chaos testing** | Kill the socket server mid-trip and prove the trip recovers |

---

## 12. Civic and open data

- **Dhaka Mobility Insights portal:** anonymized, differentially private travel-time and demand data for city planners, researchers and journalists. "Average speed on Mirpur Road dropped 18% this monsoon."
- **Open-source releases:** publish the Bangla address parser, the Banglish search normalizer and the Dhaka GTFS feed as standalone open-source libraries. A GitHub star count on your own library is very visible.
- **Research write-ups:** blog posts in the style of engineering blogs, e.g. "How we cut Dhaka pickup times 22% with batched matching (simulated)".

---

## 13. Future and moonshot

- **Autonomous-ready dispatch API:** abstract the "driver" as an agent so robotaxis or delivery robots could plug in. Test it in the simulator.
- **Super-app expansion:** parcels (Cholo Send), food and grocery through the same dispatch engine (multi-vertical batching).
- **Corporate mobility:** company accounts, commute subscriptions, and shuttle route optimization for garment-factory workers.
- **EV fleet orchestration:** charge-aware dispatch that sends low-battery EVs to trips ending near chargers.
- **Carbon credits:** verified emissions savings from pooling and EVs.

---

## Suggested build order

The full plan, with milestones, exit criteria, dependencies and risks, is in [next-level-roadmap.md](next-level-roadmap.md).

| Phase | Build | Outcome |
|-------|-------|---------|
| **1. Foundation** | Simulator (0), H3 indexing (2.5), event streaming + ClickHouse (11), MapLibre custom map (2.1, 2.2) | Data plus a much better look. The simulator becomes your permanent demo. |
| **2. Intelligence** | Batched dispatch (5.1), demand forecasting (5.2), repositioning (5.3), ML ETA (5.5), explainable surge (5.4) | Measurable wins on charts |
| **3. Understanding** | Landmark address search (3.1), Banglish search (3.2), Bangla booking agent (4.1), AI support agent (4.5) | The "wow" demo moments |
| **4. Own the map** | Self-hosted routing + traffic layer (2.3), map matching, flood routing (6.1), map self-healing (2.4) | The moat story |
| **5. Trust** | Anomaly detection (7.1), fraud graph (8), liveness ID (7.4), experimentation platform (11) | Maturity signals |
| **6. Reach** | Multimodal planner (6.2), WhatsApp/USSD (4.2), Lite mode (6.6), open data portal (12) | Impact story |

## Tech additions at a glance

| Need | Tool |
|------|------|
| Maps | MapLibre GL, planetiler, PMTiles, Maputnik |
| Routing | Valhalla (map matching built in) or OSRM |
| Spatial | PostGIS, H3 (`h3-js`, `h3-py`), Tile38 |
| Search | pgvector, pg_trgm, multilingual embeddings |
| ML | Python (FastAPI) service, LightGBM, PyTorch (GNNs), OR-Tools, MLflow, Feast |
| LLM | Claude API with tool use, Bangla speech-to-text and text-to-speech |
| On-device AI | MediaPipe, TensorFlow.js / ONNX Runtime Web |
| Data | Redpanda/Kafka, ClickHouse, Flink or Bytewax |
| Ops | OpenTelemetry, Grafana, Prometheus, k6 |

## How to make companies notice

1. **Numbers beat features.** "Batched dispatch reduced average pickup time from 6.8 to 5.2 min across 100k simulated trips" is worth more than ten screens.
2. **A 90-second demo video:** the Bangla voice booking agent, the custom map with cars gliding, the flood layer, and the simulator running at 10x speed.
3. **Engineering blog posts** for each signature feature, written like Uber/Grab engineering blog posts: problem, approach, trade-offs, results.
4. **Open-source the reusable pieces** (Bangla address parser, Dhaka GTFS, Banglish search).
5. **A design doc per major system** in the repo. Big companies hire people who write design docs.
