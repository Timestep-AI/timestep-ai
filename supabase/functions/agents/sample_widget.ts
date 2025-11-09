// Weather widget rendering for TypeScript backend
// Matches Python sample_widget.py implementation

import type { WidgetComponent, WidgetRoot, Box, Card, Col, Row, Text, Title, Image } from '../_shared/chatkit/widgets.ts';

const WEATHER_ICON_COLOR = "#1D4ED8";
const WEATHER_ICON_ACCENT = "#DBEAFE";

function sunSvg(): string {
  const color = WEATHER_ICON_COLOR;
  const accent = WEATHER_ICON_ACCENT;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">' +
    `<circle cx="32" cy="32" r="13" fill="${accent}" stroke="${color}" stroke-width="3"/>` +
    `<g stroke="${color}" stroke-width="3" stroke-linecap="round">` +
    '<line x1="32" y1="8" x2="32" y2="16"/>' +
    '<line x1="32" y1="48" x2="32" y2="56"/>' +
    '<line x1="8" y1="32" x2="16" y2="32"/>' +
    '<line x1="48" y1="32" x2="56" y2="32"/>' +
    '<line x1="14.93" y1="14.93" x2="20.55" y2="20.55"/>' +
    '<line x1="43.45" y1="43.45" x2="49.07" y2="49.07"/>' +
    '<line x1="14.93" y1="49.07" x2="20.55" y2="43.45"/>' +
    '<line x1="43.45" y1="20.55" x2="49.07" y2="14.93"/>' +
    "</g>" +
    "</svg>"
  );
}

function sunPeekSvg(): string {
  const color = WEATHER_ICON_COLOR;
  const accent = WEATHER_ICON_ACCENT;
  return (
    "<g>" +
    `<circle cx="20" cy="22" r="9" fill="${accent}" stroke="${color}" stroke-width="3"/>` +
    `<g stroke="${color}" stroke-width="3" stroke-linecap="round">` +
    '<line x1="20" y1="10" x2="20" y2="14"/>' +
    '<line x1="20" y1="30" x2="20" y2="34"/>' +
    '<line x1="8" y1="22" x2="12" y2="22"/>' +
    '<line x1="28" y1="22" x2="32" y2="22"/>' +
    '<line x1="12" y1="14" x2="14" y2="16"/>' +
    '<line x1="26" y1="28" x2="28" y2="30"/>' +
    '<line x1="12" y1="30" x2="14" y2="28"/>' +
    '<line x1="26" y1="16" x2="28" y2="14"/>' +
    "</g>" +
    "</g>"
  );
}

function fogLinesSvg(): string {
  const color = WEATHER_ICON_COLOR;
  return (
    `<g stroke="${color}" stroke-width="3" stroke-linecap="round">` +
    '<line x1="18" y1="50" x2="42" y2="50"/>' +
    '<line x1="24" y1="56" x2="48" y2="56"/>' +
    "</g>"
  );
}

function drizzleLinesSvg(): string {
  const color = WEATHER_ICON_COLOR;
  return (
    `<g stroke="${color}" stroke-width="3" stroke-linecap="round">` +
    '<line x1="26" y1="50" x2="26" y2="56"/>' +
    '<line x1="36" y1="52" x2="36" y2="58"/>' +
    '<line x1="46" y1="50" x2="46" y2="56"/>' +
    "</g>"
  );
}

function rainLinesSvg(): string {
  const color = WEATHER_ICON_COLOR;
  return (
    `<g stroke="${color}" stroke-width="3" stroke-linecap="round">` +
    '<line x1="26" y1="48" x2="30" y2="56"/>' +
    '<line x1="36" y1="50" x2="40" y2="58"/>' +
    '<line x1="46" y1="48" x2="50" y2="56"/>' +
    "</g>"
  );
}

function snowSymbolsSvg(): string {
  const color = WEATHER_ICON_COLOR;
  return (
    `<g stroke="${color}" stroke-width="2" stroke-linecap="round">` +
    '<line x1="24" y1="50" x2="24" y2="58"/>' +
    '<line x1="21" y1="53" x2="27" y2="55"/>' +
    '<line x1="21" y1="55" x2="27" y2="53"/>' +
    '<line x1="40" y1="50" x2="40" y2="58"/>' +
    '<line x1="37" y1="53" x2="43" y2="55"/>' +
    '<line x1="37" y1="55" x2="43" y2="53"/>' +
    "</g>"
  );
}

function lightningSvg(): string {
  const color = WEATHER_ICON_COLOR;
  return (
    `<path d="M34 46L28 56H34L30 64L42 50H36L40 46Z" ` +
    `fill="${color}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`
  );
}

function cloudSvg(before: string = "", after: string = ""): string {
  const color = WEATHER_ICON_COLOR;
  const accent = WEATHER_ICON_ACCENT;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">' +
    before +
    `<path d="M22 46H44C50.075 46 55 41.075 55 35S50.075 24 44 24H42.7C41.2 16.2 34.7 10 26.5 10 18 10 11.6 16.1 11 24.3 6.5 25.6 3 29.8 3 35s4.925 11 11 11h8Z" ` +
    `fill="${accent}" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>` +
    after +
    "</svg>"
  );
}

const WEATHER_ICON_SVGS: Record<string, string> = {
  "sun": sunSvg(),
  "cloud": cloudSvg(),
  "cloud-sun": cloudSvg(sunPeekSvg(), ""),
  "cloud-fog": cloudSvg("", fogLinesSvg()),
  "cloud-drizzle": cloudSvg("", drizzleLinesSvg()),
  "cloud-rain": cloudSvg("", rainLinesSvg()),
  "cloud-snow": cloudSvg("", snowSymbolsSvg()),
  "cloud-lightning": cloudSvg("", lightningSvg()),
};

function encodeSvg(svg: string): string {
  // In Deno/browser, use btoa for base64 encoding
  const encoded = btoa(svg);
  return `data:image/svg+xml;base64,${encoded}`;
}

const WEATHER_ICON_SOURCES: Record<string, string> = {};
for (const [name, svg] of Object.entries(WEATHER_ICON_SVGS)) {
  WEATHER_ICON_SOURCES[name] = encodeSvg(svg);
}

const DEFAULT_WEATHER_ICON_SRC = WEATHER_ICON_SOURCES["cloud"];

function weatherIconSrc(name: string | null | undefined): string {
  if (!name) {
    return DEFAULT_WEATHER_ICON_SRC;
  }
  return WEATHER_ICON_SOURCES[name] || DEFAULT_WEATHER_ICON_SRC;
}

function windDetailSvg(): string {
  const color = WEATHER_ICON_COLOR;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">' +
    `<path d="M12 22h26c4.418 0 8-3.582 8-8" stroke="${color}" stroke-width="4" ` +
    'stroke-linecap="round"/>' +
    `<path d="M18 32h30c5.523 0 10-4.477 10-10" stroke="${color}" stroke-width="4" ` +
    'stroke-linecap="round"/>' +
    `<path d="M18 42h22c3.314 0 6 2.686 6 6" stroke="${color}" stroke-width="4" ` +
    'stroke-linecap="round"/>' +
    "</svg>"
  );
}

function humidityDetailSvg(): string {
  const color = WEATHER_ICON_COLOR;
  const accent = WEATHER_ICON_ACCENT;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">' +
    `<path d="M32 8c10 10 18 20 18 30a18 18 0 1 1-36 0c0-10 8-20 18-30Z" ` +
    `fill="${accent}" stroke="${color}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M32 36c3.314 0 6 2.686 6 6s-2.686 6-6 6" stroke="${color}" ` +
    'stroke-width="4" stroke-linecap="round"/>' +
    "</svg>"
  );
}

function precipitationDetailSvg(): string {
  const color = WEATHER_ICON_COLOR;
  const accent = WEATHER_ICON_ACCENT;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">' +
    `<path d="M18 30c0-8.837 7.163-16 16-16 7.732 0 14 5.318 15.678 12.362" ` +
    `stroke="${color}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M46 26c6.075 0 11 4.925 11 11s-4.925 11-11 11H20c-6.075 0-11-4.925-11-11 0-5.302 3.734-9.711 8.693-10.793" ` +
    `fill="${accent}" stroke="${color}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M24 50l-4 8" stroke="${color}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M34 50l-4 8" stroke="${color}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M44 50l-4 8" stroke="${color}" stroke-width="4" stroke-linecap="round"/>` +
    "</svg>"
  );
}

function sunriseDetailSvg(rising: boolean): string {
  const color = WEATHER_ICON_COLOR;
  const accent = WEATHER_ICON_ACCENT;
  const sunY = rising ? "30" : "34";
  const raysTop = rising
    ? '<line x1="32" y1="10" x2="32" y2="6"/>'
    : '<line x1="32" y1="44" x2="32" y2="48"/>';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">' +
    `<path d="M14 44h36" stroke="${color}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M12 54h40" stroke="${color}" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="32" cy="${sunY}" r="10" fill="${accent}" stroke="${color}" stroke-width="4"/>` +
    `<g stroke="${color}" stroke-width="4" stroke-linecap="round">` +
    raysTop +
    '<line x1="16" y1="30" x2="12" y2="26"/>' +
    '<line x1="48" y1="30" x2="52" y2="26"/>' +
    "</g>" +
    "</svg>"
  );
}

function thermometerDetailSvg(): string {
  const color = WEATHER_ICON_COLOR;
  const accent = WEATHER_ICON_ACCENT;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">' +
    `<path d="M30 12a6 6 0 0 1 12 0v28.343a12 12 0 1 1-12 0V12Z" ` +
    `fill="${accent}" stroke="${color}" stroke-width="4" stroke-linejoin="round"/>` +
    `<circle cx="36" cy="46" r="6" fill="${color}"/>` +
    `<path d="M36 24v14" stroke="${color}" stroke-width="4" stroke-linecap="round"/>` +
    "</svg>"
  );
}

const DETAIL_ICON_SVGS: Record<string, string> = {
  "wind": windDetailSvg(),
  "humidity": humidityDetailSvg(),
  "precipitation": precipitationDetailSvg(),
  "sunrise": sunriseDetailSvg(true),
  "sunset": sunriseDetailSvg(false),
  "thermometer": thermometerDetailSvg(),
};

const DETAIL_ICON_SOURCES: Record<string, string> = {};
for (const [name, svg] of Object.entries(DETAIL_ICON_SVGS)) {
  DETAIL_ICON_SOURCES[name] = encodeSvg(svg);
}

const DEFAULT_DETAIL_ICON_KEY = "thermometer";

const DETAIL_ICON_MAP: Record<string, string> = {
  "wind": "wind",
  "droplets": "humidity",
  "umbrella": "precipitation",
  "sunrise": "sunrise",
  "sunset": "sunset",
  "feels_like": "thermometer",
};

function detailIconSrc(name: string): string {
  const key = DETAIL_ICON_MAP[name] || DEFAULT_DETAIL_ICON_KEY;
  return DETAIL_ICON_SOURCES[key] || DETAIL_ICON_SOURCES[DEFAULT_DETAIL_ICON_KEY];
}

export interface HourlyForecast {
  time: Date | null;
  temperature: number | null;
  temperature_unit: string;
  condition: string;
  icon: string;
}

export interface WeatherWidgetData {
  location: string;
  observation_time: Date | null;
  timezone_abbreviation: string;
  temperature: number | null;
  temperature_unit: string;
  condition: string;
  condition_icon: string;
  feels_like?: number | null;
  high?: number | null;
  low?: number | null;
  wind_speed?: number | null;
  wind_direction?: number | null;
  wind_unit?: string | null;
  humidity?: number | null;
  humidity_unit?: string | null;
  precipitation_probability?: number | null;
  sunrise?: Date | null;
  sunset?: Date | null;
  hourly?: HourlyForecast[];
}

export function renderWeatherWidget(data: WeatherWidgetData): WidgetRoot {
  const temperatureText = formatTemperature(data.temperature, data.temperature_unit);
  const highLowText = formatHighLow(data.high, data.low, data.temperature_unit);
  const updatedText = formatUpdatedLabel(data.observation_time, data.timezone_abbreviation);

  const header: Box = {
    type: "Box",
    padding: 5,
    background: "surface-tertiary",
    children: [
      {
        type: "Col",
        gap: 4,
        children: compact([
          {
            type: "Row",
            justify: "between",
            align: "center",
            children: compact([
              {
                type: "Col",
                align: "start",
                gap: 1,
                children: compact([
                  {
                    type: "Text",
                    value: data.location,
                    size: "lg",
                    weight: "semibold",
                  },
                  updatedText
                    ? {
                        type: "Text",
                        value: updatedText,
                        color: "tertiary",
                        size: "xs",
                      }
                    : null,
                ]),
              },
              {
                type: "Box",
                padding: 3,
                radius: "full",
                background: "blue-100",
                children: [
                  {
                    type: "Image",
                    src: weatherIconSrc(data.condition_icon),
                    alt: data.condition || "Current conditions",
                    size: 28,
                    fit: "contain",
                  },
                ],
              },
            ]),
          },
          {
            type: "Row",
            align: "start",
            gap: 4,
            children: compact([
              {
                type: "Title",
                value: temperatureText,
                size: "lg",
                weight: "semibold",
              },
              {
                type: "Col",
                align: "start",
                gap: 1,
                children: compact([
                  {
                    type: "Text",
                    value: data.condition,
                    color: "secondary",
                    size: "sm",
                    weight: "medium",
                  },
                  highLowText
                    ? {
                        type: "Text",
                        value: highLowText,
                        color: "tertiary",
                        size: "xs",
                      }
                    : null,
                ]),
              },
            ]),
          },
        ]),
      },
    ],
  };

  const detailsSection = buildDetailsSection(data);
  const hourlySection = buildHourlySection(data);

  const bodyChildren: WidgetComponent[] = [];
  if (detailsSection) {
    bodyChildren.push(detailsSection);
  }
  if (hourlySection) {
    bodyChildren.push(hourlySection);
  }

  const body: Box = {
    type: "Box",
    padding: 5,
    gap: 4,
    children: bodyChildren,
  };

  return {
    type: "Card",
    key: "weather",
    padding: 0,
    children: compact([header, bodyChildren.length > 0 ? body : null]),
  };
}

export function weatherWidgetCopyText(data: WeatherWidgetData): string {
  const segments: string[] = [];

  const timeText = formatUpdatedLabel(data.observation_time, data.timezone_abbreviation, true);
  const temperatureText = formatTemperature(data.temperature, data.temperature_unit);
  const conditionText = (data.condition || "unknown conditions").toLowerCase();
  const locationText = data.location || "the selected location";

  if (timeText) {
    segments.push(
      `As of ${timeText}, ${locationText} is ${temperatureText} with ${conditionText}.`
    );
  } else {
    segments.push(
      `Current weather in ${locationText} is ${temperatureText} with ${conditionText}.`
    );
  }

  const highLowText = formatHighLow(data.high, data.low, data.temperature_unit);
  if (highLowText) {
    segments.push(highLowText + ".");
  }

  const feelsLikeText = formatFeelsLike(data.feels_like, data.temperature_unit);
  if (feelsLikeText) {
    segments.push(`Feels like ${feelsLikeText}.`);
  }

  const windText = formatWind(data.wind_speed, data.wind_unit, data.wind_direction);
  if (windText) {
    segments.push(`Winds ${windText}.`);
  }

  const humidityText = formatPercentage(data.humidity, data.humidity_unit);
  if (humidityText) {
    segments.push(`Humidity ${humidityText}.`);
  }

  const precipitationText = formatProbability(data.precipitation_probability);
  if (precipitationText) {
    segments.push(`Precipitation chance ${precipitationText}.`);
  }

  const sunriseText = formatTimeOfDay(data.sunrise, data.timezone_abbreviation);
  const sunsetText = formatTimeOfDay(data.sunset, data.timezone_abbreviation);
  if (sunriseText && sunsetText) {
    segments.push(`Sunrise at ${sunriseText} and sunset at ${sunsetText}.`);
  } else if (sunriseText) {
    segments.push(`Sunrise at ${sunriseText}.`);
  } else if (sunsetText) {
    segments.push(`Sunset at ${sunsetText}.`);
  }

  if (data.hourly && data.hourly.length > 0) {
    const upcoming: string[] = [];
    for (const forecast of data.hourly.slice(0, 4)) {
      const hourLabel = formatHourLabel(forecast.time, data.timezone_abbreviation);
      const tempLabel = formatTemperature(
        forecast.temperature,
        forecast.temperature_unit || data.temperature_unit
      );
      const conditionLabel = forecast.condition.toLowerCase();
      upcoming.push(`${hourLabel}: ${tempLabel} ${conditionLabel}`);
    }
    if (upcoming.length > 0) {
      segments.push("Next hours " + upcoming.join(", ") + ".");
    }
  }

  return segments.filter(s => s).map(s => s.trim()).join(" ").trim();
}

function horizontalScroller(items: WidgetComponent[]): WidgetComponent {
  return {
    type: "Box",
    direction: "row",
    wrap: "nowrap",
    gap: 3,
    width: "100%",
    justify: "start",
    align: "stretch",
    children: items,
  };
}

function buildDetailsSection(data: WeatherWidgetData): WidgetComponent | null {
  const windText = formatWind(data.wind_speed, data.wind_unit, data.wind_direction);
  const humidityText = formatPercentage(data.humidity, data.humidity_unit);
  const precipitationText = formatProbability(data.precipitation_probability);
  const sunriseText = formatTimeOfDay(data.sunrise, data.timezone_abbreviation);
  const sunsetText = formatTimeOfDay(data.sunset, data.timezone_abbreviation);
  const feelsLikeText = formatFeelsLike(data.feels_like, data.temperature_unit);

  const chips = compact([
    feelsLikeText ? detailChip("Feels like", feelsLikeText, "feels_like") : null,
    windText ? detailChip("Wind", windText, "wind") : null,
    humidityText ? detailChip("Humidity", humidityText, "droplets") : null,
    precipitationText ? detailChip("Precipitation", precipitationText, "umbrella") : null,
    sunriseText ? detailChip("Sunrise", sunriseText, "sunrise") : null,
    sunsetText ? detailChip("Sunset", sunsetText, "sunset") : null,
  ]);

  if (chips.length === 0) {
    return null;
  }

  return {
    type: "Col",
    gap: 3,
    children: [
      {
        type: "Text",
        value: "Today's highlights",
        weight: "semibold",
        size: "sm",
      },
      horizontalScroller(chips),
    ],
  };
}

function buildHourlySection(data: WeatherWidgetData): WidgetComponent | null {
  if (!data.hourly || data.hourly.length === 0) {
    return null;
  }

  const cards = data.hourly.map(forecast =>
    hourlyChip(forecast, data.temperature_unit, data.timezone_abbreviation)
  );

  if (cards.length === 0) {
    return null;
  }

  return {
    type: "Col",
    gap: 3,
    children: [
      {
        type: "Text",
        value: "Next hours",
        weight: "semibold",
        size: "sm",
      },
      horizontalScroller(cards),
    ],
  };
}

function detailChip(label: string, value: string, icon: string): WidgetComponent {
  return {
    type: "Box",
    padding: 3,
    radius: "xl",
    background: "surface-tertiary",
    width: 150,
    minWidth: 150,
    maxWidth: 150,
    minHeight: 100,
    maxHeight: 100,
    flex: "0 0 auto",
    children: [
      {
        type: "Col",
        align: "stretch",
        gap: 2,
        children: [
          {
            type: "Row",
            gap: 2,
            align: "center",
            children: [
              {
                type: "Image",
                src: detailIconSrc(icon),
                alt: label,
                size: 28,
                fit: "contain",
              },
              {
                type: "Text",
                value: label,
                size: "xs",
                weight: "medium",
                color: "tertiary",
              },
            ],
          },
          {
            type: "Row",
            justify: "center",
            margin: { top: 4 },
            children: [
              {
                type: "Text",
                value: value,
                weight: "semibold",
                size: "lg",
              },
            ],
          },
        ],
      },
    ],
  };
}

function hourlyChip(
  forecast: HourlyForecast,
  defaultUnit: string,
  timezoneAbbreviation: string
): WidgetComponent {
  const timeLabel = formatHourLabel(forecast.time, timezoneAbbreviation);
  const temperatureLabel = formatTemperature(
    forecast.temperature,
    forecast.temperature_unit || defaultUnit
  );

  return {
    type: "Box",
    padding: 3,
    radius: "xl",
    background: "surface-tertiary",
    width: 100,
    minWidth: 100,
    maxWidth: 100,
    minHeight: 150,
    maxHeight: 150,
    flex: "0 0 auto",
    children: [
      {
        type: "Col",
        align: "center",
        gap: 2,
        children: compact([
          {
            type: "Text",
            value: timeLabel,
            size: "xs",
            color: "tertiary",
            weight: "medium",
          },
          {
            type: "Image",
            src: weatherIconSrc(forecast.icon),
            alt: forecast.condition,
            size: 36,
            fit: "contain",
          },
          {
            type: "Text",
            value: temperatureLabel,
            weight: "semibold",
          },
          {
            type: "Text",
            value: forecast.condition,
            size: "xs",
            color: "tertiary",
          },
        ]),
      },
    ],
  };
}

function formatTemperature(value: number | null | undefined, unit: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  try {
    const number = Math.round(Number(value));
    if (isNaN(number)) {
      return "—";
    }
    const suffix = unit || "°";
    return `${number}${suffix}`;
  } catch {
    return "—";
  }
}

function formatHighLow(
  high: number | null | undefined,
  low: number | null | undefined,
  unit: string | null | undefined
): string {
  const highText = high !== null && high !== undefined ? formatTemperature(high, unit) : "";
  const lowText = low !== null && low !== undefined ? formatTemperature(low, unit) : "";
  if (highText && lowText) {
    return `High ${highText} • Low ${lowText}`;
  }
  if (highText) {
    return `High ${highText}`;
  }
  if (lowText) {
    return `Low ${lowText}`;
  }
  return "";
}

function formatFeelsLike(value: number | null | undefined, unit: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return formatTemperature(value, unit);
}

function formatWind(
  speed: number | null | undefined,
  unit: string | null | undefined,
  direction: number | null | undefined
): string {
  if (speed === null && direction === null) {
    return "";
  }

  const parts: string[] = [];
  if (speed !== null && speed !== undefined) {
    try {
      const speedValue = Math.round(Number(speed));
      if (!isNaN(speedValue)) {
        parts.push(`${speedValue}${unit ? ` ${unit}` : ""}`.trim());
      }
    } catch {
      // Ignore
    }
  }

  const cardinal = windDirectionToCardinal(direction);
  if (cardinal) {
    parts.push(cardinal);
  }

  return parts.join(" ").trim();
}

function formatPercentage(value: number | null | undefined, unit: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  try {
    const number = Math.round(Number(value));
    if (isNaN(number)) {
      return "";
    }
    const suffix = unit || "%";
    return `${number}${suffix}`;
  } catch {
    return "";
  }
}

function formatProbability(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  try {
    const number = Math.round(Number(value));
    if (isNaN(number)) {
      return "";
    }
    return `${number}%`;
  } catch {
    return "";
  }
}

function formatTimeOfDay(moment: Date | null | undefined, tzAbbreviation: string): string {
  if (!moment) {
    return "";
  }
  const timeText = moment.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(/^0/, "");
  const tz = tzAbbreviation.trim();
  return `${timeText} ${tz}`.trim();
}

function formatHourLabel(moment: Date | null | undefined, tzAbbreviation: string): string {
  if (!moment) {
    return "—";
  }
  const hourText = moment.toLocaleTimeString("en-US", {
    hour: "numeric",
    hour12: true,
  }).replace(/^0/, "");
  return hourText || moment.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatUpdatedLabel(
  moment: Date | null | undefined,
  tzAbbreviation: string,
  short: boolean = false
): string {
  if (!moment) {
    return "";
  }

  const timeText = moment.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(/^0/, "");
  const tz = tzAbbreviation.trim();
  if (short) {
    return `${timeText} ${tz}`.trim();
  }

  const dateText = moment.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  }).replace(/ 0/, " ");
  const base = dateText ? `${dateText} · ${timeText}` : timeText;
  return `Updated ${base} ${tz}`.trim();
}

function windDirectionToCardinal(direction: number | null | undefined): string | null {
  if (direction === null || direction === undefined) {
    return null;
  }
  try {
    const degrees = Number(direction);
    if (isNaN(degrees)) {
      return null;
    }
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.floor((degrees + 22.5) / 45) % directions.length;
    return directions[index];
  } catch {
    return null;
  }
}

function compact(items: Array<WidgetComponent | null | undefined>): WidgetComponent[] {
  return items.filter((item): item is WidgetComponent => item !== null && item !== undefined);
}

