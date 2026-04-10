from datetime import date as date_type

from sqlalchemy import Column, Date, ForeignKey, Integer, String  # type: ignore

from db.database import Base  # type: ignore


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    creationDate = Column(Date, nullable=False, default=date_type.today)
    lastConnection = Column(Date, nullable=True)
    companyId = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
