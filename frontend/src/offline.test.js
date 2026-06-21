import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

let dbStore;

beforeAll(() => {
  dbStore = new Map();

  const mockObjectStore = {
    put: (value) => {
      dbStore.set(value.url, value);
    },
    get: (key) => {
      const value = dbStore.get(key) || null;
      const req = { result: value };
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    },
  };

  let storeExists = false;

  const mockDb = {
    objectStoreNames: {
      contains: () => storeExists,
    },
    createObjectStore: (name, opts) => {
      storeExists = true;
      dbStore = new Map();
      return mockObjectStore;
    },
    transaction: () => ({
      objectStore: () => mockObjectStore,
    }),
  };

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
          req.onupgradeneeded({ target: { result: mockDb } });
        }
        req.result = mockDb;
        if (req.onsuccess) {
          req.onsuccess({ target: { result: mockDb } });
        }
      }, 0);
      return req;
    },
  };
});

beforeEach(() => {
  dbStore.clear();
});

describe('OfflineService', () => {
  it('cacheResponse stores data', async () => {
    const { OfflineService } = await import('./offline.js');
    const service = new OfflineService();
    await service.cacheResponse('/api/rides', [{ id: 1 }]);
    expect(dbStore.has('/api/rides')).toBe(true);
    expect(dbStore.get('/api/rides').data).toEqual([{ id: 1 }]);
  });

  it('getCachedResponse returns cached data within TTL', async () => {
    const { OfflineService } = await import('./offline.js');
    const service = new OfflineService();
    await service.cacheResponse('/api/rides/1', { ride: { id: 1 }, points: [] });
    const result = await service.getCachedResponse('/api/rides/1');
    expect(result).toEqual({ ride: { id: 1 }, points: [] });
  });

  it('getCachedResponse returns null for expired data', async () => {
    const { OfflineService } = await import('./offline.js');
    const service = new OfflineService();
    await service.cacheResponse('/api/rides/stats', { totals: { distance_km: 100 } });

    const entry = dbStore.get('/api/rides/stats');
    entry.timestamp = Date.now() - 6 * 60 * 1000;
    dbStore.set('/api/rides/stats', entry);

    const result = await service.getCachedResponse('/api/rides/stats');
    expect(result).toBeNull();
  });

  it('getCachedResponse returns null for missing data', async () => {
    const { OfflineService } = await import('./offline.js');
    const service = new OfflineService();
    const result = await service.getCachedResponse('/api/rides/nonexistent');
    expect(result).toBeNull();
  });

  it('setOnlineStatus notifies listeners', async () => {
    const { OfflineService } = await import('./offline.js');
    const service = new OfflineService();
    const listener = jest.fn();
    service.addOnlineListener(listener);
    service.setOnlineStatus(false);
    expect(listener).toHaveBeenCalledWith(false);
    service.setOnlineStatus(true);
    expect(listener).toHaveBeenCalledWith(true);
  });

  it('removeOnlineListener stops notifications', async () => {
    const { OfflineService } = await import('./offline.js');
    const service = new OfflineService();
    const listener = jest.fn();
    service.addOnlineListener(listener);
    service.removeOnlineListener(listener);
    service.setOnlineStatus(false);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('Offline banner', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="offlineBanner" class="offline-banner" style="display:none;">📡 You're offline — showing cached data</div>
    `;
  });

  it('offline banner element exists', () => {
    expect(document.getElementById('offlineBanner')).not.toBeNull();
  });

  it('offline banner is hidden by default', () => {
    const banner = document.getElementById('offlineBanner');
    expect(banner.style.display).toBe('none');
  });
});
