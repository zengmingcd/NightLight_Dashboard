# Task: Implement the Minimal Production Scaffold

The initial production project structure has been reviewed and approved.

Implement the minimal production scaffold based on the approved structure and existing project decisions.

## Goal

Create the smallest production application skeleton that proves the selected frontend, backend, build, and deployment structure works together.

Do not implement the first Status Widget or other user-facing features yet.

## Before Implementation

Inspect the current repository and relevant project guidance, including:

- `AGENTS.md`
- architecture decision records
- validation documentation
- the approved production project structure plan
- the existing frontend compatibility spike where relevant

Preserve all established project constraints and accepted technology decisions.

## Implement

Create the approved minimal production structure required at this stage.

The scaffold should include:

### Frontend

- Preact
- TypeScript
- Vite
- minimal application bootstrap
- minimal Application Shell
- minimal dashboard page sufficient to verify that the production frontend loads

Preserve the frontend versions and compatibility-related build configuration established by the accepted frontend stack decision and compatibility validation.

Do not copy spike-specific diagnostics or experimental code into production.

### Backend

- Python 3.12
- FastAPI
- Pydantic
- Uvicorn
- minimal FastAPI application
- production frontend static asset serving

Do not add feature APIs yet.

### Deployment

Implement the approved single-container production model:

- multi-stage Docker build
- frontend assets built during the build process
- final runtime contains the Python application and built frontend assets
- Node is not required in the final runtime image
- FastAPI serves the production frontend
- `/api` remains reserved for backend API routes

Add only the files required for this deployment model.

## Testing and Validation

Add only the tests necessary for the scaffold.

Validate, as applicable:

- frontend type checking
- frontend production build
- backend application startup
- production frontend/static serving
- unknown or missing route behavior where relevant
- Docker image build
- container startup
- dashboard loading from the running production container

Do not add Status Widget tests or feature-specific test infrastructure yet.

Classify and report any failures rather than weakening or removing tests.

## Scope Constraints

Do not:

- implement the Status Widget
- implement `/api/widgets/status`
- create placeholder widget directories
- introduce `shared/` directories
- introduce widget registries or plugin systems
- introduce generic scheduling or polling infrastructure
- introduce global state management
- add databases, caches, queues, authentication, or external APIs
- introduce abstractions for hypothetical future requirements
- modify the compatibility spike unless a concrete issue requires discussion first

Keep the scaffold minimal.

If implementation reveals that an approved structural decision cannot work as expected, stop and report the issue rather than silently redesigning the architecture.

## Completion Report

At the end, report:

1. files and directories created or modified
2. key implementation decisions
3. validation/tests executed and their results
4. any deviations from the approved structure
5. any unresolved issues or limitations
6. whether the scaffold is ready for the first vertical slice