from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional, List


# ── User Schemas ──────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str
    is_active: Optional[bool] = True
    group_id: Optional[int] = None
    company_id: Optional[int] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    group_id: Optional[int] = None
    company_id: Optional[int] = None


class UserResponse(UserBase):
    id: int
    created_at: datetime
    last_login: Optional[datetime] = None
    mfa_enabled: bool = False
    must_change_password: bool = False

    class Config:
        from_attributes = True


class UserProfileResponse(UserResponse):
    """Extended user profile including resolved permissions."""
    permissions: List[str] = []
    active_sessions_count: Optional[int] = None
    project_roles: Optional[dict[int, str]] = None


# ── Token Schemas ─────────────────────────────────────────────────────────────

class Token(BaseModel):
    """Legacy single-token response (kept for backwards compat)."""
    access_token: str
    token_type: str = "bearer"


class TokenPair(BaseModel):
    """Production token response with both access and refresh tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token TTL in seconds


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None


# ── Auth Request Schemas ──────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False  # extends refresh token lifetime if True


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v


# ── Session Schemas ───────────────────────────────────────────────────────────

class SessionResponse(BaseModel):
    id: int
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    last_used_at: Optional[datetime] = None
    expires_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


# ── Login History Schemas ─────────────────────────────────────────────────────

class LoginHistoryResponse(BaseModel):
    id: int
    email_attempted: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str
    failure_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
