from sqlalchemy import or_
from sqlalchemy.orm import Session

from admins.models import Admin
from companies.models import Company
from users.models import User


def get_admin_by_user(db: Session, user: str) -> Admin | None:
    return (
        db.query(Admin)
        .filter((Admin.email == user) | (Admin.username == user))
        .first()
    )


def get_company_by_user(db: Session, user: str) -> Company | None:
    filters = [Company.email == user]
    if hasattr(Company, "username"):
        filters.append(Company.username == user)
    if hasattr(Company, "name"):
        filters.append(Company.name == user)
    return db.query(Company).filter(or_(*filters)).first()


def get_company_by_email(db: Session, email: str) -> Company | None:
    return db.query(Company).filter(Company.email == email).first()


def get_company_by_username(db: Session, username: str) -> Company | None:
    return db.query(Company).filter(Company.username == username).first()


def get_company_by_rnc(db: Session, rnc: str) -> Company | None:
    return db.query(Company).filter(Company.rnc == rnc).first()


def get_user_by_user(db: Session, user: str) -> User | None:
    return db.query(User).filter(or_(User.email == user, User.username == user)).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()
