# Frontend compatibility spike

Status: **promising under static analysis and modern-browser tests; Safari on iOS 12.5.8 remains unverified**. This is an isolated experiment, not a production widget, application shell, or backend design.

## Run on the iPad over the LAN

On the Mac, with Node 22.12+ (validated with 22.23.1) and npm:

```sh
cd /Users/lawrence/Work/NightLight_Dashboard/spikes/frontend-compat
npm ci --cache .npm-cache
npm run build
HOST=0.0.0.0 npm run serve
```

The server prints `LAN candidate: http://<address>:4173` for each non-loopback IPv4 interface. Connect the iPad to the same local network and open the address belonging to the Mac's Wi-Fi/Ethernet connection in Safari. Do not use `localhost` or `0.0.0.0` on the iPad. Allow Node's incoming connections if macOS asks, and keep the Mac awake. Guest-network client isolation or a VPN can prevent access. This server is a local test fixture; stop it with Ctrl-C when finished.

Use the root URL for the normal run: one-second heartbeat and polling five seconds after each completed request, subject to the heartbeat cadence. `/?fast=1` uses a 100ms heartbeat, 250ms polling delay, and 400ms mount toggles for a short accelerated run. Normal mount toggles occur every two seconds. Do the overnight run in normal mode.

No Python, virtual environment, FastAPI, Docker, or global project dependencies are used. The fixture serves the actual `dist` output with correct module MIME types and `Cache-Control: no-store`. `/fixture?mode=ok|delay|fail|slow` returns success after 100ms, success after 800ms, HTTP 503 after 100ms, or success after four seconds. The client deadline is 1.5 seconds. HTTP 503 is not a network failure; Wi-Fi interruption is a separate manual check.

## Versions and configuration

Direct dependencies pinned in `package.json`; the complete resolved tree is pinned in `package-lock.json`:

| Package | Version | Role |
| --- | --- | --- |
| Preact | 10.29.8 | Only application runtime dependency; core, hooks, JSX runtime |
| Vite | 8.3.0 | Production bundling and browser syntax/CSS targets |
| TypeScript | 7.0.2 | Separate strict type checking; no browser runtime |
| @playwright/test | 1.63.0 | Development-only browser validation |

Registry inspection on 2026-09-13 reported Preact `latest=10.29.8`, `rc=11.0.0-rc.2`, and `beta=11.0.0-beta.2`. We selected stable 10.x rather than adopting a prerelease. The [Preact support page](https://preactjs.com/about/browser-support/) documents 11.x as supporting Safari 9+ and 10.x as supporting browsers back to IE11. Neither documented boundary excludes Safari 12; there is no current requirement justifying an 11.x prerelease. This is documentary evidence, not a guarantee for this complete application or every future 10.x patch.

`vite.config.ts` explicitly sets both `build.target` and `build.cssTarget` to `['safari12', 'ios12']`, enables source maps, and retains Vite's default module-preload polyfill. The baseline is conservative; iOS 12.5.8 is an OS release, not a Vite browser target identifier. Vite's [default production target](https://vite.dev/guide/build#browser-compatibility) is too new. A build target transforms syntax but does not supply all missing runtime APIs. Vite 8 uses Oxc/Rolldown and Lightning CSS; assumptions about older Vite/esbuild pipelines should not be substituted for inspecting this output.

TypeScript uses `ES2018`/`DOM` libraries, strict checking and Preact's JSX runtime. DOM typings are not version-specific browser support checks. `tsc --noEmit` checks types, while Vite emits the browser code. No Preact development preset, React compatibility layer, external CDN scripts, router, state library, service worker, or legacy bundle plugin is included.

## What is exercised

- Preact mount/unmount, state updates, click/change events, and effect cleanup.
- Component event subscriptions (`spike-ping` and resize) and periodic work.
- Native `fetch`, Promise-based JSON parsing and async/await; loading, HTTP errors, retained last-good data, retries, timeout, cancellation, and late-response suppression.
- `visibilitychange`, `document.hidden`, `pagehide`, `pageshow`, online/offline hints. Periodic component work pauses while hidden, resumes without catching up missed ticks, and avoids duplicate intervals. Network availability is established by requests, not online events alone.
- Basic Grid with `grid-gap`, a wrapping Flexbox control row using margins, and runtime changes through `style.setProperty` to CSS custom properties.
- Bounded diagnostics, automatic mount cycles, and observable update cadence.

## Static/build compatibility findings

Reviewed the minified production HTML, JavaScript and CSS, Preact's installed browser modules, source-map module inventory, and runtime member calls. The build has one JS entry and one CSS asset. Approximate final sizes: **20.03 kB JavaScript, 8.1 kB compressed; 1.04 kB CSS, 0.55 kB compressed; 0.50 kB HTML; 53.4 kB source map**. The local fixture does not gzip responses; compressed sizes are estimates of potential transfer size. Timestamp build identifiers change hashes and slightly change compression sizes on rebuild. Source maps are debug assets, not application execution code.

- Source map lists Preact core, hooks, JSX runtime and `src/main.tsx`. Vite also injects its module-preload helper. No Preact debug/devtools/compat runtime or Vite hot-reload client is bundled.
- The deliberate `data?.value ?? 'Missing value'` probe becomes explicit null checks. No `?.` or `??` remains. One native async function remains, as expected. No dynamic imports, import maps, top-level await, BigInt literals, or newer APIs such as `queueMicrotask`, `ResizeObserver`, `structuredClone`, `flatMap`, `fromEntries`, or `replaceAll` were found in the emitted JS. Preact's `typeof ... === 'bigint'` string check is not a BigInt API or literal requirement.
- Emitted syntax includes ordinary functions, arrows, let/const, template strings and optional catch bindings. Safari 12 is expected to parse these. This was a manual/static review, not execution in a Safari 12 parser or an exhaustive compatibility proof.
- Preact uses established DOM operations, event listeners, Promise scheduling and requestAnimationFrame/timer hooks. The module-preload helper uses `relList.supports` with a guard, `querySelectorAll`, NodeList iteration, MutationObserver and fetch. These require runtime support independently of the language target.
- No module-preload links or asynchronously loaded chunks are currently emitted. Vite's helper is retained and includes a document-lifetime observer on browsers lacking module preload; it is not part of the component resource counters. This is bounded platform work, not a per-remount subscription. Its polyfill is optional for this single-entry page but is the only injected compatibility helper.
- CSS retains custom properties, `grid-gap`, explicit Grid columns and Flexbox with margins. No Flexbox gap, subgrid, nesting, dynamic viewport units or modern color functions are used.

| Capability | Expected on target / required treatment |
| --- | --- |
| Preact, DOM events, timers, Promise, requestAnimationFrame | Expected native supporting APIs. Preact behavior still requires target execution. |
| Fetch, response JSON, async/await | Expected native; WebKit introduced fetch and async/await in Safari 10.1 / iOS 10.3. No fetch/Promise/regenerator polyfill added. |
| TypeScript, JSX, optional chaining, nullish coalescing | Types erased, JSX transformed, newer operators lowered by the build. |
| URLSearchParams, MutationObserver, NodeList iteration, standard array methods | Expected native within this baseline; included in the reviewed API surface. |
| CSS Grid/Flexbox/custom properties | Basic forms expected native; Grid arrived before iOS 12 and custom properties before that. Actual sizing/orientation behavior remains a device check. |
| Module preload | Native support is not assumed; Vite injects its helper. Ordinary module loading is still required. |
| AbortController/fetch cancellation | Constructor presence alone is insufficient. Explicit native cancellation and ineffective-abort tests are included. Exact target behavior is pending. |
| Visibility/page/network events | Basic APIs expected, but event delivery/order and OS suspension/eviction cannot be inferred from modern tests. No reliance on continuous background timers. |
| Flexbox gap and newer layout/browser conveniences | Avoided instead of adding unrelated compatibility code. |

Supporting references: [WebKit Safari 10.1 features](https://webkit.org/blog/7477/new-web-features-in-safari-10-1/), [WebKit custom properties](https://webkit.org/blog/5989/css-variables-in-webkit/), [Vite build options](https://vite.dev/config/build-options), [MDN AbortController compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/AbortController.json), [gap compatibility data](https://github.com/mdn/browser-compat-data/blob/main/css/properties/gap.json), [page visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

### Request handling restriction

Only one unresolved request is allowed across all mount generations. Cleanup invalidates responses, clears timers/listeners, and requests abort. A timeout is distinguished from actual settlement: it does not release the outstanding-request guard. This prevents repeated retries/remounts from accumulating unresolved requests if cancellation is broken.

If cancellation is unavailable or ineffective, a delayed request is discarded once it eventually settles and polling can recover. If the actual browser leaves it unresolved indefinitely, the spike intentionally stops issuing requests until settlement or reload. A JavaScript timeout or a superficial AbortController polyfill cannot guarantee transport cancellation. That outcome on the iPad would require a focused follow-up decision, potentially an XHR-based transport, before accepting fetch as the production strategy.

## Automated validation

```sh
cd /Users/lawrence/Work/NightLight_Dashboard/spikes/frontend-compat
npm ci --cache .npm-cache
PLAYWRIGHT_BROWSERS_PATH=.browsers npx playwright install chromium webkit
PLAYWRIGHT_BROWSERS_PATH=.browsers npm test
```

All dependencies and downloaded browsers stay in this directory. `node_modules`, `.npm-cache`, `.browsers`, `dist`, test results and reports are ignored by Git. Browser downloads are needed only for automation, not for the iPad run.

Validation on 2026-09-13:

- Strict type checking and production build passed with no compatibility warnings.
- **16 tests passed**: eight cases each in Chromium 153.0.8010.12 (Playwright revision 1243) and WebKit 26.6 (revision 2359), against `dist` through the local fixture server.
- Tested state/events/layout/cleanup; loading and HTTP recovery; native timeout cancellation; real browser offline mode and recovery; missing AbortController and ignored late results; pagehide/pageshow/visibility handler logic; ineffective abort; accelerated mount cycles and bounded work.
- Endurance automation performed at least 25 mounts per engine in roughly 23 seconds per case, then checked continued interaction, timer cadence, bounded DOM/log size and request concurrency. This is a short regression test, not an overnight stability result.
- Modern WebKit portrait/landscape screenshots were visually reviewed. A leftover startup message was found and fixed; its absence is now asserted. Screenshots are regenerated under ignored `test-results/`.
- `node --check serve.mjs`, dependency-tree inspection and npm install audit passed (zero vulnerabilities reported at installation).

The initial environment sandbox blocked network downloads and listening on localhost; these succeeded after permission escalation. A missing CSS type declaration was fixed with `vite/client` types. No relevant tests were skipped or weakened.

Playwright's [WebKit](https://playwright.dev/docs/browsers#webkit) is a modern build. Viewport/touch emulation does not emulate iOS 12.5.8. Page-event tests use synthetic events and a `document.hidden` override to check handler logic; they do not reproduce iOS process suspension or back/forward cache behavior. Fetch abort is intentionally disabled/neutralized in two tests; those simulations are not measurements of old Safari.

## Target iPad checklist

Record model, iOS version, URL, build ID, session ID and start/end times. Keep the Mac serving the same build throughout the run.

1. **Startup/layout:** open the production URL on iOS 12.5.8. Startup text should disappear. Check both orientations, touch controls, wrapping, readable data and two-column layout. Change accent and confirm the button/border color changes.
2. **State/events:** Increment changes state once per tap; Send event changes Events once. Rotation also generates resize events. Unmount and wait at least one diagnostic refresh (500ms): `componentTimers` and `componentListeners` should become zero, ticks should stop, and Send event should not change the diagnostic event count. Remount; state resets and a tap fires once.
3. **HTTP:** select Delayed success and observe Loading then Success. Select HTTP 503; see an error while the last good timestamp remains. Switch back to Success and confirm a fresh timestamp. Retry now should also recover.
4. **Cancellation:** select Timeout. At about 1.5s an error should appear. Record `abortsRequested`, `abortRejections`, `outstanding` and `lateResponses`. Working cancellation normally produces an AbortError rejection and releases outstanding. With ineffective abort, outstanding remains one until the four-second response is ignored. Switch back to Success. Also unmount during Delayed success; the old result must not update the remounted component. `maxOutstanding` must remain one.
5. **Temporary outage:** with normal polling active, turn Wi-Fi off for 20–30 seconds, return to Safari if needed, and observe errors. Restore Wi-Fi and return to Safari. A successful request should arrive without a reload, normally within roughly ten seconds after the network becomes usable. If it stalls, record pending requests/status before manually retrying. An unchanged session ID confirms no full reload.
6. **Lifecycle:** lock/unlock, background/foreground Safari, and navigate away/back. Expect current data and ticks to resume with no duplicate event effects or burst of missed ticks. Record page-event log entries and whether the session ID changed. A changed ID means the document restarted; the spike cannot establish why iOS restarted it.
7. **Endurance:** run normal mode visible and powered for 30 minutes, then preferably 8–24 hours. Check controls periodically. Take a screenshot of diagnostics initially, at 30 minutes, and at the end. Separately run Start cycles for several minutes, stop it, and confirm stable mounted/unmounted resource counts and normal tick speed. Do not leave accelerated mode on for the overnight baseline.

## Interpreting stability observations

The diagnostic panel refreshes every 500ms. While the component is mounted and visible, expect seven explicitly registered listeners, one heartbeat interval, and at most one request deadline timer. After unmount there should be zero component timers/listeners. The app-level diagnostic timer, optional cycle timer, two lifetime error listeners, Preact internals and Vite observer are excluded from these component counts.

`mounts - unmounts` should be one while mounted and zero while unmounted. `outstanding` is zero or one; `maxOutstanding` must never exceed one. The event history reaches at most 30 entries. DOM count may change with status/mount state and grow until the log fills, then should remain bounded when comparing the same state. Diagnostic snapshots can lag component state by 500ms.

Watch for steadily worsening foreground timer delay, duplicated tick/event rates, rising unresolved requests, freezes, unexpectedly reset session IDs, or Safari reload/crash messages. `maxTimerDelayMs` is a maximum since load, so one interruption can leave a permanently high value; compare whether it keeps increasing during stable foreground use. Uptime is elapsed wall-clock time, not CPU-active time. The diagnostics themselves add some work and are not production performance estimates.

Counters and DOM size do not measure heap retention, detached DOM, GPU memory or OS pressure. No nonstandard `performance.memory` claim is made. Remote Safari Web Inspector may supplement observations if a compatible Mac/iPad pairing allows it; debugger attachment can alter timing. A finite soak test cannot prove absence of memory leaks.

## Pending decision

The emitted assets and modern-engine results support continuing with this pinned Preact/TypeScript/Vite combination as a candidate. Final acceptance is pending actual iPad startup, layout, cancellation/recovery and endurance results. Python/FastAPI asset serving, Docker deployment, fullscreen/home-screen launch behavior, TLS and any future dependencies/widgets are outside this experiment and remain unvalidated. No physical-iPad result has been supplied or inferred.

| Device result | Record after testing |
| --- | --- |
| Model / iOS / build ID | Pending |
| Startup / state / layout / cleanup | Pending |
| Fetch cancellation / outage recovery | Pending |
| Lock/background/back navigation | Pending |
| 30-minute / overnight stability | Pending |
| Decision / restrictions | Pending |
