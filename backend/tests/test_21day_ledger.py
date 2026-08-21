import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Base, User, Arena, ArenaMembership, Submission, UserWallet, ArenaPool, EscrowLedger
from app.services.ledger_service import ledger_service
from app.services.kudos_service import kudos_service

# SQLite In-Memory Database Engine
engine = create_engine("sqlite:///:memory:")
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_21_day_consistency_equal_split_distribution():
    db = TestingSessionLocal()
    try:
        # Create 3 Users with Wallets
        users = []
        for i in range(1, 4):
            user = User(email=f"user{i}@example.com", hashed_password="pw", full_name=f"User {i}")
            db.add(user)
            db.commit()
            db.refresh(user)

            wallet = UserWallet(user_id=user.id, tribes_balance=1000.0, kudos_balance=1000.0, is_frozen=False)
            db.add(wallet)
            users.append(user)

        db.commit()

        # Create Arena
        arena = Arena(
            name="21-Day Habit Arena",
            description="Test Habit Arena",
            creator_id=users[0].id,
            invite_code="HABIT21",
            deadline_time="22:00:00",
            proof_type="image",
            penalty_amount=100.0
        )
        db.add(arena)
        db.commit()
        db.refresh(arena)

        for u in users:
            membership = ArenaMembership(arena_id=arena.id, user_id=u.id, status="approved")
            db.add(membership)
        db.commit()

        # Add penalty pot in arena
        pool = ledger_service.get_or_create_arena_pool(db, arena.id)
        pool.reward_pool_tribes = 300.0
        db.commit()

        # User 1 & 2 have consistent submissions in last 21 days
        now = datetime.utcnow()
        for u in [users[0], users[1]]:
            for d in range(16):
                sub = Submission(
                    arena_id=arena.id,
                    user_id=u.id,
                    proof_url="https://example.com/proof.jpg",
                    submitted_at=now - timedelta(days=d),
                    is_absent=False,
                    upvotes=2
                )
                db.add(sub)
        db.commit()

        # Execute 21-day consistency reward distribution
        res = ledger_service.distribute_21_day_consistency_rewards(db, arena.id)
        assert res["status"] == "success"
        assert res["total_distributed"] == 300.0
        assert res["equal_share_per_winner"] == 150.0
        assert len(res["winners"]) == 2

        # Check wallets updated
        w1 = db.query(UserWallet).filter(UserWallet.user_id == users[0].id).first()
        w2 = db.query(UserWallet).filter(UserWallet.user_id == users[1].id).first()
        w3 = db.query(UserWallet).filter(UserWallet.user_id == users[2].id).first()

        assert w1.tribes_balance == 1150.0
        assert w2.tribes_balance == 1150.0
        assert w3.tribes_balance == 1000.0  # Did not qualify

        # Check arena reward pool reset
        db.refresh(pool)
        assert pool.reward_pool_tribes == 0.0

    finally:
        db.close()


def test_wallet_recharge_unfreezes_seized_account():
    db = TestingSessionLocal()
    try:
        user = User(email="seized@example.com", hashed_password="pw", full_name="Seized User")
        db.add(user)
        db.commit()
        db.refresh(user)

        wallet = kudos_service.get_or_create_user_wallet(db, user.id)
        wallet.tribes_balance = -50.0
        wallet.is_frozen = True
        db.commit()
        db.refresh(wallet)

        # Recharge +100 coins
        res = kudos_service.recharge_wallet(db, user.id, 100.0)
        assert res["status"] == "success"
        assert res["kudos_balance"] == 50.0
        assert res["is_frozen"] is False

        # Verify DB
        db.refresh(wallet)
        assert wallet.tribes_balance == 50.0
        assert wallet.is_frozen is False

    finally:
        db.close()
