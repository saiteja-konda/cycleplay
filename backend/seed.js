const { dbRun, db } = require('./db/database');

async function seed() {
  console.log("Seeding database...");
  try {
    // Clear existing for a clean slate
    await dbRun(`DELETE FROM gps_points`);
    await dbRun(`DELETE FROM rides`);
    
    // Ride 1: Morning Commute today
    const now = new Date();
    const ride1Start = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
    const ride1Stop = new Date(ride1Start.getTime() + 45 * 60 * 1000); // 45 min later
    
    const res1 = await dbRun(
      `INSERT INTO rides (started_at, stopped_at, total_seconds, moving_seconds, distance_km, avg_speed_kmh, max_speed_kmh, pause_count, status, name, notes, rating, weather_condition, weather_temp, weather_wind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?, ?, ?, ?, ?)`,
      [ride1Start.toISOString(), ride1Stop.toISOString(), 45*60, 42*60, 15.4, 22.0, 35.1, 2, 'Morning Commute', 'Beautiful sunrise ride along the river.', 1, 'Clear', 18, 8]
    );
    console.log("Inserted ride 1");

    // Ride 2: Long weekend ride (2 days ago)
    const ride2Start = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); 
    const ride2Stop = new Date(ride2Start.getTime() + 120 * 60 * 1000); 
    
    const res2 = await dbRun(
      `INSERT INTO rides (started_at, stopped_at, total_seconds, moving_seconds, distance_km, avg_speed_kmh, max_speed_kmh, pause_count, status, name, notes, rating, weather_condition, weather_temp, weather_wind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?, ?, ?, ?, ?)`,
      [ride2Start.toISOString(), ride2Stop.toISOString(), 120*60, 115*60, 42.1, 21.9, 45.2, 1, 'Weekend Century', 'Long ride through the countryside. Had a picnic at the halfway point!', 2, 'Partly cloudy', 22, 12]
    );
    console.log("Inserted ride 2");

    // Ride 3: Evening sprint (1 day ago)
    const ride3Start = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); 
    const ride3Stop = new Date(ride3Start.getTime() + 25 * 60 * 1000); 
    
    const res3 = await dbRun(
      `INSERT INTO rides (started_at, stopped_at, total_seconds, moving_seconds, distance_km, avg_speed_kmh, max_speed_kmh, pause_count, status, name, notes, rating, weather_condition, weather_temp, weather_wind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?, ?, ?, ?, ?)`,
      [ride3Start.toISOString(), ride3Stop.toISOString(), 25*60, 24*60, 11.2, 28.0, 42.5, 0, 'Evening Sprint', 'Quick interval training session.', 3, 'Clear', 26, 5]
    );
    console.log("Inserted ride 3");

    console.log("Database seeded successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed", err);
    process.exit(1);
  }
}

// Give DB time to connect
setTimeout(seed, 500);
