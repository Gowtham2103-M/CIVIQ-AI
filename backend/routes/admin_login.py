import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from jose import jwt
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(
    prefix="/admin",
    tags=["Admin Authentication"]
)

# ============================================================
# CONFIG
# ============================================================

ADMIN_USERNAME = os.getenv(
    "ADMIN_USERNAME",
    "admin"
)

ADMIN_PASSWORD = os.getenv(
    "ADMIN_PASSWORD",
    "admin123"
)

JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "change-this-secret"
)

JWT_ALGORITHM = "HS256"

TOKEN_EXPIRE_MINUTES = 60 * 8


# ============================================================
# REQUEST MODEL
# ============================================================

class AdminLoginRequest(BaseModel):
    username: str
    password: str


# ============================================================
# CREATE TOKEN
# ============================================================

def create_admin_token():

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": "admin",
        "role": "admin",
        "exp": expire
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )


# ============================================================
# ADMIN LOGIN
# ============================================================

@router.post("/login")
def admin_login(data: AdminLoginRequest):

    if (
        data.username != ADMIN_USERNAME
        or data.password != ADMIN_PASSWORD
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid admin username or password"
        )

    token = create_admin_token()

    return {
        "success": True,
        "message": "Admin login successful",
        "access_token": token,
        "token_type": "bearer"
    }