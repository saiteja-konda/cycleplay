const WMO_CODE_MAP = {
  0: 'Clear', 1: 'Clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Foggy',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Rain',
  71: 'Snow', 73: 'Snow', 75: 'Snow',
  80: 'Rain', 81: 'Rain', 82: 'Rain',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm'
};

export function getWeatherEmoji(condition) {
  const map = {
    'Clear': '<i data-lucide="sun"></i>', 'Partly cloudy': '<i data-lucide="cloud-sun"></i>', 'Overcast': '<i data-lucide="cloud"></i>',
    'Foggy': '<i data-lucide="cloud-fog"></i>', 'Drizzle': '<i data-lucide="cloud-drizzle"></i>', 'Rain': '<i data-lucide="cloud-rain"></i>',
    'Snow': '<i data-lucide="snowflake"></i>', 'Thunderstorm': '<i data-lucide="cloud-lightning"></i>', 'Unknown': '<i data-lucide="thermometer"></i>'
  };
  return map[condition] || '<i data-lucide="thermometer"></i>';
}

export async function fetchWeather(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();
  const current = data.current;
  return {
    condition: WMO_CODE_MAP[current.weather_code] || 'Unknown',
    temp: current.temperature_2m,
    wind: current.wind_speed_10m,
    weather_code: current.weather_code
  };
}
