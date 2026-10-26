# Task: Weather Widget Technical Design

## 1. Objective

Analyze the existing NightLight Dashboard architecture and propose a minimal technical design for a new Weather Widget.

**This is a design-only task. Do not modify files, implement code, install dependencies, or execute tests.**

The proposal will be reviewed and approved by the project owner before implementation begins.

## 2. Project Context

Repository: `zengmingcd/NightLight_Dashboard`

Target branch: `main`

The project is a lightweight dashboard designed for continuous display on an older iPad running Safari on iOS 12.5.8.

Existing technology stack:

- Frontend: Preact + TypeScript + Vite
- Backend: Python 3.12 + FastAPI + Pydantic
- Deployment: Multi-stage Docker build with a single Python runtime container
- Production frontend and `/api` are served from the same origin

The project already includes a working Status Widget vertical slice.

The third phase has been completed and accepted, including the previously outstanding Docker, target-device compatibility, and endurance validations.

## 3. Read Existing Project Context

Before proposing any design:

1. Inspect the current branch, commit, and working tree status.
2. Read `AGENTS.md`.
3. Read relevant architecture decisions under `docs/decisions/`.
4. Read relevant validation documents under `docs/validation/`.
5. Inspect the existing Dashboard Shell and Status Widget implementations.
6. Inspect existing backend API routing, tests, and Docker configuration.

Use the actual repository contents as the source of truth.

Do not assume that previously documented file structures are still current.

Do not make any changes to the working tree.

## 4. Weather Widget Requirements

### Functional Requirements

- Display weather for a fixed location: Toronto, Ontario, Canada.
- Display the next 12 forecast hours, rolling forward with time.
- Display 12 hourly entries in a compact grid: 2 rows × 6 columns.
- Each hourly entry includes:
  - Local hour
  - Weather condition icon
  - Temperature in Celsius
  - Precipitation probability
- Use the `America/Toronto` timezone and correctly handle daylight saving time.
- Automatically refresh weather data.
- Display the timestamp of the last successful data update.
- Handle temporary network or upstream API failures gracefully.
- When available, retain and display the last successfully retrieved forecast, clearly indicating when the data is stale.

### UI Requirements

- Designed primarily for an iPad in landscape orientation.
- Compact enough to coexist with other widgets on the Dashboard.
- Readable at a distance.
- No horizontal scrolling.
- No unnecessary animations or complex interactions.
- Follow existing Dashboard styling and layout conventions.
- Maintain compatibility with Safari on iOS 12.5.8.

### Data Source

Preferred provider: Open-Meteo Forecast API.

Official documentation:
https://open-meteo.com/en/docs

Use the backend to communicate with the weather provider.

The frontend should only communicate with the local FastAPI backend.

Confirm the required Open-Meteo fields, timezone behavior, weather-code mapping, and attribution requirements.

Do not introduce API credentials unless actually required.

## 5. Architecture Constraints

Reuse the existing architecture.

- Weather must have its own feature-specific frontend and backend boundaries.
- The Shell remains responsible for composition and layout.
- Weather-specific fetching, rendering states, and errors belong within the Weather feature.
- Do not introduce a global widget registry, plugin system, scheduler, state management framework, or database.
- Do not create shared abstractions merely for anticipated future widgets.
- Introduce a shared abstraction only if actual existing consumers justify it.
- Keep dependencies minimal.
- Preserve the single-runtime-container deployment approach.

Existing Status Widget behavior should remain unchanged unless a specific, justified integration requirement is identified.

## 6. Design Questions to Answer

Analyze and recommend:

1. **Frontend integration:** Where should Weather Widget files live, and how should the Dashboard compose the widget?
2. **Backend integration:** What endpoint, response schema, and error behavior should the Weather API expose?
3. **Provider integration:** How should FastAPI retrieve, validate, and normalize Open-Meteo data?
4. **Time handling:** How should the next 12 hourly forecast entries be selected, including hour boundaries, timezone, and daylight saving time?
5. **Refresh and caching:** What is the simplest reliable refresh strategy? How should caching, stale data, request timeouts, and failures work? Explain whether state survives server restarts.
6. **UI layout:** How can the 2 × 6 compact grid fit within the current Dashboard Shell without interfering with the Status Widget?
7. **Compatibility:** What are the relevant iOS 12 Safari risks, including JavaScript, CSS, and weather icon rendering?
8. **Testing:** What unit, integration, frontend, Docker, and target-device tests are necessary?
9. **Attribution:** How should required weather-data attribution be displayed?
10. **Tradeoffs:** What should be implemented now, deferred, or explicitly excluded?

Do not assume that build success or modern browser tests prove target-device compatibility.

## 7. Expected Deliverables

Return a design proposal containing:

### A. Existing Architecture Findings

Summarize relevant findings from the actual repository, with file paths.

Clearly distinguish verified observations from assumptions.

### B. Proposed Architecture

Describe the minimal Weather Widget data flow and integration points.

### C. Proposed File Changes

List files to add and existing files that would need modification.

Explain the purpose of each file.

### D. API Contract

Propose the backend endpoint and example JSON response.

Explain timestamp formats, units, weather-condition representation, and error behavior.

### E. Refresh and Failure Handling

Explain the recommended refresh interval, backend cache strategy, timeout handling, stale-data behavior, and prevention of unnecessary overlapping requests.

### F. Testing and Acceptance Criteria

Propose test scenarios and measurable acceptance criteria, including real iPad validation.

### G. Risks and Open Questions

Identify unresolved decisions that require project-owner approval.

### H. Implementation Plan

Break the approved design into a small number of implementation tasks, ordered by dependencies.

For each task, provide its scope, expected output, and verification criteria.

## 8. Boundaries

This task is strictly read-only and design-only.

**DO NOT:**

- Modify or create repository files.
- Execute tests or build commands.
- Install or update dependencies.
- Refactor existing components.
- Implement Weather Widget.
- Commit or push changes.

**Prefer:**

- Minimal architecture changes.
- Clear ownership boundaries.
- Reliable behavior over technical sophistication.
- Simple code that is maintainable and testable.
- Explicit tradeoffs rather than unnecessary abstractions.

Finish by presenting the proposal for Human Architecture Review.

Do not proceed with implementation without explicit approval.