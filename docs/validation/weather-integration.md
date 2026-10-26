# Phase 4 Weather dashboard integration validation

Execution date: 2026-10-23, America/Toronto. Scope: Task 3 integration, automated
regressions, production assets, Docker runtime and separate live-provider smoke
checks. Task 4 device acceptance was not started.

## Source and implementation

Branch `main`, HEAD `f6588f48c0ef3b9ac53e86a85334093c363ad172`. Validation used
uncommitted working-tree changes, including the previously completed Weather
backend, frontend and clock/lifecycle fixes. Existing work and task files were
preserved. Nothing was committed or pushed.

Task 3 changes are limited to:

- `frontend/src/shell/Dashboard.tsx`: explicitly compose Weather, then Status.
- `frontend/src/shell/dashboard.css`: a basic two-column Grid, with a flexible
  Weather column and 180px Status column, 16px spacing and top alignment. At 900px
  or less, stack the widgets in source order. No widget internals were changed.
- `tests/e2e/dashboard.spec.ts`: deterministic combined dashboard regressions.
- `README.md`, this report and `status-vertical-slice.md`: operational information,
  evidence and acceptance-status reconciliation.

No widget registry, scheduler, state manager, dependency, database, persistent
cache or deployment service was introduced. Backend endpoints and both widgets'
feature code remain unchanged by Task 3.

## Executed deterministic checks

| Check | Observed result |
| --- | --- |
| Strict frontend type checking and production build | Passed |
| Backend suite against the compiled frontend | 77 passed |
| Controlled Status browser tests | 46 passed: 23 per engine |
| Controlled Weather browser tests | 152 passed: 76 per engine |
| Combined E2E against local FastAPI, port 18006 | 12 passed: 6 per engine |
| Same combined E2E against Docker, port 18007 | 12 passed: 6 per engine |
| Landscape 1024×768 and portrait 768×1024 | Layout assertions passed; modern WebKit screenshots visually reviewed |
| Unexpected browser console/page errors in combined E2E | None; deliberate HTTP 503 resource messages allowed only for the injected failing endpoint |
| Static assets and unknown page/API routes | Expected content types, root cache header and JSON 404 contracts passed |
| Compatibility-sensitive production output inspection | Safari/iOS 12 targets retained; findings below |
| `git diff --check` | Passed |

Commands executed from the repository root, except npm commands from `frontend/`:

```sh
npm run build
.venv/bin/python -m pytest -c backend/pytest.ini
.venv/bin/python -m uvicorn nightlight.main:app --app-dir backend --host 127.0.0.1 --port 18006
DASHBOARD_URL=http://127.0.0.1:18006 PLAYWRIGHT_BROWSERS_PATH=../spikes/frontend-compat/.browsers npm test
docker build -t nightlight-dashboard:weather-integration .
docker run --rm -d --name nightlight-weather-task3 -p 127.0.0.1:18007:8000 nightlight-dashboard:weather-integration
DASHBOARD_URL=http://127.0.0.1:18007 PLAYWRIGHT_BROWSERS_PATH=../spikes/frontend-compat/.browsers npm run test:e2e
```

Existing project-local dependencies and matching spike browser binaries were
used. Docker daemon access and local test servers required sandbox escalation;
the initial sandboxed Docker version command was denied, and approved execution
then succeeded. There were no test failures in Task 3.

E2E uses compiled dashboard assets served by real FastAPI. Weather responses are
intercepted at the browser with fixed Toronto forecasts and distinct values;
there is no live-provider dependency in these automated assertions. Status uses
the real backend except its explicit failure scenario; its delayed scenario
eventually continues to the real endpoint. Deferred responses demonstrate that
each widget can finish while the other remains loading. Separate HTTP 503 cases
verify failure isolation. Thus these E2E results are not evidence of live Weather
provider success; that was checked separately below.

## Production artifacts and compatibility review

Integrated assets:

- `index-u32ZNrdA.js`: 24.21 kB, 9.70 kB gzip.
- `index-imxAvCyP.css`: 1.83 kB, 0.68 kB gzip.

The existing `safari12`/`ios12` JavaScript and CSS targets and module-preload helper
are unchanged. Shell CSS uses basic Grid and Grid spacing, with no Flexbox gap,
new browser APIs, overflow clipping or fixed-height widget containers. Weather's
two-by-six grid, icons, labels and typography are unchanged. The landscape success
state fits within 1024×768; portrait stacks without horizontal overflow. E2E also
checks that forecast text fits inside individual cells. Long failure messages
may increase document height and remain scrollable rather than being clipped.

The emitted JavaScript was inspected for optional chaining, nullish coalescing,
Promise.finally calls, newer timeout/observer APIs and development/test fixture
content. None was found. These static checks, screenshots and modern Chromium/
WebKit execution do not prove Safari on iOS 12.5.8 compatibility.
An initial broad `Unmount` token check matched Preact's expected
`componentWillUnmount` method; inspection confirmed framework code, and checks
for actual fixture identifiers and quoted button text passed.

## Docker runtime and live-provider checks

Image: `nightlight-dashboard:weather-integration`

Image ID: `sha256:8953c88300b82960eb17d888ae303fdf83c129452d5ae0000671751b78575638`

The image built and started successfully using the existing multi-stage Dockerfile.
Inspection confirmed the configured user `10001:10001`, the existing Python/
Uvicorn command and one runtime application instance. A Python check inside the
running container confirmed UID/GID 10001, no Node/npm on the runtime PATH, and
availability of `America/Toronto` timezone data. The final stage contains Python,
backend packages and compiled assets, with no copied Node tooling or test fixtures.

Separate, real runtime HTTP requests observed:

- `/`: HTTP 200, `Cache-Control: no-cache`.
- `/api/widgets/status`: HTTP 200, exact `{"status":"ok"}` contract.
- `/api/widgets/weather`: HTTP 200, `Cache-Control: no-store`, 24 entries,
  `stale: false`. The body validated against the actual `WeatherResponse` model.
  Retrieval was `2026-10-24T00:39:36.991846+00:00` (October 23 in Toronto), distinct
  from hourly forecast validity.
- Direct certificate-verified HTTPS from the runtime to the configured Open-Meteo
  endpoint: HTTP 200, 26 hourly slots, validated with `ProviderForecast` and the
  real normalization/coverage logic.

These live checks succeeded during this task; they do not guarantee future
availability. No API credentials were used. Temporary validation processes were
stopped after verification; the built image remains available locally.

## Dependency audit findings

Docker's `npm ci` reported two high-severity audit findings. A separate read-only
`npm audit --json` confirmed affected existing development/build dependencies:
Vite 8.3.0 and source-map-js 1.2.1 (through Vite → PostCSS). `npm ls` confirmed that
tree. The audit exited nonzero because of these findings; it is not a passing
security audit. Node tooling is absent from the Python runtime, but these remain
development/build concerns. No dependency versions or lockfiles were changed.
Remediation needs a separate compatibility-reviewed dependency update.

## Acceptance evidence and remaining limitations

The project owner confirmed Phase 3 Docker, target-iPad compatibility and endurance
acceptance. The historical Status report now distinguishes that confirmation
from its earlier Pending statements. Missing owner-validation dates, device logs,
checklist measurements and endurance duration were not independently verified or
fabricated. Phase 3 acceptance does not certify the Phase 4 integration.

Weather remains fixed to Toronto and uses the existing five-minute visible poll,
15-minute backend cache, 60-second provider failure cooldown and finite in-memory
forecast buffer. Server restart and page reload/unmount lose their respective
caches. Retained data stays visible with stale/coverage indicators; uncovered
future slots show dashes. A permanently unresolved browser request can require
reload. Time estimated across offline suspension remains provisional until a
valid server response reconciles it. Attribution links and adaptation disclosure
are displayed beside the forecast.

For future Task 4, record the actual device, iOS/Safari version, build/image ID,
date and observations for landscape/portrait readability, fullscreen operation,
real network loss/recovery, suspend/resume, clock reconciliation and endurance.
No real-iPad, iOS 12.5.8 or new endurance acceptance is claimed here. Task 4 has
not started.
