from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status

from auth.security import AuthContext


def get_current_auth(request: Request) -> AuthContext:
    auth = getattr(request.state, "auth", None)
    if auth is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return auth


def require_roles(*roles: str) -> Callable:
    def dependency(auth: AuthContext = Depends(get_current_auth)) -> AuthContext:
        if auth.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions.",
            )
        return auth

    return dependency
