from sqlalchemy.orm import Session
from admins.schemas import CreateAdmin, ReadAdmin
from admins.repository import (
    create_admin,
    delete_admin,
    get_admin_by_id,
    get_admin_by_username,
    get_all_admins,
    update_admin,
)
from auth.security import hash_password

def create_admin_service(db: Session, data: CreateAdmin) -> ReadAdmin:
    if get_admin_by_username(db, data.username):
        raise ValueError("Admin with this username already exists.")
    payload = data.model_copy(update={"password": hash_password(data.password)})
    admin = create_admin(db, payload)
    return ReadAdmin.model_validate(admin)

def read_all_admin_service(db: Session) -> list[ReadAdmin]:
    return [ReadAdmin.model_validate(admin) for admin in get_all_admins(db)]

def read_admin_by_id_service(db: Session, adminId: int) -> ReadAdmin:
    admin = get_admin_by_id(db, adminId)
    if not admin:
        raise ValueError("Admin not found.")
    return ReadAdmin.model_validate(admin)

def delete_admin_service(db: Session, adminId: int) -> ReadAdmin:
    admin = get_admin_by_id(db, adminId)
    if not admin:
        raise ValueError("Admin not found.")
    delete_admin(db, admin)
    return ReadAdmin.model_validate(admin)

def update_admin_service(db: Session, adminId: int, data: CreateAdmin) ->  ReadAdmin:
    admin = get_admin_by_id(db, adminId)
    if not admin:
        raise ValueError("Admin not found.")
    updatedAdmin = update_admin(
        db,
        admin,
        {
            "username": data.username,
            "email": data.email,
            "hashed_password": hash_password(data.password),
            "creationDate": data.creationDate,
            "lastConnection": data.lastConnection,
        },
    )
    return ReadAdmin.model_validate(updatedAdmin)
