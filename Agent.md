# Project Context

This project is a lightweight web dashboard designed to run fullscreen
on an older iPad through Safari. The target device has limited system
resources and runs an older version of iOS and Safari. The application
is expected to run continuously for long periods.

# Hard Constraints

- The application MUST remain compatible with Safari on iOS 12.5.8.
- API credentials and other secrets MUST NOT be exposed to frontend code or sent to the browser.

# Architecture Principles

- Separate frontend and backend responsibilities. The frontend is responsible for presentation and browser-side interactions, while the backend handles business logic, secret-dependent operations, and external API integrations.

- The dashboard uses a modular, widget-based architecture. Each widget owns its feature-specific data access, UI presentation, user interactions, and interpretation of feature-specific data.

- The application shell owns dashboard-level concerns and shared platform mechanisms, such as layout, widget sizing and alignment, and common lifecycle or scheduling behavior.

- Reusable functionality that is not specific to the application shell or an individual widget SHOULD be placed in shared code. Shared abstractions SHOULD be introduced only when the underlying behavior has the same stable semantics across multiple consumers.

- Widgets SHOULD remain loosely coupled so that a widget can be added, removed, or modified with minimal impact on other widgets.

# Engineering Guidelines

- Prefer simple, resource-efficient solutions over unnecessarily complex designs. Evaluate simplicity at the system level, not only by the amount of application code.

- Prefer existing patterns and implementations when they reasonably satisfy the requirement. Avoid introducing new abstractions without a concrete need.

- Avoid refactoring unrelated code while implementing a requested change.

- Evaluate new dependencies based on target-browser compatibility, runtime cost, maintenance burden, and the complexity they eliminate.

- Prefer mature, well-supported dependencies when they provide a clear maintenance or complexity advantage over custom implementations.

- Introduce new abstractions or infrastructure only when justified by a concrete current requirement and when the added complexity is warranted.

# Development Workflow

1. Understand the requested behavior and relevant constraints before making code changes.

2. Inspect the relevant existing implementation and identify the affected widgets, shell components, shared code, and tests.

3. For changes that affect architecture, multiple modules, or significant behavior, present the implementation plan and wait for user confirmation before proceeding.

4. Make the smallest reasonable change that satisfies the requirement, and avoid modifying unrelated code.

5. Follow the existing architecture and established code patterns.

6. After implementation, validate the affected behavior and run the relevant tests.

7. If a requested change conflicts with a hard constraint, stop and report the conflict before proceeding.

After completing the task, summarize the implemented behavior, key design decisions, affected components, validation performed, and any known limitations.

# Testing and Validation

- After modifying production code, run the tests relevant to the affected behavior.

- If a change affects the application shell, shared code, or other components used by multiple widgets, run a broader set of tests. Run the full test suite when the change has broad or cross-cutting impact.

- If a requirement changes expected system behavior, add or update the relevant tests. Tests SHOULD cover both functional behavior and relevant compatibility risks.

- Do not delete or skip relevant tests, or weaken test assertions, merely to make the test suite pass.

- When a test fails, determine whether the failure is caused by production code, the test itself, or the test environment or compatibility issue before making changes.

- If any affected behavior cannot be verified in the current environment, clearly report what could not be verified and why.

- Do not claim Safari on iOS 12.5.8 compatibility has been verified unless the affected behavior has been validated in the target environment or an equivalent environment that can reliably demonstrate compatibility.

# Definition of Done

A task is complete when:

- The requested behavior has been implemented.
- No hard constraint has been violated.
- All validation that can be performed in the current environment has passed.
- Relevant tests have been added or updated when expected behavior has changed.
- No unrelated changes have been introduced.
- Known limitations, incomplete work, and unverified behavior have been clearly reported.