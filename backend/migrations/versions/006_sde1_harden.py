"""harden_sde1_interview_schema

Revision ID: 006_sde1_harden
Revises: 005_add_performance_composite_indexes
Create Date: 2026-09-12 17:30:00.000000

Enforces SDE-1 interview-grade PostgreSQL schema:
1. users: username, avatar_url
2. user_wallets: version (optimistic locking counter), balance
3. kudos_ledger: amount, reference_id, standard transaction types
4. arenas: title, category, entry_deposit, daily_penalty, daily_cutoff_time, timezone, created_by
5. arena_memberships / arena_members: current_streak, is_active, streak_shields
6. proofs: UNIQUE (arena_id, user_id, submission_date), idx_proofs_cursor (arena_id, created_at DESC, id DESC)
7. proof_reactions: UNIQUE (proof_id, user_id, emoji), idx_proof_reactions_proof
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '006_sde1_harden'
down_revision: Union[str, None] = '005_add_performance_composite_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. users: username, avatar_url ──────────────────────────────────────────
    op.add_column('users', sa.Column('username', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.Text(), nullable=True))

    # Populate username from email for existing rows, then enforce unique
    conn.execute(sa.text("""
        UPDATE users 
        SET username = LOWER(SPLIT_PART(email, '@', 1)) || '_' || id
        WHERE username IS NULL;
    """))
    op.alter_column('users', 'username', nullable=True)
    op.create_unique_constraint('uq_users_username', 'users', ['username'])
    op.create_index('ix_users_username', 'users', ['username'])

    # Sync avatar_url from user_profiles if present
    conn.execute(sa.text("""
        UPDATE users u
        SET avatar_url = up.profile_image_url
        FROM user_profiles up
        WHERE u.id = up.user_id AND u.avatar_url IS NULL;
    """))

    # ── 2. user_wallets: version, balance ───────────────────────────────────────
    op.add_column('user_wallets', sa.Column('version', sa.Integer(), server_default='1', nullable=False))
    op.add_column('user_wallets', sa.Column('balance', sa.Numeric(precision=14, scale=2), server_default='1000.00', nullable=False))
    op.add_column('user_wallets', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
    
    conn.execute(sa.text("""
        UPDATE user_wallets 
        SET balance = tribes_balance::numeric
        WHERE balance = 1000.00 AND tribes_balance IS NOT NULL;
    """))

    # ── 3. kudos_ledger: amount, reference_id ──────────────────────────────────
    op.add_column('kudos_ledger', sa.Column('amount', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('kudos_ledger', sa.Column('reference_id', sa.String(length=255), nullable=True))
    
    conn.execute(sa.text("""
        UPDATE kudos_ledger 
        SET amount = amount_kudos,
            reference_id = idempotency_key
        WHERE amount = 0.0 AND amount_kudos IS NOT NULL;
    """))

    # ── 4. arenas: title, category, entry_deposit, daily_penalty, daily_cutoff_time, timezone, created_by
    op.add_column('arenas', sa.Column('title', sa.String(length=255), nullable=True))
    op.add_column('arenas', sa.Column('category', sa.String(length=100), server_default='Habit', nullable=False))
    op.add_column('arenas', sa.Column('entry_deposit', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False))
    op.add_column('arenas', sa.Column('daily_penalty', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False))
    op.add_column('arenas', sa.Column('daily_cutoff_time', sa.String(length=20), server_default='00:00', nullable=False))
    op.add_column('arenas', sa.Column('timezone', sa.String(length=100), server_default='UTC', nullable=False))
    op.add_column('arenas', sa.Column('created_by', sa.Integer(), nullable=True))

    conn.execute(sa.text("""
        UPDATE arenas
        SET title = name,
            daily_penalty = COALESCE(penalty_amount, 0.00),
            daily_cutoff_time = COALESCE(deadline_time, '00:00'),
            created_by = creator_id
        WHERE title IS NULL;
    """))
    op.alter_column('arenas', 'title', nullable=True)
    op.create_foreign_key('fk_arenas_created_by_users', 'arenas', 'users', ['created_by'], ['id'], ondelete='CASCADE')

    # ── 5. arena_memberships: current_streak, is_active, streak_shields ─────────
    op.add_column('arena_memberships', sa.Column('current_streak', sa.Integer(), server_default='0', nullable=False))
    op.add_column('arena_memberships', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('arena_memberships', sa.Column('streak_shields', sa.Integer(), server_default='1', nullable=False))

    # Create arena_members view for aliasing if queried as arena_members
    conn.execute(sa.text("""
        CREATE OR REPLACE VIEW arena_members AS
        SELECT id, arena_id, user_id, role, joined_at, current_streak, is_active, streak_shields, status
        FROM arena_memberships;
    """))

    # ── 6. proofs table ────────────────────────────────────────────────────────
    op.create_table(
        'proofs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('arena_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('submission_date', sa.Date(), server_default=sa.text('CURRENT_DATE'), nullable=False),
        sa.Column('media_url', sa.Text(), nullable=False),
        sa.Column('selfie_url', sa.Text(), nullable=True),
        sa.Column('proof_type', sa.String(length=50), server_default='IMAGE', nullable=False),
        sa.Column('caption', sa.Text(), nullable=True),
        sa.Column('telemetry_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['arena_id'], ['arenas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('arena_id', 'user_id', 'submission_date', name='uq_proofs_arena_user_date')
    )

    op.create_index('idx_proofs_cursor', 'proofs', ['arena_id', sa.text('created_at DESC'), sa.text('id DESC')])
    op.create_index('idx_proofs_user_date', 'proofs', ['user_id', 'submission_date'])

    # Migrate any existing rows from submissions to proofs
    conn.execute(sa.text("""
        INSERT INTO proofs (arena_id, user_id, submission_date, media_url, proof_type, created_at)
        SELECT arena_id, user_id, submitted_at::date, proof_url, 'IMAGE', submitted_at
        FROM submissions
        ON CONFLICT DO NOTHING;
    """))

    # ── 7. proof_reactions table ───────────────────────────────────────────────
    op.create_table(
        'proof_reactions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('proof_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('emoji', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['proof_id'], ['proofs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('proof_id', 'user_id', 'emoji', name='uq_proof_reactions_proof_user_emoji')
    )
    op.create_index('idx_proof_reactions_proof', 'proof_reactions', ['proof_id'])


def downgrade() -> None:
    conn = op.get_bind()
    op.drop_table('proof_reactions')
    op.drop_table('proofs')
    conn.execute(sa.text("DROP VIEW IF EXISTS arena_members;"))
    op.drop_column('arena_memberships', 'streak_shields')
    op.drop_column('arena_memberships', 'is_active')
    op.drop_column('arena_memberships', 'current_streak')
    op.drop_constraint('fk_arenas_created_by_users', 'arenas', type_='foreignkey')
    op.drop_column('arenas', 'created_by')
    op.drop_column('arenas', 'timezone')
    op.drop_column('arenas', 'daily_cutoff_time')
    op.drop_column('arenas', 'daily_penalty')
    op.drop_column('arenas', 'entry_deposit')
    op.drop_column('arenas', 'category')
    op.drop_column('arenas', 'title')
    op.drop_column('kudos_ledger', 'reference_id')
    op.drop_column('kudos_ledger', 'amount')
    op.drop_column('user_wallets', 'updated_at')
    op.drop_column('user_wallets', 'balance')
    op.drop_column('user_wallets', 'version')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_constraint('uq_users_username', 'users', type_='unique')
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'username')
