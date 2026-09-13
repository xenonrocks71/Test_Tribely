"""
Pytest configuration and session fixtures for Tribely test suite.
Ensures database schema (including newly registered tables) is synchronized
prior to running any tests.
"""

import pytest
from app.core.database import sync_engine, Base
import app.models.models  # Register all declarative models

# Auto-create any missing tables in the test database
Base.metadata.create_all(bind=sync_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Ensure all SQLAlchemy tables exist before running test suite and clean test artifacts on teardown."""
    Base.metadata.create_all(bind=sync_engine)
    # Capture initial pre-existing entity IDs before running test suite
    from app.core.database import SessionLocal
    from app.models.models import (
        User, Arena, Submission, Proof, DailyArenaSheet, ArenaMembership,
        ArenaPool, ArenaLogbook, Message, SubmissionComment, SubmissionVote,
        ProofReaction, EscrowLedger, KudosLedger, UserProfile, UserWallet
    )
    from app.models.notification_models import Notification, PushSubscription, ArenaUnreadTracker
    init_db = SessionLocal()
    try:
        initial_user_ids = {u.id for u in init_db.query(User.id).all()}
        initial_arena_ids = {a.id for a in init_db.query(Arena.id).all()}
    finally:
        init_db.close()

    yield

    # Session teardown: Purge all automated test artifacts created during test suite execution
    db = SessionLocal()
    try:
        delete_users = [u.id for u in db.query(User.id).filter(~User.id.in_(initial_user_ids)).all()]
        delete_arenas = [a.id for a in db.query(Arena.id).filter(~Arena.id.in_(initial_arena_ids)).all()]
        if delete_users or delete_arenas:
            keep_sub_ids = [
                s.id for s in db.query(Submission.id).filter(
                    Submission.arena_id.in_(initial_arena_ids),
                    Submission.user_id.in_(initial_user_ids)
                ).all()
            ]
            db.query(SubmissionVote).filter((SubmissionVote.user_id.in_(delete_users)) | (~SubmissionVote.submission_id.in_(keep_sub_ids))).delete(synchronize_session=False)
            db.query(SubmissionComment).filter((SubmissionComment.user_id.in_(delete_users)) | (~SubmissionComment.submission_id.in_(keep_sub_ids))).delete(synchronize_session=False)
            db.query(ProofReaction).filter(ProofReaction.user_id.in_(delete_users)).delete(synchronize_session=False)
            db.query(Submission).filter((Submission.user_id.in_(delete_users)) | (Submission.arena_id.in_(delete_arenas))).delete(synchronize_session=False)
            db.query(Proof).filter((Proof.user_id.in_(delete_users)) | (Proof.arena_id.in_(delete_arenas))).delete(synchronize_session=False)
            db.query(DailyArenaSheet).filter((DailyArenaSheet.user_id.in_(delete_users)) | (DailyArenaSheet.arena_id.in_(delete_arenas))).delete(synchronize_session=False)
            db.query(ArenaUnreadTracker).filter((ArenaUnreadTracker.user_id.in_(delete_users)) | (ArenaUnreadTracker.arena_id.in_(delete_arenas))).delete(synchronize_session=False)
            db.query(ArenaMembership).filter((ArenaMembership.user_id.in_(delete_users)) | (ArenaMembership.arena_id.in_(delete_arenas))).delete(synchronize_session=False)
            db.query(ArenaPool).filter(ArenaPool.arena_id.in_(delete_arenas)).delete(synchronize_session=False)
            db.query(ArenaLogbook).filter(ArenaLogbook.arena_id.in_(delete_arenas)).delete(synchronize_session=False)
            db.query(Message).filter((Message.user_id.in_(delete_users)) | (Message.arena_id.in_(delete_arenas))).delete(synchronize_session=False)
            db.query(Notification).filter(Notification.user_id.in_(delete_users)).delete(synchronize_session=False)
            db.query(KudosLedger).filter(KudosLedger.user_id.in_(delete_users)).delete(synchronize_session=False)
            db.query(EscrowLedger).filter((EscrowLedger.user_id.in_(delete_users)) | (EscrowLedger.arena_id.in_(delete_arenas))).delete(synchronize_session=False)
            db.query(UserWallet).filter(UserWallet.user_id.in_(delete_users)).delete(synchronize_session=False)
            db.query(UserProfile).filter(UserProfile.user_id.in_(delete_users)).delete(synchronize_session=False)
            db.query(PushSubscription).filter(PushSubscription.user_id.in_(delete_users)).delete(synchronize_session=False)
            db.query(Arena).filter(Arena.id.in_(delete_arenas)).delete(synchronize_session=False)
            db.query(User).filter(User.id.in_(delete_users)).delete(synchronize_session=False)
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
