export class GPSManager {
  constructor(onPoint) {
    this.onPoint = onPoint;
    this.watchId = null;
  }

  start() {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by your browser');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed } = position.coords;
        // speed is in m/s, convert to km/h. If null, default to 0.
        const speed_kmh = speed ? (speed * 3.6) : 0;
        
        this.onPoint({
          lat: latitude,
          lng: longitude,
          speed_kmh,
          timestamp: new Date(position.timestamp).toISOString()
        });
      },
      (error) => {
        console.error('GPS error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}
