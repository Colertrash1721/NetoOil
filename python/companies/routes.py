from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.orm import Session

from auth.dependencies import require_roles
from auth.security import AuthContext
from companies.schemas import CompanyCreate, CompanyRead, CompanyUpdate
from companies.service import (
    create_company_service,
    delete_company_service,
    read_all_company_service,
    read_company_by_id_service,
    update_company_service,
)
from db.database import get_db

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/", response_model=list[CompanyRead])
def read_all_company(
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    return read_all_company_service(db)


@router.get("/{id}", response_model=CompanyRead)
def read_company_by_id(
    id: int,
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    try:
        return read_company_by_id_service(db, id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@router.post("/", response_model=CompanyRead)
def create_company(
    company: CompanyCreate,
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    try:
        return create_company_service(db, company)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.delete("/{id}")
def delete_company(
    id: int,
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    try:
        return delete_company_service(db, id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@router.patch("/{id}", response_model=CompanyRead)
def update_company(
    id: int,
    data: CompanyUpdate,
    db: Session = Depends(get_db),
    _: AuthContext = Depends(require_roles("admin")),
):
    try:
        return update_company_service(db, id, data)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
