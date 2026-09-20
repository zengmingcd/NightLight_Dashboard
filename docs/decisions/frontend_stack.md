# Frontend stack decision

- **Status:** Accepted
- **Decision date:** 2026-09-20
- **Decision owner:** Project owner
- **Scope:** Frontend technology selection and compatibility baseline for NightLight Dashboard

## Decision

Use **Preact + TypeScript + Vite**, with HTML and CSS, for the production frontend.

The project owner confirmed that the frontend compatibility spike works on the target iPad and approved this stack. The [first vertical-slice brief](../../.codex/tasks/02-first-vertical-slice.md) also records successful validation on Safari running on iOS 12.5.8.

This decision supersedes the provisional frontend selection and the acceptance-pending wording in the [spike README](../../spikes/frontend-compat/README.md). That README remains the historical implementation and validation report. Acceptance applies to the tested frontend baseline; it does not certify every future dependency, feature, or upgrade.

## Context and rationale

The dashboard must run fullscreen for long periods on an older, resource-limited iPad. Safari on **iOS 12.5.8 remains a hard compatibility constraint** after stack acceptance.

- **Preact** supplies component rendering, state and lifecycle mechanisms, reducing custom DOM-management code as widgets become more interactive while keeping the browser runtime small.
- **TypeScript** provides static checks for frontend code. It does not establish browser API compatibility.
- **Vite** builds the frontend assets with explicit JavaScript and CSS browser targets. Its defaults must not replace the tested compatibility configuration.
- **HTML/CSS** provide presentation and layout; no additional UI framework or styling library is selected by this decision.

Plain TypeScript with manual DOM updates was considered. Preact was preferred for the maintenance benefit of established component behavior. A shared-language Node backend was also considered during stack discussion, but frontend selection does not require a Node production runtime.

## Tested dependency baseline

These are the versions used by the accepted spike, not claims about the latest available releases:

| Dependency | Version | Role |
| --- | --- | --- |
| Preact | 10.29.8 | Frontend runtime, hooks and JSX runtime |
| TypeScript | 7.0.2 | Development-time type checking |
| Vite | 8.3.0 | Frontend build tooling |
| @playwright/test | 1.63.0 | Spike browser tests; not shipped to the browser |

See the spike [package manifest](../../spikes/frontend-compat/package.json) and [lockfile](../../spikes/frontend-compat/package-lock.json) for the exact dependency tree. Preact 10.29.8 was selected as the stable release at the time; Preact 11 was a prerelease. Do not silently replace this baseline with a newer major version or assume that all versions have the same legacy-browser support.

Keep Node dependencies project-local and commit the relevant lockfile. The spike used Node 22.23.1; its package manifest requires Node 22.12 or newer. Node is build/development tooling, not a required runtime in the deployed application container.

## Compatibility configuration

Preserve these settings when establishing the production build:

```ts
build: {
  target: ['safari12', 'ios12'],
  cssTarget: ['safari12', 'ios12'],
  modulePreload: { polyfill: true }
}
```

The Safari/iOS 12 targets are a conservative compilation baseline; the physical target is iOS 12.5.8. The spike also enables source maps for inspection. Production source-map publication is not decided here.

Use strict TypeScript checking and the Preact JSX runtime (`jsx: 'react-jsx'`, `jsxImportSource: 'preact'`). The spike uses `ES2018` and `DOM` libraries, runs `tsc --noEmit`, and lets Vite emit browser assets. TypeScript DOM definitions do not enforce a particular Safari version.

The reviewed production bundle lowered optional chaining and nullish coalescing to null checks, retained native async/await, and included Preact core/hooks/JSX runtime plus Vite's module-preload helper. No additional fetch, Promise or async/await polyfill, broad polyfill bundle, or Vite legacy plugin was required by the accepted spike. Reassess polyfill needs when changing the API surface or dependencies; build targets alone do not supply missing browser APIs.

## Implementation boundaries

Follow [AGENTS.md](../../AGENTS.md):

- The frontend owns presentation and browser interactions. Business logic, external API integrations and secret-dependent operations belong on the backend. Never put credentials or other secrets in browser assets, build-time frontend variables, or responses sent to the browser.
- Widgets own feature-specific UI and interactions. The Application Shell owns dashboard layout and common lifecycle/scheduling mechanisms. Introduce shared code only for behavior with stable semantics across actual consumers.
- Keep updates and retained data bounded. Clean up timers and listeners, prevent duplicate periodic work, and ignore obsolete async responses after unmount or replacement.
- Treat timer suspension and page resume as normal browser behavior. Do not assume timers continue accurately in the background or replay every missed tick.
- Handle loading, errors and network recovery explicitly. A timeout does not prove that a request was cancelled. Avoid accumulating unresolved requests if cancellation fails.
- Basic Grid, Flexbox and CSS custom properties form the tested layout baseline. Use margins for Flexbox spacing rather than Flexbox `gap`. Newer CSS features and browser APIs require compatibility review before adoption.

The spike's one-outstanding-request guard and diagnostic counters are test implementation details, not a prescribed application-wide request manager or production widget contract.

## Validation evidence and limits

The [isolated spike](../../spikes/frontend-compat/README.md) records:

- Passing strict type checks and production build.
- Review of generated HTML, JavaScript, CSS, dependency code and runtime APIs.
- Sixteen passing automated tests across modern Chromium and WebKit, covering state, events, mount/unmount cleanup, timers, HTTP behavior, recovery, cancellation, lifecycle handler logic and short repeated-mount runs.
- Project-owner confirmation of successful target-iPad validation, received before this decision was accepted.

Modern browser tests and build success alone do not prove iOS 12.5.8 compatibility. The target-device confirmation supports this stack decision, but detailed device logs, exact per-check outcomes and the duration of any endurance run were not recorded in this decision. Do not infer an 8–24-hour soak result, a measured memory bound, or universal feature support from the acceptance.

For subsequent frontend changes, run relevant automated tests, inspect compatibility-sensitive production output, and validate new or affected browser behavior on the target iPad or a reliably equivalent environment. Recheck package support and generated code on upgrades. Report unverified behavior explicitly.

## Deployment context and deferred decisions

The selected deployment direction is one Docker runtime container: frontend assets are built separately and served by FastAPI alongside backend `/api` endpoints. The backend direction is Python 3.12 + FastAPI + Pydantic + Uvicorn. These are integration context; the frontend spike did not validate the production backend or Docker deployment.

Keep `spikes/frontend-compat/` isolated as engineering evidence. Production code must not import or depend on its fixture server, diagnostics or test component.

This decision does **not** establish the production directory structure, widget interfaces, first widget, routing, state-management library, UI component library, API-client abstraction, caching/persistence strategy, service worker, or generic scheduling framework. Add these only when a concrete requirement justifies them and follow the repository's plan/approval workflow for significant changes.

For future AI-assisted work: treat the frontend stack as accepted, preserve the iOS 12.5.8 boundary, and do not reopen stack selection or scaffold unrelated architecture unless the user requests it or new compatibility evidence requires reconsideration.
