from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from auth.schemas import (
    AuthUser,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    RegisterRequest,
    RegisterResponse,
    SessionResponse,
)
from auth.dependencies import get_current_auth
from auth.security import AuthContext
from auth.service import AuthError, login_service, logout_service, register_service
from db.database import get_db


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    try:
        return login_service(db, data.user, data.password, response)
    except AuthError as error:
        return JSONResponse(
            status_code=error.status_code,
            content={"message": error.message},
        )


@router.post("/logout", response_model=LogoutResponse)
def logout(response: Response):
    return logout_service(response)


@router.get("/me", response_model=SessionResponse)
def read_current_session(auth: AuthContext = Depends(get_current_auth)):
    return SessionResponse(
        authenticated=True,
        user=AuthUser(
            id=auth.entity_id,
            username=auth.username,
            email=auth.email,
            role=auth.role,
            companyId=auth.company_id,
        ),
    )


@router.post("/register", response_model=RegisterResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    try:
        return register_service(
            db,
            username=data.username,
            email=data.email,
            password=data.password,
            company_id=data.companyId,
        )
    except AuthError as error:
        return JSONResponse(
            status_code=error.status_code,
            content={"message": error.message},
        )
