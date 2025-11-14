from typing import Final, Literal, Any
import logging
from agents import function_tool, RunContextWrapper
from chatkit.agents import AgentContext, ClientToolCall
from .weather import retrieve_weather, normalize_unit as normalize_temperature_unit, WeatherLookupError
from .sample_widget import render_weather_widget, weather_widget_copy_text

logger = logging.getLogger(__name__)

# Constants for theme switching
SUPPORTED_COLOR_SCHEMES: Final[frozenset[str]] = frozenset({"light", "dark"})
CLIENT_THEME_TOOL_NAME: Final[str] = "switch_theme"

def _normalize_color_scheme(value: str) -> str:
    """Normalize color scheme input to 'light' or 'dark'."""
    normalized = str(value).strip().lower()
    if normalized in SUPPORTED_COLOR_SCHEMES:
        return normalized
    if "dark" in normalized:
        return "dark"
    if "light" in normalized:
        return "light"
    raise ValueError("Theme must be either 'light' or 'dark'.")

@function_tool(
    description_override="Switch the chat interface between light and dark color schemes."
)
async def switch_theme(
    ctx: RunContextWrapper[AgentContext],
    theme: str,
) -> dict[str, str] | None:
    """Switch the theme between light and dark mode.

    This is a client tool that triggers a theme change in the frontend.
    """
    try:
        requested = _normalize_color_scheme(theme)
        ctx.context.client_tool_call = ClientToolCall(
            name=CLIENT_THEME_TOOL_NAME,
            arguments={"theme": requested},
        )
        return {"theme": requested}
    except Exception:
        logger.exception("Failed to switch theme")
        return None

async def _needs_weather_approval(_ctx: RunContextWrapper[AgentContext], params: dict[str, Any], _call_id: str) -> bool:
    """Check if weather tool needs approval for Berkeley."""
    location = params.get("location", "")
    return "Berkeley" in location or "berkeley" in location.lower()

@function_tool(
    description_override="Look up the current weather and upcoming forecast for a location and render an interactive weather dashboard.",
    needs_approval=_needs_weather_approval,
)
async def get_weather(
    ctx: RunContextWrapper[AgentContext],
    location: str,
    unit: Literal["celsius", "fahrenheit"] | str | None = None,
) -> dict[str, str | None]:
    """Get current weather and forecast for a location.

    Args:
        location: City name, address, or landmark to look up
        unit: Temperature unit - 'celsius' or 'fahrenheit' (defaults to fahrenheit)

    Returns:
        Dictionary with location, unit, and observation time
    """
    print("[WeatherTool] tool invoked", {"location": location, "unit": unit})
    try:
        normalized_unit = normalize_temperature_unit(unit)
    except WeatherLookupError as exc:
        print("[WeatherTool] invalid unit", {"error": str(exc)})
        raise ValueError(str(exc)) from exc

    try:
        data = await retrieve_weather(location, normalized_unit)
    except WeatherLookupError as exc:
        print("[WeatherTool] lookup failed", {"error": str(exc)})
        raise ValueError(str(exc)) from exc

    print(
        "[WeatherTool] lookup succeeded",
        {
            "location": data.location,
            "temperature": data.temperature,
            "unit": data.temperature_unit,
        },
    )
    try:
        widget = render_weather_widget(data)
        copy_text = weather_widget_copy_text(data)
        payload: Any
        try:
            payload = widget.model_dump()
        except AttributeError:
            payload = widget
        print("[WeatherTool] widget payload", payload)
    except Exception as exc:
        print("[WeatherTool] widget build failed", {"error": str(exc)})
        raise ValueError("Weather data is currently unavailable for that location.") from exc

    print("[WeatherTool] streaming widget")
    try:
        await ctx.context.stream_widget(widget, copy_text=copy_text)
    except Exception as exc:
        print("[WeatherTool] widget stream failed", {"error": str(exc)})
        raise ValueError("Weather data is currently unavailable for that location.") from exc

    print("[WeatherTool] widget streamed")

    observed = data.observation_time.isoformat() if data.observation_time else None

    return {
        "location": data.location,
        "unit": normalized_unit,
        "observed_at": observed,
    }

