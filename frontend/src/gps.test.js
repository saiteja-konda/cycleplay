import { describe, it, expect, jest, beforeAll } from '@jest/globals';

describe('GPS accuracy', () => {
  beforeAll(() => {
    global.navigator.geolocation = {
      watchPosition: jest.fn((success) => {
        success({
          coords: {
            latitude: 51.5,
            longitude: -0.09,
            speed: 5,
            accuracy: 10
          },
          timestamp: Date.now()
        });
        return 123;
      }),
      clearWatch: jest.fn()
    };
  });

  it('onPoint receives accuracy field', async () => {
    const { GPSManager } = await import('./gps.js');
    const onPointMock = jest.fn();
    const gps = new GPSManager(onPointMock);
    gps.start();
    expect(onPointMock).toHaveBeenCalled();
    const point = onPointMock.mock.calls[0][0];
    expect(point).toHaveProperty('accuracy');
    expect(point.accuracy).toBe(10);
    gps.stop();
  });

  it('point includes lat, lng, speed_kmh, timestamp', async () => {
    const { GPSManager } = await import('./gps.js');
    const onPointMock = jest.fn();
    const gps = new GPSManager(onPointMock);
    gps.start();
    const point = onPointMock.mock.calls[0][0];
    expect(point).toHaveProperty('lat', 51.5);
    expect(point).toHaveProperty('lng', -0.09);
    expect(point).toHaveProperty('speed_kmh', 18);
    expect(point).toHaveProperty('timestamp');
    gps.stop();
  });
});
