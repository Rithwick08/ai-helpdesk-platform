from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base

import os

load_dotenv()

Base = declarative_base()
_raw_url = os.getenv("DATABASE_URL")
if _raw_url:
    # Render supplies postgres:// which SQLAlchemy requires as postgresql://
    DATABASE_URL = _raw_url.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = (
        f"postgresql://{os.getenv('DB_USER')}:"
        f"{os.getenv('DB_PASSWORD')}@localhost/"
        f"{os.getenv('DB_NAME')}"
    )

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()