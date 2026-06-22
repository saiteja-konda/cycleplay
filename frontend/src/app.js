import { RideState, STATES } from './state.js';
import { getRides, getActiveRide, getRideStats, deleteRide, updateRide } from './api.js';
import { getWeatherEmoji } from './weather.js';
import { shareRide } from './share.js';

// ── Live Map State ──
let mapMode = false;
let liveMap = null;
let livePolyline = null;
let liveMarker = null;
let liveAccuracy = null;

const TILE_SOURCES = {
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  cycle: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
};

const TILE_ATTR = {
  osm: '© OpenStreetMap',
  cycle: '© CyclOSM',
  satellite: '© ESRI'
};

let currentTileLayer = null;
let summaryPopupPoints = null;
let detailsPopupPoints = null;
let _currentSummary = null;

function setTileLayer(map, source) {
  if (currentTileLayer) map.removeLayer(currentTileLayer);
  currentTileLayer = L.tileLayer(TILE_SOURCES[source], {
    attribution: TILE_ATTR[source],
    maxZoom: 19
  }).addTo(map);
  localStorage.setItem('mapLayer', source);
}

let summaryMap = null;
let summaryPolyline = null;

// ── Helpers ──
function fmtSeconds(s) {
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

function fmtDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
         ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Calendar State ──
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1;

// ── Theme ──
const SUN_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

const MOON_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
  }
}

export function initTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) {
    applyTheme(stored);
  } else {
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(prefersLight ? 'light' : 'dark');
  }
}

// ── Clock & Greeting ──
function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const now = new Date();
  let h = now.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; // convert 0 → 12
  const m = String(now.getMinutes()).padStart(2, '0');
  el.textContent = `${h}:${m} ${ampm}`;
}
function updateGreeting() {
  const el = document.getElementById('home-greeting');
  if (!el) return;
  const h = new Date().getHours();
  if (h >= 5 && h < 12)       el.textContent = 'Good morning';
  else if (h >= 12 && h < 17) el.textContent = 'Good afternoon';
  else                         el.textContent = 'Good evening';
}
updateClock();
updateGreeting();
setInterval(updateClock, 10000);
setInterval(updateGreeting, 60000);

// ── Custom Alert Modal ──
window.showAlert = function(title, message, icon='<i data-lucide="alert-triangle"></i>') {
  const t = document.getElementById('alertTitle');
  const m = document.getElementById('alertMessage');
  const i = document.getElementById('alertIcon');
  if (t) t.textContent = title;
  if (m) m.textContent = message;
  if (i) i.innerHTML = icon;
  const mod = document.getElementById('alertModal');
  if (mod) mod.classList.add('show');
  if (window.lucide) lucide.createIcons();
};

window.closeAlert = function() {
  const mod = document.getElementById('alertModal');
  if (mod) mod.classList.remove('show');
};

let currentConfirmCallback = null;

window.showConfirm = function(title, message, onConfirm) {
  const t = document.getElementById('confirmTitle');
  const m = document.getElementById('confirmMessage');
  if (t) t.textContent = title;
  if (m) m.textContent = message;
  
  currentConfirmCallback = onConfirm;
  const mod = document.getElementById('confirmModal');
  if (mod) mod.classList.add('show');
  if (window.lucide) lucide.createIcons();
};

window.closeConfirm = function() {
  const mod = document.getElementById('confirmModal');
  if (mod) mod.classList.remove('show');
  currentConfirmCallback = null;
};

document.getElementById('confirmActionBtn')?.addEventListener('click', () => {
  if (currentConfirmCallback) currentConfirmCallback();
  window.closeConfirm();
});

// ── Map Toggling ──
window.toggleMap = function() {
  mapMode = !mapMode;
  const speedoWrap = document.getElementById('speedoWrap');
  const liveMapWrap = document.getElementById('liveMapWrap');
  const btnText = document.getElementById('mapToggleText');
  const btnIcon = document.getElementById('mapToggleIcon');

  if (mapMode) {
    speedoWrap.style.opacity = '0';
    speedoWrap.style.pointerEvents = 'none';
    liveMapWrap.style.opacity = '1';
    liveMapWrap.style.pointerEvents = 'auto';
    if(btnText) btnText.textContent = 'Speed';
    if(btnIcon) { btnIcon.innerHTML = '<i data-lucide="timer"></i>'; if (window.lucide) lucide.createIcons(); }
    
    if (!liveMap && window.L) {
      liveMap = L.map('liveMap', { zoomControl: false }).setView([0, 0], 16);
      const savedLayer = localStorage.getItem('mapLayer') || 'osm';
      setTileLayer(liveMap, savedLayer);
      livePolyline = L.polyline([], {color: 'var(--accent)', weight: 5}).addTo(liveMap);

      document.querySelectorAll('.layer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.layer-btn').forEach(b => {
            b.style.background = 'transparent';
            b.style.color = 'var(--text2)';
          });
          btn.style.background = 'var(--accent)';
          btn.style.color = 'white';
          setTileLayer(liveMap, btn.dataset.layer);
        });
      });
    }
    setTimeout(() => { if(liveMap) liveMap.invalidateSize(); }, 300);
  } else {
    speedoWrap.style.opacity = '1';
    speedoWrap.style.pointerEvents = 'auto';
    liveMapWrap.style.opacity = '0';
    liveMapWrap.style.pointerEvents = 'none';
    if(btnText) btnText.textContent = 'Map';
    if(btnIcon) { btnIcon.innerHTML = '<i data-lucide="map"></i>'; if (window.lucide) lucide.createIcons(); }
  }
};

// ── View switching ──
window.showView = function (id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const viewEl = document.getElementById(id);
  if (viewEl) viewEl.classList.add('active');
  const navEl = document.getElementById('nav-' + id);
  if (navEl) navEl.classList.add('active');

  // Reload history when navigating there
  if (id === 'history' || id === 'home') {
    renderRides();
  }

  if (id === 'calendar') {
    const now = new Date();
    renderCalendar(now.getFullYear(), now.getMonth() + 1);
    renderBarChart(now.getFullYear());
    renderYearTotals(now.getFullYear());
  }
};

window.goToRide = function () {
  window.showView('ride');
};

let detailsMap = null;
let detailsPolyline = null;

window.showRideDetails = async function (id) {
  window.showView('ride-details');
  document.getElementById('det-distance').innerHTML = 'Loading...';
  
  try {
    const { getRide } = await import('./api.js');
    const { ride, points } = await getRide(id);
    
    document.getElementById('det-distance').innerHTML = `${(ride.distance_km || 0).toFixed(2)} <span>km</span>`;
    document.getElementById('det-date').textContent = new Date(ride.started_at).toLocaleString();
    
    document.getElementById('det-total-time').textContent = fmtSeconds(Math.floor((new Date(ride.stopped_at) - new Date(ride.started_at))/1000));
    document.getElementById('det-moving-time').textContent = fmtSeconds(ride.moving_seconds || 0);
    document.getElementById('det-avg-speed').innerHTML = `${(ride.avg_speed_kmh || 0).toFixed(1)}<span> km/h</span>`;
    document.getElementById('det-max-speed').innerHTML = `${(ride.max_speed_kmh || 0).toFixed(1)}<span> km/h</span>`;
    
    if (points && points.length > 0 && window.L) {
      if (!detailsMap) {
        detailsMap = L.map('detailsMap', { zoomControl: true, dragging: true, touchZoom: true, scrollWheelZoom: true, doubleClickZoom: true });
        setTileLayer(detailsMap, localStorage.getItem('mapLayer') || 'osm');
        detailsPolyline = L.polyline([], {color: 'var(--accent)', weight: 5}).addTo(detailsMap);

        detailsPolyline.on('click', (e) => {
          const latlng = e.latlng;
          const pts = detailsPopupPoints || [];
          let closest = pts[0];
          let minDist = Infinity;
          pts.forEach(p => {
            const d = (p.lat - latlng.lat) ** 2 + (p.lng - latlng.lng) ** 2;
            if (d < minDist) { minDist = d; closest = p; }
          });
          if (closest) {
            const time = new Date(closest.timestamp || closest.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            L.popup()
              .setLatLng([closest.lat, closest.lng])
              .setContent(`⚡ ${closest.speed_kmh.toFixed(1)} km/h &nbsp;·&nbsp; 🕐 ${time}`)
              .openOn(detailsMap);
          }
        });

        const detFitBtn = document.getElementById('detFitRouteBtn');
        if (detFitBtn) {
          detFitBtn.onclick = () => {
            if (detailsPolyline && detailsPolyline.getBounds().isValid()) {
              detailsMap.fitBounds(detailsPolyline.getBounds(), { padding: [20, 20] });
            }
          };
        }
      }
      detailsPopupPoints = points || [];
      const latlngs = points.map(p => [p.lat, p.lng]);
      detailsPolyline.setLatLngs(latlngs);

      const detFitBtn = document.getElementById('detFitRouteBtn');
      if (detFitBtn) detFitBtn.style.display = 'block';

      setTimeout(() => {
        detailsMap.invalidateSize();
        detailsMap.fitBounds(detailsPolyline.getBounds(), { padding: [20, 20] });
      }, 300);
    }

    // Attach delete handler
    const delBtn = document.getElementById('deleteRideBtn');
    if (delBtn) {
      delBtn.onclick = () => {
        window.showConfirm('Delete Ride?', 'Are you sure you want to permanently delete this ride?', async () => {
          try {
            await deleteRide(id);
            window.showView('history');
          } catch (err) {
            window.showAlert('Error', 'Failed to delete ride. Check your connection.', '<i data-lucide="x"></i>');
          }
        });
      };
    }

    // ── Share button ──
    const detShareBtn = document.getElementById('detShareBtn');
    if (detShareBtn) {
      detShareBtn.onclick = () => {
        shareRide({
          points: points || [],
          distance: ride.distance_km || 0,
          movingTime: ride.moving_seconds || 0,
          avgSpeed: ride.avg_speed_kmh || 0,
          date: ride.started_at,
          rideName: ride.name || '',
          rideId: ride.id,
        });
      };
    }

    // ── Name ──
    const detName = document.getElementById('detName');
    if (detName) detName.textContent = ride.name || '';

    // ── Notes ──
    const detNotes = document.getElementById('detNotes');
    if (detNotes) detNotes.textContent = ride.notes || '';

    // ── Rating ──
    const detRating = document.getElementById('detRating');
    const ratings = ['', '😀', '🙂', '😐', '😞'];
    if (detRating) detRating.textContent = ride.rating ? ratings[ride.rating] || '' : '';

    // ── Photo ──
    const photoWrap = document.getElementById('detPhotoWrap');
    const photoImg = document.getElementById('detPhotoImg');
    if (photoWrap && photoImg) {
      if (ride.photo_url) {
        photoWrap.style.display = 'block';
        photoImg.src = ride.photo_url;
        photoImg.onclick = () => window.open(ride.photo_url, '_blank');
      } else {
        photoWrap.style.display = 'none';
      }
    }

    // ── Weather ──
    const detWeather = document.getElementById('detWeather');
    if (ride.weather_condition && detWeather) {
      detWeather.style.display = 'block';
      document.getElementById('detWeatherIcon').textContent = getWeatherEmoji(ride.weather_condition);
      document.getElementById('detWeatherLabel').textContent = ride.weather_condition;
      document.getElementById('detWeatherDetail').textContent = `${ride.weather_temp}°C / 💨 ${ride.weather_wind} km/h`;
    } else if (detWeather) {
      detWeather.style.display = 'none';
    }

    // ── Edit button ──
    const editBtn = document.getElementById('editRideBtn');
    if (editBtn) {
      editBtn.onclick = () => {
        const section = document.getElementById('editRideSection');
        if (section) {
          section.style.display = section.style.display === 'none' ? 'block' : 'none';
        }
        const editName = document.getElementById('editName');
        if (editName) editName.value = ride.name || '';
        const editNotes = document.getElementById('editNotes');
        if (editNotes) editNotes.value = ride.notes || '';
        document.querySelectorAll('.edit-rating-btn').forEach(b => {
          b.classList.toggle('selected', parseInt(b.dataset.rating) === ride.rating);
        });
      };
    }

    // ── Save edit ──
    const saveEditBtn = document.getElementById('saveEditBtn');
    if (saveEditBtn) {
      saveEditBtn.onclick = async () => {
        try {
          const data = {
            name: document.getElementById('editName')?.value,
            notes: document.getElementById('editNotes')?.value,
            rating: parseInt(document.querySelector('.edit-rating-btn.selected')?.dataset?.rating) || null
          };
          await updateRide(id, data);
          document.getElementById('editRideSection').style.display = 'none';
          showRideDetails(id);
        } catch (err) {
          window.showAlert('Error', 'Failed to save changes. Check your connection.', '<i data-lucide="x"></i>');
        }
      };
    }

  } catch (err) {
    console.error('Failed to load ride details:', err);
    document.getElementById('det-distance').innerHTML = 'Error';
  }
};

window.startRideBtn = function () {
  if (rideState.state === STATES.IDLE || rideState.state === STATES.SUMMARY) {
    rideState.start();
  } else if (rideState.state === STATES.PAUSED) {
    rideState.manualResume();
  } else if (rideState.state === STATES.RECORDING) {
    rideState.manualPause();
  }
};

window.endRide = function () {
  const stopBtn = document.querySelector('.ctrl-stop');
  if (stopBtn) stopBtn.disabled = true;
  window._rideName = document.getElementById('sumName')?.value || '';
  window._rideNotes = document.getElementById('sumNotes')?.value || '';
  rideState.stop();
};

// ── UI callbacks ──
const uiCallbacks = {

  updateTimer: (seconds) => {
    const el = document.getElementById('rideTimer');
    if (el) el.textContent = fmtSeconds(seconds);
    const liveTimeEl = document.getElementById('liveTime');
    if (liveTimeEl) liveTimeEl.textContent = fmtSeconds(seconds);
  },

  updateSpeed: (kmh, stats) => {
    const speedValEl = document.getElementById('speedVal');
    if (speedValEl) speedValEl.textContent = Math.round(kmh);

    // Arc: 0 km/h = dashoffset 566, 60 km/h = dashoffset 0
    const fraction = Math.min(kmh / 60, 1);
    const offset = 566 - fraction * 566;
    const speedArc = document.getElementById('speedArc');
    if (speedArc) speedArc.style.strokeDashoffset = offset;

    // Speed label
    const speedLabel = document.getElementById('speedLabel');
    if (speedLabel) {
      if (kmh < 1) speedLabel.textContent = 'STOPPED';
      else if (kmh < 10) speedLabel.textContent = 'SLOW';
      else if (kmh < 20) speedLabel.textContent = 'CRUISING';
      else if (kmh < 35) speedLabel.textContent = 'RIDING';
      else speedLabel.textContent = 'FAST!';
    }

    // Metric chips — use real accumulated stats
    const distEl = document.getElementById('metricDist');
    if (distEl) distEl.textContent = (stats.distance || 0).toFixed(2);

    const maxEl = document.getElementById('metricMax');
    if (maxEl) maxEl.textContent = (stats.maxSpeed || 0).toFixed(1);

    const movingHrs = (stats.movingSeconds || 0) / 3600;
    const avg = movingHrs > 0 ? stats.distance / movingHrs : 0;
    const avgEl = document.getElementById('metricAvg');
    if (avgEl) avgEl.textContent = avg > 0 ? avg.toFixed(1) : '—';

    const liveDistEl = document.getElementById('liveDist');
    if (liveDistEl) liveDistEl.textContent = (stats.distance || 0).toFixed(2);

    const liveAvgEl = document.getElementById('liveAvg');
    if (liveAvgEl) liveAvgEl.textContent = avg > 0 ? avg.toFixed(1) : '—';
  },

  onPoint: (point) => {
    if (liveMap && mapMode) {
      const latlng = [point.lat, point.lng];

      if (!liveMarker) {
        const icon = L.divIcon({
          className: 'live-marker',
          html: '<div class="live-marker-dot"></div><div class="live-marker-pulse"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        liveMarker = L.marker(latlng, { icon }).addTo(liveMap);

        if (point.accuracy) {
          liveAccuracy = L.circle(latlng, { radius: point.accuracy, color: '#0a84ff', fillColor: '#0a84ff', fillOpacity: 0.1, weight: 1 }).addTo(liveMap);
        }
      } else {
        liveMarker.setLatLng(latlng);
        if (liveAccuracy) liveAccuracy.setLatLng(latlng);
      }
    }
  },

  onStateChange: (state, meta = {}) => {
    const banner = document.getElementById('pausedBanner');
    const stopBtn = document.querySelector('.ctrl-stop');
    const startBtn = document.getElementById('startBtn');

    const PLAY_ICON = `<svg viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>`;
    const PAUSE_ICON = `<svg viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;

    if (state === STATES.RECORDING) {
      if (banner) banner.classList.remove('show');
      if (stopBtn) {
        stopBtn.style.display = 'flex';
        stopBtn.disabled = false;
      }
      if (startBtn) {
        startBtn.style.display = 'flex';
        startBtn.innerHTML = PAUSE_ICON;
      }
      const liveCardRec = document.getElementById('liveCard');
      if (liveCardRec) liveCardRec.style.display = 'block';
    } else if (state === STATES.PAUSED) {
      if (banner) {
        banner.textContent = meta.auto ? 'AUTO PAUSED' : 'PAUSED';
        banner.classList.add('show');
      }
      const speedVal = document.getElementById('speedVal');
      if (speedVal) speedVal.textContent = '0';
      const speedArc = document.getElementById('speedArc');
      if (speedArc) speedArc.style.strokeDashoffset = 566;
      if (startBtn) {
        startBtn.style.display = 'flex';
        startBtn.innerHTML = PLAY_ICON;
      }
      if (stopBtn) stopBtn.style.display = 'flex';
      const liveCardPaused = document.getElementById('liveCard');
      if (liveCardPaused) liveCardPaused.style.display = 'block';
    } else if (state === STATES.IDLE) {
      if (stopBtn) stopBtn.style.display = 'none';
      if (startBtn) {
        startBtn.style.display = 'flex';
        startBtn.innerHTML = PLAY_ICON;
      }
      
      const timer = document.getElementById('rideTimer');
      if (timer) timer.textContent = '--:--';
      
      const metricDist = document.getElementById('metricDist');
      if (metricDist) metricDist.textContent = '—';
      
      const metricAvg = document.getElementById('metricAvg');
      if (metricAvg) metricAvg.textContent = '—';
      
      const metricMax = document.getElementById('metricMax');
      if (metricMax) metricMax.textContent = '—';
      
      const speedArc = document.getElementById('speedArc');
      if (speedArc) speedArc.style.strokeDashoffset = 566;

      const liveCard = document.getElementById('liveCard');
      if (liveCard) liveCard.style.display = 'none';
    }
  },

  onSummary: (summary) => {
    // Re-enable stop button
    const stopBtn = document.querySelector('.ctrl-stop');
    if (stopBtn) stopBtn.disabled = false;

    // Reset the ride view UI for the next time it's visited
    uiCallbacks.onStateChange(STATES.IDLE);

    // Navigate to summary
    window.showView('summary');
    document.getElementById('nav-home').classList.add('active');

    // ── Populate all summary fields with real data ──
    const distEl = document.getElementById('sum-distance');
    if (distEl) distEl.innerHTML = `${(summary.distance_km || 0).toFixed(2)} <span>km</span>`;

    const dateEl = document.getElementById('sum-date');
    if (dateEl) {
      const startStr = fmtDate(summary.started_at);
      const endTime = summary.stopped_at
        ? new Date(summary.stopped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      dateEl.textContent = startStr + (endTime ? ` → ${endTime}` : '');
    }

    const totalTimeEl = document.getElementById('sum-total-time');
    if (totalTimeEl) totalTimeEl.textContent = fmtSeconds(summary.total_seconds || 0);

    const movingTimeEl = document.getElementById('sum-moving-time');
    if (movingTimeEl) movingTimeEl.textContent = fmtSeconds(summary.moving_seconds || 0);

    const avgSpeedEl = document.getElementById('sum-avg-speed');
    if (avgSpeedEl) avgSpeedEl.innerHTML = `${(summary.avg_speed_kmh || 0).toFixed(1)}<span> km/h</span>`;

    const maxSpeedEl = document.getElementById('sum-max-speed');
    if (maxSpeedEl) maxSpeedEl.innerHTML = `${(summary.max_speed_kmh || 0).toFixed(1)}<span> km/h</span>`;

    const pausesEl = document.getElementById('sum-pauses');
    if (pausesEl) pausesEl.innerHTML = `${summary.pause_count || 0} <span>stops</span>`;

    // ── Speed chart from speed history ──
    renderSpeedChart(summary._speedHistory || []);

    // ── Summary Map ──
    if (summary._points && summary._points.length > 0 && window.L) {
      if (!summaryMap) {
        summaryMap = L.map('summaryMap', { zoomControl: true, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false });
        setTileLayer(summaryMap, localStorage.getItem('mapLayer') || 'osm');
        summaryPolyline = L.polyline([], {color: 'var(--accent)', weight: 5}).addTo(summaryMap);

        summaryPolyline.on('click', (e) => {
          const latlng = e.latlng;
          const pts = summaryPopupPoints || [];
          let closest = pts[0];
          let minDist = Infinity;
          pts.forEach(p => {
            const d = (p.lat - latlng.lat) ** 2 + (p.lng - latlng.lng) ** 2;
            if (d < minDist) { minDist = d; closest = p; }
          });
          if (closest) {
            const time = new Date(closest.timestamp || closest.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            L.popup()
              .setLatLng([closest.lat, closest.lng])
              .setContent(`⚡ ${closest.speed_kmh.toFixed(1)} km/h &nbsp;·&nbsp; 🕐 ${time}`)
              .openOn(summaryMap);
          }
        });

        const fitBtn = document.getElementById('fitRouteBtn');
        if (fitBtn) {
          fitBtn.onclick = () => {
            if (summaryPolyline && summaryPolyline.getBounds().isValid()) {
              summaryMap.fitBounds(summaryPolyline.getBounds(), { padding: [20, 20] });
            }
          };
        }
      }
      summaryPopupPoints = summary._points || [];
      const latlngs = summary._points.map(p => [p.lat, p.lng]);
      summaryPolyline.setLatLngs(latlngs);

      const fitBtn = document.getElementById('fitRouteBtn');
      if (fitBtn) fitBtn.style.display = 'block';

      setTimeout(() => {
        summaryMap.invalidateSize();
        summaryMap.fitBounds(summaryPolyline.getBounds(), { padding: [20, 20] });
      }, 300);
    }

    // Weather
    const weatherEl = document.getElementById('sumWeather');
    const iconEl = document.getElementById('sumWeatherIcon');
    const labelEl = document.getElementById('sumWeatherLabel');
    const detailEl = document.getElementById('sumWeatherDetail');
    if (summary.weather_condition && weatherEl) {
      weatherEl.style.display = 'block';
      iconEl.textContent = getWeatherEmoji(summary.weather_condition);
      labelEl.textContent = summary.weather_condition;
      detailEl.textContent = `${summary.weather_temp}°C / 💨 ${summary.weather_wind} km/h`;
    } else if (weatherEl) {
      weatherEl.style.display = 'none';
    }

    // Clear ride metadata inputs for next ride
    const nameEl = document.getElementById('sumName');
    if (nameEl) nameEl.value = '';

    const notesEl = document.getElementById('sumNotes');
    if (notesEl) notesEl.value = '';

    document.querySelectorAll('.rating-btn:not(.edit-rating-btn)').forEach(b => b.classList.remove('selected'));
    window._selectedRating = null;

    const photoPreview = document.getElementById('photoPreview');
    if (photoPreview) photoPreview.style.display = 'none';
    const photoInput = document.getElementById('photoInput');
    if (photoInput) photoInput.value = '';
    window._capturedPhoto = null;

    // Pre-fill name/notes/rating/photo from saved ride data
    if (summary.name) { if (nameEl) nameEl.value = summary.name; }
    if (summary.notes) { if (notesEl) notesEl.value = summary.notes; }
    if (summary.rating) {
      window._selectedRating = summary.rating;
      const ratingBtn = document.querySelector(`.rating-btn[data-rating="${summary.rating}"]:not(.edit-rating-btn)`);
      if (ratingBtn) ratingBtn.classList.add('selected');
    }
    if (summary.photo_url) {
      const pImg = document.getElementById('photoImg');
      const pPrev = document.getElementById('photoPreview');
      if (pImg && pPrev) {
        pImg.src = summary.photo_url;
        pPrev.style.display = 'block';
        window._capturedPhoto = summary.photo_url;
      }
    }

    _currentSummary = summary;

    // Refresh ride list after a real ride
    renderRides();
  },

  onStopError: () => {
    const stopBtn = document.querySelector('.ctrl-stop');
    if (stopBtn) stopBtn.disabled = false;
  }
};

// ── Speed chart renderer ──
function renderSpeedChart(speeds) {
  const svg = document.getElementById('sum-speed-chart');
  if (!svg || speeds.length < 2) return;

  const W = 300, H = 60;
  const maxS = Math.max(...speeds, 1);
  const pts = speeds.map((s, i) => {
    const x = (i / (speeds.length - 1)) * W;
    const y = H - (s / maxS) * (H - 4) - 2;
    return `${x},${y}`;
  });

  const lineD = `M${pts.join(' L')}`;
  const areaD = `${lineD} L${W},${H} L0,${H} Z`;

  svg.innerHTML = `
    <defs>
      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ff6b2b" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#ff6b2b" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaD}" fill="url(#chartGrad)"/>
    <path d="${lineD}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
  `;
}

// ── Dynamic Ride Rendering ──
async function renderRides() {
  try {
    const rides = await getRides();

    function createRideCard(ride) {
      const start = new Date(ride.started_at);
      const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = start.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const movingSec = ride.moving_seconds || 0;
      const timeFmt = fmtSeconds(movingSec);

      return `
        <div class="ride-card" onclick="showRideDetails(${ride.id})">
          <div class="ride-card-top">
            <span class="ride-card-date">${dateStr} · ${timeStr}</span>
            <span class="ride-card-badge">Ride</span>
          </div>
          <div class="ride-card-dist">${(ride.distance_km || 0).toFixed(2)} <span>km</span></div>
          <div class="ride-card-stats">
            <div class="ride-stat"><div class="ride-stat-val">${timeFmt}</div><div class="ride-stat-label">Moving</div></div>
            <div class="ride-stat"><div class="ride-stat-val">${(ride.avg_speed_kmh || 0).toFixed(1)}</div><div class="ride-stat-label">Avg km/h</div></div>
            <div class="ride-stat"><div class="ride-stat-val">${(ride.max_speed_kmh || 0).toFixed(1)}</div><div class="ride-stat-label">Max km/h</div></div>
          </div>
        </div>
      `;
    }

    const homeContainer = document.getElementById('home-rides-container');
    if (homeContainer) {
      homeContainer.innerHTML = rides.length
        ? rides.slice(0, 2).map(createRideCard).join('')
        : '<p style="color:var(--text2);font-size:13px;padding:12px 0;">No rides yet — tap Start Ride!</p>';
    }

    const historyContainer = document.getElementById('history-rides-container');
    if (historyContainer) {
      historyContainer.innerHTML = rides.length
        ? rides.map(createRideCard).join('')
        : '<p style="color:var(--text2);font-size:13px;padding:12px 0;">No completed rides yet.</p>';

      const totalKm = rides.reduce((a, r) => a + (r.distance_km || 0), 0);
      const totalMovingSec = rides.reduce((a, r) => a + (r.moving_seconds || 0), 0);
      const statVals = document.querySelectorAll('.history-stat-val');
      if (statVals[0]) statVals[0].textContent = totalKm.toFixed(0);
      if (statVals[1]) statVals[1].textContent = rides.length;
      if (statVals[2]) statVals[2].textContent = `${Math.floor(totalMovingSec / 3600)}h`;
    }

    // Always update the weekly summary card
    renderWeekly(rides);

  } catch (err) {
    console.error('Error rendering rides:', err);
  }
}

// ── Weekly ring & bar chart ──
export function renderWeekly(rides) {
  // Get the Mon–Sun range of the current week
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  // Bucket km per day index (0=Mon ... 6=Sun)
  const kmPerDay = [0, 0, 0, 0, 0, 0, 0];
  let weekRides = 0, weekKm = 0, weekMovingSec = 0;

  rides.forEach(r => {
    const d = new Date(r.started_at);
    if (d >= monday) {
      const idx = (d.getDay() + 6) % 7; // convert Sun=0 to Mon=0
      kmPerDay[idx] += r.distance_km || 0;
      weekRides++;
      weekKm += r.distance_km || 0;
      weekMovingSec += r.moving_seconds || 0;
    }
  });

  // Ring: target from localStorage (default 50 km)
  const goalKm = parseFloat(localStorage.getItem('weeklyGoalKm')) || 50;
  const fraction = Math.min(weekKm / goalKm, 1);
  const circumference = 213.6;
  const ringOffset = circumference - fraction * circumference;
  const ringArc = document.getElementById('weekly-ring-arc');
  if (ringArc) ringArc.style.strokeDashoffset = ringOffset;

  const goalText = document.getElementById('weekly-goal-text');
  if (goalText) goalText.textContent = `/ ${goalKm} km`;

  const countEl = document.getElementById('weekly-ride-count');
  if (countEl) countEl.textContent = weekRides;

  const summaryEl = document.getElementById('weekly-summary-text');
  if (summaryEl) {
    const h = Math.floor(weekMovingSec / 3600);
    const m = Math.floor((weekMovingSec % 3600) / 60);
    summaryEl.textContent = `${weekKm.toFixed(1)} km · ${h}h ${m}m`;
  }

  // Bars: 7 days Mon–Sun
  const container = document.getElementById('weekly-bars-container');
  if (!container) return;
  const maxDay = Math.max(...kmPerDay, 1);
  const todayIdx = (today.getDay() + 6) % 7;
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  container.innerHTML = kmPerDay.map((km, i) => {
    const fillPct = Math.round((km / maxDay) * 100);
    const isToday = i === todayIdx ? 'today' : '';
    return `<div class="wbar ${isToday}" style="height:60%" title="${days[i]}: ${km.toFixed(1)} km"><div class="wbar-fill" style="height:${fillPct}%"></div></div>`;
  }).join('');
}

// ── Calendar ──
async function renderCalendar(year, month) {
  calYear = year;
  calMonth = month;

  const monthEl = document.getElementById('calMonthYear');
  if (monthEl) {
    const d = new Date(year, month - 1, 1);
    monthEl.textContent = d.toLocaleDateString([], { month: 'long', year: 'numeric' });
  }

  const grid = document.getElementById('calGrid');
  if (!grid) return;

  const firstDay = new Date(year, month - 1, 1).getDay();
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  let rides = [];
  try {
    const allRides = await getRides();
    rides = allRides.filter(r => {
      const d = new Date(r.started_at);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });
  } catch (e) {}

  const dayData = {};
  rides.forEach(r => {
    const d = new Date(r.started_at);
    const day = d.getDate();
    dayData[day] = (dayData[day] || 0) + (r.distance_km || 0);
  });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;

  let cells = '';
  for (let i = 0; i < startOffset; i++) {
    cells += '<div class="cal-cell empty"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dist = dayData[d] || 0;
    const isToday = `${year}-${month}-${d}` === todayStr;
    const distClass = dist > 50 ? 'l5' : dist > 30 ? 'l4' : dist > 15 ? 'l3' : dist > 5 ? 'l2' : dist > 0 ? 'l1' : '';
    cells += `<div class="cal-cell ${distClass} ${isToday ? 'today' : ''}" data-day="${d}" onclick="showDayRides(${year},${month},${d})">${d}</div>`;
  }

  grid.innerHTML = cells;
}

window.showDayRides = async function (year, month, day) {
  const container = document.getElementById('calDayRides');
  const title = document.getElementById('calDayTitle');
  const list = document.getElementById('calDayRidesList');
  if (!container || !list) return;

  container.style.display = 'block';
  const d = new Date(year, month - 1, day);
  if (title) {
    title.textContent = `Rides on ${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  document.querySelectorAll('.cal-cell.selected').forEach(el => el.classList.remove('selected'));
  const cell = document.querySelector(`.cal-cell[data-day="${day}"]`);
  if (cell) cell.classList.add('selected');

  let allRides = [];
  try {
    allRides = await getRides();
  } catch (e) {}

  const dayRides = allRides.filter(r => {
    const rd = new Date(r.started_at);
    return rd.getFullYear() === year && (rd.getMonth() + 1) === month && rd.getDate() === day;
  });

  if (dayRides.length === 0) {
    list.innerHTML = '<p style="color:var(--text2);font-size:13px;">No rides on this day.</p>';
  } else {
    list.innerHTML = dayRides.map(r => {
      const start = new Date(r.started_at);
      const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = start.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const movingSec = r.moving_seconds || 0;
      const timeFmt = fmtSeconds(movingSec);

      return `
        <div class="ride-card" onclick="showRideDetails(${r.id})">
          <div class="ride-card-top">
            <span class="ride-card-date">${dateStr} · ${timeStr}</span>
            <span class="ride-card-badge">Ride</span>
          </div>
          <div class="ride-card-dist">${(r.distance_km || 0).toFixed(2)} <span>km</span></div>
          <div class="ride-card-stats">
            <div class="ride-stat"><div class="ride-stat-val">${timeFmt}</div><div class="ride-stat-label">Moving</div></div>
            <div class="ride-stat"><div class="ride-stat-val">${(r.avg_speed_kmh || 0).toFixed(1)}</div><div class="ride-stat-label">Avg km/h</div></div>
            <div class="ride-stat"><div class="ride-stat-val">${(r.max_speed_kmh || 0).toFixed(1)}</div><div class="ride-stat-label">Max km/h</div></div>
          </div>
        </div>
      `;
    }).join('');
  }
};

async function renderBarChart(year) {
  const container = document.getElementById('calBarChart');
  if (!container) return;

  let stats = { monthly: [] };
  try {
    stats = await getRideStats();
  } catch (e) {}

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const yearMonths = (stats.monthly || []).filter(m => m.year === year);
  const maxDist = Math.max(...yearMonths.map(m => m.distance_km || 0), 1);

  let bars = '';
  for (let m = 1; m <= 12; m++) {
    const monthData = yearMonths.find(ym => ym.month === m);
    const dist = monthData ? monthData.distance_km : 0;
    const heightPct = (dist / maxDist) * 100;
    const isCurrent = (year === currentYear && m === currentMonth);

    bars += `
      <div class="cal-bar-wrap">
        <div class="cal-bar-val">${dist > 0 ? dist.toFixed(0) : ''}</div>
        <div class="cal-bar ${isCurrent ? 'current-month' : ''}" style="height:${Math.max(heightPct, 2)}%"></div>
        <div class="cal-bar-label">${monthNames[m-1]}</div>
      </div>
    `;
  }

  container.innerHTML = bars;
}

async function renderYearTotals(year) {
  const container = document.getElementById('calYearTotals');
  if (!container) return;

  let stats = { yearly: [], monthly: [] };
  try {
    stats = await getRideStats();
  } catch (e) {}

  const yearData = (stats.yearly || []).find(y => y.year === year);
  const yearMonths = (stats.monthly || []).filter(m => m.year === year);
  let bestMonth = null;
  let bestDist = 0;
  yearMonths.forEach(m => {
    if ((m.distance_km || 0) > bestDist) {
      bestDist = m.distance_km;
      bestMonth = m.month;
    }
  });
  const monthNames3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const bestMonthName = bestMonth ? monthNames3[bestMonth - 1] : '—';

  if (yearData) {
    container.innerHTML = `
      <div class="cal-year-stat">
        <div class="cal-year-stat-val">${(yearData.distance_km || 0).toFixed(0)}</div>
        <div class="cal-year-stat-label">Total km</div>
      </div>
      <div class="cal-year-stat">
        <div class="cal-year-stat-val">${yearData.ride_count || 0}</div>
        <div class="cal-year-stat-label">Rides</div>
      </div>
      <div class="cal-year-stat">
        <div class="cal-year-stat-val">${Math.floor(yearData.moving_hours || 0)}h</div>
        <div class="cal-year-stat-label">Moving Time</div>
      </div>
      <div class="cal-year-stat">
        <div class="cal-year-stat-val">${bestMonthName}</div>
        <div class="cal-year-stat-label">Best Month</div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="cal-year-stat">
        <div class="cal-year-stat-val">0</div>
        <div class="cal-year-stat-label">Total km</div>
      </div>
      <div class="cal-year-stat">
        <div class="cal-year-stat-val">0</div>
        <div class="cal-year-stat-label">Rides</div>
      </div>
      <div class="cal-year-stat">
        <div class="cal-year-stat-val">0h</div>
        <div class="cal-year-stat-label">Moving Time</div>
      </div>
      <div class="cal-year-stat">
        <div class="cal-year-stat-val">—</div>
        <div class="cal-year-stat-label">Best Month</div>
      </div>
    `;
  }
}

window.calPrevMonth = function () {
  let m = calMonth - 1;
  let y = calYear;
  if (m < 1) { m = 12; y--; }
  renderCalendar(y, m);
};

window.calNextMonth = function () {
  let m = calMonth + 1;
  let y = calYear;
  if (m > 12) { m = 1; y++; }
  renderCalendar(y, m);
};

window.selectRating = function(val) {
  document.querySelectorAll('.rating-btn:not(.edit-rating-btn)').forEach(b => b.classList.remove('selected'));
  const btn = document.querySelector(`.rating-btn[data-rating="${val}"]:not(.edit-rating-btn)`);
  if (btn) btn.classList.add('selected');
  window._selectedRating = val;
};

window.editSelectRating = function(val) {
  document.querySelectorAll('.edit-rating-btn').forEach(b => b.classList.remove('selected'));
  const btn = document.querySelector(`.edit-rating-btn[data-rating="${val}"]`);
  if (btn) btn.classList.add('selected');
};

// ── Init ──
const rideState = new RideState(uiCallbacks);

async function init() {
  initTheme();

  const toggleBtn = document.getElementById('themeToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'light' ? 'dark' : 'light');
    });
  }

  const gearBtn = document.getElementById('weeklyGoalGear');
  const editor = document.getElementById('weeklyGoalEditor');
  if (gearBtn && editor) {
    gearBtn.addEventListener('click', () => {
      const input = document.getElementById('weeklyGoalInput');
      if (input) {
        input.value = localStorage.getItem('weeklyGoalKm') || '50';
      }
      gearBtn.style.display = 'none';
      editor.style.display = 'inline-flex';
    });
    const saveBtn = document.getElementById('weeklyGoalSave');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const input = document.getElementById('weeklyGoalInput');
        if (input && input.value) {
          localStorage.setItem('weeklyGoalKm', input.value);
        }
        gearBtn.style.display = 'inline-flex';
        editor.style.display = 'none';
        renderRides();
      });
    }
  }

  // ── Photo capture ──
  document.getElementById('photoBtn')?.addEventListener('click', () => {
    document.getElementById('photoInput')?.click();
  });
  document.getElementById('photoInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const img = document.getElementById('photoImg');
      if (img) img.src = dataUrl;
      const preview = document.getElementById('photoPreview');
      if (preview) preview.style.display = 'block';
      window._capturedPhoto = dataUrl;
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('photoRemoveBtn')?.addEventListener('click', () => {
    const preview = document.getElementById('photoPreview');
    if (preview) preview.style.display = 'none';
    const input = document.getElementById('photoInput');
    if (input) input.value = '';
    window._capturedPhoto = null;
  });

  // ── Share (summary view) ──
  document.getElementById('shareBtn')?.addEventListener('click', () => {
    if (!_currentSummary) {
      window.showAlert('No Data', 'Complete a ride first to share it.', '<i data-lucide="info"></i>');
      return;
    }
    shareRide({
      points: _currentSummary._points || [],
      distance: _currentSummary.distance_km || 0,
      movingTime: _currentSummary.moving_seconds || 0,
      avgSpeed: _currentSummary.avg_speed_kmh || 0,
      date: _currentSummary.started_at,
      rideName: _currentSummary.name || '',
      rideId: _currentSummary.id,
    });
  });

  document.getElementById('home-rides-container').innerHTML = '<div style="text-align:center;color:var(--text3);margin-top:20px;">Loading...</div>';
  
  try {
    const activeData = await getActiveRide();
    if (activeData && activeData.active) {
      console.log('Hydrating active ride...', activeData);
      rideState.hydrate(activeData);
      showView('ride');
      if (activeData.points && activeData.points.length > 0 && window.toggleMap) {
        // Switch to map view immediately on hydrate if they want, or just let them toggle it.
      }
    }
  } catch(err) {
    console.error('Hydration failed:', err);
  }

  // ── Hash-based ride navigation ──
  const hash = window.location.hash;
  const rideMatch = hash.match(/^#\/ride\/(\d+)$/);
  if (rideMatch) {
    showRideDetails(parseInt(rideMatch[1]));
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'background-sync') {
        if (rideState && rideState.sync) {
          rideState.sync.retryPending();
        }
      }
    });

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('sync-rides');
    }
  }

  renderRides();
}

init();

// ── Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ── Offline indicator ──
const offlineBanner = document.getElementById('offlineBanner');
const updateOnlineStatus = () => {
  const online = navigator.onLine;
  if (offlineBanner) offlineBanner.style.display = online ? 'none' : 'block';
};
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

export { uiCallbacks, renderCalendar, renderBarChart, renderYearTotals };
