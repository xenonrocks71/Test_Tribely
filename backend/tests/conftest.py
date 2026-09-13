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
    """Ensure all SQLAlchemy tables exist before running test suite."""
    Base.metadata.create_all(bind=sync_engine)
    yield
