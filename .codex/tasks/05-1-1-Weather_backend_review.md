# Phase 4 — Task 1: Independent Backend Code Review

## Objective

Perform an independent, read-only code review of the Weather Backend implementation.

Review the actual uncommitted working-tree changes, not the implementation summary.

This is a static review only. Do not modify files, install dependencies, execute tests, commit, or push.

## Review Context

Project: NightLight Dashboard

Phase 4, Task 1: Weather Backend

The approved design requires:

- Feature-local Weather Backend
- Open-Meteo Forecast API
- Fixed Toronto location
- UTC-based hourly forecast selection
- Correct America/Toronto timezone and DST handling
- Up to 24 hourly forecast entries starting with the current hour
- 15-minute in-memory cache
- 60-second provider failure cooldown
- Bounded requests and responses
- Stale forecast retention
- Existing Status functionality preserved
- No unnecessary shared infrastructure

## Review Procedure

1. Read `AGENTS.md` and relevant architecture decisions.
2. Inspect the current branch and working-tree status.
3. Inspect `git diff`, including untracked Weather files.
4. Read all new and modified Backend source files.
5. Inspect the Weather tests and existing Backend regression tests.
6. Compare implementation against the approved architecture and API contract.

Do not rely on the implementation report as evidence of correctness.

## Focus Areas

### A. Forecast Correctness

- Current-hour selection and hourly boundaries
- UTC timestamp handling
- Toronto DST transitions
- Provider forecast length and 24-slot coverage
- Hour rollover during cache validity
- Null values and unknown weather codes

### B. Reliability

- Cache expiration and stale-data retention
- Failure cooldown
- Concurrent requests and locking
- Request timeout and cancellation
- HTTP response-body size enforcement
- Async HTTP client lifecycle and shutdown

### C. API Contract

- Response-model validation
- Timestamp and stale-state semantics
- HTTP 200 / 503 behavior
- Error sanitization
- Cache-Control headers
- No accidental leakage of internal information

### D. Architecture and Maintainability

- Compliance with existing feature boundaries
- No unnecessary abstractions
- No Status Widget regression
- Dependency correctness
- Code clarity and avoidable complexity

### E. Test Quality

Review whether the reported 66 Weather tests actually cover critical behavior.

Identify missing scenarios, weak assertions, incorrect mocks, or tests that might pass despite incorrect production behavior.

Do not rerun tests. Treat reported execution results separately from static review findings.

## Deliverables

Return:

1. Overall verdict: Approve / Changes Requested / Block
2. Findings ordered by severity: P0 / P1 / P2 / P3
3. Exact file and line references for each finding
4. Explanation of impact and recommended correction
5. Test coverage gaps
6. Non-blocking improvement suggestions
7. Whether Task 1 is ready to close and Task 2 may begin

If no issues are found, explicitly state that conclusion.

Do not propose unrelated refactoring or new features.

Do not modify anything.