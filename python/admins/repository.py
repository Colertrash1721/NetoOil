from sqlalchemy.orm import Session
from admins.models import Admin
from admins.schemas import CreateAdmin, ReadAdmin

def create_admin(db: Session, data: CreateAdmin) -> Admin:
    payload = data.model_dump()
    payload["hashed_password"] = payload.pop("password")
    newAdmin = Admin(**payload)
    db.add(newAdmin)
    db.commit()
    db.refresh(newAdmin)
    return newAdmin

def get_all_admins(db: Session) -> list[ReadAdmin]:
    return db.query(Admin).all()

def get_admin_by_id(db: Session, adminId: int) -> ReadAdmin | None:
    return db.query(Admin).filter(Admin.id == adminId).first()

def get_admin_by_username(db: Session, username: str) -> Admin | None:
    return db.query(Admin).filter(Admin.username == username).first()

def update_admin(db: Session, admin: Admin, data: dict) -> Admin:
    for key, value in data.items():
        setattr(admin, key, value)
    db.commit()
    db.refresh(admin)
    return admin

def delete_admin(db: Session, admin: Admin) -> None:
    db.delete(admin)
    db.commit()
