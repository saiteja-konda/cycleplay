# CyclePlay 🚴

Full-stack PWA cycling tracker. Record rides with GPS, view speed/distance stats, and track weekly progress — all from your phone's browser.

## Quick start

```sh
cd backend
npm install
node seed.js     # seeds 3 sample rides
node server.js   # starts on http://localhost:5100
```

No frontend build step. Open `http://localhost:5100` in any browser.

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Express 5 + SQLite3 (`sqlite3` npm package) |
| Frontend | Vanilla JS (ES modules, no framework/bundler) |
| Maps | Leaflet.js (CDN) |
| PWA | Web Manifest + Service Worker (cache-first) |
| Sync | IndexedDB-backed queue flushes to server every 15s |

## Project structure

```
backend/
  server.js          Express entrypoint (port 5100)
  routes/rides.js    All API routes
  db/database.js     SQLite3 + schema migration
  db/schema.sql      rides + gps_points tables
  utils/calculations.js  Haversine distance + summary
  seed.js            Sample data
frontend/
  index.html         Full UI (HTML + CSS inline)
  src/app.js         View switching, UI callbacks, map, clock
  src/state.js       Ride FSM, auto-pause, Web Locks, Wake Lock
  src/gps.js         Geolocation watchPosition wrapper
  src/sync.js        IndexedDB sync queue
  src/api.js         API fetch wrappers
  service-worker.js  PWA service worker
```

## API endpoints

All under `/api/rides`:
- `POST /start` — begin a ride
- `POST /track` — submit GPS points
- `POST /stop` — finish ride and compute summary
- `GET /active` — resume an active ride
- `GET /` — list completed rides
- `GET /:id` — ride detail with GPS points
- `DELETE /:id` — delete a ride

## Behavior

- **Auto-pause**: GPS speed < 1 km/h for 10s → auto-pauses. Resumes when speed ≥ 1 km/h.
- **Tab lock**: Web Locks API + backend `status='active'` check prevents concurrent recording.
- **Wake lock**: Keeps screen on during recording.
- **Weekly goal**: 50 km target, visualized as a ring + bar chart on the home screen.
- **Offline**: GPS points buffered in IndexedDB, flushed to server every 15s.

## Deployment

A systemd unit is included at `backend/cycleplay.service` for running as a service.
