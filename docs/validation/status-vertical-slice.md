# Status vertical slice validation

Original slice validation date: 2026-10-22. Implementation was uncommitted, based on
`abda12d377b2011340c88f64d63dce489402ee1f`.

Original tested Docker image: `nightlight-dashboard:status-slice`, image ID
`sha256:c5be195126507729752021743c206425b08b18616c919b3790f569fe8afd0cb8`.
Original production assets: `index-DP2hXsI7.js` and `index-DdEjK_q8.css`.
No target-iPad or endurance results have been supplied for this slice.

The canonical task for this work is [task 04: Implement the First Status Widget
Vertical Slice](../../.codex/tasks/04-first-vertical-slice.md).

The implementation and tests already existed as uncommitted work when task 04
was resumed. After plan approval, they were reviewed against task 04 and all
automated checks below were rerun successfully on October 22. No production or
test changes were needed; this report was updated with the fresh evidence.

## Task 04-1 follow-up: pending HTTP error bodies

On October 22, the follow-up fix confirmed that the non-2xx path released the
request guard immediately after receiving headers. A new regression failed on
the original code because Retry was enabled while the controlled body remained
pending. The fixture delivers headers separately from body completion and can
resolve or reject the body independently.

`StatusWidget.tsx` now displays the HTTP failure immediately, then consumes and
discards the body with `response.arrayBuffer()` before releasing the guard.
The existing deadline and unmount cancellation stay active during that read.
Abort alone does not release the guard: the read must resolve or reject. Late
completion preserves the failure state and cannot update a replacement widget.
No dependencies, shared infrastructure or browser target changes were added.

Fresh validation for this fix:

- Strict type checking and production build passed. New JavaScript asset:
  `index-grapbn2t.js`, 15.78 KB (6.58 KB gzip); CSS is unchanged.
- All 46 controlled widget tests passed, 23 each in Chromium and modern WebKit.
  The 16 added engine/case combinations cover pending HTTP error bodies,
  successful/rejected body completion, timeout, unmount, native/missing/
  ineffective cancellation, blocked retry, manual recovery and obsolete results.
- All 11 backend/static-serving tests passed against the new frontend build.
- Both real API E2E tests passed against FastAPI serving the new build on
  `127.0.0.1:18005`, without endpoint mocks or uncaught browser errors.
- Source and emitted assets were reviewed: the body read uses `arrayBuffer()`;
  Safari/iOS 12 build targets remain unchanged; no optional chaining, nullish
  coalescing or Promise.finally call was introduced. `git diff --check` passed.

The initial `npm test` run passed the build and widget suites, then could not
start E2E because the existing review container occupied port 8000. This was an
environment conflict; E2E passed with `DASHBOARD_URL=http://127.0.0.1:18005`
against a temporary FastAPI server. That server was stopped after validation.
The review container on port 8000 still uses the original image above. Docker
was not rebuilt or retested for this follow-up; its earlier results apply to
the original slice only.

The body reader buffers the error body until completion before discarding it.
If cancellation is unavailable or ineffective and the body never settles,
Retry remains disabled and reload is required. Target-iPad and endurance
validation remain pending; modern engine tests do not establish iOS 12.5.8
compatibility. The original slice evidence below predates this follow-up.

## Implemented flow and ownership

The dashboard shell explicitly mounts the Status Widget. The widget makes one
relative, same-origin request to `GET /api/widgets/status` on mount. FastAPI
registers the Status feature router explicitly and returns HTTP 200 JSON
`{"status":"ok"}`, validated by a Pydantic model with the literal status `ok`.
The endpoint demonstrates application reachability without metrics, dependency
checks, host information, timestamps or secrets.

Loading, success, failure, response interpretation and manual retry remain in
the Status feature. HTTP errors, malformed JSON, invalid contract values,
network rejection and a 10-second deadline produce failure. The deadline covers
both fetching and JSON reading. Native browser exception text is not displayed.
The shell retains layout and composition only. No polling or shared request
framework is introduced.

A feature-local outstanding promise prevents overlapping requests, including
across widget replacement. Timeout requests cancellation but keeps the guard
until actual settlement. Retry remains disabled during that interval. Unmount
clears the deadline, requests cancellation when supported, and prevents old
results from updating the widget. A replacement waits for the old request to
settle and then offers manual retry instead of launching overlapping work.

If cancellation is absent or ineffective and a request never settles, manual
retry cannot proceed; reload is required. The widget explains this limitation.
The feature assumes the single Status Widget explicitly composed by the shell.

## Static-serving finding

The original `/assets/../index.html` test is retained as route regression
coverage, but is not considered traversal evidence because the client normalizes
it. The new encoded case requests `/assets/%2e%2e/index.html` and observes the
incoming ASGI scope before delegating to the real application. It asserts both
the encoded raw path and decoded `/assets/../index.html` path. The response is
HTTP 404, JSON `{"detail":"Not Found"}`, with no frontend HTML/file contents.
The existing StaticFiles boundary required no production change.

## Files created or modified

Created:

- `backend/nightlight/widgets/__init__.py`
- `backend/nightlight/widgets/status/__init__.py`
- `backend/nightlight/widgets/status/router.py`
- `frontend/src/widgets/status/StatusWidget.tsx`
- `frontend/src/widgets/status/status.css`
- `frontend/playwright-status.config.ts`
- `frontend/tests/status.html`
- `frontend/tests/status-harness.tsx`
- `frontend/tests/status.spec.ts`
- `docs/validation/status-vertical-slice.md`

Modified:

- `backend/nightlight/main.py`
- `backend/tests/test_app.py`
- `frontend/src/shell/Dashboard.tsx`
- `frontend/package.json` (test commands only)
- `tests/e2e/dashboard.spec.ts`
- `README.md`

The existing user modification to the task file was preserved. Dependency
versions, lockfiles, browser targets, Docker configuration and the isolated
compatibility spike remain unchanged. Generated builds and test artifacts are
ignored. Nothing was committed or pushed.

## Executed validation

| Check | Result |
| --- | --- |
| Frontend strict type checking and production build | Passed locally; Docker build reused the matching frontend build layer |
| `.venv/bin/python -m pytest -c backend/pytest.ini` | 11 passed |
| Controlled frontend widget tests | 30 passed: 15 each in Chromium and modern WebKit |
| Production build served by local FastAPI, real unmocked Status endpoint | 2 E2E tests passed, one per engine |
| Docker image build and startup | Passed, final image recorded above |
| Dashboard and real Status endpoint from running container | 2 E2E tests passed, one per engine, portrait and landscape |
| Runtime inspection | UID 10001; Node and npm absent; dashboard HTTP 200; API returned contract |
| Browser errors in tested E2E flows | None |
| Modern WebKit portrait/landscape screenshots | Reviewed; heading and Status readable, no clipping |
| Compatibility-sensitive source and generated assets | Reviewed; findings below |
| `git diff --check` | Passed |

Frontend tests import the actual widget into a separate development fixture
excluded from the production build and Docker context. They control fetch
settlement and the 10-second deadline, covering loading, success, HTTP/network
errors, malformed JSON, null/array/wrong-status responses, synchronous fetch
failure, manual retry, duplicate submissions, pending JSON bodies, native
cancellation, absent/ineffective cancellation, unmount and obsolete responses
after replacement. These are controlled lifecycle tests, not a reproduction of
real iOS network behavior. E2E uses the real API with no Status endpoint mock.

Commands executed from `frontend/` used the existing matching browser binaries
without modifying the spike:

```sh
PLAYWRIGHT_BROWSERS_PATH=../spikes/frontend-compat/.browsers npm test
DASHBOARD_URL=http://127.0.0.1:18004 PLAYWRIGHT_BROWSERS_PATH=../spikes/frontend-compat/.browsers npm run test:e2e
```

The October 22 run used `docker build -t nightlight-dashboard:status-slice .`
and a temporary container bound to `127.0.0.1:18004`. Both container E2E tests
passed. The temporary validation container was stopped after testing; the image
remains available locally.

## Findings, deviations and limits

On October 22, the first frontend test attempt failed because the sandbox
prevented binding the local test server. Approved execution outside the sandbox
passed. Docker access initially failed under the sandbox; approved execution
then showed that the daemon was stopped. Starting Docker Desktop resolved that
environment blocker. Matching browser binaries already installed for the spike
were reused without modifying it. No implementation or compatibility failures
were observed in this run.

Historical implementation findings from the earlier October 14 report: the test fixture initially needed its explicit
Preact JSX import-source annotation because it is outside the production
TypeScript include scope; this was a test setup issue, corrected.

That earlier run of modern WebKit exposed an implementation issue: malformed JSON rejected with a
different exception type/message from Chromium. Error presentation now follows
the request stage, and the original assertion passes in both engines. No test
was skipped or weakened. No environment blocker remains for the checks above.

The final build retains Safari/iOS 12 JavaScript and CSS targets and Vite's
module-preload helper. Production output contains Preact, native async/await,
Promise, fetch, guarded AbortController, setTimeout/clearTimeout, and the
existing preload helper's MutationObserver. There is no optional chaining,
nullish coalescing, Promise.finally call, polling interval, development HMR
client, test fixture, or Flexbox gap in the production assets. CSS uses basic
padding, margins, borders, custom properties and inherited fonts. JavaScript is
approximately 15.74 KB (6.57 KB gzip); CSS is 0.59 KB (0.32 KB gzip).

This review and modern browser results do not prove Safari on iOS 12.5.8
compatibility. Target-device networking, cancellation, fullscreen behavior,
suspension and long-running resource stability remain unverified. No endurance
validation is claimed.

## Target-iPad checklist and remaining acceptance

Record the iPad model, iOS/Safari version, date, tested image ID or future commit,
and actual result for each check. All checks below are currently pending.

1. Load the production dashboard over the LAN on Safari/iOS 12.5.8. Confirm the
   shell mounts and the initial loading fallback disappears.
2. Confirm Status reads `Application reachable — status: ok` from the real API.
3. Interrupt connectivity during the initial Status request, or arrange for
   that endpoint to be unavailable while the frontend remains accessible.
   Confirm clear failure/timeout presentation. Restore connectivity, wait for
   settlement if necessary, tap Retry and confirm success. Connectivity loss
   after success alone does not change the widget, because it does not poll.
   If the old request stays unresolved, confirm the disabled retry guidance and
   record that reload was required.
4. Check portrait and landscape: readable headings/status, no clipping, and an
   accessible Retry control in the failure state.

Target-device results must be recorded before claiming iOS compatibility for
this slice. Any endurance run should separately record duration, build and
observations; previous spike acceptance is not evidence for this new behavior.
