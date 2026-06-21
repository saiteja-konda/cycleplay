import { trackPoints, stopRide } from './api.js';

export class SyncService {
  constructor() {
    this.db = null;
    this.syncInterval = null;
    this.rideId = null;
    this._dbReady = this._initDB();
    this._onlineHandler = () => this._syncPoints();
    this._syncing = false;
    window.addEventListener('online', this._onlineHandler);
  }

  _initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CyclePlayDB', 2);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Drop old store if it exists (no keyPath=id auto previously), recreate clean
        if (db.objectStoreNames.contains('points')) {
          db.deleteObjectStore('points');
        }
        db.createObjectStore('points', { keyPath: 'id', autoIncrement: true });
      };
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };
      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  setRideId(id) {
    this.rideId = id;
  }

  addPoint(point) {
    if (!this.db) return;
    const tx = this.db.transaction('points', 'readwrite');
    const store = tx.objectStore('points');
    store.add(point);
  }

  startSync() {
    // Sync every 15 seconds
    this.syncInterval = setInterval(() => this._syncPoints(), 15000);
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    window.removeEventListener('online', this._onlineHandler);
  }

  async retryPending() {
    await this._dbReady;
    return this._syncPoints();
  }

  async cacheStopRequest(rideId, data) {
    await this._dbReady;
    if (!this.db) return;
    const tx = this.db.transaction('points', 'readwrite');
    const store = tx.objectStore('points');
    store.add({ type: 'stop', rideId, data, timestamp: Date.now() });
  }

  // Public: await this before stopRide API call
  async flush() {
    await this._dbReady;
    return this._syncPoints();
  }

  _getAllPoints() {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);
      const tx = this.db.transaction('points', 'readonly');
      const store = tx.objectStore('points');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  _deletePoints(ids) {
    return new Promise((resolve, reject) => {
      if (!this.db || ids.length === 0) return resolve();
      const tx = this.db.transaction('points', 'readwrite');
      const store = tx.objectStore('points');
      ids.forEach(id => store.delete(id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async _syncPoints() {
    if (!this.db || this._syncing) return;
    this._syncing = true;

    try {
      const entries = await this._getAllPoints();
      if (entries.length === 0) return;

      const stopEntries = entries.filter(e => e.type === 'stop');
      const pointEntries = entries.filter(e => e.type !== 'stop');

      if (stopEntries.length > 0) {
        try {
          for (const entry of stopEntries) {
            await stopRide(entry.rideId, entry.data.moving_seconds, entry.data.pause_count, entry.data.options || {});
          }
          await this._deletePoints(stopEntries.map(e => e.id));
        } catch (err) {
          console.warn('Stop sync failed, kept for retry:', err.message);
        }
      }

      if (!this.rideId || pointEntries.length === 0) return;

      try {
        await trackPoints(this.rideId, pointEntries);
        await this._deletePoints(pointEntries.map(p => p.id));
      } catch (err) {
        console.warn('Sync failed (' + err.message + '), ' + pointEntries.length + ' points kept for retry');
      }
    } finally {
      this._syncing = false;
    }
  }
}
