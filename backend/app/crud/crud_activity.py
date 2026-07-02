from sqlalchemy.orm import Session
from app.models.models import Submission, Message, ArenaMembership
from app.schemas.schemas import SubmissionCreate, MessageCreate

def create_submission(db: Session, submission_in: SubmissionCreate, user_id: int) -> Submission:
    """
    Persists a daily habit completion proof record inside PostgreSQL.
    """
    db_submission = Submission(
        arena_id=submission_in.arena_id,
        user_id=user_id,
        proof_url=submission_in.proof_url,
        is_verified=True
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    return db_submission

def get_arena_submissions(db: Session, arena_id: int):
    """
    Retrieves all verified habit proof submissions uploaded inside a specific arena.
    """
    return db.query(Submission).filter(Submission.arena_id == arena_id).order_by(Submission.submitted_at.desc()).all()

def create_message(db: Session, message_in: MessageCreate, arena_id: int, user_id: int) -> Message:
    """
    Logs an explicit chat room message into the historical database layout.
    """
    db_message = Message(
        arena_id=arena_id,
        user_id=user_id,
        content=message_in.content,
        message_type=message_in.message_type
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def get_arena_messages(db: Session, arena_id: int, limit: int = 50):
    """
    Fetches the historical chat archive logs for an arena to instantly hydrate the front-end stream.
    """
    return db.query(Message).filter(Message.arena_id == arena_id).order_by(Message.created_at.desc()).limit(limit).all()

def is_user_in_arena(db: Session, user_id: int, arena_id: int) -> bool:
    """
    Security helper check to verify if a user actually has an active, 
    approved membership inside an arena before allowing them to read or write data.
    """
    membership = db.query(ArenaMembership).filter(
        ArenaMembership.user_id == user_id,
        ArenaMembership.arena_id == arena_id,
        ArenaMembership.status == "approved"
    ).first()
    return membership is not None