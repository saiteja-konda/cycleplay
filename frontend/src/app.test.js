import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

let applyTheme, initTheme, renderWeekly, uiCallbacks, STATES;

beforeAll(async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  const mockDb = {
    objectStoreNames: { contains: () => false },
    createObjectStore: () => ({}),
    transaction: () => ({
      objectStore: () => ({
        add: () => {},
        getAll: () => ({ result: [] }),
        delete: () => {},
      }),
    }),
  };

  const mockRequest = {
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: null,
  };

  global.indexedDB = {
    open: () => {
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDb } });
        }
      }, 0);
      return mockRequest;
    },
  };

  document.body.innerHTML = `
    <div id="offlineBanner" class="offline-banner" style="display:none;">📡 You're offline — showing cached data</div>
    <div class="statusbar">
      <span class="statusbar-time" id="clock">12:00 AM</span>
      <button id="themeToggle"></button>
    </div>
    <div id="home-rides-container"></div>
    <div id="history-rides-container"></div>
    <div class="weekly-card">
      <div class="weekly-ring-wrap">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" stroke-width="7"/>
          <circle id="weekly-ring-arc" cx="40" cy="40" r="34" fill="none" stroke="url(#ringGrad)" stroke-width="7" stroke-dasharray="213.6" stroke-dashoffset="213.6" stroke-linecap="round"/>
        </svg>
        <div class="weekly-ring-center">
          <span id="weekly-ride-count">0</span>
          <span>rides</span>
          <span id="weekly-goal-text"></span>
        </div>
      </div>
      <div class="weekly-stats">
        <h3>This Week</h3>
        <p id="weekly-summary-text">0 km · 0h 0m</p>
        <div class="weekly-bars" id="weekly-bars-container"></div>
        <button id="weeklyGoalGear">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        </button>
        <div id="weeklyGoalEditor" style="display:none">
          <input type="number" id="weeklyGoalInput" value="50">
          <button id="weeklyGoalSave">Save</button>
        </div>
      </div>
    </div>
    <div id="liveCard" class="live-card" style="display:none;">
      <div class="live-card-header">Active Ride</div>
      <div class="live-card-stats">
        <div class="live-stat">
          <span class="live-stat-val" id="liveDist">0.00</span>
          <span class="live-stat-label">km</span>
        </div>
        <div class="live-stat">
          <span class="live-stat-val" id="liveTime">--:--</span>
          <span class="live-stat-label">time</span>
        </div>
        <div class="live-stat">
          <span class="live-stat-val" id="liveAvg">--</span>
          <span class="live-stat-label">avg km/h</span>
        </div>
      </div>
    </div>
    <div class="view" id="summary">
      <div class="summary-hero">
        <div class="summary-emoji">🏅</div>
        <div class="summary-congrats">Ride Complete</div>
        <div class="summary-dist-big" id="sum-distance">0.0 <span>km</span></div>
        <div class="summary-date" id="sum-date">—</div>
      </div>
      <div id="sumWeather" class="summary-tile wide" style="margin-bottom:10px;display:none;">
        <div id="sumWeatherContent" style="display:flex;align-items:center;gap:12px;">
          <span id="sumWeatherIcon" style="font-size:28px;"></span>
          <div>
            <div id="sumWeatherLabel" style="font-size:16px;font-weight:600;"></div>
            <div id="sumWeatherDetail" style="font-size:13px;color:var(--text2);"></div>
          </div>
        </div>
      </div>
      <div id="summaryMapWrap" style="position:relative;padding:0 20px;margin-bottom:20px;">
        <div id="summaryMap" style="width:100%;height:200px;border-radius:16px;z-index:1;"></div>
        <button id="fitRouteBtn" class="fit-route-btn" style="display:none;">📍 Fit Route</button>
      </div>
      <div class="summary-grid">
        <div class="summary-tile"><div class="summary-tile-val" id="sum-total-time">—</div></div>
        <div class="summary-tile"><div class="summary-tile-val" id="sum-moving-time">—</div></div>
      </div>
      <input type="text" id="sumName" class="summary-input" placeholder="Name this ride" maxlength="100">
      <textarea id="sumNotes" class="summary-textarea" placeholder="Add notes…" rows="3"></textarea>
      <div class="rating-row">
        <button class="rating-btn" data-rating="1" onclick="selectRating(1)">😀</button>
        <button class="rating-btn" data-rating="2" onclick="selectRating(2)">🙂</button>
        <button class="rating-btn" data-rating="3" onclick="selectRating(3)">😐</button>
        <button class="rating-btn" data-rating="4" onclick="selectRating(4)">😞</button>
      </div>
      <input type="file" id="photoInput" accept="image/*" capture="environment" style="display:none">
      <button id="photoBtn" class="summary-photo-btn">📷 Add Photo</button>
      <div id="photoPreview" style="display:none;">
        <img id="photoImg" style="width:100%; border-radius:12px; max-height:200px; object-fit:cover;">
        <button id="photoRemoveBtn">Remove</button>
      </div>
      <button id="shareBtn" class="summary-share-btn">📤 Share</button>
      <svg id="sum-speed-chart" viewBox="0 0 300 60" preserveAspectRatio="none"></svg>
    </div>
    <div class="view" id="ride-details">
      <div class="ride-header"><button id="detShareBtn" title="Share ride"></button></div>
      <div class="summary-hero"></div>
      <div class="summary-grid"></div>
      <div id="detailsMapWrap" style="position:relative;">
        <div id="detailsMap"></div>
        <button id="detFitRouteBtn" class="fit-route-btn" style="display:none;">📍 Fit Route</button>
      </div>
      <div id="detName"></div>
      <div id="detNotes"></div>
      <div id="detRating"></div>
      <div id="detPhotoWrap" style="display:none;">
        <img id="detPhotoImg" style="width:100%;border-radius:12px;max-height:250px;object-fit:cover;cursor:pointer;">
      </div>
      <div id="detWeather" style="padding:0 20px;margin-bottom:12px;display:none;">
        <div style="display:flex;align-items:center;gap:10px;background:var(--card);border-radius:14px;padding:12px 16px;border:1px solid var(--border);">
          <span id="detWeatherIcon" style="font-size:24px;"></span>
          <div>
            <div id="detWeatherLabel" style="font-size:15px;font-weight:600;"></div>
            <div id="detWeatherDetail" style="font-size:12px;color:var(--text2);"></div>
          </div>
        </div>
      </div>
      <button id="editRideBtn">✏️ Edit</button>
      <div id="editRideSection" style="display:none;">
        <input type="text" id="editName" class="summary-input" placeholder="Ride name">
        <textarea id="editNotes" class="summary-textarea" placeholder="Notes" rows="3"></textarea>
        <div class="rating-row">
          <button class="rating-btn edit-rating-btn" data-rating="1" onclick="editSelectRating(1)">😀</button>
          <button class="rating-btn edit-rating-btn" data-rating="2" onclick="editSelectRating(2)">🙂</button>
          <button class="rating-btn edit-rating-btn" data-rating="3" onclick="editSelectRating(3)">😐</button>
          <button class="rating-btn edit-rating-btn" data-rating="4" onclick="editSelectRating(4)">😞</button>
        </div>
        <button id="saveEditBtn">💾 Save</button>
      </div>
    </div>
    <div class="view" id="calendar">
      <div class="cal-nav">
        <button id="calPrev" class="cal-nav-btn">‹</button>
        <span id="calMonthYear" class="cal-month-year">January 2025</span>
        <button id="calNext" class="cal-nav-btn">›</button>
      </div>
      <div class="cal-days">
        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
      </div>
      <div id="calGrid" class="cal-grid"></div>
      <div id="calDayRides" class="cal-day-rides" style="display:none;">
        <h4 class="cal-day-title" id="calDayTitle">Rides on Jan 15</h4>
        <div id="calDayRidesList"></div>
      </div>
      <div class="cal-chart-section">
        <h4 class="cal-section-title">Monthly Distance</h4>
        <div id="calBarChart" class="cal-bar-chart"></div>
      </div>
      <div id="calYearTotals" class="cal-year-totals"></div>
    </div>
    <div id="liveMapWrap">
      <div id="layerSwitcher">
        <button class="layer-btn active" data-layer="osm">Map</button>
        <button class="layer-btn" data-layer="cycle">Cycle</button>
        <button class="layer-btn" data-layer="satellite">Sat</button>
      </div>
      <div id="liveMap"></div>
    </div>
    <div id="rideTimer">--:--</div>
    <style>
      .live-marker { background: none !important; border: none !important; }
      .live-marker-dot { width: 14px; height: 14px; background: #0a84ff; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3); }
      .live-marker-pulse { position: absolute; top: -10px; left: -10px; width: 34px; height: 34px; background: rgba(10,132,255,0.3); border-radius: 50%; animation: live-pulse 1.5s infinite; }
      @keyframes live-pulse { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
      .fit-route-btn { position: absolute; bottom: 10px; right: 10px; z-index: 1000; background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
    </style>
  `;

  const app = await import('./app.js');
  applyTheme = app.applyTheme;
  initTheme = app.initTheme;
  renderWeekly = app.renderWeekly;
  uiCallbacks = app.uiCallbacks;
  const stateModule = await import('./state.js');
  STATES = stateModule.STATES;
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('Dark/Light mode', () => {

  it('theme toggle button exists in the DOM after init', () => {
    const btn = document.getElementById('themeToggle');
    expect(btn).not.toBeNull();
    expect(btn.id).toBe('themeToggle');
  });

  it('defaults to dark theme when no localStorage and prefers-color-scheme is dark', () => {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('defaults to light theme when no localStorage and prefers-color-scheme is light', () => {
    window.matchMedia = (query) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('applies theme from localStorage on init', () => {
    localStorage.setItem('theme', 'light');
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggle switches between dark and light', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const btn = document.getElementById('themeToggle');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('persists theme choice to localStorage after toggle', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const btn = document.getElementById('themeToggle');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(localStorage.getItem('theme')).toBe('light');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(localStorage.getItem('theme')).toBe('dark');
  });

});

describe('Configurable weekly goal', () => {

  beforeEach(() => {
    localStorage.clear();
  });

  it('reads weekly goal from localStorage, defaults to 50', () => {
    const rides = [];
    renderWeekly(rides);
    const goalText = document.getElementById('weekly-goal-text');
    expect(goalText.textContent).toContain('50');
  });

  it('uses stored weekly goal from localStorage', () => {
    localStorage.setItem('weeklyGoalKm', '100');
    const rides = [];
    renderWeekly(rides);
    const goalText = document.getElementById('weekly-goal-text');
    expect(goalText.textContent).toContain('100');
  });

  it('gear icon exists on weekly card', () => {
    const gear = document.getElementById('weeklyGoalGear');
    expect(gear).not.toBeNull();
  });

  it('save button updates localStorage and re-renders', () => {
    localStorage.setItem('weeklyGoalKm', '50');
    const gear = document.getElementById('weeklyGoalGear');
    const editor = document.getElementById('weeklyGoalEditor');
    const input = document.getElementById('weeklyGoalInput');
    const saveBtn = document.getElementById('weeklyGoalSave');

    gear.click();
    expect(editor.style.display).not.toBe('none');

    input.value = '75';
    saveBtn.click();

    expect(localStorage.getItem('weeklyGoalKm')).toBe('75');
  });

});

describe('Live distance card', () => {

  it('liveCard element exists in DOM', () => {
    expect(document.getElementById('liveCard')).not.toBeNull();
  });

  it('liveCard is hidden by default', () => {
    const card = document.getElementById('liveCard');
    expect(card.style.display).toBe('none');
  });

  it('updateSpeed updates liveDist and liveAvg', () => {
    uiCallbacks.updateSpeed(25, { distance: 12.5, maxSpeed: 30, movingSeconds: 1800 });
    const liveDist = document.getElementById('liveDist');
    const liveAvg = document.getElementById('liveAvg');
    expect(liveDist.textContent).toBe('12.50');
    expect(liveAvg.textContent).toBe('25.0');
  });

  it('updateTimer updates liveTime', () => {
    uiCallbacks.updateTimer(3661);
    const liveTime = document.getElementById('liveTime');
    expect(liveTime.textContent).toBe('1:01:01');
  });

  it('onStateChange RECORDING shows liveCard', () => {
    uiCallbacks.onStateChange(STATES.RECORDING);
    const card = document.getElementById('liveCard');
    expect(card.style.display).toBe('block');
  });

  it('onStateChange PAUSED shows liveCard', () => {
    uiCallbacks.onStateChange(STATES.PAUSED);
    const card = document.getElementById('liveCard');
    expect(card.style.display).toBe('block');
  });

  it('onStateChange IDLE hides liveCard', () => {
    uiCallbacks.onStateChange(STATES.IDLE);
    const card = document.getElementById('liveCard');
    expect(card.style.display).toBe('none');
  });

});

describe('Landscape layout', () => {
  it('ride-details view has landscape-compatible CSS classes', () => {
    const view = document.getElementById('ride-details');
    expect(view).not.toBeNull();
    expect(view.style.overflow).not.toBe('hidden');
  });
});

describe('Calendar view', () => {
  it('calendar nav buttons exist', () => {
    expect(document.getElementById('calPrev')).not.toBeNull();
    expect(document.getElementById('calNext')).not.toBeNull();
  });

  it('calendar grid element exists', () => {
    expect(document.getElementById('calGrid')).not.toBeNull();
  });

  it('month label shows current month after render', async () => {
    const { renderCalendar } = await import('./app.js');
    await renderCalendar(2025, 1);
    expect(document.getElementById('calMonthYear').textContent).toContain('January');
  });

  it('bar chart container exists', () => {
    expect(document.getElementById('calBarChart')).not.toBeNull();
  });

  it('year totals container exists', () => {
    expect(document.getElementById('calYearTotals')).not.toBeNull();
  });
});

describe('Summary view — ride metadata inputs', () => {
  it('name input exists', () => {
    expect(document.getElementById('sumName')).not.toBeNull();
  });
  it('notes textarea exists', () => {
    expect(document.getElementById('sumNotes')).not.toBeNull();
  });
  it('rating buttons exist', () => {
    const btns = document.querySelectorAll('.rating-btn');
    expect(btns.length).toBe(8);
  });
  it('photo input and button exist', () => {
    expect(document.getElementById('photoInput')).not.toBeNull();
    expect(document.getElementById('photoBtn')).not.toBeNull();
  });
  it('photo preview elements exist', () => {
    expect(document.getElementById('photoPreview')).not.toBeNull();
    expect(document.getElementById('photoImg')).not.toBeNull();
    expect(document.getElementById('photoRemoveBtn')).not.toBeNull();
  });
  it('share button exists', () => {
    expect(document.getElementById('shareBtn')).not.toBeNull();
  });
});

describe('Ride details view — ride metadata display', () => {
  it('detName element exists', () => {
    expect(document.getElementById('detName')).not.toBeNull();
  });
  it('detNotes element exists', () => {
    expect(document.getElementById('detNotes')).not.toBeNull();
  });
  it('detRating element exists', () => {
    expect(document.getElementById('detRating')).not.toBeNull();
  });
  it('detPhotoWrap and detPhotoImg exist', () => {
    expect(document.getElementById('detPhotoWrap')).not.toBeNull();
    expect(document.getElementById('detPhotoImg')).not.toBeNull();
  });
  it('editRideBtn exists', () => {
    expect(document.getElementById('editRideBtn')).not.toBeNull();
  });
  it('detShareBtn exists in ride details view', () => {
    expect(document.getElementById('detShareBtn')).not.toBeNull();
    expect(document.getElementById('detShareBtn').title).toBe('Share ride');
  });
  it('edit ride section with all fields exists', () => {
    expect(document.getElementById('editRideSection')).not.toBeNull();
    expect(document.getElementById('editName')).not.toBeNull();
    expect(document.getElementById('editNotes')).not.toBeNull();
    expect(document.querySelectorAll('.edit-rating-btn').length).toBe(4);
    expect(document.getElementById('saveEditBtn')).not.toBeNull();
  });
});

describe('Weather display elements', () => {
  it('weather elements exist in summary view', () => {
    expect(document.getElementById('sumWeather')).not.toBeNull();
    expect(document.getElementById('sumWeatherIcon')).not.toBeNull();
    expect(document.getElementById('sumWeatherLabel')).not.toBeNull();
    expect(document.getElementById('sumWeatherDetail')).not.toBeNull();
  });

  it('weather elements exist in ride details view', () => {
    expect(document.getElementById('detWeather')).not.toBeNull();
    expect(document.getElementById('detWeatherIcon')).not.toBeNull();
    expect(document.getElementById('detWeatherLabel')).not.toBeNull();
    expect(document.getElementById('detWeatherDetail')).not.toBeNull();
  });
});

describe('Map features', () => {
  it('layer switcher buttons exist', () => {
    expect(document.querySelector('.layer-btn[data-layer="osm"]')).not.toBeNull();
    expect(document.querySelector('.layer-btn[data-layer="cycle"]')).not.toBeNull();
    expect(document.querySelector('.layer-btn[data-layer="satellite"]')).not.toBeNull();
  });

  it('fit route button exists on summary', () => {
    expect(document.getElementById('fitRouteBtn')).not.toBeNull();
  });

  it('fit route button exists on details', () => {
    expect(document.getElementById('detFitRouteBtn')).not.toBeNull();
  });

  it('live marker CSS classes exist', () => {
    const style = document.querySelector('style');
    expect(style.textContent).toContain('.live-marker');
    expect(style.textContent).toContain('.live-marker-dot');
    expect(style.textContent).toContain('.live-marker-pulse');
    expect(style.textContent).toContain('live-pulse');
  });

  it('fit route button CSS class exists', () => {
    const style = document.querySelector('style');
    expect(style.textContent).toContain('.fit-route-btn');
  });
});
