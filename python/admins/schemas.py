from pydantic import BaseModel, ConfigDict

class AdminBase(BaseModel):
    username: str
    email: str

class CreateAdmin(AdminBase):
    password: str
    lastConnection: str | None = None
    creationDate: str

class ReadAdmin(AdminBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    isOnline: bool
    creationDate: str
    lastConnection: str | None = None
