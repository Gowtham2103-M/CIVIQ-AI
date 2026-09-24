import os
from dotenv import load_dotenv


# Load .env file
load_dotenv()


class Config:

    # ------------------------------------------
    # Flask
    # ------------------------------------------

    SECRET_KEY = os.getenv(
        "SECRET_KEY",
        "civicguard-development-secret"
    )

    # ------------------------------------------
    # JWT
    # ------------------------------------------

    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY",
        "civicguard-jwt-secret"
    )

    # ------------------------------------------
    # Database
    # ------------------------------------------

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ------------------------------------------
    # Upload Configuration
    # ------------------------------------------

    UPLOAD_FOLDER = os.getenv(
        "UPLOAD_FOLDER",
        "uploads/complaints"
    )

    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB

    # Allowed complaint image types
    ALLOWED_IMAGE_EXTENSIONS = {
        "jpg",
        "jpeg",
        "png",
        "webp"
    }