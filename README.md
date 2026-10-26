# NightLight Dashboard

A lightweight dashboard targeting Safari on iOS 12.5.8. A Preact shell explicitly
composes Toronto Weather and Status, served by FastAPI from one origin. Weather
occupies the primary landscape column; Status occupies a narrow secondary column.
At 900px or less, they stack in that order. Widget presentation remains feature-owned.

## Local setup

Use Python 3.12 and Node 22.12+ (the accepted frontend baseline used 22.23.1).
Dependencies remain project-local:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt
cd frontend
npm ci --cache .npm-cache
npm run build
cd ..
.venv/bin/python -m uvicorn nightlight.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000. Build the frontend before starting FastAPI: it serves
`frontend/dist/index.html` at `/` and generated assets at `/assets/`.
Unknown routes, including `/api`, return JSON 404 responses; there is no SPA fallback.

For frontend development, run `npm run dev` from `frontend/`. Its `/api` proxy
targets FastAPI at port 8000.

On mount, Status requests
`GET /api/widgets/status`, whose Pydantic response is `{"status":"ok"}`. This
demonstrates application reachability. The widget shows loading, success or
failure and offers manual retry after failure; it does not poll.

Requests time out after 10 seconds. Retry remains disabled until the actual
request (including JSON reading) settles, even after requesting cancellation.
If cancellation is unavailable or ineffective and the request never settles,
reload is required. Replacement widgets also respect this feature-local guard,
and obsolete results cannot update them. No secrets are included in the API.

## Toronto hourly forecast

Weather requests `GET /api/widgets/weather` from the local backend. FastAPI alone
communicates with Open-Meteo, for Toronto, Ontario, Canada at 43.6532, -79.3832.
No provider credentials are required for this personal, non-commercial use.

The widget displays the current hourly forecast slot and the following eleven in
a two-row, six-column grid. Each shows the Toronto-local hour/date/EST or EDT,
a local SVG condition icon, Celsius temperature and precipitation probability.
These are forecasts, not live observations. Percentages describe the preceding
hour's precipitation chance. Missing measurements and uncovered slots show `—`.

While visible, Weather polls every five minutes and recomputes its window every
minute. Visibility restoration and `pageshow` request an update. Visible elapsed
time uses a server timestamp plus monotonic time; hidden/departed elapsed time
is provisional until another valid server response. Clock changes during offline
suspension cannot always be distinguished from real elapsed time.

The backend requests 26 provider slots and returns up to 24, beginning with the
current hour. It caches validated data in memory for 15 minutes, coordinates one
refresh at a time and applies a 60-second cooldown after provider failures. There
is no background provider polling. Provider requests have a three-second connect
timeout, an eight-second total deadline and a 256 KiB response limit. Browser
requests have a 15-second deadline, held through response-body settlement.

`updated_at` records successful retrieval, `served_at` anchors the browser clock,
and each hourly `time` records forecast validity. Failed refreshes retain valid
data and clearly mark it stale without changing its retrieval timestamp. Exhausted
backend coverage returns HTTP 200 with stale metadata and empty `hours`; an initial
failure without any valid cache returns sanitized HTTP 503. Weather responses use
`Cache-Control: no-store`.

Caches do not survive backend restart or browser reload/unmount. An open widget
can retain data while the backend restarts. Forecast coverage is finite. If browser
cancellation is ineffective and a request never settles, further requests remain
blocked and the widget explains that reload may be required.

The widget includes [Open-Meteo attribution](https://open-meteo.com/en/licence),
a CC BY 4.0 link and disclosure of rounded values/grouped icons. Review provider
terms before commercial deployment; any future credentials must remain backend-only.

## Validation

Build the frontend first, then run backend integration tests:

```sh
.venv/bin/python -m pytest -c backend/pytest.ini
```

Install project-local browser binaries and run controlled Status/Weather tests
and combined dashboard E2E tests against the production build:

```sh
cd frontend
PLAYWRIGHT_BROWSERS_PATH=.browsers npx playwright install chromium webkit
PLAYWRIGHT_BROWSERS_PATH=.browsers npm test
```

To test an already running production container instead, use
`DASHBOARD_URL=http://127.0.0.1:8000 PLAYWRIGHT_BROWSERS_PATH=.browsers npm run test:e2e`.
`npm run test:status` and `npm run test:weather` run their respective controlled
widget suites, using fixtures excluded from the production build and Docker context.
`npm test` builds first and runs both widget suites and E2E. Dashboard E2E uses
deterministic Weather API fixtures, real Status responses except in explicit
failure/delay scenarios, and compiled assets served by FastAPI. Live-provider
smoke tests are separate. Backend tests require the frontend build, including
the encoded asset traversal test that checks both raw and decoded ASGI paths.
Modern Chromium/WebKit tests do not verify Safari on iOS 12.5.8. See the
[stack decision](docs/decisions/frontend_stack.md) and
[validation summary](docs/validation/ios-12-frontend-compatibility.md) for the
accepted baseline and its limitations. The project owner confirmed Phase 3 Docker,
target-iPad compatibility and endurance acceptance; detailed missing device logs,
dates and measurements have not been independently verified. Phase 4's integrated
dashboard needs its own target-device acceptance; Task 4 has not started.

## Docker

From the repository root:

```sh
docker build -t nightlight-dashboard .
docker run --rm --name nightlight-dashboard -p 8000:8000 nightlight-dashboard
```

Open http://127.0.0.1:8000. The multi-stage build uses Node only to build assets;
the runtime contains Python 3.12, FastAPI, Pydantic, Uvicorn and the built frontend.
It runs as an unprivileged user with one Uvicorn worker.

## Structure

- `frontend/src/shell/`: dashboard composition and layout.
- `frontend/src/widgets/status/`: Status UI, request lifecycle and feature styles.
- `frontend/src/widgets/weather/`: forecast UI, clock/lifecycle, validation and icons.
- `backend/nightlight/`: FastAPI application and static serving.
- `backend/nightlight/widgets/status/`: Status router and Pydantic response.
- `backend/nightlight/widgets/weather/`: Open-Meteo access, validation, cache and API.
- `backend/tests/`: application/static-serving integration tests.
- `frontend/tests/`: controlled widget tests and mount/unmount fixture.
- `tests/e2e/`: compiled dashboard integration tests with controlled Weather fixtures.
- `spikes/frontend-compat/`: isolated historical compatibility evidence.

The [Status slice validation report](docs/validation/status-vertical-slice.md)
records historical checks and owner-confirmed Phase 3 acceptance. The
[Weather integration report](docs/validation/weather-integration.md) records
Task 3 checks separately from live-provider results and remaining device acceptance.
