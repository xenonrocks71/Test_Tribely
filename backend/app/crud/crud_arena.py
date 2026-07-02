import random
import string
from sqlalchemy.orm import Session
from app.models.models import Arena, ArenaMembership
from app.schemas.schemas import ArenaCreate

def generate_unique_invite_code(db: Session) -> str:
    """
    Generates a random 6-character alphanumeric uppercase invite code 
    and checks the database to guarantee it is completely unique.
    """
    while True:
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        # Verify uniqueness in the arenas table
        exists = db.query(Arena).filter(Arena.invite_code == code).first()
        if not exists:
            return code

def create_arena(db: Session, arena_in: ArenaCreate, creator_id: int) -> Arena:
    """
    Creates an accountability arena, assigns a secure invite code, 
    and binds the creator as an approved Admin member.
    """
    # 1. Generate the unique room entry key
    invite_code = generate_unique_invite_code(db)
    
    # 2. Instantiate the Arena entity row
    db_arena = Arena(
        name=arena_in.name,
        description=arena_in.description,
        invite_code=invite_code,
        creator_id=creator_id,
        proof_type=arena_in.proof_type,
        penalty_amount=arena_in.penalty_amount,
        deadline_time=arena_in.deadline_time,
        is_private=arena_in.is_private
    )
    db.add(db_arena)
    db.commit()  # Commit first to generate the db_arena.id primary key
    db.refresh(db_arena)
    
    # 3. Automatically join the creator to their own arena as an approved Admin member
    creator_membership = ArenaMembership(
        user_id=creator_id,
        arena_id=db_arena.id,
        status="approved",
        role="admin"
    )
    db.add(creator_membership)
    db.commit()
    
    return db_arena

def get_arena_by_id(db: Session, arena_id: int) -> Arena:
    """
    Fetch a single arena container by its integer primary key ID.
    """
    return db.query(Arena).filter(Arena.id == arena_id).first()

def get_arena_by_invite_code(db: Session, invite_code: str) -> Arena:
    """
    Find an arena matching a specific 6-character invite code.
    """
    return db.query(Arena).filter(Arena.invite_code == invite_code.upper()).first()

def join_arena_by_code(db: Session, user_id: int, arena_id: int) -> ArenaMembership:
    """
    Creates a membership association tracking row between a user and an arena.
    Prevents duplicates if the user is already mapped to the arena.
    """
    # Check if a membership record already exists
    existing = db.query(ArenaMembership).filter(
        ArenaMembership.user_id == user_id,
        ArenaMembership.arena_id == arena_id
    ).first()
    
    if existing:
        return existing
        
    db_membership = ArenaMembership(
        user_id=user_id,
        arena_id=arena_id,
        status="approved",
        role="member"
    )
    db.add(db_membership)
    db.commit()
    db.refresh(db_membership)
    return db_membership

def get_user_arenas(db: Session, user_id: int):
    """
    Fetch all arenas that a specific user has joined.
    """
    return db.query(Arena).join(ArenaMembership).filter(ArenaMembership.user_id == user_id).all()