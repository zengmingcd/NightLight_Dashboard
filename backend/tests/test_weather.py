import json
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, reset_tzpath

import anyio
import httpx2
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from nightlight.main import app
from nightlight.widgets.weather import service as weather_module
from nightlight.widgets.weather.models import ProviderForecast
from nightlight.widgets.weather.router import weather_service
from nightlight.widgets.weather.service import (
    CACHE_TTL_SECONDS, FAILURE_COOLDOWN_SECONDS, MAX_RESPONSE_BYTES,
    PROVIDER_PARAMS, PROVIDER_URL, WeatherService, WeatherUnavailable,
    current_hour, normalize,
)


@pytest.fixture
def anyio_backend():
    return "asyncio"


class Clock:
    def __init__(self, now="2026-10-23T11:15:00+00:00"):
        self.now = datetime.fromisoformat(now)
        self.tick = 1000.0

    def advance(self, seconds):
        self.now += timedelta(seconds=seconds)
        self.tick += seconds


def provider_data(now, count=26):
    start = int(current_hour(now).timestamp())
    return {
        "timezone": "America/Toronto",
        # Deliberately fixed: normalization must not use this across DST.
        "utc_offset_seconds": -14400,
        "hourly_units": {
            "time": "unixtime", "temperature_2m": "°C",
            "precipitation_probability": "%", "weather_code": "wmo code", "is_day": "",
        },
        "hourly": {
            "time": [start + i * 3600 for i in range(count)],
            "temperature_2m": [12.4] * count,
            "precipitation_probability": [20] * count,
            "weather_code": [2] * count,
            "is_day": [1] * count,
        },
    }


class Body(httpx2.AsyncByteStream):
    def __init__(self, *chunks, hang=False):
        self.chunks = chunks
        self.hang = hang
        self.closed = False
        self.reads = 0

    async def __aiter__(self):
        for chunk in self.chunks:
            self.reads += 1
            yield chunk
        if self.hang:
            await anyio.sleep_forever()

    async def aclose(self):
        self.closed = True


def upstream(data, *, status=200, headers=None):
    body = Body(json.dumps(data).encode())
    return httpx2.Response(
        status, headers={"content-type": "application/json", **(headers or {})}, stream=body,
    )


def make_service(client, clock):
    return WeatherService(client, now=lambda: clock.now, clock=lambda: clock.tick)


@pytest.mark.parametrize("instant", [
    "2026-10-23T11:00:00+00:00", "2026-10-23T11:00:01+00:00",
    "2026-10-23T11:15:00+00:00", "2026-10-23T11:59:59.999999+00:00",
])
def test_current_hour_includes_started_slot(instant):
    now = datetime.fromisoformat(instant)
    hours = normalize(ProviderForecast.model_validate(provider_data(now)), now, ZoneInfo("America/Toronto"))
    assert hours[0].time == datetime(2026, 10, 23, 11, tzinfo=UTC)
    assert hours[0].local_label == "07:00"
    assert hours[11].local_label == "18:00"


@pytest.mark.parametrize(("instant", "labels", "zones", "dates"), [
    ("2026-03-08T06:15:00+00:00", ["01:00", "03:00", "04:00"],
     ["EST", "EDT", "EDT"], ["2026-03-08"] * 3),
    ("2026-11-01T05:15:00+00:00", ["01:00", "01:00", "02:00"],
     ["EDT", "EST", "EST"], ["2026-11-01"] * 3),
    ("2026-10-24T03:15:00+00:00", ["23:00", "00:00", "01:00"],
     ["EDT"] * 3, ["2026-10-23", "2026-10-24", "2026-10-24"]),
])
def test_dst_and_midnight(instant, labels, zones, dates):
    now = datetime.fromisoformat(instant)
    hours = normalize(ProviderForecast.model_validate(provider_data(now)), now, ZoneInfo("America/Toronto"))
    assert [hour.local_label for hour in hours[:3]] == labels
    assert [hour.local_zone for hour in hours[:3]] == zones
    assert [hour.local_date for hour in hours[:3]] == dates
    assert all(b.time - a.time == timedelta(hours=1) for a, b in zip(hours, hours[1:]))


def test_timezone_package_works_without_os_timezone_database():
    try:
        reset_tzpath(())
        zone = ZoneInfo.no_cache("America/Toronto")
        assert datetime(2026, 1, 1, tzinfo=UTC).astimezone(zone).tzname() == "EST"
        assert datetime(2026, 7, 1, tzinfo=UTC).astimezone(zone).tzname() == "EDT"
    finally:
        reset_tzpath()


def test_nulls_unknown_codes_and_night():
    clock = Clock()
    data = provider_data(clock.now)
    for field in ("temperature_2m", "precipitation_probability", "weather_code", "is_day"):
        data["hourly"][field][0] = None
    data["hourly"]["weather_code"][1] = 123456
    data["hourly"]["is_day"][1] = 0
    hours = normalize(ProviderForecast.model_validate(data), clock.now, ZoneInfo("America/Toronto"))
    assert hours[0].temperature_c is None
    assert hours[0].precipitation_probability_pct is None
    assert hours[0].weather_code is None
    assert hours[0].is_day is None
    assert hours[1].weather_code == 123456
    assert hours[1].is_day is False


@pytest.mark.parametrize(("field", "value"), [
    ("temperature_2m", "12"), ("temperature_2m", float("nan")),
    ("temperature_2m", float("inf")), ("temperature_2m", True),
    ("precipitation_probability", -1), ("precipitation_probability", 101),
    ("precipitation_probability", float("inf")), ("precipitation_probability", "20"),
    ("weather_code", 2.5), ("weather_code", -1), ("weather_code", True),
    ("is_day", 2), ("is_day", "1"), ("is_day", True), ("is_day", False),
    ("time", True), ("time", "123"),
    ("time", 999999999999999),
])
def test_invalid_measurements(field, value):
    data = provider_data(Clock().now)
    data["hourly"][field][0] = value
    with pytest.raises(ValidationError):
        ProviderForecast.model_validate(data)


@pytest.mark.parametrize("mutation", [
    "unequal", "duplicate", "gap", "descending", "unaligned", "missing", "units",
    "timezone", "too_many", "no_current", "short", "empty", "all_null",
])
def test_invalid_provider_shape_or_coverage(mutation):
    clock = Clock()
    data = provider_data(clock.now)
    if mutation == "unequal":
        data["hourly"]["temperature_2m"].pop()
    elif mutation in ("duplicate", "gap", "descending", "unaligned"):
        data["hourly"]["time"][1] += {
            "duplicate": -3600, "gap": 3600, "descending": -7200, "unaligned": 1,
        }[mutation]
    elif mutation == "missing":
        del data["hourly"]["is_day"]
    elif mutation == "units":
        data["hourly_units"]["temperature_2m"] = "°F"
    elif mutation == "timezone":
        data["timezone"] = "GMT"
    elif mutation == "too_many":
        data = provider_data(clock.now, 27)
    elif mutation == "no_current":
        data = provider_data(clock.now + timedelta(hours=1))
    elif mutation == "short":
        data = provider_data(clock.now, 24)
    elif mutation == "empty":
        data = provider_data(clock.now, 0)
    elif mutation == "all_null":
        for field in ("temperature_2m", "precipitation_probability", "weather_code"):
            data["hourly"][field] = [None] * 26
    with pytest.raises(ValueError):
        normalize(ProviderForecast.model_validate(data), clock.now, ZoneInfo("America/Toronto"))


@pytest.mark.anyio
async def test_provider_request_cache_ttl_and_rollover():
    clock = Clock("2026-10-23T11:59:59+00:00")
    requests = []

    def handler(request):
        requests.append(request)
        return upstream(provider_data(clock.now))

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
        service = make_service(client, clock)
        first = await service.forecast()
        assert len(first.hours) == 24
        assert first.hours[0].local_label == "07:00"
        assert not first.stale and first.refresh_error is None
        assert first.updated_at == clock.now == first.served_at
        assert first.stale_after == first.updated_at + timedelta(minutes=15)
        request = requests[0]
        assert str(request.url).split("?")[0] == PROVIDER_URL
        assert dict(request.url.params) == PROVIDER_PARAMS
        assert request.headers["accept-encoding"] == "identity"
        assert request.extensions["timeout"] == {"connect": 3, "read": 5, "write": 5, "pool": 5}
        clock.advance(1)
        rolled = await service.forecast()
        assert len(rolled.hours) == 24 and rolled.hours[0].local_label == "08:00"
        assert rolled.updated_at == first.updated_at
        clock.advance(CACHE_TTL_SECONDS - 2)
        assert (await service.forecast()).updated_at == first.updated_at
        assert len(requests) == 1
        clock.advance(1)
        refreshed = await service.forecast()
        assert len(requests) == 2
        assert refreshed.updated_at == clock.now and not refreshed.stale


@pytest.mark.anyio
async def test_inflight_hour_boundary_has_cache_headroom():
    clock = Clock("2026-10-23T11:59:59+00:00")

    def handler(request):
        data = provider_data(clock.now)
        clock.advance(2)
        return upstream(data)

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
        service = make_service(client, clock)
        first = await service.forecast()
        assert len(first.hours) == 24 and first.hours[0].local_label == "08:00"


@pytest.mark.anyio
async def test_retention_cooldown_exhaustion_and_recovery():
    clock = Clock()
    calls = 0
    failing = False

    def handler(request):
        nonlocal calls
        calls += 1
        return upstream({"secret": "do not expose"}, status=500) if failing else upstream(provider_data(clock.now))

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
        service = make_service(client, clock)
        first = await service.forecast()
        failing = True
        clock.advance(CACHE_TTL_SECONDS)
        stale = await service.forecast()
        assert stale.stale and stale.refresh_error == "upstream_unavailable"
        assert stale.updated_at == first.updated_at and stale.hours == first.hours
        assert stale.stale_after == first.stale_after
        clock.advance(FAILURE_COOLDOWN_SECONDS - 1)
        await service.forecast()
        assert calls == 2
        clock.advance(1)
        await service.forecast()
        assert calls == 3
        clock.advance(25 * 3600)
        partial = await service.forecast()
        assert len(partial.hours) == 1 and partial.hours[0].local_label == "08:00"
        clock.advance(3600)
        exhausted = await service.forecast()
        assert exhausted.hours == [] and exhausted.stale
        assert exhausted.updated_at == first.updated_at
        failing = False
        clock.advance(FAILURE_COOLDOWN_SECONDS)
        recovered = await service.forecast()
        assert len(recovered.hours) == 24 and not recovered.stale
        assert recovered.refresh_error is None and recovered.updated_at == clock.now


@pytest.mark.anyio
async def test_cold_failure_cooldown_and_new_service_has_no_persistence():
    clock = Clock()
    calls = 0
    failing = False

    def handler(request):
        nonlocal calls
        calls += 1
        if failing:
            raise httpx2.ConnectError("private upstream details", request=request)
        return upstream(provider_data(clock.now))

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
        await make_service(client, clock).forecast()
        failing = True
        restarted = make_service(client, clock)
        for _ in range(3):
            with pytest.raises(WeatherUnavailable):
                await restarted.forecast()
        assert calls == 2
        clock.advance(FAILURE_COOLDOWN_SECONDS)
        with pytest.raises(WeatherUnavailable):
            await restarted.forecast()
        assert calls == 3


@pytest.mark.anyio
@pytest.mark.parametrize("failing", [False, True])
async def test_concurrent_calls_share_one_refresh(failing):
    clock = Clock()
    entered, release = anyio.Event(), anyio.Event()
    calls = 0
    results = []

    async def handler(request):
        nonlocal calls
        calls += 1
        entered.set()
        await release.wait()
        return upstream(provider_data(clock.now), status=503 if failing else 200)

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
        service = make_service(client, clock)

        async def request():
            try:
                results.append(await service.forecast())
            except WeatherUnavailable:
                results.append(None)

        async with anyio.create_task_group() as group:
            for _ in range(10):
                group.start_soon(request)
            await entered.wait()
            release.set()
        assert calls == 1 and len(results) == 10
        if failing:
            assert results == [None] * 10
        else:
            assert all(result.updated_at == clock.now for result in results)


@pytest.mark.anyio
@pytest.mark.parametrize("failure", [
    "json", "schema", "http", "redirect", "network", "read_timeout", "size_header",
    "size_stream", "compression", "content_type", "bad_length",
])
async def test_bad_provider_responses_never_replace_cache(failure):
    clock = Clock()
    failing = False
    bodies = []

    def handler(request):
        if not failing:
            return upstream(provider_data(clock.now))
        if failure == "network":
            raise httpx2.ConnectError("private", request=request)
        if failure == "read_timeout":
            raise httpx2.ReadTimeout("private", request=request)
        headers = {"content-type": "application/json"}
        status = 200
        body = Body(b"{invalid")
        if failure == "schema":
            body = Body(b'{"hourly": null}')
        elif failure == "http":
            status, body = 500, Body(hang=True)
        elif failure == "redirect":
            status, headers["location"] = 302, "https://private.invalid"
        elif failure == "size_header":
            headers["content-length"] = str(MAX_RESPONSE_BYTES + 1)
        elif failure == "size_stream":
            body = Body(b" " * MAX_RESPONSE_BYTES, b"x")
        elif failure == "compression":
            headers["content-encoding"] = "gzip"
        elif failure == "content_type":
            headers["content-type"] = "text/html"
        elif failure == "bad_length":
            headers["content-length"] = "wrong"
        bodies.append(body)
        return httpx2.Response(status, headers=headers, stream=body)

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
        service = make_service(client, clock)
        first = await service.forecast()
        failing = True
        clock.advance(CACHE_TTL_SECONDS)
        result = await service.forecast()
        assert result.stale and result.refresh_error == "upstream_unavailable"
        assert result.updated_at == first.updated_at and result.hours == first.hours
        assert all(body.closed for body in bodies)
        if failure == "http":
            assert bodies[0].reads == 0


@pytest.mark.anyio
@pytest.mark.parametrize("stage", ["headers", "body"])
@pytest.mark.parametrize("warm_cache", [False, True])
async def test_total_deadline_covers_headers_and_slow_body(stage, warm_cache, monkeypatch):
    # Exercise real cancellation with a short deadline, not an eight-second sleep.
    monkeypatch.setattr(weather_module, "REQUEST_TIMEOUT_SECONDS", 0.02)
    clock = Clock()
    body = Body(b'{"hourly":', hang=True)
    hanging = not warm_cache

    async def handler(request):
        if not hanging:
            return upstream(provider_data(clock.now))
        if stage == "headers":
            await anyio.sleep_forever()
        return httpx2.Response(200, headers={"content-type": "application/json"}, stream=body)

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
        service = make_service(client, clock)
        if warm_cache:
            first = await service.forecast()
            clock.advance(CACHE_TTL_SECONDS)
            hanging = True
        with anyio.fail_after(1):
            if warm_cache:
                retained = await service.forecast()
                assert retained.stale and retained.refresh_error == "upstream_unavailable"
                assert retained.updated_at == first.updated_at and retained.hours == first.hours
            else:
                with pytest.raises(WeatherUnavailable):
                    await service.forecast()
        if stage == "body":
            assert body.closed
        # Timeout releases the lock; cooldown prevents repeated provider work.
        if warm_cache:
            assert (await service.forecast()).updated_at == first.updated_at
        else:
            with pytest.raises(WeatherUnavailable):
                await service.forecast()


@pytest.mark.anyio
async def test_concurrent_expired_cache_requests_share_one_refresh():
    clock = Clock()
    calls = 0
    entered, release = anyio.Event(), anyio.Event()

    async def handler(request):
        nonlocal calls
        calls += 1
        if calls == 2:
            entered.set()
            await release.wait()
        return upstream(provider_data(clock.now))

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
        service = make_service(client, clock)
        first = await service.forecast()
        clock.advance(CACHE_TTL_SECONDS)
        results = []

        async def request():
            results.append(await service.forecast())

        async with anyio.create_task_group() as group:
            for _ in range(10):
                group.start_soon(request)
            await entered.wait()
            release.set()
        assert calls == 2 and len(results) == 10
        assert all(result.updated_at == clock.now > first.updated_at for result in results)


@pytest.mark.anyio
async def test_cancellation_closes_stream_and_cannot_overwrite_replacement():
    clock = Clock()
    entered = anyio.Event()
    body = Body(hang=True)
    calls = 0
    results = []

    async def handler(request):
        nonlocal calls
        calls += 1
        if calls == 1:
            entered.set()
            return httpx2.Response(200, headers={"content-type": "application/json"}, stream=body)
        return upstream(provider_data(clock.now))

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
        service = make_service(client, clock)
        async with anyio.create_task_group() as group:
            async def request():
                results.append(await service.forecast())
            group.start_soon(request)
            await entered.wait()
            group.cancel_scope.cancel()
        assert body.closed and results == []
        recovered = await service.forecast()
        assert calls == 2 and len(recovered.hours) == 24 and not recovered.stale


@pytest.mark.anyio
async def test_wall_clock_changes_do_not_extend_ttl_or_mislabel_hours():
    clock = Clock()
    calls = 0

    def handler(request):
        nonlocal calls
        calls += 1
        if calls > 1:
            return upstream({}, status=503)
        return upstream(provider_data(clock.now))

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
        service = make_service(client, clock)
        first = await service.forecast()
        clock.tick += CACHE_TTL_SECONDS
        clock.now -= timedelta(hours=1)
        result = await service.forecast()
        assert calls == 2 and result.stale and result.hours == []
        assert result.updated_at == first.updated_at


def test_endpoint_contract_stale_empty_and_sanitized_unavailable():
    clock = Clock()
    failing = False
    calls = 0

    def handler(request):
        nonlocal calls
        calls += 1
        if failing:
            raise httpx2.ConnectError("SECRET upstream host", request=request)
        return upstream(provider_data(clock.now))

    # The application's real lifespan creates/closes the mock-backed client.
    with pytest.MonkeyPatch.context() as patch:
        real_client = httpx2.AsyncClient
        patch.setattr("nightlight.main.httpx2.AsyncClient", lambda **kwargs: real_client(
            transport=httpx2.MockTransport(handler), **kwargs,
        ))
        with TestClient(app) as client:
            service = make_service(app.state.weather._client, clock)
            app.dependency_overrides[weather_service] = lambda: service
            try:
                response = client.get("/api/widgets/weather")
                assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
                data = response.json()
                assert set(data) == {"location", "timezone", "served_at", "updated_at", "updated_label",
                                     "stale_after", "stale", "refresh_error", "hours"}
                assert data["location"] == "Toronto, Ontario, Canada"
                assert data["timezone"] == "America/Toronto"
                assert data["updated_at"] == data["served_at"] == "2026-10-23T11:15:00Z"
                assert data["stale_after"] == "2026-10-23T11:30:00Z"
                assert data["updated_label"] == "Oct 23, 07:15 EDT"
                assert len(data["hours"]) == 24
                assert data["hours"][0] == {
                    "time": "2026-10-23T11:00:00Z", "local_label": "07:00",
                    "local_date": "2026-10-23", "local_zone": "EDT", "temperature_c": 12.4,
                    "precipitation_probability_pct": 20.0, "weather_code": 2, "is_day": True,
                }
                failing = True
                clock.advance(CACHE_TTL_SECONDS)
                stale = client.get("/api/widgets/weather").json()
                assert stale["stale"] and stale["updated_at"] == data["updated_at"]
                assert stale["refresh_error"] == "upstream_unavailable"
                clock.advance(26 * 3600)
                exhausted = client.get("/api/widgets/weather")
                assert exhausted.status_code == 200
                assert exhausted.json()["hours"] == [] and exhausted.json()["stale"]
                app.dependency_overrides[weather_service] = lambda: make_service(service._client, clock)
                unavailable = client.get("/api/widgets/weather")
                assert unavailable.status_code == 503
                assert unavailable.headers["cache-control"] == "no-store"
                assert unavailable.headers["retry-after"] == "60"
                assert unavailable.json() == {"error": {
                    "code": "weather_unavailable", "message": "Weather is temporarily unavailable.",
                }}
                assert "SECRET" not in unavailable.text
            finally:
                app.dependency_overrides.clear()
        assert not hasattr(app.state, "weather")


def test_application_lifespan_does_not_poll_and_closes_client():
    with TestClient(app) as client:
        weather = app.state.weather
        assert weather._updated_at is None
        assert client.get("/api/widgets/status").json() == {"status": "ok"}
        assert weather._updated_at is None
        assert not weather._client.is_closed
    assert weather._client.is_closed
    assert not hasattr(app.state, "weather")
