-- One row per ride
CREATE TABLE IF NOT EXISTS rides (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at      DATETIME NOT NULL,
  stopped_at      DATETIME,
  total_seconds   INTEGER,         -- wall clock time
  moving_seconds  INTEGER,         -- time actually moving
  distance_km     REAL,
  avg_speed_kmh   REAL,
  max_speed_kmh   REAL,
  pause_count     INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'active',  -- active | complete | abandoned
  username        TEXT DEFAULT 'Guest',
  name            TEXT,
  notes           TEXT,
  rating          INTEGER,
  photo_url       TEXT,
  weather_condition TEXT,
  weather_temp    REAL,
  weather_wind    REAL
);

-- One row per GPS point (every 5 seconds)
CREATE TABLE IF NOT EXISTS gps_points (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ride_id    INTEGER NOT NULL REFERENCES rides(id),
  lat        REAL NOT NULL,
  lng        REAL NOT NULL,
  speed_kmh  REAL NOT NULL,
  recorded_at DATETIME NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gps_ride ON gps_points(ride_id);
CREATE INDEX IF NOT EXISTS idx_rides_started ON rides(started_at DESC);
