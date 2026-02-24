// weather-api.ts — Open-Meteo geocoding and forecast client

import type { WeatherLocationConfig, GeocodingResult, DailyForecast, AirQuality, LocationWeather } from "./types.js";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const REQUEST_TIMEOUT = 5000;

const DAILY_FIELDS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "weather_code",
  "precipitation_probability_max",
].join(",");


const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "晴", 1: "大部晴朗", 2: "局部多云", 3: "阴天",
  45: "雾", 48: "雾凇",
  51: "小毛毛雨", 53: "中毛毛雨", 55: "大毛毛雨",
  56: "冻毛毛雨", 57: "浓冻毛毛雨",
  61: "小雨", 63: "中雨", 65: "大雨",
  66: "小冻雨", 67: "大冻雨",
  71: "小雪", 73: "中雪", 75: "大雪", 77: "雪粒",
  80: "小阵雨", 81: "中阵雨", 82: "强阵雨",
  85: "小阵雪", 86: "大阵雪",
  95: "雷暴", 96: "雷暴伴小冰雹", 99: "雷暴伴大冰雹",
};

function weatherDescription(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? "未知";
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

type GeocodingResponse = {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    timezone: string;
  }>;
};

async function geocode(city: string): Promise<GeocodingResult> {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=zh`;
  const data = await fetchJson<GeocodingResponse>(url);
  if (!data.results || data.results.length === 0) {
    throw new Error(`无法解析城市: ${city}`);
  }
  const r = data.results[0]!;
  return {
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country,
    timezone: r.timezone,
  };
}

type ForecastResponse = {
  timezone: string;
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_probability_max: number[];
  };
};

function parseDailyForecast(daily: ForecastResponse["daily"]): DailyForecast {
  return {
    date: daily.time[0]!,
    tempMax: daily.temperature_2m_max[0]!,
    tempMin: daily.temperature_2m_min[0]!,
    weatherCode: daily.weather_code[0]!,
    weatherDesc: weatherDescription(daily.weather_code[0]!),
    precipProbability: daily.precipitation_probability_max[0]!,
  };
}

async function fetchForecast(lat: number, lon: number): Promise<ForecastResponse> {
  const url = `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&daily=${DAILY_FIELDS}&timezone=auto&forecast_days=1`;
  return fetchJson<ForecastResponse>(url);
}

type AirQualityResponse = {
  current: {
    european_aqi: number;
    pm2_5: number;
    pm10: number;
  };
};

async function fetchAirQuality(lat: number, lon: number): Promise<AirQuality> {
  const url = `${AIR_QUALITY_URL}?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10`;
  const data = await fetchJson<AirQualityResponse>(url);
  return {
    aqi: data.current.european_aqi,
    pm25: data.current.pm2_5,
    pm10: data.current.pm10,
  };
}

export async function fetchLocationWeather(loc: WeatherLocationConfig): Promise<LocationWeather> {
  let lat: number;
  let lon: number;
  let name: string;
  let country = "";
  let timezone = "";

  if (loc.lat != null && loc.lon != null) {
    lat = loc.lat;
    lon = loc.lon;
    name = loc.name ?? `${lat},${lon}`;
  } else if (loc.city) {
    const geo = await geocode(loc.city);
    lat = geo.latitude;
    lon = geo.longitude;
    name = loc.name ?? geo.name;
    country = geo.country;
    timezone = geo.timezone;
  } else {
    throw new Error("天气地点配置无效: 需要 city 或 lat/lon");
  }

  const [forecast, airQuality] = await Promise.all([
    fetchForecast(lat, lon),
    fetchAirQuality(lat, lon).catch(() => undefined),
  ]);
  if (!timezone) timezone = forecast.timezone;
  return {
    name,
    country,
    timezone,
    forecast: parseDailyForecast(forecast.daily),
    airQuality,
  };
}

export async function fetchAllWeather(locations: WeatherLocationConfig[]): Promise<LocationWeather[]> {
  const results = await Promise.all(locations.map(fetchLocationWeather));
  return results;
}