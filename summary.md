# CyclePlay — Implementation Summary

## Test Infrastructure

| Layer | Framework | Files |
|---|---|---|
| Backend | mocha + chai + supertest | `backend/test/calculations.test.js`, `database.test.js`, `rides.test.js` |
| Frontend | Jest 29 + jsdom | 7 test files in `frontend/src/*.test.js` |

**Totals:** 16 backend tests + 96 frontend tests = **112 tests** all passing.

---

## Phase 1 — Foundation & Personalization

### 1.1 Dark/Light Mode
- **CSS**: `[data-theme="light"]` block overriding 11 CSS custom properties (bg, surface, card, border, text, etc.)
- **Toggle**: Sun/moon icon button (`#themeToggle`) in status bar
- **Default**: Respects `prefers-color-scheme` on first load
- **Persistence**: Stored in `localStorage` key `theme`
- **Files**: `frontend/index.html`, `frontend/src/app.js`

### 1.2 Configurable Weekly Goal
- **Storage**: `localStorage` key `weeklyGoalKm`, default `50`
- **UI**: Gear icon (`#weeklyGoalGear`) on weekly card → inline number input (`#weeklyGoalInput`) + Save button (`#weeklyGoalSave`)
- **Usage**: `renderWeekly()` reads goal from localStorage instead of hardcoded constant
- **Files**: `frontend/index.html`, `frontend/src/app.js`

### 1.3 Live Distance Card on Home
- **Card**: `#liveCard` with distance (`#liveDist`), time (`#liveTime`), avg speed (`#liveAvg`)
- **Visibility**: Hidden when IDLE, shown during RECORDING/PAUSED via `onStateChange`
- **Updates**: Driven by existing `updateSpeed` and `updateTimer` callbacks
- **Files**: `frontend/index.html`, `frontend/src/app.js`

### 1.4 Landscape Layout for All Views
- Added landscape grid rules for `#ride-details` (2-column: stats left, map right)
- Existing views (home, ride, summary, history) already had landscape layouts
- **Files**: `frontend/index.html`

---

## Phase 2 — Calendar & Monthly/Yearly Stats

### 2.1 Backend Stats Endpoint
- **Route**: `GET /api/rides/stats`
- **Response**: `{ monthly: [{year, month, distance_km, ride_count, moving_hours}], yearly: [...], totals: {...} }`
- **Frontend**: `getRideStats()` in `frontend/src/api.js`
- **Files**: `backend/routes/rides.js`, `frontend/src/api.js`

### 2.2 Calendar View
- **Nav**: 4th tab "Calendar" with calendar icon
- **Grid**: Month navigation (‹ ›), Mon–Sun headers, day cells with color intensity (l1–l5 based on distance)
- **Day detail**: Click a day → shows ride list for that day below the calendar
- **Files**: `frontend/index.html`, `frontend/src/app.js`

### 2.3 Monthly Bar Chart & Year Totals
- **Chart**: SVG bar chart showing 12 months, current month highlighted, distance labels
- **Totals**: Total km, Ride count, Moving time, Best month (calculated from monthly data)
- **Auto-load**: Calendar view loads current month/year on navigation
- **Files**: `frontend/index.html`, `frontend/src/app.js`

---

## Phase 3 — Ride Experience

### 3.1 Schema Migration
- **Columns added to `rides`**: `name TEXT`, `notes TEXT`, `rating INTEGER`, `photo_url TEXT`, `weather_condition TEXT`, `weather_temp REAL`, `weather_wind REAL`
- **Pattern**: Idempotent `ALTER TABLE` with "duplicate column" error catch (same as existing username migration)
- **Files**: `backend/db/database.js`, `backend/db/schema.sql`

### 3.2 Ride Naming
- **UI**: Text input (`#sumName`) on summary screen with "Name this ride" placeholder
- **Storage**: Sent in `POST /stop` as `name`, persisted to DB
- **Display**: Name shown in ride details header
- **Files**: `backend/routes/rides.js`, `frontend/index.html`, `frontend/src/app.js`

### 3.3 Ride Notes
- **UI**: Textarea (`#sumNotes`) on summary screen with "Add notes…" placeholder
- **Storage**: Sent in `POST /stop`, editable via `PUT /api/rides/:id`
- **Display**: Shown in ride details, pre-wrapped
- **Files**: Same as naming

### 3.4 Emoji Rating
- **UI**: 4 emoji buttons (😀🙂😐😞) on summary screen, tap to select (highlighted with accent border)
- **Storage**: Integer 1–4 sent in `POST /stop`, editable via `PUT`
- **Display**: Emoji shown in ride details
- **Files**: Same as naming

### 3.5 Ride Photos
- **Capture**: Hidden `<input type="file" accept="image/*" capture="environment">` triggered by camera button
- **Storage**: Base64 data URL via `FileReader`, stored as `photo_url`
- **Display**: Thumbnail in ride details, tap to open fullscreen
- **Files**: `frontend/index.html`, `frontend/src/app.js`, `backend/routes/rides.js`

### 3.6 Share Photos
- **Web Share**: `navigator.share()` when available (mobile)
- **Fallback**: Clipboard copy of ride stats text
- **Files**: `frontend/index.html`, `frontend/src/app.js`

### 3.7 Weather Data
- **API**: [Open-Meteo](https://open-meteo.com) — free, no API key
- **Timing**: Fetched on ride start + ride stop using current GPS position
- **Storage**: `weather_condition` (WMO code → label), `weather_temp` (°C), `weather_wind` (km/h)
- **Display**: Weather chip on summary and ride details with emoji + temp + wind
- **Files**: `frontend/src/weather.js` (NEW), `frontend/src/app.js`, `frontend/index.html`, `backend/routes/rides.js`

### 3.8 Voice Announcements
- **API**: `window.speechSynthesis` (Web Speech API)
- **Triggers**: Ride start/stop, pause/resume, every 5 km milestone
- **Messages**: "Ride started", "Ride paused", "Ride resumed", "X km in Y min", "Ride complete. X km in Y min"
- **Queue**: Single-item queue with `speaking` flag to prevent overlap
- **Toggle**: `localStorage` key `voiceEnabled` (default on)
- **Files**: `frontend/src/voice.js` (NEW), `frontend/src/state.js`

### 3.9 Audio Cues
- **API**: `AudioContext` + `OscillatorNode` — no audio files
- **Tones**: Start = ascending sweep (440→880Hz), Pause = low beep (300Hz), Resume = high beep (660Hz), Milestone = double beep (660+880Hz), End = descending sweep (880→220Hz)
- **Toggle**: `localStorage` key `audioCuesEnabled` (default on)
- **Files**: `frontend/src/audio.js` (NEW), `frontend/src/state.js`

### 3.10 Edit Metadata via PUT
- **Route**: `PUT /api/rides/:id`
- **Fields**: name, notes, rating (validates at least one, dynamic UPDATE)
- **UI**: Edit button on ride details → inline form with Save
- **Files**: `backend/routes/rides.js`, `frontend/src/api.js`, `frontend/src/app.js`

---

## Phase 4 — Offline Resilience & Better Maps

### 4.1 Offline Service
- **Cache**: `OfflineService` class with IndexedDB-backed API cache (`CyclePlayDB` v3, `apiCache` store, 5-minute TTL)
- **Online status**: Event listener system for online/offline transitions
- **Offline banner**: `#offlineBanner` showing "📡 You're offline — showing cached data" when offline
- **Files**: `frontend/src/offline.js` (NEW), `frontend/index.html`, `frontend/src/app.js`

### 4.2 Write Queue with Retry
- **Auto-retry**: `window.addEventListener('online', ...)` triggers `retryPending()`
- **Stop request queue**: Failed `POST /stop` calls stored in IndexedDB as `type: 'stop'` entries, retried with GPS points
- **Files**: `frontend/src/sync.js`

### 4.3 Cache-then-fetch API Wrappers
- **Pattern**: GET functions (`getRides`, `getRide`, `getRideStats`) cache on success, fall back to cache on network error
- **Files**: `frontend/src/api.js`

### 4.4 Service Worker v14
- **Cache name**: Bumped to `cycleplay-v14`
- **Assets**: Added voice.js, audio.js, weather.js, offline.js
- **Strategy**: Stale-while-revalidate for static assets, network-first with cache fallback for `/api/` requests
- **Background Sync**: Registers `sync-rides` tag, forwards to client via `postMessage`
- **Files**: `frontend/service-worker.js`

### 4.5 Background Sync
- **Registration**: SW message handler registers `sync-rides` background sync
- **Sync handler**: On sync event, posts message to all clients → triggers `rideState.sync.retryPending()`
- **Files**: `frontend/service-worker.js`, `frontend/src/app.js`

### 4.6 Map Layer Switcher
- **Sources**: OpenStreetMap standard, OpenCycleMap (Thunderforest), ESRI Satellite
- **Persistence**: Layer choice stored in `localStorage` key `mapLayer`
- **UI**: 3 buttons (Map/Cycle/Sat) positioned at top-left of live map
- **Files**: `frontend/index.html`, `frontend/src/app.js`

### 4.7 Live Location Marker
- **Dot**: Pulsing blue dot (`#0a84ff`) with CSS animation, created via `L.divIcon`
- **Accuracy**: Accuracy circle overlay (`L.circle`) with opacity
- **Updates**: Driven by `uiCallbacks.onPoint` callback, updated every GPS tick
- **GPS**: Accuracy field (`position.coords.accuracy`) captured in `frontend/src/gps.js`
- **Files**: `frontend/index.html`, `frontend/src/app.js`, `frontend/src/gps.js`

### 4.8 Fit Route Buttons
- **Summary map**: `#fitRouteBtn` — calls `summaryMap.fitBounds()`
- **Details map**: `#detFitRouteBtn` — calls `detailsMap.fitBounds()`
- **Display**: Hidden until map has polyline, shown after bounds fit
- **Files**: `frontend/index.html`, `frontend/src/app.js`

### 4.9 Speed Popup
- **Trigger**: Click on GPX polyline on summary or details map
- **Content**: ⚡ speed (km/h) 🕐 time — finds closest point to click location
- **Files**: `frontend/src/app.js`

### 4.10 Zoom Controls
- **Summary/Details maps**: Changed to `zoomControl: true` (was false)
- **Live map**: Kept `zoomControl: false` for clean overlay appearance
- **Files**: `frontend/src/app.js`

---

## New Modules Created

| Module | File | Exports |
|---|---|---|
| Weather | `frontend/src/weather.js` | `fetchWeather()`, `getWeatherEmoji()` |
| Voice | `frontend/src/voice.js` | `VoiceService` class |
| Audio | `frontend/src/audio.js` | `AudioCue` class |
| Offline | `frontend/src/offline.js` | `OfflineService` class |

## Deployment

`https://cycleplay.myhobbies.fun` — behind Cloudflare (HTTPS edge) + Cloudflare Tunnel → Caddy reverse proxy → Express on port 5100. Managed as a systemd service with auto-restart.
