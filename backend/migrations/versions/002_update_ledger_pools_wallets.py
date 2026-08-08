"""update_ledger_pools_wallets

Revision ID: 002_update_ledger_pools_wallets
Revises: 001_init_postgres_schema
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002_update_ledger_pools_wallets'
down_revision: Union[str, None] = '001_init_postgres_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update escrow_ledger table: add amount_inr and entry_type, make user_id nullable
    op.add_column('escrow_ledger', sa.Column('amount_inr', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('escrow_ledger', sa.Column('entry_type', sa.String(), nullable=False, server_default='penalty_accrual'))
    op.alter_column('escrow_ledger', 'user_id', existing_type=sa.Integer(), nullable=True)

    # 2. Create arena_pools table
    op.create_table(
        'arena_pools',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('arena_id', sa.Integer(), nullable=False),
        sa.Column('reserve_pool_inr', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('reward_pool_inr', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('total_penalties_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['arena_id'], ['arenas.id'], name=op.f('fk_arena_pools_arena_id_arenas'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_arena_pools')),
        sa.UniqueConstraint('arena_id', name=op.f('uq_arena_pools_arena_id'))
    )
    op.create_index(op.f('ix_arena_pools_arena_id'), 'arena_pools', ['arena_id'], unique=True)
    op.create_index(op.f('ix_arena_pools_id'), 'arena_pools', ['id'], unique=False)

    # 3. Create user_wallets table
    op.create_table(
        'user_wallets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('balance_inr', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('last_reward_won_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_wallets_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_user_wallets')),
        sa.UniqueConstraint('user_id', name=op.f('uq_user_wallets_user_id'))
    )
    op.create_index(op.f('ix_user_wallets_id'), 'user_wallets', ['id'], unique=False)
    op.create_index(op.f('ix_user_wallets_user_id'), 'user_wallets', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_wallets_user_id'), table_name='user_wallets')
    op.drop_index(op.f('ix_user_wallets_id'), table_name='user_wallets')
    op.drop_table('user_wallets')

    op.drop_index(op.f('ix_arena_pools_id'), table_name='arena_pools')
    op.drop_index(op.f('ix_arena_pools_arena_id'), table_name='arena_pools')
    op.drop_table('arena_pools')

    op.alter_column('escrow_ledger', 'user_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('escrow_ledger', 'entry_type')
    op.drop_column('escrow_ledger', 'amount_inr')
