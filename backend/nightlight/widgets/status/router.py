from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel


class StatusResponse(BaseModel):
    status: Literal["ok"]


router = APIRouter(prefix="/api/widgets/status")


@router.get("", response_model=StatusResponse)
def status() -> StatusResponse:
    return StatusResponse(status="ok")
