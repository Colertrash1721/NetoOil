from sqlalchemy.orm import Session

from companies.repository import get_company_by_id
from users.repository import (
    get_all_users,
    get_user_by_id,
    update_user_status,
)
from users.schemas import UserRead


VALID_STATUSES = {"pending", "accepted", "rejected"}


def _serialize_user(row: tuple) -> UserRead:
    user, company_name = row
    return UserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        status=user.status,
        creationDate=user.creationDate,
        lastConnection=user.lastConnection,
        companyId=user.companyId,
        companyName=company_name,
    )


def read_all_users_service(db: Session) -> list[UserRead]:
    return [_serialize_user(row) for row in get_all_users(db)]


def update_user_status_service(db: Session, user_id: int, status: str) -> UserRead:
    normalized_status = status.strip().lower()
    if normalized_status not in VALID_STATUSES:
        raise ValueError("Estado invalido.")

    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("Usuario no encontrado.")

    company = get_company_by_id(db, user.companyId)
    if not company:
        raise ValueError("Empresa no encontrada.")

    updated_user = update_user_status(db, user, normalized_status)
    return UserRead(
        id=updated_user.id,
        username=updated_user.username,
        email=updated_user.email,
        status=updated_user.status,
        creationDate=updated_user.creationDate,
        lastConnection=updated_user.lastConnection,
        companyId=updated_user.companyId,
        companyName=company.name,
    )
