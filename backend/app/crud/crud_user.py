from sqlalchemy.orm import Session
from app.models.models import User
from app.schemas.schemas import UserCreate
from app.core.security import get_password_hash

def get_user_by_id(db: Session, user_id: int) -> User:
    """
    Fetch a single user profile from PostgreSQL using their unique integer primary key.
    """
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> User:
    """
    Fetch a user profile using their email address. Used heavily during login and registration checks.
    """
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user_in: UserCreate) -> User:
    """
    Takes a validated Pydantic schema, hashes the raw password, and inserts the record into PostgreSQL.
    """
    # 1. Hash the raw user password safely using our security rules
    hashed_pass = get_password_hash(user_in.password)
    
    # 2. Map the incoming dataset to the actual SQLAlchemy model schema
    db_user = User(
        email=user_in.email,
        hashed_password=hashed_pass,
        full_name=user_in.full_name,
        is_active=True
    )
    
    # 3. Save to database using synchronous transaction control
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user