from datetime import date

from pydantic import BaseModel, ConfigDict # type: ignore

class CompanyBase(BaseModel):
    name: str
    address: str
    phone: str
    email: str
    rnc: str
    username: str | None = None

class CompanyCreate(CompanyBase):
    password: str | None = None

class CompanyRead(CompanyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    creationDate: date

class CompanyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    rnc: str | None = None
    username: str | None = None
    password: str | None = None
