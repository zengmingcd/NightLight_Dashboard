from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


# Local: frontend/dist. Container: /app/frontend/dist.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    return FileResponse(
        FRONTEND_DIST / "index.html",
        headers={"Cache-Control": "no-cache"},
    )


# Only assets are mounted: /api and unknown paths retain FastAPI's JSON 404.
app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")
