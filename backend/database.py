import os
import pymysql
from dotenv import load_dotenv

#
load_dotenv(
    os.path.join(
        os.path.dirname(__file__),
        ".env"
    )
)


def get_connection():
    return pymysql.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        cursorclass=pymysql.cursors.DictCursor
    )


# Alias for compatibility
get_db_connection = get_connection