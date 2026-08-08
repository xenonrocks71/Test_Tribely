"""
Script to ensure all PostgreSQL database columns and tables for Kudos digital currency system exist.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine, Base
from app.models import models


def sync_postgres_schema():
    print("=" * 60)
    print("SYNCING POSTGRESQL DATABASE SCHEMA")
    print("=" * 60)

    with engine.begin() as conn:
        print("1. Adding missing columns to user_wallets...")
        conn.execute(text("ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS kudos_balance DOUBLE PRECISION NOT NULL DEFAULT 1000.0;"))
        conn.execute(text("ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS last_reward_won_at TIMESTAMP WITH TIME ZONE;"))
        conn.execute(text("ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS razorpay_customer_id VARCHAR;"))
        conn.execute(text("ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS mandate_id VARCHAR;"))
        conn.execute(text("ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS mandate_status VARCHAR NOT NULL DEFAULT 'active';"))
        conn.execute(text("ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS upi_vpa VARCHAR;"))
        conn.execute(text("ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS pending_penalty BOOLEAN NOT NULL DEFAULT FALSE;"))

        print("2. Adding missing columns to arena_pools...")
        conn.execute(text("ALTER TABLE arena_pools ADD COLUMN IF NOT EXISTS kudos_reserve_vault DOUBLE PRECISION NOT NULL DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE arena_pools ADD COLUMN IF NOT EXISTS cycle_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();"))
        conn.execute(text("ALTER TABLE arena_pools ADD COLUMN IF NOT EXISTS cycle_days_count INTEGER NOT NULL DEFAULT 21;"))

    print("3. Running Base.metadata.create_all(bind=engine)...")
    Base.metadata.create_all(bind=engine)

    print("\n[OK] POSTGRESQL SCHEMA SYNC COMPLETED SUCCESSFULLY!")


if __name__ == "__main__":
    sync_postgres_schema()
