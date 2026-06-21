import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Service Worker', () => {
  const swContent = fs.readFileSync(path.resolve(process.cwd(), 'service-worker.js'), 'utf8');

  it('cache name is cycleplay-v14', () => {
    expect(swContent).toContain('cycleplay-v14');
  });

  it('has stale-while-revalidate pattern for static assets', () => {
    expect(swContent).toContain('staleWhileRevalidate');
  });

  it('has network-first for API', () => {
    expect(swContent).toContain('networkFirstWithCacheFallback');
  });

  it('includes new modules in ASSETS', () => {
    expect(swContent).toContain('/src/weather.js');
    expect(swContent).toContain('/src/offline.js');
    expect(swContent).toContain('/src/voice.js');
    expect(swContent).toContain('/src/audio.js');
  });

  it('handles background sync event', () => {
    expect(swContent).toContain("'sync'");
    expect(swContent).toContain('sync-rides');
  });
});
