import { describe, it, expect, jest } from '@jest/globals';

describe('Weather module', () => {
  it('fetchWeather calls Open-Meteo API', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ current: { weather_code: 0, temperature_2m: 22, wind_speed_10m: 12 } })
    });
    const { fetchWeather } = await import('./weather.js');
    const result = await fetchWeather(40.71, -74.01);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.open-meteo.com')
    );
    expect(result.condition).toBe('Clear');
    expect(result.temp).toBe(22);
    expect(result.wind).toBe(12);
  });

  it('getWeatherEmoji returns correct emoji', async () => {
    const { getWeatherEmoji } = await import('./weather.js');
    expect(getWeatherEmoji('Clear')).toBe('☀️');
    expect(getWeatherEmoji('Rain')).toBe('🌧️');
    expect(getWeatherEmoji('Unknown')).toBe('🌡️');
  });

  it('fetchWeather throws on network error', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));
    const { fetchWeather } = await import('./weather.js');
    await expect(fetchWeather(40.71, -74.01)).rejects.toThrow('Network error');
  });

  it('fetchWeather throws on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false });
    const { fetchWeather } = await import('./weather.js');
    await expect(fetchWeather(40.71, -74.01)).rejects.toThrow('Weather fetch failed');
  });

  it('getWeatherEmoji always returns a string for any input', async () => {
    const { getWeatherEmoji } = await import('./weather.js');
    expect(getWeatherEmoji('Foggy')).toBe('🌫️');
    expect(getWeatherEmoji('Snow')).toBe('❄️');
    expect(getWeatherEmoji('Thunderstorm')).toBe('⛈️');
    expect(getWeatherEmoji('Nonexistent')).toBe('🌡️');
    expect(getWeatherEmoji('')).toBe('🌡️');
  });
});
