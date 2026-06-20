import { RideState, STATES } from './state.js';
import { getRides, getActiveRide } from './api.js';

// ── Live Map State ──
let mapMode = false;
let liveMap = null;
let livePolyline = null;
let liveMarker = null;
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
window.showAlert = function(title, message, icon='⚠️') {
  const t = document.getElementById('alertTitle');
  const m = document.getElementById('alertMessage');
  const i = document.getElementById('alertIcon');
  if (t) t.textContent = title;
  if (m) m.textContent = message;
  if (i) i.textContent = icon;
  const mod = document.getElementById('alertModal');
  if (mod) mod.classList.add('show');
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
    if(btnIcon) btnIcon.textContent = '⏱️';
    
    if (!liveMap && window.L) {
      liveMap = L.map('liveMap', { zoomControl: false }).setView([0, 0], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(liveMap);
      livePolyline = L.polyline([], {color: 'var(--accent)', weight: 5}).addTo(liveMap);
    }
    setTimeout(() => { if(liveMap) liveMap.invalidateSize(); }, 300);
  } else {
    speedoWrap.style.opacity = '1';
    speedoWrap.style.pointerEvents = 'auto';
    liveMapWrap.style.opacity = '0';
    liveMapWrap.style.pointerEvents = 'none';
    if(btnText) btnText.textContent = 'Map';
    if(btnIcon) btnIcon.textContent = '🗺️';
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
        detailsMap = L.map('detailsMap', { zoomControl: false, dragging: true, touchZoom: true, scrollWheelZoom: true, doubleClickZoom: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap'
        }).addTo(detailsMap);
        detailsPolyline = L.polyline([], {color: 'var(--accent)', weight: 5}).addTo(detailsMap);
      }
      const latlngs = points.map(p => [p.lat, p.lng]);
      detailsPolyline.setLatLngs(latlngs);
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
            const { deleteRide } = await import('./api.js');
            await deleteRide(id);
            window.showView('history');
          } catch (err) {
            window.showAlert('Error', 'Failed to delete ride.', '❌');
          }
        });
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
  // Disable the stop button during the stop + flush sequence
  const stopBtn = document.querySelector('.ctrl-stop');
  if (stopBtn) stopBtn.disabled = true;
  rideState.stop();
};

// ── UI callbacks ──
const uiCallbacks = {

  updateTimer: (seconds) => {
    const el = document.getElementById('rideTimer');
    if (el) el.textContent = fmtSeconds(seconds);
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
        summaryMap = L.map('summaryMap', { zoomControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap'
        }).addTo(summaryMap);
        summaryPolyline = L.polyline([], {color: 'var(--accent)', weight: 5}).addTo(summaryMap);
      }
      const latlngs = summary._points.map(p => [p.lat, p.lng]);
      summaryPolyline.setLatLngs(latlngs);
      setTimeout(() => {
        summaryMap.invalidateSize();
        summaryMap.fitBounds(summaryPolyline.getBounds(), { padding: [20, 20] });
      }, 300);
    }

    // Refresh ride list after a real ride
    renderRides();
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
function renderWeekly(rides) {
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

  // Ring: target = 50 km/week (full circle at 50 km)
  const WEEKLY_GOAL_KM = 50;
  const fraction = Math.min(weekKm / WEEKLY_GOAL_KM, 1);
  const circumference = 213.6;
  const ringOffset = circumference - fraction * circumference;
  const ringArc = document.getElementById('weekly-ring-arc');
  if (ringArc) ringArc.style.strokeDashoffset = ringOffset;

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

// ── Init ──
const rideState = new RideState(uiCallbacks);

async function init() {
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
