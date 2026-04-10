import os
from datetime import date

from fastapi import Response, status
from sqlalchemy.orm import Session

from auth.repository import (
    get_admin_by_user,
    get_company_by_user,
    get_user_by_email,
    get_user_by_user,
    get_user_by_username,
)
from auth.security import (
    COOKIE_NAME,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    LEGACY_COOKIE_NAMES,
    TOKEN_TTL_SECONDS,
    build_access_token,
    hash_password,
    verify_password,
)
from auth.schemas import LoginResponse, RegisterResponse
from companies.repository import get_company_by_id
from users.repository import create_user, update_user_password


class AuthError(Exception):
    def __init__(self, message: str, status_code: int):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _set_auth_cookie(response: Response, token: str) -> None:
    if COOKIE_SECURE == "true":
        secure = True
    elif COOKIE_SECURE == "false":
        secure = False
    else:
        secure = COOKIE_SAMESITE == "none" or os.getenv("ENV") == "production"

    for cookie_name in LEGACY_COOKIE_NAMES:
        response.set_cookie(
            key=cookie_name,
            value=token,
            max_age=TOKEN_TTL_SECONDS,
            httponly=True,
            secure=secure,
            samesite=COOKIE_SAMESITE,
            path="/",
        )
    response.headers["Authorization"] = f"Bearer {token}"


def _build_login_response(
    *,
    response: Response,
    role: str,
    entity_id: int,
    username: str,
    email: str,
    company_id: int | None,
) -> LoginResponse:
    token = build_access_token(
        entity_id=entity_id,
        username=username,
        email=email,
        role=role,
        company_id=company_id,
    )
    _set_auth_cookie(response, token)
    return LoginResponse(
        message="Login exitoso",
        user={
            "id": entity_id,
            "username": username,
            "email": email,
            "role": role,
            "companyId": company_id,
        },
        token=token,
    )


def login_service(db: Session, user: str, password: str, response: Response) -> LoginResponse:
    if not user or not password:
        raise AuthError("No debe dejar campos vacios", status.HTTP_400_BAD_REQUEST)

    admin = get_admin_by_user(db, user)
    if admin:
        verified, needs_rehash = verify_password(password, admin.hashed_password)
        if not verified:
            raise AuthError("Contraseña incorrecta", status.HTTP_401_UNAUTHORIZED)
        if needs_rehash:
            admin.hashed_password = hash_password(password)

        admin.isOnline = True
        admin.lastConnection = date.today()
        db.commit()
        db.refresh(admin)

        return _build_login_response(
            response=response,
            role="admin",
            entity_id=admin.id,
            username=admin.username,
            email=admin.email,
            company_id=None,
        )

    registered_user = get_user_by_user(db, user)
    if registered_user:
        if registered_user.status != "accepted":
            raise AuthError(
                "Tu usuario aun no ha sido aprobado por un administrador",
                status.HTTP_403_FORBIDDEN,
            )

        verified, needs_rehash = verify_password(password, registered_user.hashed_password)
        if not verified:
            raise AuthError("Contraseña incorrecta", status.HTTP_401_UNAUTHORIZED)
        if needs_rehash:
            update_user_password(db, registered_user, hash_password(password))

        registered_user.lastConnection = date.today()
        db.commit()
        db.refresh(registered_user)

        return _build_login_response(
            response=response,
            role="client",
            entity_id=registered_user.id,
            username=registered_user.username,
            email=registered_user.email,
            company_id=registered_user.companyId,
        )

    company = get_company_by_user(db, user)
    if company:
        company_password = getattr(company, "hashed_password", None)
        company_username = getattr(company, "username", None) or company.name

        if not company_password:
            raise AuthError(
                "El cliente no tiene autenticacion configurada en su modelo",
                status.HTTP_400_BAD_REQUEST,
            )

        verified, needs_rehash = verify_password(password, company_password)
        if not verified:
            raise AuthError("Contraseña incorrecta", status.HTTP_401_UNAUTHORIZED)
        if needs_rehash:
            company.hashed_password = hash_password(password)

        if hasattr(company, "isOnline"):
            company.isOnline = True
        if hasattr(company, "lastConnection"):
            company.lastConnection = date.today()
        db.commit()
        db.refresh(company)

        return _build_login_response(
            response=response,
            role="company",
            entity_id=company.id,
            username=company_username,
            email=company.email,
            company_id=company.id,
        )

    raise AuthError("Usuario no encontrado", status.HTTP_404_NOT_FOUND)


def logout_service(response: Response) -> dict[str, str]:
    for cookie_name in LEGACY_COOKIE_NAMES:
        response.delete_cookie(
            key=cookie_name,
            httponly=True,
            samesite=COOKIE_SAMESITE,
            path="/",
        )
    return {"message": "Logout exitoso"}


def register_service(
    db: Session,
    *,
    username: str,
    email: str,
    password: str,
    company_id: int,
) -> RegisterResponse:
    if not all([username, email, password, company_id]):
        raise AuthError("No debe dejar campos vacios", status.HTTP_400_BAD_REQUEST)

    if get_admin_by_user(db, username):
        raise AuthError("El usuario ya existe", status.HTTP_409_CONFLICT)

    if get_admin_by_user(db, email):
        raise AuthError("El correo ya existe", status.HTTP_409_CONFLICT)

    if get_user_by_username(db, username):
        raise AuthError("El usuario ya existe", status.HTTP_409_CONFLICT)

    if get_user_by_email(db, email):
        raise AuthError("El correo ya existe", status.HTTP_409_CONFLICT)

    company = get_company_by_id(db, company_id)
    if not company:
        raise AuthError("La empresa no existe", status.HTTP_404_NOT_FOUND)

    user_record = create_user(
        db,
        username=username,
        email=email,
        password=hash_password(password),
        company_id=company_id,
    )

    return RegisterResponse(
        message="Registro enviado. Pendiente de aprobacion.",
        user={
            "id": user_record.id,
            "username": user_record.username,
            "email": user_record.email,
            "role": "client",
            "companyId": user_record.companyId,
        },
    )
