from datetime import date

from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    companyId: int


class UserStatusUpdate(BaseModel):
    status: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    status: str
    creationDate: date
    lastConnection: date | None = None
    companyId: int
    companyName: str
