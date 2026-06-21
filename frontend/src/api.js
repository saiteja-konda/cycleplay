const API_BASE = '/api/rides';

export async function startRide(weatherData = {}) {
  const res = await fetch(`${API_BASE}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(weatherData)
  });
  if (res.status === 409) throw new Error('ALREADY_ACTIVE');
  if (!res.ok) throw new Error('Failed to start ride');
  return res.json();
}

export async function getActiveRide() {
  const res = await fetch(`${API_BASE}/active`);
  if (!res.ok) return { active: false };
  return res.json();
}

export async function trackPoints(ride_id, points) {
  const res = await fetch(`${API_BASE}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ride_id, points })
  });
  if (!res.ok) throw new Error('Failed to track points');
  return res.json();
}

export async function stopRide(ride_id, moving_seconds, pause_count, options = {}) {
  const { name, notes, rating, photo_url, weather_condition, weather_temp, weather_wind } = options;
  const res = await fetch(`${API_BASE}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ride_id, moving_seconds, pause_count, name, notes, rating, photo_url, weather_condition, weather_temp, weather_wind })
  });
  if (!res.ok) throw new Error('Failed to stop ride');
  return res.json();
}

export async function getRides() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('Failed to get rides');
    const data = await res.json();
    try {
      const { OfflineService } = await import('./offline.js');
      const offline = new OfflineService();
      offline.cacheResponse(API_BASE, data).catch(() => {});
    } catch (e) {}
    return data;
  } catch (err) {
    try {
      const { OfflineService } = await import('./offline.js');
      const offline = new OfflineService();
      const cached = await offline.getCachedResponse(API_BASE);
      if (cached) return cached;
    } catch (e) {}
    throw err;
  }
}

export async function getRide(id) {
  const url = `${API_BASE}/${id}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to get ride');
    const data = await res.json();
    try {
      const { OfflineService } = await import('./offline.js');
      const offline = new OfflineService();
      offline.cacheResponse(url, data).catch(() => {});
    } catch (e) {}
    return data;
  } catch (err) {
    try {
      const { OfflineService } = await import('./offline.js');
      const offline = new OfflineService();
      const cached = await offline.getCachedResponse(url);
      if (cached) return cached;
    } catch (e) {}
    throw err;
  }
}

export async function getRideStats() {
  const url = `${API_BASE}/stats`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to get stats');
    const data = await res.json();
    try {
      const { OfflineService } = await import('./offline.js');
      const offline = new OfflineService();
      offline.cacheResponse(url, data).catch(() => {});
    } catch (e) {}
    return data;
  } catch (err) {
    try {
      const { OfflineService } = await import('./offline.js');
      const offline = new OfflineService();
      const cached = await offline.getCachedResponse(url);
      if (cached) return cached;
    } catch (e) {}
    throw err;
  }
}

export async function deleteRide(id) {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete ride');
  return res.json();
}

export async function updateRide(id, data) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update ride');
  return res.json();
}


