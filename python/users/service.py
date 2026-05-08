from sqlalchemy.orm import Session

from auth.security import AuthContext
from companies.repository import get_company_by_id
from users.repository import (
    get_all_users,
    get_user_by_id,
    update_user_company_role,
    update_user_status,
)
from users.schemas import UserRead


VALID_STATUSES = {"pending", "accepted", "rejected"}
VALID_COMPANY_ROLES = {"superadmin", "admin", "user", "viewer"}


def _normalize_company_role(company_role: str | None) -> str:
    normalized_role = (company_role or "user").strip().lower()
    if normalized_role == "viewer":
        return "user"
    return normalized_role


def _ensure_admin_user_scope(auth: AuthContext, company_id: int) -> None:
    if auth.role == "admin" and auth.company_id != company_id:
        raise ValueError("Permisos insuficientes para esta empresa.")


def _serialize_user(row: tuple) -> UserRead:
    user, company_name = row
    return UserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        status=user.status,
        companyRole=_normalize_company_role(getattr(user, "companyRole", "user")),
        creationDate=user.creationDate,
        lastConnection=user.lastConnection,
        companyId=user.companyId,
        companyName=company_name,
    )


def read_all_users_service(db: Session, auth: AuthContext) -> list[UserRead]:
    company_id = auth.company_id if auth.role == "admin" else None
    return [_serialize_user(row) for row in get_all_users(db, company_id)]


def update_user_status_service(db: Session, user_id: int, status: str, auth: AuthContext) -> UserRead:
    normalized_status = status.strip().lower()
    if normalized_status not in VALID_STATUSES:
        raise ValueError("Estado invalido.")

    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("Usuario no encontrado.")
    _ensure_admin_user_scope(auth, user.companyId)

    company = get_company_by_id(db, user.companyId)
    if not company:
        raise ValueError("Empresa no encontrada.")

    updated_user = update_user_status(db, user, normalized_status)
    return UserRead(
        id=updated_user.id,
        username=updated_user.username,
        email=updated_user.email,
        status=updated_user.status,
        companyRole=_normalize_company_role(getattr(updated_user, "companyRole", "user")),
        creationDate=updated_user.creationDate,
        lastConnection=updated_user.lastConnection,
        companyId=updated_user.companyId,
        companyName=company.name,
    )


def update_user_company_role_service(
    db: Session,
    user_id: int,
    company_role: str,
    auth: AuthContext,
) -> UserRead:
    normalized_role = _normalize_company_role(company_role)
    if normalized_role not in VALID_COMPANY_ROLES:
        raise ValueError("Rol invalido.")

    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("Usuario no encontrado.")
    _ensure_admin_user_scope(auth, user.companyId)

    company = get_company_by_id(db, user.companyId)
    if not company:
        raise ValueError("Empresa no encontrada.")

    updated_user = update_user_company_role(db, user, normalized_role)
    return UserRead(
        id=updated_user.id,
        username=updated_user.username,
        email=updated_user.email,
        status=updated_user.status,
        companyRole=updated_user.companyRole,
        creationDate=updated_user.creationDate,
        lastConnection=updated_user.lastConnection,
        companyId=updated_user.companyId,
        companyName=company.name,
    )
