"""init_postgres_schema

Revision ID: 001_init_postgres_schema
Revises: 
Create Date: 2026-07-28 11:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_init_postgres_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_users'))
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    # 2. user_profiles table
    op.create_table(
        'user_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('profile_image_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_profiles_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_user_profiles')),
        sa.UniqueConstraint('user_id', name=op.f('uq_user_profiles_user_id'))
    )
    op.create_index(op.f('ix_user_profiles_id'), 'user_profiles', ['id'], unique=False)

    # 3. arenas table
    op.create_table(
        'arenas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('invite_code', sa.String(), nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('proof_type', sa.String(), nullable=True, server_default='image'),
        sa.Column('penalty_amount', sa.Numeric(precision=10, scale=2), nullable=True, server_default='0.00'),
        sa.Column('deadline_time', sa.String(), nullable=True, server_default='00:00'),
        sa.Column('is_private', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('icon_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], name=op.f('fk_arenas_creator_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_arenas'))
    )
    op.create_index(op.f('ix_arenas_id'), 'arenas', ['id'], unique=False)
    op.create_index(op.f('ix_arenas_invite_code'), 'arenas', ['invite_code'], unique=True)

    # 4. arena_memberships table
    op.create_table(
        'arena_memberships',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('arena_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=True, server_default='approved'),
        sa.Column('role', sa.String(), nullable=True, server_default='member'),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['arena_id'], ['arenas.id'], name=op.f('fk_arena_memberships_arena_id_arenas'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_arena_memberships_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_arena_memberships'))
    )
    op.create_index(op.f('ix_arena_memberships_id'), 'arena_memberships', ['id'], unique=False)

    # 5. messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('arena_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('message_type', sa.String(), nullable=True, server_default='text'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['arena_id'], ['arenas.id'], name=op.f('fk_messages_arena_id_arenas'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_messages_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_messages'))
    )
    op.create_index(op.f('ix_messages_id'), 'messages', ['id'], unique=False)

    # 6. submissions table
    op.create_table(
        'submissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('arena_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('proof_url', sa.Text(), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.Column('upvotes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('downvotes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_absent', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['arena_id'], ['arenas.id'], name=op.f('fk_submissions_arena_id_arenas'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_submissions_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_submissions'))
    )
    op.create_index(op.f('ix_submissions_id'), 'submissions', ['id'], unique=False)

    # 7. submission_votes table
    op.create_table(
        'submission_votes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('vote_type', sa.String(), nullable=False),
        sa.Column('voted_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], name=op.f('fk_submission_votes_submission_id_submissions'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_submission_votes_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_submission_votes')),
        sa.UniqueConstraint('submission_id', 'user_id', name='_user_submission_vote_uc')
    )
    op.create_index(op.f('ix_submission_votes_id'), 'submission_votes', ['id'], unique=False)

    # 8. daily_arena_sheets table
    op.create_table(
        'daily_arena_sheets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('arena_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('date_day', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('proof_type', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['arena_id'], ['arenas.id'], name=op.f('fk_daily_arena_sheets_arena_id_arenas'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_daily_arena_sheets_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_daily_arena_sheets')),
        sa.UniqueConstraint('arena_id', 'user_id', 'date_day', name='_arena_user_day_uc')
    )
    op.create_index(op.f('ix_daily_arena_sheets_id'), 'daily_arena_sheets', ['id'], unique=False)

    # 9. arena_logbook table
    op.create_table(
        'arena_logbook',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('arena_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('entry_type', sa.String(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=True, server_default='0.00'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('logged_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['arena_id'], ['arenas.id'], name=op.f('fk_arena_logbook_arena_id_arenas'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_arena_logbook_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_arena_logbook'))
    )
    op.create_index(op.f('ix_arena_logbook_id'), 'arena_logbook', ['id'], unique=False)


def downgrade() -> None:
    op.drop_table('arena_logbook')
    op.drop_table('daily_arena_sheets')
    op.drop_table('submission_votes')
    op.drop_table('submissions')
    op.drop_table('messages')
    op.drop_table('arena_memberships')
    op.drop_table('arenas')
    op.drop_table('user_profiles')
    op.drop_table('users')
