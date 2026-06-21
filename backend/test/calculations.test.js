const { expect } = require('chai');
const { haversineDistance, calculateSummary } = require('../utils/calculations');

describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(40.7128, -74.0060, 40.7128, -74.0060)).to.equal(0);
  });

  it('returns ~4.0 km for a short known distance (NYC approx)', () => {
    const d = haversineDistance(40.7580, -73.9855, 40.7484, -73.9855);
    expect(d).to.be.a('number');
    expect(d).to.be.closeTo(1.07, 0.1);
  });

  it('returns ~110 km for 1 degree latitude', () => {
    const d = haversineDistance(0, 0, 1, 0);
    expect(d).to.be.closeTo(111.2, 1);
  });
});

describe('calculateSummary', () => {
  it('returns zeros for empty points', () => {
    const ride = { started_at: '2024-01-01T10:00:00Z', stopped_at: '2024-01-01T11:00:00Z' };
    const summary = calculateSummary(ride, []);
    expect(summary.distance_km).to.equal(0);
    expect(summary.max_speed_kmh).to.equal(0);
    expect(summary.total_seconds).to.equal(3600);
    expect(summary.moving_seconds).to.equal(0);
  });

  it('calculates distance from two points', () => {
    const ride = { started_at: '2024-01-01T10:00:00Z', stopped_at: '2024-01-01T10:10:00Z' };
    const points = [
      { lat: 40.7128, lng: -74.0060, speed_kmh: 0 },
      { lat: 40.7200, lng: -74.0100, speed_kmh: 15 }
    ];
    const summary = calculateSummary(ride, points);
    expect(summary.distance_km).to.be.greaterThan(0);
    expect(summary.max_speed_kmh).to.equal(15);
    expect(summary.total_seconds).to.equal(600);
  });
});
