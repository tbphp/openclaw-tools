// types.ts — Shared type definitions for daily-summary plugin


export type WeatherLocationConfig = {
  city?: string;
  lat?: number;
  lon?: number;
  name?: string;
};

export type PluginConfig = {
  weather: {
    locations: WeatherLocationConfig[];
  };
  fx: {
    pairs: string[];
  };
};


export type GeocodingResult = {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  timezone: string;
};

export type DailyForecast = {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  weatherDesc: string;
  precipProbability: number;
};

export type AirQuality = {
  aqi: number;
  pm25: number;
  pm10: number;
};

export type LocationWeather = {
  name: string;
  country: string;
  timezone: string;
  forecast: DailyForecast;
  airQuality?: AirQuality;
};


export type FXPairRate = {
  base: string;
  quote: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
};

export type FXSummary = {
  currentDate: string;
  previousDate: string;
  pairs: FXPairRate[];
};


export type DailySummaryResult = {
  generatedAt: string;
  weather: LocationWeather[];
  fx: FXSummary;
  errors: string[];
};
