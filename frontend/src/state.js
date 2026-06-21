import { GPSManager } from './gps.js';
import { SyncService } from './sync.js';
import { startRide, stopRide, getActiveRide } from './api.js';
import { VoiceService } from './voice.js';
import { AudioCue } from './audio.js';
import { fetchWeather } from './weather.js';

export const STATES = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
  SUMMARY: 'SUMMARY'
};

// Haversine distance between two GPS points (in km)
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class RideState {
  constructor(uiCallbacks) {
    this.state = STATES.IDLE;
    this.rideId = null;
    this.sync = new SyncService();
    this.gps = new GPSManager(this.onPoint.bind(this));

    this.ui = uiCallbacks;

    this.stats = {
      distance: 0,       // km, running total
      movingSeconds: 0,
      pauseCount: 0,
      currentSpeed: 0,
      maxSpeed: 0,
      lastLat: null,
      lastLng: null
    };

    this.timerInterval = null;
    this.pauseTimeout = null;
    this.wakeLock = null;
    this.speedHistory = []; // for speed chart on summary
    this.pointsHistory = []; // for map polyline on summary
    this._releaseTabLock = null;
    this._lastMilestoneKm = 0;
    this.voice = new VoiceService();
    this.audio = new AudioCue();
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock not available:', err.message);
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  _resetStats() {
    this.stats = {
      distance: 0,
      movingSeconds: 0,
      pauseCount: 0,
      currentSpeed: 0,
      maxSpeed: 0,
      lastLat: null,
      lastLng: null
    };
    this.speedHistory = [];
    this.pointsHistory = [];
    this._lastMilestoneKm = 0;
  }

  async start() {
    this._resetStats();
    try {
      if ('locks' in navigator) {
        const lockAcquired = await new Promise(resolve => {
          navigator.locks.request('cycleplay_recording', { ifAvailable: true }, async (lock) => {
            if (!lock) {
              resolve(false);
              return;
            }
            resolve(true);
            // Hold the lock until stop() is called
            return new Promise(releaseLock => {
              this._releaseTabLock = releaseLock;
            });
          }).catch(() => resolve(true));
        });

        if (!lockAcquired) {
          window.showAlert('Already Recording', 'You are already recording a ride in another tab!', '🔒');
          return;
        }
      }

      let weatherData = {};
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          const weather = await fetchWeather(pos.coords.latitude, pos.coords.longitude);
          weatherData = {
            weather_condition: weather.condition,
            weather_temp: weather.temp,
            weather_wind: weather.wind
          };
        } catch (e) {}
      }

      const { ride_id } = await startRide(weatherData);
      this.rideId = ride_id;
      this.sync.setRideId(ride_id);

      this.state = STATES.RECORDING;
      this.sync.startSync();
      this.gps.start();

      await this.requestWakeLock();

      this.timerInterval = setInterval(() => {
        if (this.state === STATES.RECORDING) {
          this.stats.movingSeconds++;
          this.ui.updateTimer(this.stats.movingSeconds);
        }
      }, 1000);

      this.ui.onStateChange(this.state);
      this.voice.speak('Ride started');
      this.audio.playSweep(440, 880, 0.3);
    } catch (err) {
      if (this._releaseTabLock) {
        this._releaseTabLock();
        this._releaseTabLock = null;
      }
      if (err.message === 'ALREADY_ACTIVE') {
        const activeData = await getActiveRide();
        if (activeData && activeData.active) {
          this.hydrate(activeData);
          return;
        }
      }
      console.error('Failed to start ride:', err);
      window.showAlert('Connection Error', err.message || 'Please check your internet connection and try again.', '📡');
    }
  }

  async hydrate(activeData) {
    const { ride, points, summary } = activeData;
    this._resetStats();
    this.rideId = ride.id;
    this.sync.setRideId(ride.id);

    this.stats.distance = summary.distance_km || 0;
    this.stats.movingSeconds = summary.moving_seconds || 0;
    this.stats.maxSpeed = summary.max_speed_kmh || 0;
    this.stats.pauseCount = ride.pause_count || 0;
    
    if (points && points.length > 0) {
      this.speedHistory = points.map(p => p.speed_kmh);
      this.pointsHistory = points;
      const lastPt = points[points.length - 1];
      this.stats.lastLat = lastPt.lat;
      this.stats.lastLng = lastPt.lng;
      this.stats.currentSpeed = lastPt.speed_kmh;
      this.ui.updateSpeed(lastPt.speed_kmh, this.stats);
    }
    
    this.ui.updateTimer(this.stats.movingSeconds);

    this.state = STATES.RECORDING;
    this.sync.startSync();
    this.gps.start();
    await this.requestWakeLock();

    this.timerInterval = setInterval(() => {
      if (this.state === STATES.RECORDING) {
        this.stats.movingSeconds++;
        this.ui.updateTimer(this.stats.movingSeconds);
      }
    }, 1000);

    this.ui.onStateChange(this.state);
  }

  onPoint(point) {
    this.sync.addPoint(point);

    // ── Distance accumulation (Haversine) ──
    if (this.state === STATES.RECORDING &&
        this.stats.lastLat !== null && this.stats.lastLng !== null) {
      const d = haversineKm(
        this.stats.lastLat, this.stats.lastLng,
        point.lat, point.lng
      );
      // Sanity-check: ignore impossible GPS jumps (>0.5 km in one tick)
      if (d < 0.5) {
        this.stats.distance += d;
      }
    }
    this.stats.lastLat = point.lat;
    this.stats.lastLng = point.lng;

    // ── Max speed ──
    if (point.speed_kmh > this.stats.maxSpeed) {
      this.stats.maxSpeed = point.speed_kmh;
    }

    // ── Speed history for chart ──
    this.speedHistory.push(point.speed_kmh);
    this.pointsHistory.push(point);

    this.stats.currentSpeed = point.speed_kmh;
    this.ui.updateSpeed(point.speed_kmh, this.stats);
    if (this.ui.onPoint) this.ui.onPoint(point);

    // ── Auto-pause detection ──
    if (this.state === STATES.RECORDING && point.speed_kmh < 1) {
      if (!this.pauseTimeout) {
        this.pauseTimeout = setTimeout(() => this.autoPause(), 10000);
      }
    } else if (point.speed_kmh >= 1) {
      if (this.pauseTimeout) {
        clearTimeout(this.pauseTimeout);
        this.pauseTimeout = null;
      }
      if (this.state === STATES.PAUSED) {
        this.autoResume();
      }
    }

    if (this.state === STATES.RECORDING) {
      const milestoneKm = Math.floor(this.stats.distance / 5);
      if (milestoneKm > this._lastMilestoneKm) {
        const mins = Math.floor(this.stats.movingSeconds / 60);
        this.voice.speak(`${Math.floor(this.stats.distance)} kilometers in ${mins} minutes`);
        this.audio.playTone(660, 0.15);
        setTimeout(() => this.audio.playTone(880, 0.15), 100);
        this._lastMilestoneKm = milestoneKm;
      }
    }
  }

  autoPause() {
    this.state = STATES.PAUSED;
    this.stats.pauseCount++;
    this.pauseTimeout = null;
    this.ui.onStateChange(this.state, { auto: true });
    this.voice.speak('Ride paused');
    this.audio.playTone(300, 0.15);
  }

  autoResume() {
    this.state = STATES.RECORDING;
    this.ui.onStateChange(this.state);
    this.voice.speak('Ride resumed');
    this.audio.playTone(660, 0.15);
  }

  manualPause() {
    if (this.pauseTimeout) { clearTimeout(this.pauseTimeout); this.pauseTimeout = null; }
    this.state = STATES.PAUSED;
    this.ui.onStateChange(this.state, { auto: false });
    this.voice.speak('Ride paused');
    this.audio.playTone(300, 0.15);
  }

  manualResume() {
    this.state = STATES.RECORDING;
    this.ui.onStateChange(this.state);
    this.voice.speak('Ride resumed');
    this.audio.playTone(660, 0.15);
  }

  async stop() {
    this.state = STATES.SUMMARY;
    this.gps.stop();
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    if (this.pauseTimeout) { clearTimeout(this.pauseTimeout); this.pauseTimeout = null; }
    this.releaseWakeLock();

    if (this._releaseTabLock) {
      this._releaseTabLock();
      this._releaseTabLock = null;
    }

    // ── Wait for the final sync flush before calling stop ──
    try {
      await this.sync.flush();
    } catch (err) {
      console.warn('Final sync flush warning:', err);
    }

    // Stop the recurring sync to prevent stale requests
    this.sync.stopSync();

    let weatherStopData = {};
    if (this.stats.lastLat !== null && this.stats.lastLng !== null) {
      try {
        const weather = await fetchWeather(this.stats.lastLat, this.stats.lastLng);
        weatherStopData = {
          weather_condition: weather.condition,
          weather_temp: weather.temp,
          weather_wind: weather.wind
        };
      } catch (e) {}
    }

    try {
      const summary = await stopRide(
        this.rideId,
        this.stats.movingSeconds,
        this.stats.pauseCount,
        {
          name: window._rideName || '',
          notes: window._rideNotes || '',
          rating: window._selectedRating || null,
          photo_url: window._capturedPhoto || null,
          ...weatherStopData
        }
      );
      // Attach local speed history for the chart
      summary._speedHistory = this.speedHistory;
      summary._points = this.pointsHistory;
      this.ui.onSummary(summary);
      const mins = Math.floor(this.stats.movingSeconds / 60);
      this.voice.speak(`Ride complete. ${this.stats.distance.toFixed(1)} kilometers in ${mins} minutes`);
      this.audio.playSweep(880, 220, 0.5);
    } catch (err) {
      console.error('Failed to stop ride:', err);
      window.showAlert('Save Failed', err.message || 'Please check your internet connection to save this ride.', '❌');
    }
  }
}
