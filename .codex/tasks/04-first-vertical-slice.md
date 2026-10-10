The frontend compatibility spike has been successfully validated on the target iPad running iOS 12.5.8.

We can now treat the selected technology stack as:

- Frontend: Preact + TypeScript + Vite
- Backend: Python 3.12 + FastAPI + Pydantic + Uvicorn
- Deployment: single Docker runtime container
- FastAPI will eventually serve the built frontend assets and `/api` endpoints
- Python dependencies must use an isolated `.venv` created with `python3.12`
- Node dependencies must remain project-local

The compatibility spike should remain isolated as engineering evidence and should not become production application code.

Please inspect the repository and AGENTS.md before proceeding.

## Goal

Propose the initial production project structure for NightLight Dashboard.

The structure should support the documented architecture:

- Application Shell owns dashboard-level layout and common lifecycle/scheduling mechanisms.
- Widgets are feature boundaries and may contain both frontend and backend feature-specific code.
- Shared code should exist only for genuinely reusable capabilities with stable shared semantics.
- Frontend handles presentation and browser interaction.
- Backend handles business logic, external integrations, and secrets.
- The application remains a single lightweight application, not a collection of microservices.

## Important constraints

Keep the initial structure minimal.

Do not create directories, abstraction layers, interfaces, generic widget frameworks, repositories, services, caches, configuration systems, or infrastructure merely because they may be useful later.

The structure should make the intended ownership boundaries clear without designing for hypothetical future requirements.

The existing compatibility spike should remain under `spikes/` and should not be coupled to production code.

## First vertical slice

Design the structure with the first vertical slice in mind.

The first slice should be intentionally simple but exercise the real production architecture end-to-end:

Browser
→ Application Shell
→ one Widget
→ frontend API call
→ FastAPI widget endpoint
→ response model
→ Widget rendering

The first widget should not require an external API, database, authentication, AI integration, or secret.

Its purpose is to validate the production architecture and development workflow rather than provide a sophisticated feature.

You may recommend an appropriate minimal first widget, but do not implement it yet.

## Testing

The proposed structure should provide clear locations for:

- frontend tests
- backend tests
- cross-boundary or end-to-end tests when justified

Do not introduce a large testing framework hierarchy before it is needed.

## Deliverables

Before modifying files, provide:

1. Proposed production directory structure.
2. Responsibility of each important directory/module.
3. How Application Shell, Widgets, Shared, and backend feature boundaries map onto that structure.
4. Proposed first vertical-slice widget and why it is suitable.
5. Expected frontend/backend API boundary for that slice.
6. Initial testing strategy.
7. Which files/directories should be created now versus deferred until required.
8. Any architectural decisions or uncertainties that still require my approval.

Do not modify files yet.

Wait for my approval before scaffolding the production application.