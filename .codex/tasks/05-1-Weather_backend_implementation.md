Phase 4 — Task 1: Weather Backend Implementation
Objective
Implement the Weather Widget backend according to the approved Phase 4 Technical Design.
Scope is strictly limited to backend functionality and associated backend tests.
Do not implement the frontend Widget or modify the Dashboard Shell.
Approved Design
- Location: Toronto, Ontario, Canada
- Coordinates: 43.6532, -79.3832
- Timezone: America/Toronto
- Provider: Open-Meteo Forecast API
- Endpoint: GET /api/widgets/weather
- Current hourly forecast slot plus the following 11 slots will be displayed by the frontend.
- Backend should return up to 24 upcoming hourly forecast slots, starting with the current slot.
- The provider response should contain sufficient additional hours to support the rolling window while the backend cache is fresh.
- Backend in-memory cache TTL: 15 minutes.
- Preserve previously validated forecast data when provider refresh fails.
- No database, scheduler, global widget registry, or new shared infrastructure.
Required Implementation
1. Inspect the latest repository state and follow AGENTS.md and relevant ADRs.
2. Implement the Weather feature backend using feature-local modules.
3. Implement provider access using the approved HTTP client strategy, with bounded timeouts, response size limits, and validated provider responses.
4. Implement typed response models using Pydantic.
5. Select forecast slots using UTC instants. Convert each slot independently to Toronto local time.
6. Handle DST transitions, null measurements, unfamiliar weather codes, and invalid provider data.
7. Implement bounded in-memory caching, refresh coordination, provider failure cooldown, and stale-data retention.
8. Implement the approved API contract, including served_at, updated_at, stale_after, stale, refresh_error, and hourly forecast entries.
9. Preserve the existing Status Widget and static asset behavior.
10. Add deterministic backend tests for provider normalization, time boundaries, DST, caching, concurrency, timeouts, malformed data, and endpoint behavior.
API Behavior Clarification
- When usable cached forecast data exists, return HTTP 200 with freshness metadata.
- When cached forecast coverage is exhausted, preserve stale metadata and return an empty hours collection.
- When no successful usable forecast has ever been retrieved and the provider is unavailable, return HTTP 503 with a sanitized public error.
- Do not expose upstream exception details or internal service information.
- Use Cache-Control: no-store.
Verification
Run relevant backend tests and the existing backend regression suite.
Explicitly distinguish:
- Tests actually executed
- Results reported by the implementation
- Any checks that remain unverified
Do not claim frontend, Docker, or real-iPad acceptance from backend tests.
Constraints
- Do not modify frontend implementation.
- Do not refactor Status Widget.
- Do not introduce generalized scheduling or caching frameworks.
- Do not create unnecessary abstractions.
- Do not add background weather polling.
- Keep dependencies minimal.
- Preserve the approved single-container deployment architecture.
Deliverables
Provide:
1. Summary of implementation
2. Files added or modified
3. API contract and example response
4. Test execution results
5. Known limitations and tradeoffs
6. Git diff summary
7. Any deviations from the approved design
Stop after Task 1.
Do not start Task 2 without Human approval.