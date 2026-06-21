export class OfflineService {
  constructor() {
    this.db = null;
    this._dbReady = this._initDB();
    this.online = navigator.onLine;
    this.listeners = new Set();
  }

  _initDB() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined' || typeof indexedDB.open !== 'function') {
        resolve();
        return;
      }
      const request = indexedDB.open('CyclePlayDB', 3);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('apiCache')) {
          db.createObjectStore('apiCache', { keyPath: 'url' });
        }
      };
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };
      request.onerror = () => resolve();
    });
  }

  async cacheResponse(url, data) {
    await this._dbReady;
    if (!this.db) return;
    const tx = this.db.transaction('apiCache', 'readwrite');
    const store = tx.objectStore('apiCache');
    store.put({ url, data, timestamp: Date.now() });
  }

  async getCachedResponse(url) {
    await this._dbReady;
    if (!this.db) return null;
    const tx = this.db.transaction('apiCache', 'readonly');
    const store = tx.objectStore('apiCache');
    return new Promise((resolve) => {
      const req = store.get(url);
      req.onsuccess = () => {
        const result = req.result;
        if (result && (Date.now() - result.timestamp) < 5 * 60 * 1000) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  addOnlineListener(fn) {
    this.listeners.add(fn);
  }

  removeOnlineListener(fn) {
    this.listeners.delete(fn);
  }

  setOnlineStatus(online) {
    this.online = online;
    this.listeners.forEach(fn => fn(online));
  }
}
