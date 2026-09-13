"""
Database Cleanup Script for Tribely:
Purges ephemeral automated test data from PostgreSQL tribely_db
while strictly preserving real user accounts, production arenas, and audit history.
"""

import sys
import os
import argparse
from sqlalchemy import text
from app.core.database import sync_engine


def purge_test_data(dry_run: bool = False, preserve_user_ids: list[int] = None):
    if preserve_user_ids is None:
        preserve_user_ids = [4]

    print("[1/3] Connecting to PostgreSQL database...")
    with sync_engine.connect() as conn:
        trans = conn.begin()
        try:
            # 1. Inspect test arenas
            test_arenas = conn.execute(
                text("""
                    SELECT id, name FROM arenas
                    WHERE name ILIKE '%[TEST]%'
                       OR name ILIKE '%smoketest%'
                       OR name ILIKE '%temporary%'
                """)
            ).fetchall()
            test_arena_ids = [r[0] for r in test_arenas]
            print(f"Found {len(test_arena_ids)} test arenas: {[r[1] for r in test_arenas]}")

            # 2. Inspect ephemeral test users
            preserved_clause = f"id NOT IN ({','.join(map(str, preserve_user_ids))})"
            test_users = conn.execute(
                text(f"""
                    SELECT id, email, full_name FROM users
                    WHERE {preserved_clause} AND (
                        email ILIKE '%smoketest_%@tribely.internal%'
                        OR email ILIKE '%test_%@example.com%'
                        OR email ILIKE '%+test@%'
                    )
                """)
            ).fetchall()
            test_user_ids = [r[0] for r in test_users]
            print(f"Found {len(test_user_ids)} ephemeral test users.")

            if dry_run:
                print("[DRY RUN] No database changes committed.")
                trans.rollback()
                return

            # 3. Purge dependent tables for test arenas
            if test_arena_ids:
                tuple_arenas = tuple(test_arena_ids) if len(test_arena_ids) > 1 else f"({test_arena_ids[0]})"
                conn.execute(text(f"DELETE FROM submission_votes WHERE submission_id IN (SELECT id FROM submissions WHERE arena_id IN {tuple_arenas})"))
                conn.execute(text(f"DELETE FROM submissions WHERE arena_id IN {tuple_arenas}"))
                conn.execute(text(f"DELETE FROM daily_arena_sheets WHERE arena_id IN {tuple_arenas}"))
                conn.execute(text(f"DELETE FROM messages WHERE arena_id IN {tuple_arenas}"))
                conn.execute(text(f"DELETE FROM arena_memberships WHERE arena_id IN {tuple_arenas}"))
                conn.execute(text(f"DELETE FROM arena_logbook WHERE arena_id IN {tuple_arenas}"))
                conn.execute(text(f"DELETE FROM kudos_ledger WHERE arena_id IN {tuple_arenas}"))
                conn.execute(text(f"DELETE FROM arenas WHERE id IN {tuple_arenas}"))

            # 4. Purge records for test users
            if test_user_ids:
                tuple_users = tuple(test_user_ids) if len(test_user_ids) > 1 else f"({test_user_ids[0]})"
                conn.execute(text(f"DELETE FROM submission_votes WHERE user_id IN {tuple_users}"))
                conn.execute(text(f"DELETE FROM submissions WHERE user_id IN {tuple_users}"))
                conn.execute(text(f"DELETE FROM daily_arena_sheets WHERE user_id IN {tuple_users}"))
                conn.execute(text(f"DELETE FROM messages WHERE user_id IN {tuple_users}"))
                conn.execute(text(f"DELETE FROM arena_memberships WHERE user_id IN {tuple_users}"))
                conn.execute(text(f"DELETE FROM kudos_ledger WHERE user_id IN {tuple_users}"))
                conn.execute(text(f"DELETE FROM user_wallets WHERE user_id IN {tuple_users}"))
                conn.execute(text(f"DELETE FROM user_profiles WHERE user_id IN {tuple_users}"))
                conn.execute(text(f"DELETE FROM notifications WHERE user_id IN {tuple_users}"))
                conn.execute(text(f"DELETE FROM push_subscriptions WHERE user_id IN {tuple_users}"))
                conn.execute(text(f"DELETE FROM arena_unread_trackers WHERE user_id IN {tuple_users}"))
                conn.execute(text(f"DELETE FROM users WHERE id IN {tuple_users}"))

            trans.commit()
            print("[3/3] Ephemeral test data purged successfully.")
        except Exception as e:
            trans.rollback()
            print(f"[ERROR] Transaction rolled back due to error: {e}")
            raise e


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Purge ephemeral test data from Tribely database.")
    parser.add_argument("--dry-run", action="store_true", help="Inspect test records without committing deletes.")
    args = parser.parse_args()
    purge_test_data(dry_run=args.dry_run)
