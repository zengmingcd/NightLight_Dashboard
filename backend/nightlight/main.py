from contextlib import asynccontextmanager
from pathlib import Path

import httpx2

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from nightlight.widgets.status.router import router as status_router
from nightlight.widgets.weather.router import router as weather_router
from nightlight.widgets.weather.service import WeatherService


# Local: frontend/dist. Container: /app/frontend/dist.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx2.AsyncClient(
        limits=httpx2.Limits(max_connections=1, max_keepalive_connections=1),
    ) as client:
        app.state.weather = WeatherService(client)
        try:
            yield
        finally:
            del app.state.weather


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.include_router(status_router)
app.include_router(weather_router)


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    return FileResponse(
        FRONTEND_DIST / "index.html",
        headers={"Cache-Control": "no-cache"},
    )


# Only assets are mounted: /api and unknown paths retain FastAPI's JSON 404.
app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")
