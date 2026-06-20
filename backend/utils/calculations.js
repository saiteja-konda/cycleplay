// utils/calculations.js
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateSummary(ride, points) {
  let distance_km = 0;
  let max_speed_kmh = 0;
  
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.speed_kmh > max_speed_kmh) {
      max_speed_kmh = pt.speed_kmh;
    }
    
    if (i > 0) {
      const prev = points[i-1];
      distance_km += haversineDistance(prev.lat, prev.lng, pt.lat, pt.lng);
    }
  }

  const startedAt = new Date(ride.started_at);
  const stoppedAt = ride.stopped_at ? new Date(ride.stopped_at) : new Date();
  
  const total_seconds = Math.floor((stoppedAt.getTime() - startedAt.getTime()) / 1000);
  
  // Simple estimation of moving_seconds based on points with speed > 1
  const movingPoints = points.filter(p => p.speed_kmh > 1);
  const moving_seconds = movingPoints.length > 0 ? (movingPoints.length * 5) : 0; 
  
  const avg_speed_kmh = moving_seconds > 0 ? distance_km / (moving_seconds / 3600) : 0;

  return {
    distance_km,
    total_seconds,
    moving_seconds,
    max_speed_kmh,
    avg_speed_kmh
  };
}

module.exports = { haversineDistance, calculateSummary };
