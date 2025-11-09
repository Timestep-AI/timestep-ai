// Weather tool implementation for TypeScript backend
// Matches Python weather.py implementation

import type { WidgetRoot } from '../_shared/chatkit/widgets.ts';
import { renderWeatherWidget, weatherWidgetCopyText, type WeatherWidgetData } from './sample_widget.ts';

const USER_AGENT = "ChatKitWeatherTool/1.0 (+https://openai.com/)";
const DEBUG_PREFIX = "[WeatherDebug]";
const GEOCODE_URL = "https://nominatim.openstreetmap.org/search";
const OPEN_METEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const CURRENT_FIELDS = "temperature_2m,apparent_temperature,relative_humidity_2m,is_day,wind_speed_10m,wind_direction_10m,weather_code";
const HOURLY_FIELDS = "temperature_2m,weather_code";
const DAILY_FIELDS = "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max";
const DEFAULT_TIMEOUT = 20000;
const HOURLY_SEGMENTS = 6;

export class WeatherLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeatherLookupError";
  }
}

interface GeocodedLocation {
  latitude: number;
  longitude: number;
  label: string;
  raw: Record<string, any>;
}

const WEATHER_CODE_LOOKUP: Map<number, [string, string]> = new Map();

const DEFAULT_ICON_KEY = "cloud";

function registerWeatherCodes(codes: number[], label: string, icon: string): void {
  for (const code of codes) {
    WEATHER_CODE_LOOKUP.set(code, [label, icon]);
  }
}

registerWeatherCodes([0], "Clear sky", "sun");
registerWeatherCodes([1], "Mostly sunny", "cloud-sun");
registerWeatherCodes([2], "Partly cloudy", "cloud-sun");
registerWeatherCodes([3], "Overcast", "cloud");
registerWeatherCodes([45, 48], "Foggy", "cloud-fog");
registerWeatherCodes([51, 53, 55, 56, 57], "Light drizzle", "cloud-drizzle");
registerWeatherCodes([61, 63, 65], "Rain", "cloud-rain");
registerWeatherCodes([66, 67], "Icy rain", "cloud-rain");
registerWeatherCodes([71, 73, 75, 77], "Snow", "cloud-snow");
registerWeatherCodes([80, 81, 82], "Rain showers", "cloud-rain");
registerWeatherCodes([85, 86], "Snow showers", "cloud-snow");
registerWeatherCodes([95, 96, 99], "Thunderstorm", "cloud-lightning");

export function normalizeUnit(value: string | null | undefined): "celsius" | "fahrenheit" {
  if (!value) {
    return "fahrenheit";
  }

  const normalized = value.trim().toLowerCase();
  if (["c", "cel", "celsius", "metric", "°c"].includes(normalized)) {
    return "celsius";
  }
  if (["f", "fahr", "fahrenheit", "imperial", "°f"].includes(normalized)) {
    return "fahrenheit";
  }
  throw new WeatherLookupError("Units must be either 'celsius' or 'fahrenheit'.");
}

export async function retrieveWeather(
  query: string,
  unit: string | null | undefined
): Promise<WeatherWidgetData> {
  const locationQuery = query.trim();
  console.log(`${DEBUG_PREFIX} retrieve_weather invoked`, { query: locationQuery, unit });
  if (!locationQuery) {
    throw new WeatherLookupError("Please provide a city, address, or landmark to look up.");
  }

  const normalizedUnit = normalizeUnit(unit);

  let geocoded: GeocodedLocation | null = null;
  let forecast: Record<string, any> | null = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      geocoded = await geocodeLocation(locationQuery, controller.signal);
      console.log(`${DEBUG_PREFIX} geocode lookup succeeded`, {
        label: geocoded.label,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
      });
      console.log(`${DEBUG_PREFIX} requesting forecast`, { unit: normalizedUnit });
      forecast = await fetchWeatherForecast(geocoded, normalizedUnit, controller.signal);
      const forecastKeys = forecast ? Object.keys(forecast).sort() : "unexpected";
      const hasCurrent = forecast?.current ? true : false;
      console.log(`${DEBUG_PREFIX} forecast received`, {
        keys: forecastKeys,
        has_current: hasCurrent,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    // Match Python: catch HTTPStatusError and RequestError separately
    if (error instanceof WeatherLookupError) {
      throw error;
    }
    if (error.name === "AbortError") {
      // Timeout error - treat as request error
      console.log(`${DEBUG_PREFIX} request error during weather lookup`, {
        error: String(error),
        query: locationQuery,
      });
      throw new WeatherLookupError("Unable to contact the weather service at the moment.");
    }
    // Check if it's an HTTP error (response exists but not ok)
    if (error.response || (typeof error === 'object' && 'status' in error)) {
      console.log(`${DEBUG_PREFIX} http status error during weather lookup`, {
        status_code: error.response?.status || error.status,
        query: locationQuery,
      });
      throw new WeatherLookupError("The weather service returned an error response.");
    }
    // Otherwise it's a request error (network failure, etc.)
    console.log(`${DEBUG_PREFIX} request error during weather lookup`, {
      error: String(error),
      query: locationQuery,
    });
    throw new WeatherLookupError("Unable to contact the weather service at the moment.");
  }

  if (!geocoded || !forecast) {
    console.log(`${DEBUG_PREFIX} weather lookup completed without data`, {
      geocoded: !!geocoded,
      forecast: !!forecast,
    });
    throw new WeatherLookupError("Weather data is currently unavailable for that location.");
  }

  try {
    console.log(`${DEBUG_PREFIX} building widget data`, {
      location: geocoded.label,
      unit: normalizedUnit,
    });
    const widgetData = buildWidgetData(geocoded, forecast, normalizedUnit);
    if (widgetData.temperature === null || widgetData.temperature === undefined) {
      console.log(`${DEBUG_PREFIX} weather data missing temperature`, {
        location: geocoded.label,
      });
      throw new WeatherLookupError("Weather data is currently unavailable for that location.");
    }

    console.log(`${DEBUG_PREFIX} weather data ready`, {
      location: widgetData.location,
      temperature: widgetData.temperature,
      unit: widgetData.temperature_unit,
    });

    return widgetData;
  } catch (error: any) {
    console.error(`${DEBUG_PREFIX} failed to build widget data`, {
      location: geocoded.label,
      error: String(error),
    });
    if (error instanceof WeatherLookupError) {
      throw error;
    }
    throw new WeatherLookupError("Weather data is currently unavailable for that location.");
  }
}

async function geocodeLocation(
  query: string,
  signal?: AbortSignal
): Promise<GeocodedLocation> {
  const providers: Array<[string, (q: string, s?: AbortSignal) => Promise<GeocodedLocation>]> = [
    ["nominatim", geocodeWithNominatim],
    ["open-meteo", geocodeWithOpenMeteo],
  ];
  let lastError: WeatherLookupError | null = null;

  for (const [providerName, provider] of providers) {
    try {
      const location = await provider(query, signal);
      return location;
    } catch (error: any) {
      // Match Python: catch HTTPStatusError (response.ok === false) separately
      if (error instanceof WeatherLookupError && error.message === "The geocoding service returned an error response.") {
        // This is an HTTP status error - rethrow it as-is
        lastError = error;
      } else if (error instanceof WeatherLookupError) {
        // This is a WeatherLookupError from the provider (e.g., no results found)
        console.log(`${DEBUG_PREFIX} geocode provider failed`, {
          provider: providerName,
          reason: String(error),
        });
        lastError = error;
      } else {
        // This is a network/request error (fetch failed, timeout, etc.)
        console.log(`${DEBUG_PREFIX} geocode provider request error`, {
          provider: providerName,
          error: String(error),
        });
        lastError = new WeatherLookupError("Unable to contact the geocoding service at the moment.");
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new WeatherLookupError("I couldn't find that location. Try another nearby city or landmark.");
}

async function geocodeWithNominatim(
  query: string,
  signal?: AbortSignal
): Promise<GeocodedLocation> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal,
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (error: any) {
    // Network/request error - rethrow to be caught as RequestError
    throw error;
  }

  // HTTP status error (response exists but not ok)
  if (!response.ok) {
    const error: any = new WeatherLookupError("The geocoding service returned an error response.");
    error.response = { status: response.status };
    throw error;
  }

  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new WeatherLookupError("I couldn't find that location. Try another nearby city or landmark.");
  }

  const first = payload[0];
  let latitude: number;
  let longitude: number;
  try {
    latitude = parseFloat(first.lat);
    longitude = parseFloat(first.lon);
    if (isNaN(latitude) || isNaN(longitude)) {
      throw new Error("Invalid coordinates");
    }
  } catch {
    throw new WeatherLookupError("The location data returned from the geocoder was incomplete.");
  }

  const label = formatLocationLabel(first);
  return { latitude, longitude, label, raw: first };
}

async function geocodeWithOpenMeteo(
  query: string,
  signal?: AbortSignal
): Promise<GeocodedLocation> {
  const url = new URL(OPEN_METEO_GEOCODE_URL);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal });
  } catch (error: any) {
    // Network/request error - rethrow to be caught as RequestError
    throw error;
  }

  // HTTP status error (response exists but not ok)
  if (!response.ok) {
    const error: any = new WeatherLookupError("The geocoding service returned an error response.");
    error.response = { status: response.status };
    throw error;
  }

  const payload = await response.json();
  const results = payload?.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new WeatherLookupError("I couldn't find that location. Try another nearby city or landmark.");
  }

  const first = results[0];
  let latitude: number;
  let longitude: number;
  try {
    latitude = parseFloat(first.latitude);
    longitude = parseFloat(first.longitude);
    if (isNaN(latitude) || isNaN(longitude)) {
      throw new Error("Invalid coordinates");
    }
  } catch {
    throw new WeatherLookupError("The location data returned from the geocoder was incomplete.");
  }

  const label = formatOpenMeteoLabel(first);
  return { latitude, longitude, label, raw: first };
}

async function fetchWeatherForecast(
  location: GeocodedLocation,
  unit: "celsius" | "fahrenheit",
  signal?: AbortSignal
): Promise<Record<string, any>> {
  const url = new URL(WEATHER_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("current", CURRENT_FIELDS);
  url.searchParams.set("hourly", HOURLY_FIELDS);
  url.searchParams.set("daily", DAILY_FIELDS);
  url.searchParams.set("temperature_unit", unit);
  url.searchParams.set("windspeed_unit", unit === "fahrenheit" ? "mph" : "kmh");
  url.searchParams.set("timezone", "auto");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal,
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (error: any) {
    // Network/request error (fetch failed, timeout, etc.)
    throw error; // Will be caught and handled as RequestError
  }

  // HTTP status error (response exists but not ok)
  if (!response.ok) {
    const error: any = new WeatherLookupError("The weather service returned an error response.");
    error.response = { status: response.status };
    throw error;
  }
  return await response.json();
}

function buildWidgetData(
  location: GeocodedLocation,
  forecast: Record<string, any>,
  unit: "celsius" | "fahrenheit"
): WeatherWidgetData {
  // Note: TypeScript doesn't have ZoneInfo like Python, so we'll use simpler timezone handling
  const tz = forecast.timezone || null;
  const tzAbbreviation = forecast.timezone_abbreviation || "";

  const current = forecast.current || {};
  const currentUnits = forecast.current_units || {};
  const daily = forecast.daily || {};
  const hourly = forecast.hourly || {};
  const hourlyUnits = forecast.hourly_units || {};

  const observationTime = parseTime(current.time, tz);
  const temperature = toFloat(current.temperature_2m);
  const feelsLike = toFloat(current.apparent_temperature);
  const humidity = toFloat(current.relative_humidity_2m);
  const windSpeed = toFloat(current.wind_speed_10m);
  const windDirection = toFloat(current.wind_direction_10m);

  const weatherCode = current.weather_code;
  const [condition, icon] = weatherCodeInfo(weatherCode);

  const dailyHigh = toFloat(firstValue(daily.temperature_2m_max));
  const dailyLow = toFloat(firstValue(daily.temperature_2m_min));
  const precipitation = toFloat(firstValue(daily.precipitation_probability_max));
  const sunrise = parseTime(firstValue(daily.sunrise), tz);
  const sunset = parseTime(firstValue(daily.sunset), tz);

  const hourlyForecasts = buildHourlyForecasts(
    hourly,
    hourlyUnits,
    tz,
    observationTime
  );

  const temperatureUnit = currentUnits.temperature_2m || (unit === "fahrenheit" ? "°F" : "°C");

  return {
    location: location.label,
    observation_time: observationTime,
    timezone_abbreviation: tzAbbreviation,
    temperature,
    temperature_unit: temperatureUnit,
    condition,
    condition_icon: icon,
    feels_like: feelsLike,
    high: dailyHigh,
    low: dailyLow,
    wind_speed: windSpeed,
    wind_direction: windDirection,
    wind_unit: currentUnits.wind_speed_10m || (unit === "fahrenheit" ? "mph" : "km/h"),
    humidity,
    humidity_unit: currentUnits.relative_humidity_2m || "%",
    precipitation_probability: precipitation,
    sunrise,
    sunset,
    hourly: hourlyForecasts,
  };
}

function buildHourlyForecasts(
  hourly: Record<string, any>,
  hourlyUnits: Record<string, any>,
  tz: string | null,
  observationTime: Date | null
): Array<{ time: Date | null; temperature: number | null; temperature_unit: string; condition: string; icon: string }> {
  const times = hourly.time || [];
  const temperatures = hourly.temperature_2m || [];
  const codes = hourly.weather_code || [];
  const unit = hourlyUnits.temperature_2m || "°";

  const forecasts: Array<{ time: Date | null; temperature: number | null; temperature_unit: string; condition: string; icon: string }> = [];
  for (let i = 0; i < times.length && forecasts.length < HOURLY_SEGMENTS; i++) {
    const moment = parseTime(times[i], tz);
    if (observationTime && moment && moment < observationTime) {
      continue;
    }
    const [condition, icon] = weatherCodeInfo(codes[i]);
    forecasts.push({
      time: moment,
      temperature: toFloat(temperatures[i]),
      temperature_unit: unit,
      condition,
      icon,
    });
  }
  return forecasts;
}

function weatherCodeInfo(code: any): [string, string] {
  try {
    const numeric = parseInt(String(code), 10);
    if (isNaN(numeric)) {
      return ["Current conditions", DEFAULT_ICON_KEY];
    }
    const result = WEATHER_CODE_LOOKUP.get(numeric);
    return result || ["Current conditions", DEFAULT_ICON_KEY];
  } catch {
    return ["Current conditions", DEFAULT_ICON_KEY];
  }
}

function parseTime(value: any, tz: string | null): Date | null {
  if (!value) {
    return null;
  }
  try {
    let text = String(value);
    if (text.endsWith("Z")) {
      text = text.replace("Z", "+00:00");
    }
    const moment = new Date(text);
    if (isNaN(moment.getTime())) {
      return null;
    }
    return moment;
  } catch {
    return null;
  }
}

function toFloat(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    const num = parseFloat(String(value));
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

function firstValue(values: any): any {
  if (Array.isArray(values) && values.length > 0) {
    return values[0];
  }
  return null;
}

function formatLocationLabel(result: Record<string, any>): string {
  const address = result.address || {};
  const city = address.city || address.town || address.village || address.hamlet || address.municipality || address.county;
  const region = address.state || address.province || address.state_district;
  const country = address.country;

  const parts = [city, region, country].filter(Boolean);
  if (parts.length > 0) {
    if (parts.length > 2) {
      return parts.slice(0, 2).join(", ");
    }
    return parts.join(", ");
  }

  const display = result.display_name;
  if (typeof display === "string" && display) {
    const pieces = display.split(",").map(s => s.trim()).filter(Boolean);
    if (pieces.length > 0) {
      return pieces.slice(0, 2).join(", ");
    }
  }

  return "Selected location";
}

function formatOpenMeteoLabel(result: Record<string, any>): string {
  const name = result.name;
  const admin1 = result.admin1 || result.admin2;
  const country = result.country;

  const parts = [name, admin1, country].filter(Boolean);
  if (parts.length > 0) {
    if (parts.length > 2) {
      return parts.slice(0, 2).join(", ");
    }
    return parts.join(", ");
  }

  return "Selected location";
}

