# Task: Implement the First Status Widget Vertical Slice

## Context

The Minimal Production Scaffold has been implemented and reviewed. Its overall architecture is accepted.

Continue from the existing scaffold. Do not repeat initial project structure planning or recreate the application skeleton.

The established stack remains:

- Frontend: Preact + TypeScript + Vite.
- Backend: Python 3.12 + FastAPI + Pydantic + Uvicorn.
- Deployment: multi-stage Docker build with one Python runtime container.
- FastAPI serves built frontend assets and `/api` endpoints from the same origin.
- Safari on iOS 12.5.8 remains a hard compatibility constraint.

## Goal

Implement the smallest Status Widget that exercises the real production flow:

Browser → Application Shell → Status Widget → same-origin API request → FastAPI endpoint → Pydantic response → Widget rendering.

The widget demonstrates application reachability. It is not an infrastructure health check or system monitoring feature.

## Before Implementation

Inspect:

- `AGENTS.md`.
- `docs/decisions/frontend_stack.md`.
- `docs/validation/ios-12-frontend-compatibility.md`.
- The existing frontend, backend, Docker configuration, and tests.
- Relevant compatibility spike code as reference only.

Preserve accepted dependency versions and compatibility-related build settings.

Present a concise implementation plan and wait for approval before editing, following `AGENTS.md`. Identify proposed files, ownership boundaries, API contract, tests, and any decisions requiring clarification.

## Implementation Scope

### 1. Correct the Static-Serving Test

The existing `/assets/../index.html` request is normalized by the HTTP client before reaching the application. It does not exercise the intended static-directory boundary.

Add an encoded traversal case such as:

`/assets/%2e%2e/index.html`

Ensure the request reaches the application with the intended traversal path rather than becoming an ordinary unknown route.

Assert:

- HTTP 404.
- JSON error response.
- No frontend HTML or file contents are exposed.

Retain existing relevant route and asset tests.

### 2. Implement the Backend Status Feature

Add:

`GET /api/widgets/status`

Return HTTP 200 with a Pydantic response model representing:

```json
{
  "status": "ok"
}
```

Requirements:

- Organize the endpoint and response model within the Status feature.
- Register the feature router explicitly in the application.
- Keep application composition and static serving in the application entry point.
- Preserve unknown `/api` routes as JSON 404 responses.
- Do not add timestamps, host information, resource metrics, or dependency checks.

### 3. Implement the Frontend Status Widget

Requirements:

- Place feature-specific UI and request behavior within the Status feature.
- Compose the widget explicitly in the existing dashboard shell.
- Request `/api/widgets/status` using a relative, same-origin URL.
- Make one request when the widget mounts.
- Display clear loading, success, and failure states.
- Provide manual retry after failure.
- Treat HTTP errors, invalid responses, network failures, and timeouts as failures.
- Avoid overlapping requests and repeated retry submissions.
- Clean up timers and cancel requests on unmount where supported.
- Prevent obsolete responses from updating the widget after unmount or replacement.

Respect the documented iOS cancellation limitations: a timeout or abort request does not prove the underlying request has settled. Do not allow repeated retries to accumulate unresolved requests. Report any resulting recovery limitation clearly.

Keep request handling local to this feature. Do not create a generic API client or shared request framework.

### 4. Preserve the Shell Boundary

The Application Shell owns dashboard composition and layout.

Status-specific fetching, response interpretation, loading, errors, and retry behavior belong to the Status feature.

Do not introduce shell-level scheduling or lifecycle infrastructure for this single widget.

## Testing

Keep tests focused on distinct responsibilities.

### Backend Tests

Verify:

- The endpoint returns HTTP 200 and JSON.
- The response matches the agreed contract.
- Unknown API routes still return JSON 404.
- Existing frontend/static-serving behavior remains correct.
- The encoded traversal case is covered.

### Frontend Tests

Verify:

- Loading state.
- Successful response rendering.
- HTTP, network, invalid-response, and timeout failures.
- Manual retry and prevention of overlapping requests.
- Safe behavior when requests finish after unmount.

Use mocked responses or controlled requests where appropriate. Reuse existing test tooling when practical; justify any new dependency.

### Cross-Boundary E2E

Verify that:

- FastAPI serves the production frontend build.
- The dashboard mounts the Status Widget.
- The widget calls the real backend endpoint.
- The returned status is rendered successfully.
- No uncaught browser errors occur during the tested flow.

Do not mock the Status endpoint in this E2E test. Keep E2E coverage small rather than duplicating every frontend failure case.

## Validation

Run applicable checks:

- Frontend type checking.
- Frontend production build.
- Backend tests.
- Frontend behavior tests.
- Real frontend/backend E2E.
- Docker image build.
- Production container startup.
- Dashboard and Status Widget loading from the running container.
- Review of compatibility-sensitive source code and generated assets.

Confirm that Node remains build/development tooling and is not required in the final runtime image.

Classify failures as implementation, test, environment, or compatibility issues. Do not remove tests or weaken assertions to obtain a pass.

If a check cannot run, report the blocker and mark the behavior unverified. Do not treat previous scaffold or spike results as evidence that new behavior passed.

Modern Chromium or WebKit results do not prove Safari on iOS 12.5.8 compatibility.

## Target-iPad Validation

Provide a short checklist for the project owner covering:

- Loading the production dashboard on Safari/iOS 12.5.8.
- Successful Status rendering.
- Failure presentation and manual retry after restoring connectivity.
- Portrait and landscape display.

Record the tested commit/build and actual results when supplied. Do not claim target-device or endurance validation without evidence.

## Scope Constraints

Do not introduce:

- Automatic polling, schedulers, or background refresh.
- Shared directories or generic request abstractions.
- Widget registries or plugin systems.
- Global state management.
- Databases, caches, queues, authentication, or external integrations.
- AI functionality.
- Infrastructure health monitoring.
- Unrelated refactoring or dependency upgrades.

Keep the compatibility spike isolated and unchanged.

If implementation conflicts with an accepted architectural decision or the iOS compatibility constraint, stop and explain the conflict before redesigning.

## Acceptance Criteria

- The Status Widget completes the real frontend/backend flow.
- Loading, success, failure, and manual retry behave as specified.
- Request lifecycle handling prevents overlapping work and obsolete updates.
- The encoded traversal test exercises the intended boundary.
- Existing static-serving and unknown-route behavior is preserved.
- Applicable automated checks pass.
- Docker, browser, and target-device validation results or limitations are explicitly reported.
- No out-of-scope infrastructure or abstractions are introduced.

## Completion Report

Report:

1. Files created or modified.
2. The implemented frontend/backend flow and API contract.
3. How the static-serving test finding was addressed.
4. Tests and validation actually executed, with results.
5. Deviations, environment blockers, and unverified behavior.
6. The target-iPad checklist and remaining acceptance steps.

Do not commit, push, or implement additional features.