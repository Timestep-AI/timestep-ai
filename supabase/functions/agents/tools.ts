import { tool } from '@openai/agents-core';
import { AgentContext } from '../_shared/chatkit/agents.ts';
import { retrieveWeather, normalizeUnit as normalizeTemperatureUnit, WeatherLookupError } from './weather.ts';
import { renderWeatherWidget, weatherWidgetCopyText } from './sample_widget.ts';

// Constants for theme switching
const SUPPORTED_COLOR_SCHEMES = new Set(['light', 'dark']);
export const CLIENT_THEME_TOOL_NAME = 'switch_theme';

/**
 * Normalize color scheme input to 'light' or 'dark'
 */
function normalizeColorScheme(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (SUPPORTED_COLOR_SCHEMES.has(normalized)) {
    return normalized;
  }
  if (normalized.includes('dark')) {
    return 'dark';
  }
  if (normalized.includes('light')) {
    return 'light';
  }
  throw new Error("Theme must be either 'light' or 'dark'.");
}

/**
 * Switch the theme between light and dark mode.
 * This is a client tool that triggers a theme change in the frontend.
 *
 * Matches Python switch_theme implementation
 *
 * NOTE: Using JSON Schema directly instead of Zod because:
 * - Zod schemas require strict: true in the agents SDK
 * - The zodResponsesFunction helper may not be available in Deno/npm environment
 * - JSON Schema is universally supported by all model providers
 */
export const switchTheme = tool({
  name: 'switch_theme',
  description: 'Switch the chat interface between light and dark color schemes.',
  parameters: {
    type: 'object',
    properties: {
      theme: {
        type: 'string',
        description: 'The theme to switch to: "light" or "dark"',
        enum: ['light', 'dark'],
      },
    },
    required: ['theme'],
    additionalProperties: false,
  },
  strict: false, // Using JSON Schema directly, not Zod
  execute: ({ theme }: { theme: string }, ctx: { context?: AgentContext }) => {
    console.log('[agents] switch_theme tool called with theme:', theme);
    console.log('[agents] Context type:', typeof ctx, 'ctx:', ctx);
    try {
      const requested = normalizeColorScheme(theme);
      console.log('[agents] Normalized theme to:', requested);

      // The tool receives a RunContext that wraps our AgentContext in the 'context' property
      const agentContext = ctx.context as AgentContext;
      if (!agentContext) {
        console.error('[agents] No AgentContext found in RunContext');
        return null;
      }

      agentContext.client_tool_call = {
        name: CLIENT_THEME_TOOL_NAME,
        arguments: { theme: requested },
      };
      console.log('[agents] Set client_tool_call:', agentContext.client_tool_call);
      return { theme: requested };
    } catch (error) {
      console.error('[agents] Failed to switch theme:', error);
      return null;
    }
  },
});

/**
 * Get current weather and forecast for a location
 * Matches Python get_weather implementation
 */
export const getWeather = tool({
  name: 'get_weather',
  description: 'Look up the current weather and upcoming forecast for a location and render an interactive weather dashboard.',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name, address, or landmark to look up',
      },
      unit: {
        type: 'string',
        description: 'Temperature unit - "celsius" or "fahrenheit" (defaults to fahrenheit)',
        enum: ['celsius', 'fahrenheit'],
      },
    },
    required: ['location'],
    additionalProperties: false,
  },
  strict: false,
  execute: async ({ location, unit }: { location: string; unit?: string }, ctx: { context?: AgentContext }) => {
    console.log('[WeatherTool] tool invoked', { location, unit });
    try {
      const normalizedUnit = normalizeTemperatureUnit(unit);
      console.log('[WeatherTool] normalized unit:', normalizedUnit);

      const data = await retrieveWeather(location, normalizedUnit);
      console.log('[WeatherTool] lookup succeeded', {
        location: data.location,
        temperature: data.temperature,
        unit: data.temperature_unit,
      });

      const widget = renderWeatherWidget(data);
      const copyText = weatherWidgetCopyText(data);
      console.log('[WeatherTool] widget built');

      const agentContext = ctx.context as AgentContext;
      if (!agentContext) {
        console.error('[WeatherTool] No AgentContext found in RunContext');
        throw new Error('Weather data is currently unavailable for that location.');
      }

      console.log('[WeatherTool] streaming widget');
      await agentContext.stream_widget(widget, copyText);
      console.log('[WeatherTool] widget streamed');

      const observed = data.observation_time ? data.observation_time.toISOString() : null;

      return {
        location: data.location,
        unit: normalizedUnit,
        observed_at: observed,
      };
    } catch (error) {
      console.error('[WeatherTool] error:', error);
      if (error instanceof WeatherLookupError) {
        throw new Error(error.message);
      }
      throw new Error('Weather data is currently unavailable for that location.');
    }
  },
});

