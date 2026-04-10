from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from admins.schemas import CreateAdmin, ReadAdmin
from admins.service import (
    delete_admin_service,
    update_admin_service,
    read_admin_by_id_service,
    read_all_admin_service,
    create_admin_service,
)
from auth.dependencies import require_roles
from auth.security import AuthContext
from db.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix="/admins", tags=["admins"])

@router.get("/", response_model=list[ReadAdmin])
def get_all_admins(
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    return read_all_admin_service(db)

@router.get("/{id}", response_model=ReadAdmin)
def get_admin_by_id(
    id: int,
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    try:
        return read_admin_by_id_service(db, id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))

@router.post("/", response_model=ReadAdmin)
def create_admin(
    admin: CreateAdmin,
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    try:
        return create_admin_service(db, admin)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

@router.delete("/{id}")
def delete_admin(
    id: int,
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    try:
        return delete_admin_service(db, id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))

@router.patch("/{id}", response_model=ReadAdmin)
def update_admin(
    id: int,
    data: CreateAdmin,
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    try:
        return update_admin_service(db, id, data)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
