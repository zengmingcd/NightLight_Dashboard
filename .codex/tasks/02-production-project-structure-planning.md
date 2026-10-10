# Task: Propose the Initial Production Project Structure

We have completed the project instruction, architecture foundation, technology-stack selection, and iOS 12.5.8 frontend compatibility validation.

The next phase is:

**Production Project Structure + First Vertical Slice**

For this task, focus only on **production project structure planning**.

Do **NOT** modify, create, move, or delete any files.

## 1. Inspect Existing Project Context

Before proposing the structure, inspect the current repository and relevant existing project knowledge, including:

- `AGENTS.md`
- existing architecture decision records
- validation documentation
- existing spike code where relevant
- current repository structure and implementation state

Base the proposal on the project's existing constraints and accepted decisions rather than designing the structure from scratch.

## 2. Established Technology Decisions

The production stack is already decided:

### Frontend

- Preact
- TypeScript
- Vite

### Backend

- Python 3.12
- FastAPI
- Pydantic
- Uvicorn

### Deployment

- multi-stage Docker build
- single runtime container
- FastAPI serves production frontend assets
- FastAPI provides `/api` endpoints
- frontend and backend use the same origin

Treat these as established project decisions rather than alternatives to reconsider in this task.

## 3. Structure to Propose

Propose the initial production project structure for NightLight Dashboard.

The proposal should address:

1. Frontend production structure
2. Backend production structure
3. Application Shell location and responsibilities
4. Widget feature organization
5. Backend/API feature organization
6. Test organization
7. Minimal shared/common code organization
8. Frontend/backend boundary
9. Production build/deployment-related files or locations that should exist initially
10. Which directories/files should exist initially
11. Which structures or abstractions should be deferred until there is a concrete requirement

## 4. Design Expectations

For each important structural decision:

- explain the reasoning
- reference relevant existing project constraints, architecture decisions, or validation results
- identify important trade-offs where applicable
- distinguish between what is needed now and what is only a possible future requirement

If multiple reasonable structures exist, explain the alternatives and trade-offs rather than silently choosing one.

Recommend one structure when there is enough evidence to do so.

Keep the structure minimal.

Do not introduce abstractions for hypothetical future requirements.

In particular, do not create shared abstractions merely because code may look similar. Shared code should only be introduced when there are multiple consumers with stable shared semantics.

Do not introduce distributed or multi-instance infrastructure unless an existing requirement requires it.

## 5. Scope Boundary

This is a **planning task only**.

Do not:

- scaffold the production application
- implement the Application Shell
- implement Widgets
- implement backend APIs
- create tests
- create Docker/build files
- modify existing spike code
- change existing architecture decisions

Implementation will happen only after human review and approval of the proposed structure.

## 6. Required Output

End the response with:

1. **Proposed Directory Tree**
2. **Responsibilities of Each Major Directory**
3. **Key Structural Decisions and Reasoning**
4. **Deferred Structures / Abstractions**
5. **Open Questions or Decisions Requiring Human Approval**

The goal of this task is to produce a minimal, justified production structure that can be reviewed before implementation begins.