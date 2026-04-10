import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass
from typing import Any


TOKEN_TTL_SECONDS = int(os.getenv("TOKEN_TTL_SECONDS", str(7 * 24 * 60 * 60)))
PBKDF2_ITERATIONS = int(os.getenv("PASSWORD_HASH_ITERATIONS", "200000"))
JWT_ALGORITHM = "HS256"
COOKIE_NAME = "jwt"
LEGACY_COOKIE_NAMES = ("jwt", "access_token")
COOKIE_SAMESITE = os.getenv(
    "AUTH_COOKIE_SAMESITE",
    "none" if os.getenv("ENV") != "production" else "lax",
).lower()
COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "auto").lower()


@dataclass
class AuthContext:
    entity_id: int
    username: str
    email: str
    role: str
    company_id: int | None
    token: str


def _get_secret_key() -> str:
    return os.getenv("SECRET_KEY", "change-me-in-env")


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("utf-8")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw + padding)


def hash_password(raw_password: str) -> str:
    salt = secrets.token_hex(16)
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        raw_password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return (
        f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}"
        f"${base64.b64encode(derived_key).decode('utf-8')}"
    )


def verify_password(raw_password: str, stored_password: str | None) -> tuple[bool, bool]:
    if not stored_password:
        return False, False

    if not stored_password.startswith("pbkdf2_sha256$"):
        return hmac.compare_digest(raw_password, stored_password), True

    try:
        _, iterations_raw, salt, encoded_hash = stored_password.split("$", 3)
        iterations = int(iterations_raw)
        expected_hash = base64.b64decode(encoded_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False, False

    candidate_hash = hashlib.pbkdf2_hmac(
        "sha256",
        raw_password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    )
    return hmac.compare_digest(candidate_hash, expected_hash), iterations != PBKDF2_ITERATIONS


def sign_token(payload: dict[str, Any]) -> str:
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    header_part = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_part = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    message = f"{header_part}.{payload_part}".encode("utf-8")
    signature = hmac.new(_get_secret_key().encode("utf-8"), message, hashlib.sha256).digest()
    return f"{header_part}.{payload_part}.{_b64url_encode(signature)}"


def verify_token(token: str) -> dict[str, Any]:
    try:
        header_part, payload_part, signature_part = token.split(".")
    except ValueError as error:
        raise ValueError("Malformed token.") from error

    message = f"{header_part}.{payload_part}".encode("utf-8")
    expected_signature = hmac.new(
        _get_secret_key().encode("utf-8"),
        message,
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(expected_signature, _b64url_decode(signature_part)):
        raise ValueError("Invalid token signature.")

    payload = json.loads(_b64url_decode(payload_part))
    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        raise ValueError("Token expired.")
    return payload


def build_access_token(
    *,
    entity_id: int,
    username: str,
    email: str,
    role: str,
    company_id: int | None,
) -> str:
    now = int(time.time())
    payload = {
        "sub": entity_id,
        "username": username,
        "email": email,
        "role": role,
        "company_id": company_id,
        "iat": now,
        "exp": now + TOKEN_TTL_SECONDS,
    }
    return sign_token(payload)
