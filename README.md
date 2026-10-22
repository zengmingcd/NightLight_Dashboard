# NightLight Dashboard

A lightweight dashboard for Safari on iOS 12.5.8. The production scaffold has
a Preact shell and Status Widget served by FastAPI from one origin.

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

The shell composes the Status Widget explicitly. On mount it requests
`GET /api/widgets/status`, whose Pydantic response is `{"status":"ok"}`. This
demonstrates application reachability. The widget shows loading, success or
failure and offers manual retry after failure; it does not poll.

Requests time out after 10 seconds. Retry remains disabled until the actual
request (including JSON reading) settles, even after requesting cancellation.
If cancellation is unavailable or ineffective and the request never settles,
reload is required. Replacement widgets also respect this feature-local guard,
and obsolete results cannot update them. No secrets are included in the API.

## Validation

Build the frontend first, then run backend integration tests:

```sh
.venv/bin/python -m pytest -c backend/pytest.ini
```

Install project-local browser binaries and run controlled Status behavior tests
and a small real frontend/backend test against the production build:

```sh
cd frontend
PLAYWRIGHT_BROWSERS_PATH=.browsers npx playwright install chromium webkit
PLAYWRIGHT_BROWSERS_PATH=.browsers npm test
```

To test an already running production container instead, use
`DASHBOARD_URL=http://127.0.0.1:8000 PLAYWRIGHT_BROWSERS_PATH=.browsers npm run test:e2e`.
`npm run test:status` runs only controlled widget tests using a development
fixture excluded from the production build and Docker context. `npm test`
builds first and runs both suites. Backend tests require that build, including
the encoded asset traversal test that checks both raw and decoded ASGI paths.
Modern Chromium/WebKit tests do not verify Safari on iOS 12.5.8. See the
[stack decision](docs/decisions/frontend_stack.md) and
[validation summary](docs/validation/ios-12-frontend-compatibility.md) for the
accepted baseline and its limitations. Production target-device and endurance
validation remain necessary.

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
- `backend/nightlight/`: FastAPI application and static serving.
- `backend/nightlight/widgets/status/`: Status router and Pydantic response.
- `backend/tests/`: application/static-serving integration tests.
- `frontend/tests/`: controlled widget tests and mount/unmount fixture.
- `tests/e2e/`: real frontend/backend browser test.
- `spikes/frontend-compat/`: isolated historical compatibility evidence.

The [Status slice validation report](docs/validation/status-vertical-slice.md)
records executed checks, limitations and the remaining target-iPad checklist.
