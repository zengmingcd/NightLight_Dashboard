from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse

from .models import WeatherResponse
from .service import WeatherService, WeatherUnavailable


router = APIRouter(prefix="/api/widgets/weather")


def weather_service(request: Request) -> WeatherService:
    return request.app.state.weather


@router.get("", response_model=WeatherResponse)
async def weather(
    response: Response,
    service: Annotated[WeatherService, Depends(weather_service)],
) -> WeatherResponse | JSONResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await service.forecast()
    except WeatherUnavailable:
        return JSONResponse(
            status_code=503,
            headers={"Cache-Control": "no-store", "Retry-After": "60"},
            content={"error": {
                "code": "weather_unavailable",
                "message": "Weather is temporarily unavailable.",
            }},
        )
