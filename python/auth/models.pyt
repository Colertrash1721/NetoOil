from sqlalchemy import Column, Integer, String, Boolean, Date  # type: ignore
from db.database import Base  # type: ignore

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    isOnline = Column(Boolean, default=False)
    creationDate = Column(Date, nullable=False)
    lastConnection = Column(Date, nullable=True)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    isOnline = Column(Boolean, default=False)
    creationDate = Column(Date, nullable=False)
    lastConnection = Column(Date, nullable=True)
    role = Column(String(50), nullable=False, default="user")
    idCompany = Column(Integer, nullable=False,foreign_key="companies.id")
