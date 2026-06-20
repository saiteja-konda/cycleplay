const API_BASE = '/api/rides';

export async function startRide() {
  const res = await fetch(`${API_BASE}/start`, { method: 'POST' });
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

export async function stopRide(ride_id, moving_seconds, pause_count) {
  const res = await fetch(`${API_BASE}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ride_id, moving_seconds, pause_count })
  });
  if (!res.ok) throw new Error('Failed to stop ride');
  return res.json();
}

export async function getRides() {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error('Failed to get rides');
  return res.json();
}

export async function getRide(id) {
  const res = await fetch(`${API_BASE}/${id}`);
  if (!res.ok) throw new Error('Failed to get ride');
  return res.json();
}

export async function deleteRide(id) {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete ride');
  return res.json();
}


