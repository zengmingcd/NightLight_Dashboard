# Frontend dependency security patch

Validation date: 2026-10-23, America/Toronto. Based on `main` at `f6588f4`
with the existing, approved, uncommitted Weather integration preserved.
Task 4 was not started. Nothing was committed or pushed.

## Scope and exact dependency changes

Only `frontend/package.json`, `frontend/package-lock.json` and this report were
changed during this task. Application code, tests, Docker configuration and
Safari/iOS 12 build targets were unchanged. Earlier working-tree changes remain.

The manifest change is exactly `devDependencies.vite`: `8.3.0` → `8.3.3`.
source-map-js remains transitive through the unchanged PostCSS 8.5.28; its
existing `^1.2.1` requirement permits 1.2.2. No override or new direct dependency
was added. The lockfile retains exact versions, registry URLs and integrity hashes.

| Package | Before | After |
| --- | --- | --- |
| vite | 8.3.0 | 8.3.3 |
| source-map-js | 1.2.1 | 1.2.2 |
| rolldown | 1.2.8 | 1.2.11 |
| @oxc-project/types | 0.149.0 | 0.151.0 |
| All 15 @rolldown/binding packages listed below | 1.2.8 | 1.2.11 |

Vite 8.3.3 requires Rolldown `~1.2.11`, so retaining 1.2.8 is not valid.
1.2.11 is the minimum supported version and was selected instead of npm's
initial resolution of 1.2.15. Rolldown requires the matching bindings and exactly
@oxc-project/types 0.151.0. These are required dependency changes, not unrelated
upgrades. A structural comparison of the pre-task and final lockfiles confirmed
exactly 19 changed package entries, with no added, removed or unrelated entries.

The binding package names, each prefixed with `@rolldown/binding-`, are:

```text
android-arm-eabi
android-arm64
darwin-arm64
darwin-x64
freebsd-x64
linux-arm-gnueabihf
linux-arm64-gnu
linux-arm64-musl
linux-ppc64-gnu
linux-s390x-gnu
linux-x64-gnu
linux-x64-musl
openharmony-arm64
win32-arm64-msvc
win32-x64-msvc
```

Preact 10.29.8, TypeScript 7.0.2, Playwright 1.63.0, PostCSS 8.5.28 and all other
locked package entries remain unchanged. The historical compatibility spike was
not upgraded.

## Advisory coverage and audit

The executed pre-patch `npm audit --json` reported two high-severity affected
packages, covering seven advisories:

- source-map-js ≥1.0.0, <1.2.2:
  [GHSA-68fv-2mgg-jv7q / CVE-2026-93749](https://github.com/advisories/GHSA-68fv-2mgg-jv7q),
  indexed source-map denial of service. Fixed in
  [source-map-js 1.2.2](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2).
- Vite 8.3.0–8.3.2: launch-editor advisories
  [GHSA-587h-7wmj-h5pm](https://github.com/vitejs/launch-editor/security/advisories/GHSA-587h-7wmj-h5pm),
  [GHSA-698v-4r3x-3vcv](https://github.com/vitejs/launch-editor/security/advisories/GHSA-698v-4r3x-3vcv)
  and [GHSA-r825-w8mm-5pxw](https://github.com/vitejs/launch-editor/security/advisories/GHSA-r825-w8mm-5pxw);
  custom middleware script execution
  [GHSA-9jrq-w75r-8gcw](https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw);
  and file disclosure
  [GHSA-rq7h-c2jc-7f22](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22)
  and [GHSA-vfpm-58rq-9qcg](https://github.com/vitejs/vite/security/advisories/GHSA-vfpm-58rq-9qcg).
  Fixed in [Vite 8.3.3](https://github.com/vitejs/vite/releases/tag/v8.3.3).
  Installed Vite code confirms bundled launch-editor 2.14.2 instead of 2.14.1.

Registry metadata confirmed the selected releases and their Node requirements.
Node 22.23.1/npm 10.9.8 were used. A clean `npm ci` succeeded. The subsequent
`npm audit --json` exited zero with **zero vulnerabilities at every severity**.
Docker's separate `npm ci` also reported zero vulnerabilities. This is an npm
dependency audit, not a Python or container OS vulnerability assessment.

## Executed validation

| Check | Result |
| --- | --- |
| Strict TypeScript checks and local production builds | Passed |
| Backend pytest suite against compiled assets | 77 passed |
| Status browser suite | 46 passed: 23 per engine |
| Weather browser suite | 152 passed: 76 per engine |
| Combined E2E against local FastAPI, port 18008 | 12 passed: 6 per engine |
| Combined E2E against rebuilt Docker, port 18009 | 12 passed: 6 per engine |
| Docker production build, including TypeScript check | Passed |
| Lockfile change-scope assertion and `git diff --check` | Passed |

Browser engines were modern Chromium and WebKit, using existing project-local
spike browser binaries. Combined E2E covers independent loading and failure,
forecast values, 1024×768/768×1024 layouts, overflow, browser errors, assets and
404 behavior. Weather fixtures are deterministic; live-provider checks below
were separate. No test assertions or application logic were changed.

Relevant commands, from `frontend/` except backend and Docker commands:

```sh
npm ci --no-audit
npm audit --json
npm run build
.venv/bin/python -m pytest -c backend/pytest.ini
DASHBOARD_URL=http://127.0.0.1:18008 PLAYWRIGHT_BROWSERS_PATH=../spikes/frontend-compat/.browsers npm test
docker build -t nightlight-dashboard:dependency-security-patch .
docker run --rm -d --name nightlight-dependency-security-patch -p 127.0.0.1:18009:8000 nightlight-dashboard:dependency-security-patch
DASHBOARD_URL=http://127.0.0.1:18009 PLAYWRIGHT_BROWSERS_PATH=../spikes/frontend-compat/.browsers npm run test:e2e -- --output=/tmp/nightlight-dependency-patch/docker-e2e
```

## Compiled assets and compatibility

All three generated files are byte-for-byte identical to the assets captured
before this patch. Docker-served files have the same SHA-256 hashes:

| File | SHA-256 |
| --- | --- |
| index.html | 2bc5add76be11c7af57f420a5c7d3c81ceb55081eb342185f3c77a0625fb052d |
| assets/index-u32ZNrdA.js | 4eeb455b3fad84f939967b7e967e49c0fdfd73bdf9bde2814f82fc2a4edf68fb |
| assets/index-imxAvCyP.css | 6f9d10c0f0dbf064698ee88a0592ad20b923540577fb5bc953ad4c6ed644199a |

The `safari12`/`ios12` JavaScript and CSS targets and module-preload polyfill remain.
Output checks found no optional chaining, nullish coalescing, Promise.finally
calls, AbortSignal timeout/any APIs, ResizeObserver/IntersectionObserver, Vite
development client or widget test fixture identifiers. CSS retains the existing
Grid/grid-gap layout. Identical output demonstrates no emitted-asset change for
this application; it does not establish target-device compatibility.

## Docker and live smoke check

Rebuilt image: `nightlight-dashboard:dependency-security-patch`.
Image ID: `sha256:8953c88300b82960eb17d888ae303fdf83c129452d5ae0000671751b78575638`.
The runtime image ID matches the earlier integration image because the rebuilt
frontend assets and runtime inputs are identical; build tooling is not copied
into the runtime stage.

Checks inside the running container confirmed UID/GID 10001, no Node/npm on PATH,
and America/Toronto timezone availability. Root returned HTTP 200/no-cache;
Status returned HTTP 200 with exactly `{"status":"ok"}`. A real Weather request
returned HTTP 200/no-store, 24 hours and `stale: false`, and validated against
the backend WeatherResponse model. Retrieval timestamp:
`2026-10-24T01:42:24.457427+00:00` (October 23 in Toronto). This also exercised
outbound provider HTTPS through the application's normal backend path.

The first standalone container Python probe lacked the backend import path;
rerunning it with working directory `/app/backend` passed. No application or
test failure required a code change. Temporary validation servers and the
container were stopped after validation; the built image remains locally.

## Residual limits

No npm audit findings remain at execution time. Audits do not guarantee the
absence of undisclosed issues. Source-map processing and Vite remain build/
development tools, with the associated exposure to untrusted inputs.
Actual iOS 12.5.8 operation, suspension, fullscreen behavior and endurance were
not tested. Those remain Task 4 acceptance work; builds, identical assets and
modern browser passes do not replace device acceptance.
