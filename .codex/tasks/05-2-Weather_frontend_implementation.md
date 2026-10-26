# Phase 4 — Task 2: Weather Frontend Implementation

## Objective

Implement the Weather Widget frontend according to the approved Phase 4 architecture and the actual Weather Backend API contract.

Scope is limited to the Weather frontend feature and its feature-specific tests.

Do not integrate Weather into the Dashboard Shell in this task.

## 1. Read Existing Context

Before implementation:

1. Read `AGENTS.md` and relevant architecture decisions.
2. Inspect the latest working tree and branch.
3. Inspect the existing Status Widget implementation and frontend tests.
4. Inspect the actual Weather Backend API contract and Pydantic response models.
5. Confirm current iOS 12.5.8 compatibility constraints.

Use actual repository code as the source of truth.

Do not assume that the API example in previous design documents exactly matches the implementation.

## 2. Functional Requirements

Implement a Weather Widget with:

- Fixed location: Toronto, Ontario, Canada.
- Display the current hourly forecast slot and the following 11 hourly slots.
- Compact grid layout: 2 rows × 6 columns.
- Each slot displays:
  - Local hour
  - Weather condition icon
  - Temperature in Celsius
  - Precipitation probability
- Clearly label the information as an hourly forecast, not a live observation.
- Display the timestamp of the last successful forecast retrieval.
- Provide weather-data attribution as required by Open-Meteo.

## 3. Data and Time Handling

Use:

`GET /api/widgets/weather`

The frontend must:

- Validate backend responses before rendering.
- Use the backend's UTC hourly timestamps for chronological selection.
- Use backend-provided Toronto-local labels for display.
- Preserve correct behavior across midnight and DST transitions.
- Display exactly 12 slots, using `—` for unavailable measurements or missing future slots.
- Never reuse expired hourly data as future forecasts.
- Distinguish forecast coverage from retrieval freshness.

The backend may provide up to 24 hourly entries.

## 4. Refresh and Reliability

Implement a minimal Weather-local lifecycle:

1. Fetch on component mount.
2. Poll the backend approximately every five minutes while visible.
3. Recompute the displayed hourly window at least once per minute while visible.
4. On page visibility restoration or `pageshow`, refresh the forecast window and request updated data.
5. Clean up timers and listeners on unmount.

Handle:

- Initial loading
- Successful responses
- HTTP errors
- Invalid JSON or invalid contracts
- Network failures
- Request timeout
- Stale cached data
- Exhausted forecast coverage
- Recovery after temporary failures

Retain the last valid forecast during refreshes and temporary failures.

Use the server response timestamp as the clock anchor when available, rather than relying exclusively on the iPad's local clock.

## 5. Request Safety

Preserve the established reliability requirements:

- Prevent overlapping Weather requests.
- Prevent stale responses from replacing newer state.
- Prevent unmounted components from updating state.
- Handle native, missing and ineffective cancellation.
- Do not release an outstanding request guard merely because abort was called.
- Do not accumulate timers, listeners, or unresolved requests.

Follow lessons from the Status Widget without introducing an unnecessary generalized request framework.

## 6. UI and Styling

Follow existing Dashboard visual conventions.

Initial layout:

- Compact heading: `Toronto · Hourly forecast`
- Two rows, six columns each
- Chronological reading order
- Weather condition icon
- Celsius temperature
- Precipitation probability
- Last successful retrieval timestamp
- Stale-data indication where applicable
- Open-Meteo attribution

Use local, lightweight weather icons.

Avoid external icon services, remote fonts, unnecessary animations and heavyweight UI dependencies.

Maintain compatibility with Safari on iOS 12.5.8.

Do not assume modern Chromium or WebKit test success proves target-device compatibility.

## 7. Architecture Constraints

- Keep the Weather feature self-contained.
- Do not modify Status Widget behavior.
- Do not introduce global scheduling or state management.
- Do not implement a Widget Registry or plugin framework.
- Do not modify the Backend API unless an actual contract defect is discovered; report any such defect instead.
- Do not modify Dashboard Shell composition or layout.
- Do not introduce additional dependencies without clear justification.

## 8. Tests

Add deterministic frontend tests following the existing project's testing conventions.

Cover:

- Loading, successful rendering and error states
- Twelve-slot rendering
- Distinct hourly temperatures and precipitation values
- Current-hour selection and hourly rollover
- Midnight and DST transitions
- Null and missing measurements
- Unknown weather codes
- Five-minute polling
- Visibility suspend and resume
- Stale-data retention and recovery
- Exhausted coverage
- Request timeout and cancellation
- Late responses
- Component replacement and unmount cleanup
- Prevention of overlapping requests

Use controlled API fixtures.

Run the relevant frontend test suite and available compatibility checks.

Do not claim actual iPad compatibility based solely on automated browser tests.

## 9. Deliverables

Provide:

1. Implementation summary
2. Files added or modified
3. Description of UI and behavior
4. Tests actually executed and their results
5. Known limitations
6. Git diff summary
7. Any deviations from the approved design

Stop after Task 2.

Do not start Dashboard Shell integration or Task 3 without explicit Human approval.