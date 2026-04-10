from sqlalchemy import Boolean, Column, Date, Integer, String  # type: ignore
from db.database import Base  # type: ignore

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    address = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    isOnline = Column(Boolean, default=False)
    creationDate = Column(Date, nullable=False)
    lastConnection = Column(Date, nullable=True)
    rnc = Column(String(100), unique=True, index=True, nullable=False)
