import datetime
from sqlalchemy import Column, Integer, String, Boolean, Date
from db.database import Base

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    isOnline = Column(Boolean, default=False)
    creationDate = Column(Date, nullable=False, default=datetime.date)
    lastConnection = Column(Date, nullable=True)
