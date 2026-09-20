We have provisionally selected the following technology stack:

- Frontend: Preact + TypeScript + Vite
- Backend: Python 3.12 + FastAPI + Pydantic + Uvicorn
- Deployment: a single Docker runtime container, with frontend assets built separately and served by FastAPI

The technology stack is not considered fully validated yet because Safari on iOS 12.5.8 is a hard compatibility constraint.

Before designing the full project structure or implementing production widgets, I want to perform a small compatibility spike focused on the frontend.

Please first inspect the repository instructions and current repository state.

## Goal

Determine whether Preact + TypeScript + Vite is a practical frontend stack for Safari on iOS 12.5.8, and identify any compatibility configuration, polyfills, implementation restrictions, or target-device validation that will be required.

## Scope

The spike should be intentionally small. It is not the first production widget and should not establish unnecessary application architecture.

It should exercise only representative capabilities likely to be needed by the dashboard, including:

- Preact component mount, update, and unmount behavior
- basic component state
- event handling and cleanup
- periodic updates using timers
- HTTP requests using `fetch`
- async/await
- basic error and loading states
- CSS Grid and/or Flexbox layout
- CSS custom properties
- relevant page/lifecycle behavior for a long-running dashboard
- recovery after a temporary network failure where practical

Review the generated production assets and browser APIs used by the implementation, rather than assuming that TypeScript transpilation or Preact browser support guarantees application compatibility.

## Compatibility Analysis

Identify, for the capabilities used by the spike:

- what is expected to work natively on Safari/iOS 12.5.8
- what requires transpilation
- what requires a polyfill
- what should be avoided
- what cannot be confidently verified without the physical target device

Pay particular attention to Vite's production build target and any dependencies or generated JavaScript that could exceed the Safari 12 compatibility boundary.

## Validation

Validation should distinguish between:

1. automated validation possible in the development environment
2. static/build compatibility analysis
3. validation that must be performed on the actual iPad running iOS 12.5.8

Do not claim Safari/iOS 12.5.8 compatibility based only on modern browser tests or build success.

For target-device validation, propose a short manual test checklist that I can execute on the iPad.

Also include a practical way to observe whether repeated updates over an extended period cause obvious functional or resource-stability problems.

## Process

Because this work affects the selected technology stack and compatibility strategy:

1. Inspect the repository and relevant instructions.
2. Research or verify current compatibility assumptions where necessary.
3. Propose an implementation and validation plan.
4. Explain any important technology or configuration choices.
5. Wait for my confirmation before modifying files.

Keep the spike minimal and avoid introducing unrelated infrastructure or abstractions.

## Deliverables for the planning step

Before implementation, provide:

- your proposed spike design
- files you expect to add or modify
- Vite/browser compatibility strategy
- capabilities/APIs being tested
- automated validation approach
- target-iPad manual validation checklist
- known uncertainties or risks

Do not modify files until I approve the plan.