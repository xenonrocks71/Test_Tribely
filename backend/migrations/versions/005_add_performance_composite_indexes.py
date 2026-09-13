"""add_performance_composite_indexes

Revision ID: 005_add_performance_composite_indexes
Revises: 004_add_kudos_currency_system
Create Date: 2026-09-06 15:30:00.000000

High-concurrency composite indexes to eliminate full-table scans at 1M+ scale:
- messages: (arena_id, created_at)
- submissions: (arena_id, user_id, submitted_at)
- daily_arena_sheets: (arena_id, date_day, status), (user_id, arena_id, status)
- escrow_ledger: (arena_id, created_at), (user_id, created_at)
- kudos_ledger: (arena_id, created_at), (user_id, created_at)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_add_performance_composite_indexes'
down_revision: Union[str, None] = '004_add_kudos_currency_system'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. messages composite index
    op.create_index(
        'idx_messages_arena_created',
        'messages',
        ['arena_id', 'created_at'],
        unique=False
    )

    # 2. submissions composite index
    op.create_index(
        'idx_arena_user_submitted',
        'submissions',
        ['arena_id', 'user_id', 'submitted_at'],
        unique=False
    )

    # 3. daily_arena_sheets composite indexes
    op.create_index(
        'idx_sheet_arena_date_status',
        'daily_arena_sheets',
        ['arena_id', 'date_day', 'status'],
        unique=False
    )
    op.create_index(
        'idx_sheet_user_arena_status',
        'daily_arena_sheets',
        ['user_id', 'arena_id', 'status'],
        unique=False
    )

    # 4. escrow_ledger composite indexes
    op.create_index(
        'idx_escrow_arena_created',
        'escrow_ledger',
        ['arena_id', 'created_at'],
        unique=False
    )
    op.create_index(
        'idx_escrow_user_created',
        'escrow_ledger',
        ['user_id', 'created_at'],
        unique=False
    )

    # 5. kudos_ledger composite indexes
    op.create_index(
        'idx_kudos_arena_created',
        'kudos_ledger',
        ['arena_id', 'created_at'],
        unique=False
    )
    op.create_index(
        'idx_kudos_user_created',
        'kudos_ledger',
        ['user_id', 'created_at'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('idx_kudos_user_created', table_name='kudos_ledger')
    op.drop_index('idx_kudos_arena_created', table_name='kudos_ledger')
    op.drop_index('idx_escrow_user_created', table_name='escrow_ledger')
    op.drop_index('idx_escrow_arena_created', table_name='escrow_ledger')
    op.drop_index('idx_sheet_user_arena_status', table_name='daily_arena_sheets')
    op.drop_index('idx_sheet_arena_date_status', table_name='daily_arena_sheets')
    op.drop_index('idx_arena_user_submitted', table_name='submissions')
    op.drop_index('idx_messages_arena_created', table_name='messages')
