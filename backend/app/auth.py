"""Telegram Mini App session-token exchange endpoint."""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from .security import create_session_token, verify_telegram_init_data

router = APIRouter(prefix="/auth", tags=["Authentication"])


class SessionResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int


@router.post("/session", response_model=SessionResponse)
def create_mini_app_session(request: Request) -> SessionResponse:
    """Verify Telegram's short-lived signature and issue a bounded API token."""
    authorization = request.headers.get("authorization", "")
    scheme, separator, init_data = authorization.partition(" ")
    if scheme.lower() != "tma" or not separator or not init_data.strip():
        raise HTTPException(status_code=401, detail="Telegram Mini App orqali qayta kiring.")
    identity = verify_telegram_init_data(init_data.strip())
    access_token, expires_in = create_session_token(identity)
    return SessionResponse(access_token=access_token, expires_in=expires_in)
