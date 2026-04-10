from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore

from auth.dependencies import require_roles
from auth.security import AuthContext
from db.database import get_db
from users.schemas import UserRead, UserStatusUpdate
from users.service import read_all_users_service, update_user_status_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserRead])
def get_all_users(
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    return read_all_users_service(db)


@router.patch("/{user_id}/status", response_model=UserRead)
def patch_user_status(
    user_id: int,
    data: UserStatusUpdate,
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    try:
        return update_user_status_service(db, user_id, data.status)
    except ValueError as error:
        message = str(error)
        status_code = 404 if "no encontrado" in message.lower() else 400
        raise HTTPException(status_code=status_code, detail=message)
