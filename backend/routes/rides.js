const express = require('express');
const router = express.Router();
const { dbRun, dbAll, dbGet } = require('../db/database');
const { calculateSummary } = require('../utils/calculations');

// Log request body for mutations and response for errors
router.use((req, res, next) => {
  if (req.method !== 'GET') {
    console.log(`[${req.method} ${req.originalUrl}] body:`, JSON.stringify(req.body));
  }
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 400) {
      console.log(`[${req.method} ${req.originalUrl}] → ${res.statusCode}:`, JSON.stringify(body));
    }
    return originalJson(body);
  };
  next();
});

// POST /api/rides/start
router.post('/start', async (req, res) => {
  try {
    // Backend Lock: Prevent multiple active rides
    const activeRide = await dbGet(`SELECT id FROM rides WHERE status = 'active'`);
    if (activeRide) {
      return res.status(409).json({ error: 'You are already recording a ride somewhere else.' });
    }

    const { username, weather_condition, weather_temp, weather_wind } = req.body || {};
    const now = new Date().toISOString();
    const finalUsername = username || 'Guest';
    const result = await dbRun(
      `INSERT INTO rides (started_at, status, username, weather_condition, weather_temp, weather_wind) VALUES (?, 'active', ?, ?, ?, ?)`,
      [now, finalUsername, weather_condition || null, weather_temp || null, weather_wind || null]
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
    // Validate ride exists before accepting points
    const ride = await dbGet(`SELECT id FROM rides WHERE id = ?`, [ride_id]);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

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
  const { ride_id, moving_seconds, pause_count, name, notes, rating, photo_url, weather_condition, weather_temp, weather_wind } = req.body;
  
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
      `UPDATE rides SET stopped_at = ?, total_seconds = ?, moving_seconds = ?, distance_km = ?, avg_speed_kmh = ?, max_speed_kmh = ?, pause_count = ?, name = ?, notes = ?, rating = ?, photo_url = ?, weather_condition = ?, weather_temp = ?, weather_wind = ?, status = 'complete' WHERE id = ?`,
      [
        ride.stopped_at, 
        summary.total_seconds, 
        finalMovingSecs, 
        summary.distance_km, 
        finalAvgSpeed, 
        summary.max_speed_kmh, 
        finalPauseCount,
        name || null,
        notes || null,
        rating || null,
        photo_url || null,
        weather_condition !== undefined ? weather_condition : ride.weather_condition,
        weather_temp !== undefined ? weather_temp : ride.weather_temp,
        weather_wind !== undefined ? weather_wind : ride.weather_wind,
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

// GET /api/rides/stats
router.get('/stats', async (req, res) => {
  try {
    const monthly = await dbAll(`
      SELECT
        CAST(strftime('%Y', started_at) AS INTEGER) as year,
        CAST(strftime('%m', started_at) AS INTEGER) as month,
        SUM(distance_km) as distance_km,
        COUNT(*) as ride_count,
        SUM(CAST(moving_seconds AS REAL) / 3600.0) as moving_hours
      FROM rides
      WHERE status = 'complete'
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `);

    const yearly = await dbAll(`
      SELECT
        CAST(strftime('%Y', started_at) AS INTEGER) as year,
        SUM(distance_km) as distance_km,
        COUNT(*) as ride_count,
        SUM(CAST(moving_seconds AS REAL) / 3600.0) as moving_hours
      FROM rides
      WHERE status = 'complete'
      GROUP BY year
      ORDER BY year DESC
    `);

    const totals = await dbGet(`
      SELECT
        SUM(distance_km) as distance_km,
        COUNT(*) as ride_count,
        SUM(CAST(moving_seconds AS REAL) / 3600.0) as moving_hours
      FROM rides
      WHERE status = 'complete'
    `);

    res.json({
      monthly,
      yearly,
      totals: {
        distance_km: totals.distance_km || 0,
        ride_count: totals.ride_count || 0,
        moving_hours: totals.moving_hours || 0
      }
    });
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

// PUT /api/rides/:id — update ride metadata (name, notes, rating)
router.put('/:id', async (req, res) => {
  const { name, notes, rating } = req.body;
  
  if (name === undefined && notes === undefined && rating === undefined) {
    return res.status(400).json({ error: 'At least one field (name, notes, rating) must be provided' });
  }

  try {
    const ride = await dbGet(`SELECT * FROM rides WHERE id = ?`, [req.params.id]);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
    if (rating !== undefined) { fields.push('rating = ?'); values.push(rating); }

    values.push(req.params.id);
    await dbRun(`UPDATE rides SET ${fields.join(', ')} WHERE id = ?`, values);

    const updatedRide = await dbGet(`SELECT * FROM rides WHERE id = ?`, [req.params.id]);
    res.json(updatedRide);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
