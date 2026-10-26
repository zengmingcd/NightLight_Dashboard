# Phase 4 — Task 2: Independent Weather Frontend Code Review

## Objective

Perform an independent, read-only code review of the Weather Frontend implementation.

Review the actual working-tree changes rather than relying on the implementation report.

Do not modify files, install dependencies, run tests or builds, commit, or push.

## 1. Context

Project: NightLight Dashboard

Target: Safari on iOS 12.5.8, running continuously on a landscape iPad.

Task 2 implements the Weather Widget frontend only.

Approved requirements:

- Fixed Toronto hourly forecast
- Current hour plus the following 11 hours
- Compact 2 × 6 grid
- Weather icons, Celsius temperature, precipitation probability
- Five-minute polling
- Hourly window rollover
- Stale-data retention
- Proper error and timeout handling
- Feature-local request lifecycle
- Open-Meteo attribution
- No changes to Dashboard Shell or Status Widget

## 2. Review Preparation

1. Read `AGENTS.md` and relevant ADRs.
2. Inspect the current branch and working-tree changes.
3. Read the actual Weather Backend response models.
4. Review all new Weather Frontend files and tests.
5. Inspect the existing Status Widget and relevant testing conventions.
6. Identify which changes belong to Task 2 versus earlier tasks.

Use actual repository contents as the source of truth.

## 3. Review Focus

### A. Forecast Data Correctness

Verify:

- Backend response validation
- Correct UTC hourly selection
- Current-hour inclusion
- Exactly 12 display slots
- Correct association of hourly measurements with timestamps
- Midnight rollover
- Spring and autumn DST transitions
- Missing hourly entries and nullable values
- Unknown weather codes
- No reuse of expired forecasts
- Server-clock anchoring and behavior during clock changes

### B. Refresh and Lifecycle Reliability

Verify:

- Initial request on mount
- Five-minute polling while visible
- Hourly window rollover within approximately one minute
- Visibility and pageshow handling
- Correct cleanup of timers and listeners
- No overlapping requests
- Native, unavailable and ineffective cancellation
- Late-response protection
- Request deadline covering response-body handling
- Safe component unmount and replacement
- No unbounded accumulation of resources

### C. UI and Legacy Compatibility

Verify:

- Compact 2 × 6 layout
- Weather icon accessibility and correctness
- Readable temperature, hour and precipitation labels
- Stale and incomplete-coverage messages
- Last successful retrieval timestamp
- Open-Meteo attribution
- No unnecessary animation or external assets
- Compatibility with Safari on iOS 12.5.8

Inspect both JavaScript runtime compatibility and CSS/SVG compatibility.

Do not treat modern WebKit tests or successful compilation as proof of target-device compatibility.

### D. Architecture and Maintainability

Check:

- Weather feature ownership boundaries
- No accidental coupling with Status
- No Dashboard Shell integration in Task 2
- No unnecessary shared abstractions
- No unjustified dependencies
- Avoidable duplication or excessive lifecycle complexity

Do not recommend refactoring solely because Weather and Status contain similar code.

### E. Test Quality

Review the reported Weather tests for:

- Meaningful behavioral assertions
- Distinct hourly fixture values
- Realistic success and failure scenarios
- Deterministic time control
- Genuine coverage of timeout and cancellation
- Cleanup and component replacement
- Stale-data retention and recovery
- Weak mocks or assertions that could conceal defects

Identify gaps that could allow an incorrect production implementation to pass.

## 4. Deliverables

Provide:

1. Overall verdict: Approve / Changes Requested / Block
2. Findings ordered by severity: P0, P1, P2, P3
3. Exact file and line references
4. Impact and recommended correction for each finding
5. Test coverage assessment
6. Non-blocking improvements
7. Whether Task 2 is ready to close and Task 3 may begin

Distinguish implementation-reported test results from independently verified observations.

If no findings exist, explicitly state so.

## 5. Boundaries

This is a strictly read-only static review.

DO NOT:

- Modify any file
- Execute tests or builds
- Install dependencies
- Refactor production code
- Commit or push changes
- Begin Task 3

Return review findings for Human decision.