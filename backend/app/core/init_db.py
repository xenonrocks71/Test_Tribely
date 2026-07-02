from app.core.database import engine, Base
# We must import our models here explicitly so that SQLAlchemy's Base 
# registry is aware of them before running create_all
from app.models.models import User, UserProfile, Arena, ArenaMembership, Message, Submission, ArenaLogbook

def init_database() -> None:
    print("Connecting to database and creating tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("--- ALL DATABASE TABLES GENERATED AND VERIFIED SUCCESSFULLY ---")
    except Exception as e:
        print("CRITICAL: Failed to initialize tables in PostgreSQL.")
        print(f"Error Details: {e}")
        raise e

if __name__ == "__main__":
    init_database()