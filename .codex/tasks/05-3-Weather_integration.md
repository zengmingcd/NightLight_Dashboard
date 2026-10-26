# Phase 4 — Task 3: Dashboard Integration

## Objective

Integrate the completed Weather Widget into the existing NightLight Dashboard.

This task covers Dashboard composition, minimal Shell layout changes, combined regression testing, production/Docker integration verification, and necessary documentation updates.

Do not redesign the Weather or Status features.

## 1. Preparation

Before implementation:

1. Read `AGENTS.md`.
2. Inspect the latest branch, working tree, and relevant commits.
3. Read relevant ADRs and validation documents.
4. Inspect the actual Dashboard Shell.
5. Inspect the completed Status and Weather Widgets.
6. Inspect existing E2E tests and Docker configuration.

Use current repository contents as the source of truth.

Preserve uncommitted work. Do not assume Task 1 or Task 2 changes have already been committed.

If a significant architecture change becomes necessary, stop and request Human approval.

## 2. Dashboard Integration

Explicitly compose both widgets:

- Weather Widget
- Status Widget

Requirements:

- Weather is the primary information widget.
- Status remains a compact secondary widget.
- Both widgets must render independently.
- Weather errors must not interfere with Status.
- Status errors must not interfere with Weather.
- Do not introduce widget registries or dynamic composition mechanisms.

## 3. Layout

Optimize for an iPad in landscape orientation, particularly the existing iOS 12.5.8 target device.

Requirements:

- Weather uses its existing compact 2 × 6 hourly grid.
- Preserve readable temperatures, icons, time labels and precipitation information.
- Avoid horizontal scrolling.
- Avoid clipped content.
- Follow the existing dark theme and visual conventions.
- Keep changes to Shell CSS minimal.
- Do not redesign either Widget's internal presentation without explicit justification.

The layout must also degrade reasonably in portrait orientation.

Do not introduce a general-purpose dashboard layout engine.

## 4. Integration Testing

Update or extend existing E2E tests to verify:

- Dashboard renders both widgets.
- Weather and Status load independently.
- Successful Weather responses render the expected forecast.
- Weather failures do not affect Status.
- Status failures do not affect Weather.
- Unknown API and page paths preserve existing 404 behavior.
- Static asset serving remains correct.
- No unexpected browser console errors.
- No horizontal overflow in relevant viewport sizes.

Use deterministic Weather fixtures for automated E2E tests.

Avoid fragile timing assumptions or uncontrolled dependencies on the live weather provider.

## 5. Production and Docker Verification

Verify:

- Production frontend build succeeds.
- FastAPI serves the compiled Dashboard.
- Both Widget endpoints are reachable.
- Existing backend and frontend tests pass.
- Docker image builds and starts successfully.
- The runtime container remains unprivileged.
- Node/npm are absent from the final runtime.
- Outbound HTTPS to Open-Meteo works from the runtime container.
- A real Weather API smoke test returns a valid contract.

Separate deterministic automated test results from live-provider verification.

Do not report live-provider success if external connectivity is unavailable.

## 6. Documentation

Update the relevant README and validation documentation.

Document:

- Weather Widget overview
- Weather endpoint
- Fixed Toronto location
- Refresh and cache behavior
- Open-Meteo attribution
- Offline/stale limitations
- Verification results
- Remaining target-device acceptance items

Also reconcile outdated Phase 3 Pending statements.

The project owner has confirmed that the previous Phase 3 Docker, iPad compatibility and endurance validations passed.

Record this as owner-confirmed acceptance. Do not fabricate missing test logs, dates or measurements.

Preserve an explicit distinction between owner confirmation, repository evidence, and tests actually executed during this task.

## 7. Constraints

- Do not refactor Status Widget.
- Do not redesign Weather Widget.
- Do not introduce a shared scheduler or global state manager.
- Do not add a database or persistent cache.
- Do not introduce unnecessary dependencies.
- Preserve iOS 12.5.8 build targets.
- Preserve existing single-container production architecture.
- Do not start Task 4 device acceptance.

## 8. Expected Deliverables

Return:

1. Implementation summary
2. Files added or modified
3. Dashboard layout description
4. Tests and builds actually executed
5. Docker verification results
6. Live Open-Meteo smoke-test results
7. Git diff summary
8. Known limitations
9. Any deviations from the approved architecture

Do not claim actual iPad compatibility based solely on Chromium, modern WebKit, screenshots, or production builds.

Stop after Task 3.

Do not start Task 4 or commit/push without explicit Human approval.