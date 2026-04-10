from datetime import date

from sqlalchemy.orm import Session

from companies.models import Company
from users.models import User


def create_user(
    db: Session,
    *,
    username: str,
    email: str,
    password: str,
    company_id: int,
) -> User:
    user = User(
        username=username,
        email=email,
        hashed_password=password,
        status="pending",
        creationDate=date.today(),
        lastConnection=None,
        companyId=company_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user_password(db: Session, user: User, hashed_password: str) -> User:
    user.hashed_password = hashed_password
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_user(db: Session, user: str) -> User | None:
    return db.query(User).filter((User.email == user) | (User.username == user)).first()


def get_all_users(db: Session) -> list[tuple[User, str]]:
    return (
        db.query(User, Company.name)
        .join(Company, Company.id == User.companyId)
        .order_by(User.id.desc())
        .all()
    )


def update_user_status(db: Session, user: User, status: str) -> User:
    user.status = status
    db.commit()
    db.refresh(user)
    return user
