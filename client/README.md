# Cholo frontend

React + TypeScript + Vite client for Cholo's passenger, driver, and admin
surfaces. M6 includes the real passenger booking/live-trip experience and the
driver availability/offer/active-trip experience; M7/M8 routes remain visible
as explicit placeholders so milestone scope stays clear.

## Run locally

Start PostgreSQL and the API from the repository root first, then:

```bash
cp .env.example .env
npm install
npm run dev
```

The client expects the REST API at `VITE_API_URL` and derives the Socket.io
origin from it unless `VITE_SOCKET_URL` is set. Browser geolocation permission
is required for current-location pickup and driver tracking. OpenStreetMap
tiles and the backend's Nominatim/OSRM adapters require internet access.

Local OTP SMS is mocked by design. The verification screen points to the
API terminal, where each code appears in a `Mock SMS sent` log entry.

## Checks

```bash
npm run lint
npm run build
```

The production build uses route-level lazy loading, keeping Leaflet and each
M6 screen out of the initial bundle until that route is opened.
