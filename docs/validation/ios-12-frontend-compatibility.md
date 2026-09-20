# iOS 12.5.8 Frontend Compatibility Validation

- **Summary date:** 2026-09-20
- **Scope:** The isolated frontend compatibility spike in `spikes/frontend-compat/`.
- **Outcome:** The project owner confirmed that the spike works on the target iPad running Safari on iOS 12.5.8. Preact + TypeScript + Vite is accepted as the frontend stack.
- **Related decision:** [Frontend stack decision](../decisions/frontend_stack.md).

## Tested Baseline

| Component | Version / configuration |
| --- | --- |
| Preact | 10.29.8 |
| TypeScript | 7.0.2; strict checking; Preact JSX runtime |
| Vite | 8.3.0 |
| JavaScript and CSS build targets | `['safari12', 'ios12']` |
| Compatibility helper | Vite module-preload polyfill enabled |
| Automated test tooling | @playwright/test 1.63.0 |

Validation used the generated production assets served by a small local Node fixture server. It did not use a production FastAPI application or Docker deployment. Exact dependencies and build settings are preserved in the spike's [package manifest](../../spikes/frontend-compat/package.json), [lockfile](../../spikes/frontend-compat/package-lock.json), and [Vite configuration](../../spikes/frontend-compat/vite.config.ts).

## Capabilities Exercised

- Preact component mounting, updating and unmounting; component state and event handling.
- Timer and listener cleanup, periodic updates, and repeated mount/unmount cycles.
- `fetch`, JSON responses and async/await; loading, success, HTTP errors, timeouts and retained last-good data.
- Temporary network failure and recovery, request cancellation, and suppression of obsolete responses.
- Basic CSS Grid, Flexbox with margin-based spacing, and CSS custom properties.
- Visibility and page lifecycle handlers, pause/resume behavior, and prevention of duplicate periodic work.
- Bounded diagnostic history, request counts, DOM counts and observable update cadence.

## Validation Results

### Automated development-environment validation

The implementation report dated 2026-09-13 records passing strict type checks, a successful production build, and **16 passing browser tests**: eight cases each in Chromium 153.0.8010.12 and modern WebKit 26.6.

Tests covered the behaviors above, including missing or ineffective AbortController behavior. Lifecycle handler tests used synthetic events and a visibility-property override; they did not reproduce actual iOS suspension. Accelerated tests performed at least 25 mounts per engine in roughly 23 seconds per case and checked bounded work and continued interaction. Modern WebKit portrait/landscape screenshots were also reviewed.

These are modern-browser regression results, not independent proof of iOS 12.5.8 compatibility.

### Static and production-build analysis

- Generated HTML, JavaScript, CSS, dependency code and runtime API usage were reviewed.
- The bundle contained Preact core, hooks and JSX runtime, spike code, and Vite's module-preload helper. No development hot-reload client or Preact debug runtime was bundled.
- Optional chaining and nullish coalescing were lowered to null checks; native async/await remained. No additional fetch, Promise or async/await polyfill was required by the spike.
- Basic Grid, Flexbox and custom properties were retained. Flexbox `gap` and newer layout features were avoided.
- The JavaScript asset was approximately 20 KB (8.1 KB compressed). This is the spike's size, not a production bundle budget or performance guarantee.

### Target-device validation

The project owner reported that the spike works on the target iPad running iOS 12.5.8 and approved the frontend stack. This is the basis for target-device acceptance, distinct from the automated and static checks.

The exact iPad model, tested build identifier, individual checklist outcomes, device logs and endurance-run duration have not been recorded in this summary. The overall confirmation must not be expanded into invented per-test results or an assumed overnight soak-test pass.

The [spike README](../../spikes/frontend-compat/README.md) contains the detailed test procedures, LAN commands and manual checklist. Its earlier “pending” target-validation wording reflects the original implementation report; the later project-owner confirmation and accepted stack decision supersede that status.

## Important Boundaries

**This validation applies only to the current compatibility spike, its recorded dependency versions, build configuration and exercised behavior. It does not mean that every implementation using Preact, TypeScript or Vite supports Safari on iOS 12.5.8.**

- **Stack acceptance is not application-wide certification.** Future widgets, application-shell behavior, integrations and combinations of features require their own relevant validation.
- **Dependencies and build changes can alter compatibility.** New packages, upgrades, different bundling settings, browser APIs and CSS features are not covered automatically by this result.
- **Transpilation has limits.** Successful type checking or compilation does not supply missing browser APIs, correct every browser bug, or prove runtime compatibility. Review emitted production assets as well as source code.
- **Resource stability is only partially assessed.** Short repeated-update tests and bounded counters do not prove absence of memory leaks, stable overnight operation or resistance to iOS process eviction. No measured heap bound or 8–24-hour result is claimed here.
- **Lifecycle and network behavior depend on the environment.** Do not assume uninterrupted background timers or universal cancellation behavior. The spike prevents unresolved requests from accumulating; if cancellation fails and a request never settles, further requests remain blocked until settlement or reload. This is a known restriction, not proof that all network failures recover.
- **Deployment remains separate.** FastAPI asset serving, Docker deployment, TLS, fullscreen/home-screen launch behavior and production backend integrations were not established by this frontend spike.
- **The spike is engineering evidence, not production architecture.** Its fixture server, diagnostics and request guard do not establish production widget interfaces or shared infrastructure.

Safari on iOS 12.5.8 remains a hard constraint. For subsequent changes, run relevant tests, review compatibility-sensitive dependencies and generated assets, and validate affected behavior on the target device or a reliably equivalent environment. Record the tested scope and report anything unverified, following [AGENTS.md](../../AGENTS.md).
