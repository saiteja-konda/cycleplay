import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeAll(() => {
  global.indexedDB = {
    open: () => {
      const req = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        result: null,
      };
      setTimeout(() => {
        if (req.onupgradeneeded) {
          req.onupgradeneeded({ target: { result: createMockDb() } });
        }
        const db = createMockDb();
        req.result = db;
        if (req.onsuccess) {
          req.onsuccess({ target: { result: db } });
        }
      }, 0);
      return req;
    },
  };
});

function createMockDb() {
  const mockStore = new Map();
  return {
    objectStoreNames: { contains: (n) => n === 'apiCache' },
    createObjectStore: (name, opts) => mockStore,
    transaction: () => ({
      objectStore: () => ({
        put: (v) => { mockStore.set(v.url, v); },
        get: (key) => ({ result: mockStore.get(key) || null }),
      }),
    }),
  };
}

beforeEach(() => mockFetch.mockReset());

describe('api.js', () => {
  it('startRide calls POST /api/rides/start', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ride_id: 1 }) });
    const { startRide } = await import('./api.js');
    const result = await startRide();
    expect(mockFetch).toHaveBeenCalledWith('/api/rides/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    expect(result.ride_id).toBe(1);
  });

  it('startRide passes weather data in body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ride_id: 1 }) });
    const { startRide } = await import('./api.js');
    const result = await startRide({ weather_condition: 'Clear', weather_temp: 22, weather_wind: 12 });
    expect(mockFetch).toHaveBeenCalledWith('/api/rides/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weather_condition: 'Clear', weather_temp: 22, weather_wind: 12 })
    });
    expect(result.ride_id).toBe(1);
  });

  it('getRides calls GET /api/rides', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1 }] });
    const { getRides } = await import('./api.js');
    const result = await getRides();
    expect(mockFetch).toHaveBeenCalledWith('/api/rides');
    expect(result).toEqual([{ id: 1 }]);
  });

  it('getRide calls GET /api/rides/:id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ride: { id: 42 }, points: [] }) });
    const { getRide } = await import('./api.js');
    const result = await getRide(42);
    expect(mockFetch).toHaveBeenCalledWith('/api/rides/42');
    expect(result.ride.id).toBe(42);
  });

  it('getRideStats calls GET /api/rides/stats', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ monthly: [], yearly: [], totals: { distance_km: 0, ride_count: 0, moving_hours: 0 } }) });
    const { getRideStats } = await import('./api.js');
    const result = await getRideStats();
    expect(mockFetch).toHaveBeenCalledWith('/api/rides/stats');
    expect(result.totals.distance_km).toBe(0);
  });

  it('stopRide sends options object', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) });
    const { stopRide } = await import('./api.js');
    const result = await stopRide(1, 600, 2, { name: 'Test', notes: 'Notes', rating: 3, photo_url: 'data:image/png;base64,abc' });
    expect(mockFetch).toHaveBeenCalledWith('/api/rides/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ride_id: 1, moving_seconds: 600, pause_count: 2, name: 'Test', notes: 'Notes', rating: 3, photo_url: 'data:image/png;base64,abc' })
    });
    expect(result.id).toBe(1);
  });

  it('stopRide works without options', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) });
    const { stopRide } = await import('./api.js');
    const result = await stopRide(1, 600, 2);
    expect(mockFetch).toHaveBeenCalledWith('/api/rides/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ride_id: 1, moving_seconds: 600, pause_count: 2, name: undefined, notes: undefined, rating: undefined, photo_url: undefined })
    });
    expect(result.id).toBe(1);
  });

  it('updateRide calls PUT /api/rides/:id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, name: 'Updated' }) });
    const { updateRide } = await import('./api.js');
    const result = await updateRide(1, { name: 'Updated' });
    expect(mockFetch).toHaveBeenCalledWith('/api/rides/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' })
    });
    expect(result.name).toBe('Updated');
  });

  it('updateRide throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { updateRide } = await import('./api.js');
    await expect(updateRide(1, { name: 'x' })).rejects.toThrow('Failed to update ride');
  });
});
