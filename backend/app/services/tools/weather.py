"""
Weather Tool - Open-Meteo Integration
Provides current weather data for any location.
Uses the free Open-Meteo API (no API key required).
"""

import httpx
from typing import Dict, Any

from app.services.tools import Tool, ToolParameter, tool_registry


async def get_weather(location: str) -> Dict[str, Any]:
    """Get current weather for a location using Open-Meteo (free, no key needed)."""
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Step 1: Geocode the location name to coordinates
            geo_resp = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": location, "count": 1, "language": "en"}
            )
            geo_data = geo_resp.json()
            
            if not geo_data.get("results"):
                return {"error": f"Could not find location '{location}'. Try a more specific name."}
            
            place = geo_data["results"][0]
            lat = place["latitude"]
            lon = place["longitude"]
            resolved_name = f"{place.get('name', location)}, {place.get('country', '')}"
            
            # Step 2: Get current weather
            weather_resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,is_day",
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset",
                    "timezone": "auto",
                    "forecast_days": 3
                }
            )
            weather_data = weather_resp.json()
            current = weather_data.get("current", {})
            daily = weather_data.get("daily", {})
            
            # Weather code to description
            WMO_CODES = {
                0: "☀️ Clear sky", 1: "🌤️ Mainly clear", 2: "⛅ Partly cloudy", 3: "☁️ Overcast",
                45: "🌫️ Foggy", 48: "🌫️ Rime fog",
                51: "🌦️ Light drizzle", 53: "🌦️ Moderate drizzle", 55: "🌧️ Dense drizzle",
                61: "🌧️ Slight rain", 63: "🌧️ Moderate rain", 65: "🌧️ Heavy rain",
                71: "🌨️ Slight snow", 73: "🌨️ Moderate snow", 75: "❄️ Heavy snow",
                80: "🌦️ Rain showers", 81: "🌧️ Moderate showers", 82: "⛈️ Violent showers",
                95: "⛈️ Thunderstorm", 96: "⛈️ Thunderstorm with hail", 99: "⛈️ Severe thunderstorm"
            }
            
            code = current.get("weather_code", 0)
            condition = WMO_CODES.get(code, f"Code {code}")
            
            # Format the forecast
            forecast_lines = []
            if daily.get("time"):
                for i in range(min(3, len(daily["time"]))):
                    day = daily["time"][i]
                    hi = daily.get("temperature_2m_max", [None])[i]
                    lo = daily.get("temperature_2m_min", [None])[i]
                    precip = daily.get("precipitation_sum", [0])[i]
                    forecast_lines.append(f"  {day}: {lo}°C – {hi}°C, Precipitation: {precip}mm")
            
            summary = (
                f"📍 {resolved_name}\n"
                f"🌡️ Temperature: {current.get('temperature_2m', '?')}°C (feels like {current.get('apparent_temperature', '?')}°C)\n"
                f"🌬️ Wind: {current.get('wind_speed_10m', '?')} km/h\n"
                f"💧 Humidity: {current.get('relative_humidity_2m', '?')}%\n"
                f"Condition: {condition}\n"
                f"\n📅 3-Day Forecast:\n" + "\n".join(forecast_lines)
            )
            
            return {
                "location": resolved_name,
                "temperature": current.get("temperature_2m"),
                "feels_like": current.get("apparent_temperature"),
                "humidity": current.get("relative_humidity_2m"),
                "wind_speed": current.get("wind_speed_10m"),
                "condition": condition,
                "summary": summary,
            }
    
    except Exception as e:
        return {"error": f"Weather lookup failed: {str(e)}"}


# Register the tool
weather_tool = Tool(
    name="get_weather",
    description="Get current weather and 3-day forecast for any city or location in the world.",
    parameters=[
        ToolParameter(name="location", type="string", description="City name or location (e.g. 'London', 'New York', 'Tokyo')"),
    ],
    execute=get_weather,
    icon="🌤️",
    category="utility"
)

tool_registry.register(weather_tool)
