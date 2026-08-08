"""
Scratch script to check actual dev database state for users and wallets.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal
from app.models.models import User, UserWallet, KudosLedger, ArenaPool, Arena


from app.services.kudos_service import kudos_service

def check_db_state():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"Total Users in DB: {len(users)}")
        for u in users:
            w = kudos_service.get_or_create_user_wallet(db, u.id)
            tx_count = db.query(KudosLedger).filter(KudosLedger.user_id == u.id).count()
            print(f"User #{u.id} ({u.email}): Wallet exists? True, Balance: {w.kudos_balance}, Ledger Count: {tx_count}")


        ledger_entries = db.query(KudosLedger).all()
        print(f"\nTotal KudosLedger entries: {len(ledger_entries)}")
        for l in ledger_entries:
            print(f"Ledger #{l.id}: User {l.user_id}, Type: {l.transaction_type}, Amount: {l.amount_kudos}, Key: {l.idempotency_key}")

    except Exception as e:
        print(f"Error checking DB state: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    check_db_state()
