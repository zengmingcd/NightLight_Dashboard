from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Temperature = Annotated[float, Field(allow_inf_nan=False)]
Probability = Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]
Timestamp = Annotated[int, Field(ge=0, le=253402300799)]
WeatherCode = Annotated[int, Field(ge=0)]


class ProviderHours(BaseModel):
    model_config = ConfigDict(strict=True, allow_inf_nan=False)

    time: list[Timestamp] = Field(min_length=1, max_length=26)
    temperature_2m: list[Temperature | None]
    precipitation_probability: list[Probability | None]
    weather_code: list[WeatherCode | None]
    is_day: list[Annotated[int, Field(ge=0, le=1)] | None]

    @model_validator(mode="after")
    def aligned_hours(self):
        size = len(self.time)
        if any(len(values) != size for values in (
            self.temperature_2m, self.precipitation_probability,
            self.weather_code, self.is_day,
        )):
            raise ValueError("Hourly arrays must align")
        if any(value % 3600 for value in self.time) or any(
            right - left != 3600 for left, right in zip(self.time, self.time[1:])
        ):
            raise ValueError("Expected continuous UTC hourly slots")
        return self


class ProviderUnits(BaseModel):
    model_config = ConfigDict(strict=True)

    time: Literal["unixtime"]
    temperature_2m: Literal["°C"]
    precipitation_probability: Literal["%"]
    weather_code: Literal["wmo code"]
    is_day: Literal[""]


class ProviderForecast(BaseModel):
    model_config = ConfigDict(strict=True)

    timezone: Literal["America/Toronto"]
    hourly_units: ProviderUnits
    hourly: ProviderHours


class ForecastHour(BaseModel):
    model_config = ConfigDict(frozen=True)

    time: datetime
    local_label: str
    local_date: str
    local_zone: str
    temperature_c: Temperature | None
    precipitation_probability_pct: Probability | None
    # Preserve unfamiliar codes; presentation can fall back to an unknown icon.
    weather_code: WeatherCode | None
    is_day: bool | None


class WeatherResponse(BaseModel):
    location: Literal["Toronto, Ontario, Canada"] = "Toronto, Ontario, Canada"
    timezone: Literal["America/Toronto"] = "America/Toronto"
    served_at: datetime
    updated_at: datetime
    updated_label: str
    stale_after: datetime
    stale: bool
    refresh_error: Literal["upstream_unavailable"] | None
    hours: list[ForecastHour] = Field(max_length=24)
