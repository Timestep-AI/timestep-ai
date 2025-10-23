import { z } from 'npm:zod';

export const getWeatherTool = {
  name: 'get_weather',
  definition: {
    title: 'Get Weather Tool',
    description: 'Get the weather for a given city',
    inputSchema: { city: z.string() },
    outputSchema: { temperature: z.number(), conditions: z.string() },
  },
  handler: async ({ city }: { city: string }) => {
    try {
      // Use Open-Meteo API (free, no API key required)
      // First, get coordinates for the city using geocoding
      const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

      // Add 10 second timeout to prevent hanging
      const geocodeController = new AbortController();
      const geocodeTimeoutId = setTimeout(() => geocodeController.abort(), 10000);

      let geocodeResponse;
      try {
        geocodeResponse = await fetch(geocodeUrl, {
          signal: geocodeController.signal,
        });
        clearTimeout(geocodeTimeoutId);
      } catch (fetchError) {
        clearTimeout(geocodeTimeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(`Geocoding API request timed out after 10 seconds for city: ${city}`);
        }
        throw fetchError;
      }

      if (!geocodeResponse.ok) {
        const errorText = await geocodeResponse.text();
        console.error(
          `[Weather Tool] Geocoding Error - Status: ${geocodeResponse.status}, Response: ${errorText}`
        );
        throw new Error(
          `Geocoding API error: ${geocodeResponse.status} ${geocodeResponse.statusText}`
        );
      }

      const geocodeData = await geocodeResponse.json();

      if (!geocodeData.results || geocodeData.results.length === 0) {
        throw new Error(`No results found for city: ${city}`);
      }

      const location = geocodeData.results[0];
      const latitude = location.latitude;
      const longitude = location.longitude;
      const cityName = location.name;
      const country = location.country;

      // Get weather data using coordinates
      const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`;

      // Add 10 second timeout to prevent hanging
      const weatherController = new AbortController();
      const weatherTimeoutId = setTimeout(() => weatherController.abort(), 10000);

      let response;
      try {
        response = await fetch(apiUrl, {
          signal: weatherController.signal,
        });
        clearTimeout(weatherTimeoutId);
      } catch (fetchError) {
        clearTimeout(weatherTimeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(
            `Weather API request timed out after 10 seconds for ${cityName}, ${country}`
          );
        }
        throw fetchError;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Weather Tool] Weather API Error - Status: ${response.status}, Response: ${errorText}`
        );
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Map weather codes to descriptions
      const weatherDescriptions: Record<number, string> = {
        0: 'clear sky',
        1: 'mainly clear',
        2: 'partly cloudy',
        3: 'overcast',
        45: 'foggy',
        48: 'depositing rime fog',
        51: 'light drizzle',
        53: 'moderate drizzle',
        55: 'dense drizzle',
        61: 'slight rain',
        63: 'moderate rain',
        65: 'heavy rain',
        71: 'slight snow',
        73: 'moderate snow',
        75: 'heavy snow',
        80: 'slight rain showers',
        81: 'moderate rain showers',
        82: 'violent rain showers',
        95: 'thunderstorm',
        96: 'thunderstorm with slight hail',
        99: 'thunderstorm with heavy hail',
      };

      const weatherCode = data.current?.weather_code || 0;
      const temperature = Math.round(data.current?.temperature_2m || 20);
      const conditions = weatherDescriptions[weatherCode] || 'unknown';

      const output = {
        temperature,
        conditions,
      };

      return {
        content: [
          {
            type: 'text',
            text: `Weather in ${cityName}, ${country}: ${output.temperature}°C, ${output.conditions}`,
          },
        ],
        structuredContent: output,
      };
    } catch (error) {
      console.error(`[Weather Tool] Error fetching weather for ${city}:`, error);
      throw error; // Re-throw the error so it's properly handled by the MCP framework
    }
  },
};
