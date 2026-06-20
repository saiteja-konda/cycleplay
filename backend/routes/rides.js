const express = require('express');
const router = express.Router();
const { dbRun, dbAll, dbGet } = require('../db/database');
const { calculateSummary } = require('../utils/calculations');

// POST /api/rides/start
router.post('/start', async (req, res) => {
  try {
    // Backend Lock: Prevent multiple active rides
    const activeRide = await dbGet(`SELECT id FROM rides WHERE status = 'active'`);
    if (activeRide) {
      return res.status(409).json({ error: 'You are already recording a ride somewhere else.' });
    }

    const { username } = req.body || {};
    const now = new Date().toISOString();
    const finalUsername = username || 'Guest';
    const result = await dbRun(
      `INSERT INTO rides (started_at, status, username) VALUES (?, 'active', ?)`,
      [now, finalUsername]
    );
    res.json({ ride_id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rides/active
router.get('/active', async (req, res) => {
  try {
    const activeRide = await dbGet(`SELECT * FROM rides WHERE status = 'active'`);
    if (!activeRide) {
      return res.json({ active: false });
    }
    const points = await dbAll(`SELECT * FROM gps_points WHERE ride_id = ? ORDER BY recorded_at ASC`, [activeRide.id]);
    const summary = calculateSummary(activeRide, points);
    
    res.json({ active: true, ride: activeRide, points, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rides/track
router.post('/track', async (req, res) => {
  const { ride_id, points } = req.body;
  if (!ride_id || !points || !Array.isArray(points)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    // Basic bulk insert logic
    for (const pt of points) {
      await dbRun(
        `INSERT INTO gps_points (ride_id, lat, lng, speed_kmh, recorded_at) VALUES (?, ?, ?, ?, ?)`,
        [ride_id, pt.lat, pt.lng, pt.speed_kmh || 0, pt.timestamp || new Date().toISOString()]
      );
    }
    res.json({ success: true, inserted: points.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rides/stop
router.post('/stop', async (req, res) => {
  const { ride_id, moving_seconds, pause_count } = req.body;
  
  try {
    const ride = await dbGet(`SELECT * FROM rides WHERE id = ?`, [ride_id]);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    const points = await dbAll(`SELECT * FROM gps_points WHERE ride_id = ? ORDER BY recorded_at ASC`, [ride_id]);
    
    ride.stopped_at = new Date().toISOString();
    
    const summary = calculateSummary(ride, points);
    
    // Override with frontend values if provided
    const finalMovingSecs = moving_seconds !== undefined ? moving_seconds : summary.moving_seconds;
    const finalAvgSpeed = finalMovingSecs > 0 ? summary.distance_km / (finalMovingSecs / 3600) : 0;
    const finalPauseCount = pause_count || 0;

    await dbRun(
      `UPDATE rides SET stopped_at = ?, total_seconds = ?, moving_seconds = ?, distance_km = ?, avg_speed_kmh = ?, max_speed_kmh = ?, pause_count = ?, status = 'complete' WHERE id = ?`,
      [
        ride.stopped_at, 
        summary.total_seconds, 
        finalMovingSecs, 
        summary.distance_km, 
        finalAvgSpeed, 
        summary.max_speed_kmh, 
        finalPauseCount, 
        ride_id
      ]
    );

    const updatedRide = await dbGet(`SELECT * FROM rides WHERE id = ?`, [ride_id]);
    res.json(updatedRide);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rides
router.get('/', async (req, res) => {
  try {
    const rides = await dbAll(`SELECT * FROM rides WHERE status = 'complete' ORDER BY started_at DESC LIMIT 50`);
    res.json(rides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rides/:id
router.get('/:id', async (req, res) => {
  try {
    const ride = await dbGet(`SELECT * FROM rides WHERE id = ?`, [req.params.id]);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    
    const points = await dbAll(`SELECT * FROM gps_points WHERE ride_id = ? ORDER BY recorded_at ASC`, [req.params.id]);
    res.json({ ride, points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rides/:id
router.delete('/:id', async (req, res) => {
  try {
    // Delete points first (if no cascade)
    await dbRun(`DELETE FROM gps_points WHERE ride_id = ?`, [req.params.id]);
    await dbRun(`DELETE FROM rides WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
