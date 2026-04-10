from sqlalchemy.orm import Session
from companies.schemas import CompanyCreate, CompanyUpdate, CompanyRead
from companies.repository import (
    create_company,
    delete_company,
    get_all_company,
    get_company_by_email,
    get_company_by_id,
    get_company_by_name,
    get_company_by_rnc,
    get_company_by_username,
    update_company,
)
from auth.security import hash_password

def create_company_service(db: Session, data: CompanyCreate) -> CompanyRead:
    if get_company_by_name(db, data.name):
        raise ValueError("Company with this name already exists.")
    if get_company_by_email(db, data.email):
        raise ValueError("Company with this email already exists.")
    if get_company_by_rnc(db, data.rnc):
        raise ValueError("Company with this RNC already exists.")
    if data.username and get_company_by_username(db, data.username):
        raise ValueError("Company with this username already exists.")
    payload = data.model_copy(
        update={
            "password": None,
            "username": data.username,
        }
    )
    company = create_company(db, payload)
    if data.password:
        company.hashed_password = hash_password(data.password)
        db.commit()
        db.refresh(company)
    return CompanyRead.model_validate(company)

def read_all_company_service(db: Session) -> list[CompanyRead]:
    return [CompanyRead.model_validate(company) for company in get_all_company(db)]

def read_company_by_id_service(db: Session, companyId: int) -> CompanyRead:
    company = get_company_by_id(db, companyId)
    if not company:
        raise ValueError("Company not found.")
    return CompanyRead.model_validate(company)

def update_company_service(db: Session, companyId: int, data: CompanyUpdate) ->  CompanyRead:
    company = get_company_by_id(db, companyId)
    if not company:
        raise ValueError("Company not found.")
    if data.username and data.username != company.username and get_company_by_username(db, data.username):
        raise ValueError("Company with this username already exists.")
    updatedCompany = update_company(db, company, data)
    if data.password:
        updatedCompany.hashed_password = hash_password(data.password)
        db.commit()
        db.refresh(updatedCompany)
    return CompanyRead.model_validate(updatedCompany)

def delete_company_service(db: Session, companyId: int) -> CompanyRead:
    company = get_company_by_id(db, companyId)
    if not company:
        raise ValueError("Company not found.")
    delete_company(db, company)
    return CompanyRead.model_validate(company)
