# NightLight Dashboard

A lightweight dashboard for Safari on iOS 12.5.8. The production scaffold has
a minimal Preact shell served by FastAPI, with no widgets or feature APIs yet.

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
targets FastAPI at port 8000. No API endpoints are implemented in this scaffold.

## Validation

Build the frontend first, then run backend integration tests:

```sh
.venv/bin/python -m pytest -c backend/pytest.ini
```

Install project-local browser binaries and run the dashboard smoke test against
the built frontend served by FastAPI:

```sh
cd frontend
PLAYWRIGHT_BROWSERS_PATH=.browsers npx playwright install chromium webkit
PLAYWRIGHT_BROWSERS_PATH=.browsers npm test
```

To test an already running production container instead, use
`DASHBOARD_URL=http://127.0.0.1:8000 PLAYWRIGHT_BROWSERS_PATH=.browsers npm test`.
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
- `backend/nightlight/`: FastAPI application and static serving.
- `backend/tests/`: application/static-serving integration tests.
- `tests/e2e/`: browser smoke test across the frontend/backend boundary.
- `spikes/frontend-compat/`: isolated historical compatibility evidence.

Future widget code belongs in matching frontend/backend feature directories;
no placeholder widget or shared directories are created yet.
