# Prompt: চলো (Cholo) full feature walkthrough video

Use this whole file as the brief for an AI video generator, a motion designer, or a coding agent that builds and renders the video.

---

## 1. Your role and the goal

You are a senior motion designer and product-video director. Your past work includes launch films for Uber, Grab, Apple and Stripe.

Make a **premium, cinematic, fully animated product walkthrough** of **চলো (Cholo)**, Bangladesh's ride-sharing super-app. The viewer should finish thinking: *"This is the most complete, most advanced mobility app in South Asia."*

The video has two halves that must feel like one continuous product:

1. **The real product.** It starts on the real website (https://cholo-cholo7.vercel.app) and walks through every live feature for passengers, drivers and admins, using the real screens.
2. **The next-generation platform.** These are the AI, maps, safety and Bangladesh-specific features from the roadmap and the trailer. They are **presented as already live and fully working**, shown in a polished, simulated UI with motion that explains how each one works.

There is no "coming soon" label, no "concept" label and no roadmap language anywhere in the video. Every feature is shown as shipped.

---

## 2. Output specifications

| Item | Spec |
|---|---|
| Main cut | **8–10 minutes**, 1920×1080, 60 fps (30 fps acceptable), H.264 High, AAC 320 kbps, under 1 GB |
| Short cuts | A **90-second** highlight cut (16:9). A **60-second** vertical cut (1080×1920) for Reels, Shorts and TikTok. A **15-second** teaser. |
| Captions | Burned-in English subtitles. A separate `.srt` for English and one for Bangla. |
| Voice-over | Warm, confident, young Bangladeshi narrator. Provide an English VO track and a Bangla VO track as separate versions. |
| Music | Modern, uplifting electronic or cinematic at about 110–124 BPM. It builds through the acts, with a big drop at the next-gen reveal. Cuts land on the beat. Use royalty-free or licensed music only. |
| Chapters | YouTube chapter markers at each act (timestamps listed in section 6) |
| Deliverables | The master video, the three short cuts, SRT files, a project file or source, and a thumbnail (1280×720) |

---

## 3. Brand system (follow exactly)

- **Logo:** use the **চলো** gold wordmark and ride mark from the repo (`client/public/logo.svg`, plus the latest version in `client/src/components/brand/`). Never redraw it or change its colours.
- **Colours:**
  - Forest green `#0C684F` (primary)
  - Deep green `#0A3D30`
  - Night `#03140F`
  - Gold gradient `#FFE58A → #FBBF2E → #E88A12` (highlights, key words, numbers)
  - Cream `#FAF7F0` (light surfaces)
  - Ink `#0E261F` (text)
  - Accents, used only in their scenes:
    - Women Ride pink `#F0508C`
    - SOS red `#DC2626`
    - Flood blue `#3B82F6`
    - Metro MRT-6 line colour `#E11D48` with a white station ring
- **Payment brand colours:** bKash `#E2136E`, Nagad `#F6921E`.
- **Type:**
  - Latin: **Inter** (800–900 for headlines, 500–600 for body).
  - Bangla: **Baloo Da 2** for display and **Hind Siliguri** for UI text.
- **Headline style:**
  - Two lines. The first line is white; the second line is in the gold gradient (or the scene's accent colour).
  - Headlines enter word by word, sliding up from a mask.
  - Above the headline goes an eyebrow label: numbered, uppercase, letter-spaced, in a gold circle badge (for example `07 · PAY YOUR WAY`).
- **Backgrounds:**
  - A deep green radial gradient with slow, blurred light blobs.
  - A faint moving dot grid.
  - Thin gold "car light trail" streaks drifting diagonally.
  - A soft vignette.
  - Light-theme product shots sit on this dark stage inside device frames.
- **Device frames:**
  - A modern edge-to-edge phone with a dynamic island and a soft glare.
  - A slim laptop or browser frame for the admin dashboard and the web site.
  - Devices float with gentle 3D tilt (±8° on Y), deep soft shadows, and a very slow idle float of 6–10 px.
- **Tone:** confident, modern, warm and proudly Bangladeshi. It should feel premium, never cheesy. No stock-photo people on screen. Use abstract avatars with initials.

---

## 4. Motion language (apply everywhere)

| Rule | Value |
|---|---|
| Easing | Entrances use `cubic-bezier(0.23, 1, 0.32, 1)` (strong ease-out). Moves use `cubic-bezier(0.77, 0, 0.175, 1)`. Pop-ins use a slight overshoot back-ease. |
| Durations | Micro 150–250 ms, UI transitions 400–600 ms, scene transitions 600–900 ms |
| Stagger | List items 80–140 ms apart. Headline words 60 ms apart. |
| Camera | Slow push-ins (scale 1.00 → 1.06 over the scene). Whip-pan or light-sweep transitions between acts. Match-cuts from a UI element into the next scene, e.g. the payment button expands into the next screen. |
| Maps | Cars **glide** along roads and rotate to their bearing, never jumping. Route lines draw themselves in, and the travelled part fades. Pins drop with a bounce, and the pickup pin has a pulsing ring. |
| Numbers | Every amount, count and percentage **counts up**, with tabular figures. |
| Taps | Show a soft white touch ripple where a finger taps. Show a cursor on desktop shots. |
| Transitions | Use a gold light sweep (a diagonal glare band) on every act change, timed to a whoosh. |
| Restraint | Hold each key frame for at least 1.5 seconds so it can be read. Never more than about 3 simultaneous motions in focus. |

**Sound design:**
- a soft whoosh on transitions;
- UI ticks on taps;
- a coin chime on payments;
- a "ding" when a driver is matched;
- a low impact hit on act reveals;
- shimmer bells on logo moments;
- a two-tone alert for SOS;
- light rain ambience in the flood scene;
- a metro chime in the Metro scene.

---

## 5. Cast and demo data (keep it consistent)

Use these recurring characters and real Dhaka places so the story feels continuous:

| Who | Role | Detail |
|---|---|---|
| **Nusrat Jahan** | Passenger | Lives in Dhanmondi, works in Gulshan 2. Her emergency contacts are "Ammu", "Abbu" and "Rafi (brother)". |
| **Rafiq / Rahim Hossain** | Driver | Green CNG and a car, plate `Dhaka Metro-Tha 11-2345`, rating 4.9 |
| **Nusrat J.** (driver variant) | Woman driver | Used for the Women Ride scene, with "Verified woman driver" and "NID checked" badges |
| **Ayesha** | Super admin | Rezwana is the finance admin and Imtiaz the support admin |

- **Places:**
  - Dhanmondi 27, Gulshan 2 Circle, Banani, Motijheel and Farmgate
  - Mirpur 10, Uttara North, Bashundhara City and Hazrat Shahjalal Airport
  - Kamalapur, Old Dhaka, plus Chattogram and Sylhet for the multi-city shots
- **Money:** all in **৳ BDT**. Typical fares: bike ৳85, CNG ৳140, car ৳260. Driver day earnings ৳2,480. Wallet balance ৳1,250.00.
- **Real data for screen recordings:** use the repo's demo seed (`database/seeds/seed.demo.sql`, guide in `database/seeds/DEMO_SEED.md`). It holds about 738 trips, 3 cities, live trips, withdrawals, disputes and SOS alerts, so every admin table looks full and real.
  - Logins, all with password `DemoPass123`:
    - passenger `01710000001`
    - driver `01810000002`
    - admin `01510009993`

---

## 6. Story structure and shot list

Each beat lists **on-screen visuals → motion → VO (English) → on-screen text**. Timings are targets for the 8–10 minute master.

### ACT 0 — Cold open (0:00–0:25)
1. Black screen, then the hum of the city at night. Gold light trails streak across Dhaka's road network, drawn as glowing lines on a dark map.
2. One car icon glides along a route. The route curls into the **চলো logo**, which reveals with a blur-to-sharp effect and a gold shine sweep.
   - **Text:** "BANGLADESH MOVES WITH চলো" → "RIDE · DRIVE · EARN"
3. Rapid kinetic type, one line per beat:
   - "One app." / "Every ride." / "Every city."
   - City names ticker underneath: Dhaka, Chattogram, Sylhet, Khulna, Rajshahi, Barishal, Rangpur, Mymensingh.
   - **VO:** "This is চলো. Built for how Bangladesh really moves."

### ACT 1 — The real website: home page (0:25–1:10) · chapter "Welcome"
4. A browser frame flies in showing **cholo-cholo7.vercel.app**. A real screen recording, scrolling smoothly.
5. Show the home page "one ride, step by step" story and its animated scenes, each highlighted as the cursor hovers:
   - **Book → Match → Women-only → Arrive → Board → Ride → Detour → Pay → Rate → Metro + ride → Digital twin**
   - For each scene, a pill label pops above it in sync with the beat.
6. Show the loading "trip meter" counter, the light/dark theme toggle (the page cross-fades between themes), and the **Bangla ↔ English** language switch, with text morphing between languages.
   - **VO:** "Everything starts here. One clear story, from tapping 'Book' to rating your ride, in Bangla or English, in light or dark."

### ACT 2 — Passenger journey: real app (1:10–3:30) · chapter "Ride"
Show the real app in a phone frame. Every step is a real screen recording, enhanced with motion overlays: zooms, callout chips and touch ripples.

7. **Sign up in seconds.** Register, then enter the OTP code sent by SMS (digits pop into the boxes one by one), then log in.
   - **Chip:** "Secure login · OTP by SMS"
8. **Where to?** The pickup is the current location. In the destination search, type "Gulshan 2 Circle" letter by letter while suggestions slide in. Show **saved places** (Home, Office), then **add a stop**.
9. **Choose a ride.** The route draws on the map and the vehicle sheet slides up with **Bike, CNG, Car and Car Premium**, each with an ETA and an **upfront fare**. Selection moves from Bike to CNG.
   - **Chip:** "Fare locked · ৳140"
10. **Extras on the booking screen:**
    - a **promo code** applied, with the discount counting down;
    - **schedule for later**, a calendar picking "Tomorrow 8:30 AM";
    - the **Women Ride** toggle turning on (pink accent).
11. **Pay your way.** The payment method picker shows **Cash, Cholo Wallet, bKash, Nagad, Card**. When the wallet balance is too low, show the "Top up" button working.
12. **Matching.** A radar pulse spreads out, then a "ding" as the driver is found. The card shows Rahim Hossain, ★4.9, Green CNG, `Tha 11-2345`, 3 min away. The car glides toward the pickup on the live map.
13. **Passenger-confirmed pickup (signature safety feature).**
    - The banner reads "Rahim says he's arrived — is he really here?"
    - The **slide-to-confirm** thumb glides across and the screen floods green: "Pickup confirmed — trip started."
    - Then show the alternative briefly: the rider taps **"He's not here"**, and the driver is blocked from starting the trip.
    - **VO:** "No fake pickups. Your trip only starts when *you* confirm your driver is really there."
14. **Live trip.** The car follows the route and the ETA counts down. Tap **Share trip**, and a family member's browser opens the **/share link** with the live car moving. Ammu receives it.
15. **SOS (dedicated hero beat, red accent, two-tone alert).** Tap the big pulsing SOS button and the screen floods red with "Help is on the way" and a timer. A checklist lights up row by row:
    - Ammu ✓, Abbu ✓, Rafi ✓ (each sent your live location)
    - চলো Safety Team is calling you
    - Police 999 alerted ✓
    - Audio recording started
    - On top, a live mini-map with a pulsing dot "updating every second". A family-phone notification pops in: "চলো SOS ALERT — Nusrat needs help right now! Live location: Gulshan Avenue."
    - **VO:** "In danger? One tap. Your family gets your live location, our 24/7 safety team calls you, and police are alerted in seconds."
16. **"Stop here."** The rider ends the trip early and the fare **recalculates to the distance actually travelled**. The meter shrinks from ৳260 to ৳150.
17. **Pay and receipt.** Choose bKash; the secure SSLCommerz-style page slides in and shows success, then the coin chime plays. The receipt card shows the fare breakdown (base, distance, time, promo, total).
18. **Rate and tip.** Stars fill one by one, quick tags pop in ("Polite", "Safe driving"), and the driver is saved as a **favourite** (heart burst).
19. **Rider hub montage** (fast cuts, 1 second each): trip history, wallet with top-ups and a transaction list counting, promo codes, notifications, support chat, account and security.

### ACT 3 — Driver app: real app (3:30–4:50) · chapter "Drive & Earn"
20. **Become a driver.**
    - Apply, then upload NID and licence (photos snap into frames).
    - Licence expiry is validated against **Bangladesh licence rules**, with a green check animation.
    - Add a vehicle: bike, CNG or car.
    - **Chip:** "Verified in-app"
21. **Go online.** The toggle flips green and the map wakes up around the driver.
22. **Ride offer.** A card slides in with a countdown ring, pickup, drop-off, fare and distance. Tap **Accept**, then navigate.
23. **Arrive, then wait for the rider to confirm.** The driver's screen shows "Waiting for Nusrat to confirm" until it unlocks and becomes **Start trip**, then **Complete**.
24. **Earnings dashboard.**
    - "Today" counts up from ৳0 to ৳2,480 and a sparkline draws itself.
    - Show cards for Gross, Commission and Net, a **Cash collected vs Paid in app** split, and the per-trip list sliding in.
25. **Monthly statements.** Open a month and the statement page flips open like a document.
26. **Withdraw to bKash / Nagad.** Enter the amount, then confirm. The "৳2,000 sent to bKash" toast drops in and the wallet balance updates.
    - **VO:** "Keep more of every fare, see every taka clearly, and withdraw to bKash or Nagad any day."

### ACT 4 — Admin operations centre: real dashboard (4:50–6:00) · chapter "Operations"
Show this in a laptop frame with the real admin UI and the demo seed data, so every table is full. Use smooth cursor movement, zooms onto key numbers, and count-ups.

27. **Operations dashboard:** KPIs count up (live trips, online drivers, today's revenue). The city switcher changes between Dhaka, Chattogram and Sylhet, and the numbers re-animate.
28. **Analytics:** 10 reports flick through (revenue by city and month, peak hours heatmap, top drivers, top riders, cancellations).
29. **Commissions report:** presets such as "Last 30 days", a date-range search and a city filter. Show the totals (commission, rides, drivers, ride cost, averages), the cash vs in-app split, the by-day table and the by-vehicle table.
30. **Driver approvals and document review:** approve a pending driver, and the row flies into "Approved" with a check.
31. **Pricing:** publish a new rate card per city and vehicle. **Zones:** draw a polygon on the Dhaka map (restricted, airport, station types, each in its colour), then switch cities and watch the map fly to the new city. **Surge:** set a multiplier for a zone.
32. **Promo codes, withdrawals/payouts** (approve, and the status pill morphs to "Paid"), **SOS board** (a live red alert card pulsing), **disputes, user reports, support tickets, audit log** (rows stream in, each with a timestamp).
    - **VO:** "Behind every ride, a full operations centre: pricing, zones, payouts, safety and a complete audit trail."

### ACT 5 — The next generation: shown as live (6:00–9:00) · chapter "Next Gen"
**The big reveal.** The music drops. A full-screen gold sweep, then the text **"And this is just the beginning."** cuts to **"চলো Intelligence."** The interface shifts to a darker, more futuristic version of the brand: thin glowing lines, glassmorphism cards and data overlays.

Every feature below is presented as **live in the app**. For each one, show a short simulated UI (6–12 seconds) with motion that **explains how it works**: the data flowing, the model thinking and the result appearing.

**5A. Dhaka Digital Twin (hero opener, 15 s)**
- A dark 3D Dhaka with **5,000 glowing cars** moving on real roads, with demand pulsing as H3 hexagons.
- A scenario selector cycles "Office rush", "Friday prayers", "Monsoon evening", "Eid exodus" and "Cricket at Mirpur", and the city reacts each time.
- A split-screen "Dispatch v1 vs v2, same seed" ends with **"Pickup time −22%"** counting up.

**5B. Cholo Maps**
- **Our own vector map:** Bangla-first labels, 3D buildings rising, and an automatic switch to night style at sunset.
- **The live Cholo Traffic Layer:** roads turn green, yellow or red from fleet GPS. Show pings flowing into road segments.
- **Smart pickup points:** a pin dropped inside a building snaps to "Gate 2, Bashundhara City · riders usually meet here".
- **AR find-my-ride:** a camera view with floating arrows to the car, then the **Bangla number plate is read by OCR** and a check appears: "This is your car ✓".
- **Map self-healing:** an admin "Map QA" view where GPS traces reveal a missing road, and it is added to the map.

**5C. AI search and addresses**
- **Landmark-aware AI address search:** type *"Mirpur 10 golchottor er pashe, Shopno er samne"*. It is parsed into chips (Area · Landmark · Relation) and resolves to a precise pin with a confidence ring.
- **Banglish and typo-tolerant search:** "gulshan", "gulsan", "গুলশান" and "gulshun" all collapse into one result.
- **Intent search:** "Hospital with emergency open now" returns ranked results with open-now badges.
- **Predictive destinations:** at 8:45 AM the first card says "Office · 24 min · ৳180".
- **Cholo Codes:** `CHL-7K2P` opens a gate photo, an exact pin and a voice note: "blue gate, ring twice."

**5D. Conversational AI (Bangla-first)**
- **Voice booking agent:**
  - The user says *"আমাকে এখন বনানী নিয়ে যাও, সস্তা দেখে"*. A waveform animates, the transcript types out, and the agent compares the options.
  - It **confirms the fare out loud** and books the ride.
  - Then: "add a stop", "share with Ammu", "where is my driver?"
- **Book from anywhere:** booking happens in a WhatsApp chat, a Messenger chat, an SMS `RIDE Mirpur10 TO Motijheel`, and a basic feature phone dialling **`*CHOLO#`** and stepping through a USSD menu.
- **Driver hands-free copilot:** the driver says "Accept" and "I've arrived" with no touch.
- **Live translated chat:** a tourist writes in English and the driver reads it in Bangla, with bubbles translating mid-animation.
- **AI support agent with real authority:**
  - A rider says "I was overcharged."
  - The agent replays the GPS trace, highlights a detour and compares the fare.
  - It **issues the refund itself**: "৳60 refunded to your wallet", with the audit-log line shown.
- **Ask Cholo (admin):**
  - An admin types "Why did cancellations spike in Uttara last Tuesday?"
  - The SQL writes itself, a chart draws, and the answer reads "Rain started 6:10 pm; supply dropped 40%."

**5E. Marketplace intelligence**
- **Batched AI dispatch:** riders and drivers are matched together in a 3-second window. Show lines rewiring to the optimal assignment and the total pickup time dropping.
- **Demand forecasting:** a hex heatmap of the next 15, 30 and 60 minutes, with a forecast-vs-actual chart.
- **Predictive repositioning:** the driver sees "Go to Gulshan 1 · 12 requests expected in 20 min · ~৳600" and a glowing zone.
- **Explainable surge:** "1.4× — because it's raining and 60% fewer drivers are nearby", with a smooth hex-to-hex surge map and a visible cap.
- **ML ETA:** the ETA corrects itself live, with the accuracy (MAPE) chart improving.
- **Cholo Pool (shared rides):** two riders going the same way merge onto one route, the fare splits, and "Saved 38% · 1.2 kg CO₂" appears.
- **Multi-stop optimizer:** pharmacy, bank and home are reordered automatically into the best order, with one fare.
- **Guaranteed upfront fare:** a fare-certainty badge.
- **Peak-hour forecast, fare lock and price-drop alerts** (from the trailer): a demand bar chart with a moving "NOW" marker, "Fare locked · ৳180 · 9:59" counting down, and a notification "Home → Office is 20% cheaper now".

**5F. Bangladesh-first innovation**
- **Flood-aware routing (rain ambience):**
  - Rain falls over the map and roads flood blue as the fleet slows and drivers tap "Water here".
  - The route re-draws around them: "Route avoids 2 waterlogged roads."
- **Metro + Cholo multimodal planner (hero beat, 15 s, MRT-6 red line):**
  - Uttara to Motijheel. Three option cards compare: "Car ৳320 · 55 min", **"Bike + Metro ৳140 · 30 min — fastest"** and "Bus + walk".
  - Animate the chosen journey:
    - a Cholo bike glides to **Uttara North station** (8 min);
    - a **metro train streaks along MRT Line 6**, with station dots lighting up (Pallabi, Mirpur 10, Agargaon, Farmgate, Karwan Bazar, Shahbagh, Dhaka University, Secretariat, Motijheel) and the metro chime playing;
    - a walk icon covers the last 5 min.
  - A total time and cost bar counts up. "Book the Cholo leg" takes one tap.
  - **VO:** "Cholo works with the Metro, not against it. A bike to the station, MRT Line 6 across town, and you arrive 25 minutes sooner for half the price."
- **Fair-fare meter:** a street CNG fare is checked against the "Fair price: ৳120–150" range from real trips, then shared as a card to the driver.
- **Women-safe night mode:** female drivers, automatic trip sharing, and a **safer route** weighted toward well-lit, busy roads, shown glowing.
- **Festival / Eid mode:** an intercity booking (Dhaka to Rajshahi), event-aware ETAs, and supply pre-positioned on the map.
- **Lite mode:** a 2G signal icon, a text-first UI and a static map snapshot. The app is still fast.

**5G. Safety and trust AI**
- **Trip anomaly detection:** the route deviates from its corridor, an "Are you okay?" check-in appears, and with no response it escalates to the SOS board.
- **Crash detection:** an accelerometer spike shows on a graph, a 10-second countdown runs, then support calls automatically.
- **Driver drowsiness detection:** an on-device face mesh shows eye-closure detection, then "Take a 15-minute break". Show an "On-device · never uploaded" privacy badge.
- **Selfie liveness check at shift start:** blink and head-turn prompts, then "Identity verified".
- **Driver behaviour score:** braking and speeding telemetry feed a weekly coaching card with a badge.
- **Fraud defence:**
  - GPS-spoofing detection: a "teleporting" car is flagged.
  - Collusion graph: users, devices and payments linked into a cluster that lights up red.
  - A per-trip risk score with the reasons listed.

**5H. AI for drivers**
- **Earnings forecaster:** "Drive 5–9 pm in Gulshan → ৳1,400–1,800."
- **AI shift planner:** a goal of "৳20,000 this week" produces a suggested schedule.
- **True-profit view:** earnings minus fuel and CNG cost minus maintenance.
- **EV switch calculator.**
- **Document OCR onboarding:** a photo of the NID fills the form automatically.
- **Transparent deactivation:** the reasons and a human appeal button.

**5I. Delight**
- **Cinematic trip recap:** an animated route replay, then distance, time and "CO₂ saved", then a shareable card.
- **Cholo Wrapped:** a yearly summary in a Spotify-Wrapped style (km travelled, favourite places, hours saved).
- **Live-activity lock-screen widget:** the driver's progress shown on the lock screen.
- **Micro-interactions:** the car "honks" on arrival, confetti on the first ride, a pulsing radar while searching.
- **Accessibility:** screen-reader flow, voice-only mode, large text and colour-blind-safe maps.

**5J. Platform scale (fast montage, data-viz style)**
- **Event streams:** a live KPI wall at "10,000 concurrent drivers", with millions of pings per minute flowing through.
- **Speed:** dashboards over millions of rows load in milliseconds.
- **Experiments:** a switchback A/B test grid.
- **Monitoring:** SLO gauges such as "p99 match time < 3 s".
- **Dhaka Mobility Insights portal:** public, anonymised data, e.g. "Average speed on Mirpur Road −18% this monsoon".
- **Super-app expansion** (short beats):
  - **Cholo Send** parcels and food/grocery on the same dispatch;
  - **Airport transfers** and **Cholo for Business** corporate accounts;
  - **Rewards and referrals**, promo codes and 24/7 support;
  - **EV fleet** charge-aware dispatch;
  - **Carbon credits.**

### ACT 6 — Why চলো + outro (9:00–9:45) · chapter "Why চলো"
33. **Comparison table** on a glass card, with "চলো" against "Other apps". Rows reveal one by one; gold checks pop for চলো and grey crosses for others:
    - Made for Bangladesh, fully in Bangla
    - Cash, bKash, Nagad and wallet
    - Women Ride with women drivers
    - Passenger-confirmed pickup
    - One-tap SOS to family and police
    - Metro + ride planning
    - Flood-aware routing
    - Bangla voice booking
    - Lower commission for drivers
34. **"And so much more."** A grid of 12–16 feature tiles pops in a wave.
35. **Final logo:** the চলো wordmark reveals with a shine.
    - **Text:** **"Let's go. চলো!"** → "RIDE SAFE · PAY EASY · EARN MORE"
    - **Badges:** "Available on Android & iOS" and **cholo-cholo7.vercel.app**
    - The music resolves on one final hit and fades to black.

---

## 7. How to produce it (recommended pipeline)

1. **Real screens (Acts 1–4):**
   - Record the live site with **Playwright** at 2× device scale for crisp 60 fps captures. Use a phone viewport (390×844) for passenger and driver, and 1440×900 for admin.
   - Use the demo seed accounts.
   - Script each flow so recordings are clean, with no loading flicker. Pre-load the data, and hide any developer toolbars.
   - Composite the recordings into the device frames, then add zooms, callout chips, touch ripples and count-up overlays.
2. **Next-gen screens (Act 5):**
   - Build them as **high-fidelity UI mockups in the same design system**: same fonts, colours, radii, shadows and components. They must look exactly like the real app.
   - Animate them as code (HTML/CSS/JS rendered frame by frame, Remotion, Lottie or After Effects).
   - Maps use stylised Dhaka geometry with real place names. Cars always glide.
3. **Data visualisations:**
   - Animated charts with axes drawing in, bars growing with stagger, lines drawing, and numbers counting up.
   - Every chart is labelled in plain words; no jargon on screen.
4. **Assembly:** cut to the music's beat, put a light-sweep and whoosh on every act change, and mix VO, music and SFX together.
5. **Localisation:** export separate English-VO and Bangla-VO versions. On-screen text stays English, with Bangla accents used as the brand already does.

---

## 8. Writing rules for VO and on-screen text

- Short, punchy lines: **one idea per line**, at most about 12 words on screen at once.
- Speak to the viewer as "you" ("Your trip starts only when *you* confirm").
- Use concrete numbers and places, never vague claims: "৳140 · 30 min", "−22% pickup time", "Uttara North → Motijheel".
- Every feature is described in the **present tense, as live** ("Cholo routes you around flooded roads"). Never "will", "soon", "planned" or "concept".
- Bangla lines must be natural, spoken Bangla, not word-for-word translation.

---

## 9. Quality checklist (the video is done only when all are true)

- [ ] Every real feature listed in Acts 1–4 appears at least once, using the real UI.
- [ ] Every next-gen feature in Act 5 appears with a motion explanation of **how it works**, not just a static screen.
- [ ] Every next-gen feature is shown as live, with no roadmap or "coming soon" language anywhere.
- [ ] The brand colours, fonts and logo match section 3 exactly.
- [ ] No text overlaps, clips or runs off-screen, at every frame and in every aspect ratio.
- [ ] Every number is in ৳ BDT with consistent values across scenes (the same driver, plate, fares and balances).
- [ ] Map motion is smooth: cars glide and rotate, never teleport.
- [ ] Each key frame holds long enough to read (at least 1.5 s); captions are synced.
- [ ] Audio is about −14 LUFS integrated, with no clipping and the VO always intelligible over the music.
- [ ] The 90 s, 60 s vertical and 15 s cuts each work on their own, with a hook in the first 2 seconds.
- [ ] Thumbnail: the চলো logo, a phone showing the Metro + ride card, and the text "Ride. Safe. Smart."
