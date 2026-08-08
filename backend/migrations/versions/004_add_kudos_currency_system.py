"""add_kudos_currency_system

Revision ID: 004_add_kudos_currency_system
Revises: 003_add_razorpay_payment_fields
Create Date: 2026-08-08 19:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004_add_kudos_currency_system'
down_revision: Union[str, None] = '002_update_ledger_pools_wallets'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    # 1. Add kudos_balance to user_wallets
    op.add_column('user_wallets', sa.Column('kudos_balance', sa.Float(), nullable=False, server_default='1000.0'))

    # 2. Add Kudos vault & 21-day cycle tracking to arena_pools
    op.add_column('arena_pools', sa.Column('kudos_reserve_vault', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('arena_pools', sa.Column('cycle_start_date', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')))
    op.add_column('arena_pools', sa.Column('cycle_days_count', sa.Integer(), nullable=False, server_default='21'))

    # 3. Create kudos_ledger table
    op.create_table(
        'kudos_ledger',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('arena_id', sa.Integer(), nullable=True),
        sa.Column('transaction_type', sa.String(), nullable=False),
        sa.Column('amount_kudos', sa.Float(), nullable=False),
        sa.Column('debit_account', sa.String(), nullable=False),
        sa.Column('credit_account', sa.String(), nullable=False),
        sa.Column('razorpay_payment_id', sa.String(), nullable=True),
        sa.Column('razorpay_payout_id', sa.String(), nullable=True),
        sa.Column('idempotency_key', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['arena_id'], ['arenas.id'], name=op.f('fk_kudos_ledger_arena_id_arenas'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_kudos_ledger_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_kudos_ledger')),
        sa.UniqueConstraint('idempotency_key', name=op.f('uq_kudos_ledger_idempotency_key'))
    )
    op.create_index(op.f('ix_kudos_ledger_arena_id'), 'kudos_ledger', ['arena_id'], unique=False)
    op.create_index(op.f('ix_kudos_ledger_id'), 'kudos_ledger', ['id'], unique=False)
    op.create_index(op.f('ix_kudos_ledger_idempotency_key'), 'kudos_ledger', ['idempotency_key'], unique=True)
    op.create_index(op.f('ix_kudos_ledger_razorpay_payment_id'), 'kudos_ledger', ['razorpay_payment_id'], unique=False)
    op.create_index(op.f('ix_kudos_ledger_razorpay_payout_id'), 'kudos_ledger', ['razorpay_payout_id'], unique=False)
    op.create_index(op.f('ix_kudos_ledger_transaction_type'), 'kudos_ledger', ['transaction_type'], unique=False)
    op.create_index(op.f('ix_kudos_ledger_user_id'), 'kudos_ledger', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_kudos_ledger_user_id'), table_name='kudos_ledger')
    op.drop_index(op.f('ix_kudos_ledger_transaction_type'), table_name='kudos_ledger')
    op.drop_index(op.f('ix_kudos_ledger_razorpay_payout_id'), table_name='kudos_ledger')
    op.drop_index(op.f('ix_kudos_ledger_razorpay_payment_id'), table_name='kudos_ledger')
    op.drop_index(op.f('ix_kudos_ledger_idempotency_key'), table_name='kudos_ledger')
    op.drop_index(op.f('ix_kudos_ledger_id'), table_name='kudos_ledger')
    op.drop_index(op.f('ix_kudos_ledger_arena_id'), table_name='kudos_ledger')
    op.drop_table('kudos_ledger')

    op.drop_column('arena_pools', 'cycle_days_count')
    op.drop_column('arena_pools', 'cycle_start_date')
    op.drop_column('arena_pools', 'kudos_reserve_vault')

    op.drop_column('user_wallets', 'kudos_balance')
