from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from time import monotonic
from zoneinfo import ZoneInfo

import anyio
import httpx2

from .models import ForecastHour, ProviderForecast, WeatherResponse


CACHE_TTL_SECONDS = 15 * 60
FAILURE_COOLDOWN_SECONDS = 60
REQUEST_TIMEOUT_SECONDS = 8
MAX_RESPONSE_BYTES = 256 * 1024
PROVIDER_HOURS = 26  # 24 public slots + cache rollover + in-flight rollover.
PROVIDER_URL = "https://api.open-meteo.com/v1/forecast"
PROVIDER_PARAMS = {
    "latitude": "43.6532",
    "longitude": "-79.3832",
    "hourly": "temperature_2m,precipitation_probability,weather_code,is_day",
    "temperature_unit": "celsius",
    "timezone": "America/Toronto",
    "timeformat": "unixtime",
    "forecast_hours": str(PROVIDER_HOURS),
}


class WeatherUnavailable(Exception):
    """No previously validated usable forecast is available."""


def current_hour(now: datetime) -> datetime:
    return now.astimezone(UTC).replace(minute=0, second=0, microsecond=0)


def normalize(data: ProviderForecast, now: datetime, zone: ZoneInfo) -> tuple[ForecastHour, ...]:
    source = data.hourly
    hours = []
    for index, timestamp in enumerate(source.time):
        instant = datetime.fromtimestamp(timestamp, UTC)
        local = instant.astimezone(zone)
        hours.append(ForecastHour(
            time=instant,
            local_label=local.strftime("%H:%M"),
            local_date=local.date().isoformat(),
            local_zone=local.tzname(),
            temperature_c=source.temperature_2m[index],
            precipitation_probability_pct=source.precipitation_probability[index],
            weather_code=source.weather_code[index],
            is_day=None if source.is_day[index] is None else bool(source.is_day[index]),
        ))
    start = current_hour(now)
    upcoming = [hour for hour in hours if hour.time >= start]
    # Require a current slot and headroom to return 24 through a cache rollover.
    if len(upcoming) < 25 or upcoming[0].time != start:
        raise ValueError("Insufficient current forecast coverage")
    if not any(
        hour.temperature_c is not None or hour.precipitation_probability_pct is not None
        or hour.weather_code is not None for hour in upcoming[:12]
    ):
        raise ValueError("No usable forecast measurements")
    return tuple(hours)


class WeatherService:
    def __init__(
        self,
        client: httpx2.AsyncClient,
        *,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
        clock: Callable[[], float] = monotonic,
    ):
        self._client = client
        self._now = now
        self._clock = clock
        self._zone = ZoneInfo("America/Toronto")
        self._lock = anyio.Lock()
        self._hours: tuple[ForecastHour, ...] = ()
        self._updated_at: datetime | None = None
        self._updated_clock = 0.0
        self._retry_at = 0.0
        self._refresh_error = False

    def _expired(self) -> bool:
        return self._updated_at is None or (
            self._clock() - self._updated_clock >= CACHE_TTL_SECONDS
            or self._now() >= self._updated_at + timedelta(seconds=CACHE_TTL_SECONDS)
        )

    async def _retrieve(self) -> ProviderForecast:
        # Refuse compression so both retained bytes and JSON parsing are bounded.
        # Closing the stream also covers HTTP errors without buffering their bodies.
        async with self._client.stream(
            "GET", PROVIDER_URL, params=PROVIDER_PARAMS,
            headers={"Accept": "application/json", "Accept-Encoding": "identity"},
            timeout=httpx2.Timeout(5, connect=3), follow_redirects=False,
        ) as response:
            response.raise_for_status()
            if response.headers.get("content-encoding", "identity").lower() != "identity":
                raise ValueError("Unexpected encoding")
            if response.headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
                raise ValueError("Expected JSON")
            length = response.headers.get("content-length")
            if length is not None and int(length) > MAX_RESPONSE_BYTES:
                raise ValueError("Response too large")
            body = bytearray()
            async for chunk in response.aiter_raw():
                if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
                    raise ValueError("Response too large")
                body.extend(chunk)
            return ProviderForecast.model_validate_json(body)

    async def forecast(self) -> WeatherResponse:
        # No detached refresh tasks: cancellation cannot leave an obsolete writer.
        async with self._lock:
            if self._expired() and self._clock() >= self._retry_at:
                try:
                    with anyio.fail_after(REQUEST_TIMEOUT_SECONDS):
                        data = await self._retrieve()
                        retrieved_at = self._now().astimezone(UTC)
                        hours = normalize(data, retrieved_at, self._zone)
                except (httpx2.HTTPError, ValueError, TimeoutError):
                    self._refresh_error = True
                    self._retry_at = self._clock() + FAILURE_COOLDOWN_SECONDS
                else:
                    self._hours = hours
                    self._updated_at = retrieved_at
                    self._updated_clock = self._clock()
                    self._refresh_error = False
                    self._retry_at = 0.0

            if self._updated_at is None:
                raise WeatherUnavailable
            served_at = self._now().astimezone(UTC)
            start = current_hour(served_at)
            hours = [hour for hour in self._hours if hour.time >= start][:24]
            # A backward wall-clock jump must not label later slots as current.
            if hours and hours[0].time != start:
                hours = []
            local_update = self._updated_at.astimezone(self._zone)
            return WeatherResponse(
                served_at=served_at,
                updated_at=self._updated_at,
                updated_label=local_update.strftime("%b %d, %H:%M %Z"),
                stale_after=self._updated_at + timedelta(seconds=CACHE_TTL_SECONDS),
                stale=self._expired() or self._refresh_error or not hours,
                refresh_error="upstream_unavailable" if self._refresh_error else None,
                hours=hours,
            )
