#This file instantiates the core SQLAlchemy Database Engine using our configuration URL. It handles connection pooling behind the scenes. We create a SessionLocal factory that spawns individual database transaction connections, and a Base class that all future database models (Users, Arenas, Messages) will inherit from.#

#We also introduce get_db(), a context-managed dependency injector. When an API route hits our server, get_db() yields a session for that single request, handles the database interactions, and guarantees the connection closes cleanly once the request completes, preventing memory or connection leaks.#


from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from typing import Generator
from app.core.config import settings

# Create the synchronous SQLAlchemy engine
# pool_pre_ping=True automatically tests connections before executing queries to prevent stale connection errors
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True
)

# Create a customized database session factory class
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# The base class that our models will inherit from to be mapped to database tables
Base = declarative_base()

# Dependency injector to provide a clean database session context per request
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()