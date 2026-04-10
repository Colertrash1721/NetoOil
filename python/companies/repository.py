from datetime import date

from sqlalchemy.orm import Session
from companies.models import Company
from companies.schemas import CompanyCreate, CompanyUpdate, CompanyRead

def create_company(db: Session, data: CompanyCreate) -> Company:
    payload = data.model_dump()
    payload.pop("password", None)
    payload["creationDate"] = date.today()
    newCompany = Company(**payload)
    db.add(newCompany)
    db.commit()
    db.refresh(newCompany)
    return newCompany

def get_all_company(db: Session) -> Company | None:
    return db.query(Company).all()

def get_company_by_id(db: Session, companyId: int) -> list[CompanyRead] | None:
    return db.query(Company).filter(Company.id == companyId).first()

def get_company_by_name(db: Session, name: str) -> Company | None:
    return db.query(Company).filter(Company.name == name).first()

def get_company_by_email(db: Session, email: str) -> Company | None:
    return db.query(Company).filter(Company.email == email).first()

def get_company_by_username(db: Session, username: str) -> Company | None:
    return db.query(Company).filter(Company.username == username).first()

def get_company_by_rnc(db: Session, rnc: str) -> Company | None:
    return db.query(Company).filter(Company.rnc == rnc).first()

def update_company(db: Session, company: Company, data: CompanyUpdate) -> Company | None:
    updateData = data.model_dump(exclude_unset=True)
    for key, value in updateData.items():
        if key != "password":
            setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return company

def delete_company(db: Session, company: Company) -> None:
    db.delete(company)
    db.commit()
