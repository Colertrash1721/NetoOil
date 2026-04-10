from pydantic import BaseModel


class LoginRequest(BaseModel):
    user: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    companyId: int


class AuthUser(BaseModel):
    id: int
    username: str
    email: str
    role: str
    companyId: int | None = None


class LoginResponse(BaseModel):
    message: str
    user: AuthUser
    token: str


class LogoutResponse(BaseModel):
    message: str


class RegisterResponse(BaseModel):
    message: str
    user: AuthUser


class SessionResponse(BaseModel):
    authenticated: bool
    user: AuthUser | None = None
