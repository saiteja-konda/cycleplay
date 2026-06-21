# CyclePlay — Development Plan

## Overview

Full-stack PWA cycling tracker adding calendar/stats, dark mode, weather, photos, voice/audio cues, naming/notes/rating, offline resilience, and better maps.

---

## Phase 1 — Foundation & Personalization

Goal: polish the core UX so it feels complete day-to-day.

### 1.1 Dark / Light mode

| Aspect | Detail |
|--------|--------|
| **CSS** | Duplicate all `--bg`/`--surface`/`--card`/`--border`/`--text`/`--text2`/`--text3` vars under `[data-theme="light"]` with light palette. |
| **Default** | Respect `prefers-color-scheme` media query on first load. |
| **Persistence** | Store choice in `localStorage` key `theme`. |
| **Toggle** | Sun/moon icon button in the status bar. |
| **Files** | `frontend/index.html` |

### 1.2 Configurable weekly goal

| Aspect | Detail |
|--------|--------|
| **Storage** | `localStorage` key `weeklyGoalKm`, default `50`. |
| **UI** | Gear icon on the weekly card → inline number input with save. |
| **Ring + bars** | Read from `localStorage` instead of hardcoded `WEEKLY_GOAL_KM`. |
| **Files** | `frontend/index.html`, `frontend/src/app.js` |

### 1.3 Live distance card on home screen

| Aspect | Detail |
|--------|--------|
| **What** | A new card below the weekly ring showing current active ride stats: distance, duration, avg speed. Updates every GPS tick + every 1s timer. |
| **Visibility** | Hidden when idle. Appears during RECORDING / PAUSED. |
| **Implementation** | Expose `window.rideState` (already a module-level `const`). New DOM elements in home view. `uiCallbacks` updates them alongside speedometer chips. |
| **Files** | `frontend/index.html`, `frontend/src/app.js` |

### 1.4 Landscape layout for all views

| Aspect | Detail |
|--------|--------|
| **What** | Ensure calendar, stats, ride-details, and any new views have proper `@media (orientation: landscape)` rules using the 64px left nav rail. |
| **Files** | `frontend/index.html` |

---

## Phase 2 — Calendar & Monthly / Yearly Stats

Goal: give the user a visual history of their riding over time.

### 2.1 Backend stats endpoint

| Aspect | Detail |
|--------|--------|
| **Route** | `GET /api/rides/stats` |
| **Response** | `{ monthly: [{year, month, distance_km, ride_count, moving_hours}], yearly: [{year, distance_km, ride_count, moving_hours}], totals: {distance_km, ride_count, moving_hours} }` |
| **Query** | Aggregate from completed rides using SQLite date functions. |
| **Files** | `backend/routes/rides.js`, `frontend/src/api.js` |

### 2.2 Calendar view

| Aspect | Detail |
|--------|--------|
| **Location** | 4th nav tab, new view with id `calendar`. |
| **Calendar grid** | Month navigation (arrows), day cells showing distance or a dot. Color intensity from `#1c1c26` (no ride) through accent orange (high km). |
| **Day detail** | Clicking a day shows a list of rides for that day below the calendar. |
| **Files** | `frontend/index.html`, `frontend/src/app.js` |

### 2.3 Monthly / yearly charts & summary

| Aspect | Detail |
|--------|--------|
| **Layout** | Below the calendar (or a tab toggle). Monthly bar chart (SVG), one bar per month. Current month highlighted. Year selector. |
| **Year totals** | Total km, ride count, moving time, best month, best single ride. |
| **Files** | `frontend/index.html`, `frontend/src/app.js` |

---

## Phase 3 — Ride Experience

Goal: make every ride memorable with photos, weather, voice cues, naming, and ratings.

### 3.1 Schema migration

| Aspect | Detail |
|--------|--------|
| **Columns added** | `name TEXT`, `notes TEXT`, `rating INTEGER`, `photo_url TEXT`, `weather_condition TEXT`, `weather_temp REAL`, `weather_wind REAL` |
| **Migration** | `ALTER TABLE rides ADD COLUMN` in `backend/db/database.js`. Each statement catches "duplicate column" errors (same pattern as existing `username` migration). |
| **Files** | `backend/db/database.js`, `backend/db/schema.sql` |

### 3.2 Ride naming

| Aspect | Detail |
|--------|--------|
| **UI** | Text input on the summary screen: "Name this ride" with placeholder like "Morning commute". |
| **Storage** | Sent as part of `POST /stop` payload. Also editable via new `PUT /api/rides/:id`. |
| **Display** | Name shown in ride cards (replacing generic "Ride" badge) and ride details header. |
| **Files** | `backend/routes/rides.js`, `frontend/index.html`, `frontend/src/app.js`, `frontend/src/api.js` |

### 3.3 Ride notes

| Aspect | Detail |
|--------|--------|
| **UI** | Textarea on the summary screen: "Add notes…". Multi-line. |
| **Storage** | Same as naming — sent in `POST /stop`, editable via `PUT /api/rides/:id`. |
| **Display** | Shown in ride details, expandable. |
| **Files** | `backend/routes/rides.js`, `frontend/index.html`, `frontend/src/app.js` |

### 3.4 Emoji rating

| Aspect | Detail |
|--------|--------|
| **UI** | 4 emoji buttons on the summary screen: 😀🙂😐😞. User taps one to select. Selected is highlighted. |
| **Storage** | Integer 1–4 sent in `POST /stop`. Editable via `PUT /api/rides/:id`. |
| **Display** | Emoji shown in ride cards and ride details header. |
| **Files** | `backend/routes/rides.js`, `frontend/index.html`, `frontend/src/app.js` |

### 3.5 Ride photos

| Aspect | Detail |
|--------|--------|
| **Capture** | Hidden `<input type="file" accept="image/*" capture="environment">` triggered by a camera button on the summary screen. |
| **Storage** | Read as base64 data URL via `FileReader`. Sent to backend as `photo_url` string in `POST /stop`. |
| **Display** | Thumbnail in ride details, tap to fullscreen modal. |
| **Files** | `frontend/index.html`, `frontend/src/app.js`, `backend/routes/rides.js` |

### 3.6 Share photos

| Aspect | Detail |
|--------|--------|
| **Web Share** | `navigator.share({ title, text, url })` when available (mobile). |
| **Fallback** | Render a `<canvas>` combining the photo + ride stats overlay → download as PNG. |
| **Files** | `frontend/index.html`, `frontend/src/app.js` |

### 3.7 Weather data

| Aspect | Detail |
|--------|--------|
| **API** | [Open-Meteo](https://open-meteo.com/) — free, no API key. Call: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,weather_code,wind_speed_10m` |
| **Timing** | Fetched on ride start + ride stop using the current GPS position. |
| **Storage** | `weather_condition` (WMO weather code → label), `weather_temp` (celsius), `weather_wind` (km/h). |
| **Display** | Weather chip on summary and ride details: ☀️ 22°C / 💨 12 km/h. WMO code maps to icon + label. |
| **Files** | `frontend/src/weather.js` (NEW), `frontend/src/app.js`, `frontend/index.html`, `backend/routes/rides.js` |

### 3.8 Voice announcements

| Aspect | Detail |
|--------|--------|
| **API** | `window.speechSynthesis` (Web Speech API). |
| **Triggers** | Every 5 km distance milestone, ride start/stop, pause/resume. |
| **Examples** | "5 kilometers in 18 minutes", "Ride paused", "Ride resumed". |
| **Queue** | Single-item queue with a `speaking` flag to prevent overlap. |
| **Toggle** | On/off switch in settings (gear menu). Default on. |
| **Files** | `frontend/src/voice.js` (NEW), `frontend/src/state.js` (hook calls) |

### 3.9 Audio cues

| Aspect | Detail |
|--------|--------|
| **API** | `AudioContext` + `OscillatorNode` — no audio files needed. |
| **Tones** | Start ride = ascending tone (440→880 Hz, 300ms). Pause = short low beep (300 Hz, 150ms). Resume = short high beep (660 Hz, 150ms). 5km milestone = double beep (660+880 Hz). Ride end = descending tone (880→220 Hz, 500ms). |
| **Toggle** | Same settings toggle as voice (or separate). |
| **Files** | `frontend/src/audio.js` (NEW), `frontend/src/state.js` (hook calls) |

---

## Phase 4 — Offline & Maps

Goal: make the app reliable without internet and a joy to explore routes on.

### 4.1 Better offline support

| Aspect | Detail |
|--------|--------|
| **API cache** | Cache `GET /api/rides` and `GET /api/rides/:id` responses in IndexedDB with timestamps. Serve cached data when fetch fails. |
| **Offline indicator** | Subtle banner at the top: "You're offline — showing cached data". Shown/hidden via `online`/`offline` events. |
| **Write queue** | Queue failed `POST /track` and `POST /stop` calls in IndexedDB. Retry on `online` event + periodic interval. |
| **Service worker** | Bump cache name to `cycleplay-v14`. Add stale-while-revalidate for static assets. Network-first for API with cache fallback. |
| **Background Sync** | Register `navigator.serviceWorker.ready.sync.register('sync-rides')` when supported. Register a periodic sync for pending GPS points. |
| **Files** | `frontend/src/offline.js` (NEW), `frontend/service-worker.js`, `frontend/src/sync.js` |

### 4.2 Better maps experience

| Aspect | Detail |
|--------|--------|
| **Layer switcher** | 3 tile sources: OpenStreetMap standard, OpenCycleMap (cycling-specific), ESRI Satellite. Selectable via a small button/panel. |
| **Live location** | Pulsing blue dot marker (custom CSS animation) on the live map during recording. Accuracy circle overlay. |
| **Fit route** | "Fit route" button on summary and details maps to auto-zoom to the GPX path. |
| **Speed popup** | Tap any point on the GPX polyline → popup showing speed, time, and cumulative distance at that point. |
| **Zoom controls** | `zoomControl: true` on detail/summary maps (live map already has `zoomControl: false` for clean overlay). |
| **Files** | `frontend/index.html`, `frontend/src/app.js` |

---

## Deferred (future considerations)

- Auto start (GPS-based auto recording detection)
- GPX export / import
- Strava integration
- Bluetooth heart rate monitor
- Segments (geo-fenced route segments with leaderboard)
