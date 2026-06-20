# CyclePlay

Full-stack PWA cycling tracker: Express 5 + SQLite3 backend, vanilla JS SPA frontend with Leaflet maps.

## Quick start

```sh
cd backend && npm install && node seed.js && node server.js
```

Then open `http://localhost:5100`. No frontend build step — Express serves `frontend/` as static files.

## Structure

| Path | Role |
|---|---|
| `backend/server.js` | Express entrypoint (port 5100, `PORT` env override) |
| `backend/routes/rides.js` | All API routes (start, stop, track, list, detail, delete, active) |
| `backend/db/database.js` | SQLite3 init + schema migration, promise wrappers (`dbRun`/`dbAll`/`dbGet`) |
| `backend/db/schema.sql` | Schema: `rides` + `gps_points` tables |
| `backend/utils/calculations.js` | Server-side Haversine + summary |
| `backend/seed.js` | Seeds 3 sample rides (runs standalone) |
| `frontend/index.html` | Entire UI inline — HTML, CSS, all views, nav |
| `frontend/src/app.js` | View switching, UI callbacks, map init, clock |
| `frontend/src/state.js` | FSM: `IDLE → RECORDING ↔ PAUSED → SUMMARY`, auto-pause logic, Web Locks, Wake Lock |
| `frontend/src/gps.js` | `watchPosition` wrapper (high accuracy, every ~5s) |
| `frontend/src/sync.js` | IndexedDB-backed sync queue, flushes to server every 15s |
| `frontend/src/api.js` | Fetch wrappers for all API endpoints |
| `frontend/service-worker.js` | PWA cache-first (excludes `/api/`), cache name `cycleplay-v13` |
| `backend/cycleplay.service` | systemd unit |

## Key behavior

- **Auto-pause**: If GPS speed < 1 km/h for 10 consecutive seconds, transitions to `PAUSED`. Resumes automatically when speed >= 1.
- **Tab lock**: `navigator.locks.request('cycleplay_recording')` prevents recording in two tabs. Backend also has a `status='active'` check as a fallback.
- **Wake lock**: `navigator.wakeLock.request('screen')` during recording.
- **GPX distance**: Haversine is calculated on both client (live display) and server (final summary). Client discards GPS jumps > 0.5 km in a single tick.
- **Weekly goal**: Hardcoded 50 km target in `app.js:renderWeekly`.

## Notes

- Express 5 — double-check middleware/route signatures if porting patterns from Express 4.
- `sqlite3` npm package is the callback-based C binding, not `better-sqlite3`. The repo wraps it with promises.
- No linter, formatter, typechecker, or test suite defined. `npm test` is a no-op.
- Service worker cache names are versioned (`cycleplay-v13`). Bump when assets change to force update.
