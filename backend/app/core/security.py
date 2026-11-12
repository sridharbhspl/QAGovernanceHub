"""
Security Utilities — Phase 0 Production Grade
Provides: password hashing, JWT access tokens, refresh tokens, password reset tokens.
"""
import hashlib
import hmac
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# ── Password hashing ──────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# ── Access Token (JWT, short-lived) ──────────────────────────────────────────

def create_access_token(
    subject: Union[str, Any],
    role: str,
    permissions: Optional[list] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a short-lived JWT access token.
    Embeds role and resolved permission list for stateless permission checks.
    """
    expire = datetime.now(timezone.utc).replace(tzinfo=None) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "exp": expire,
        "sub": str(subject),
        "role": role,
        "permissions": permissions or [],
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ── Refresh Token (opaque, stored hashed in DB) ───────────────────────────────

def create_refresh_token() -> str:
    """
    Generate a cryptographically secure random refresh token (opaque).
    128 hex characters = 512 bits of entropy.
    Store only the hash in the database.
    """
    return secrets.token_hex(64)


def hash_token(raw_token: str) -> str:
    """SHA-256 hash of a token for safe DB storage."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def verify_token_hash(raw_token: str, stored_hash: str) -> bool:
    """Constant-time comparison to prevent timing attacks."""
    computed = hash_token(raw_token)
    return hmac.compare_digest(computed, stored_hash)


# ── Password Reset Token (HMAC-signed, time-limited) ─────────────────────────

def create_password_reset_token(email: str) -> str:
    """
    Create a time-limited, HMAC-signed password reset token.
    Format: <timestamp_hex>.<hmac_signature>
    Expires after RESET_TOKEN_EXPIRE_MINUTES.
    """
    timestamp = int(time.time())
    payload = f"{email}:{timestamp}"
    signature = hmac.new(
        settings.PASSWORD_RESET_SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{timestamp}.{signature}"


def verify_password_reset_token(email: str, token: str) -> bool:
    """
    Verify a password reset token is valid and not expired.
    Returns True if valid, False otherwise.
    """
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return False
        timestamp_str, provided_sig = parts
        timestamp = int(timestamp_str)

        # Check expiry
        elapsed = int(time.time()) - timestamp
        if elapsed > settings.RESET_TOKEN_EXPIRE_MINUTES * 60:
            return False

        # Verify signature
        payload = f"{email}:{timestamp}"
        expected_sig = hmac.new(
            settings.PASSWORD_RESET_SECRET_KEY.encode(),
            payload.encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(provided_sig, expected_sig)
    except Exception:
        return False
