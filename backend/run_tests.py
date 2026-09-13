"""
Tribely Automated Test Suite Runner with Explicit Asyncio Plugin Registration.
"""

import sys
import pluggy

# Monkey-patch pluggy to selectively allow pytest_asyncio while filtering broken entrypoints
original_load = pluggy.PluginManager.load_setuptools_entrypoints

def safe_load_setuptools_entrypoints(self, group, name=None):
    if group == "pytest11":
        try:
            import pytest_asyncio
            self.register(pytest_asyncio, name="pytest_asyncio")
        except ImportError:
            pass
        return
    return original_load(self, group, name)

pluggy.PluginManager.load_setuptools_entrypoints = safe_load_setuptools_entrypoints

import pytest
from app.core.database import sync_engine, Base
import app.models.models  # Register all models

if __name__ == "__main__":
    Base.metadata.create_all(bind=sync_engine)
    args = sys.argv[1:] if len(sys.argv) > 1 else ["tests/", "-v"]
    exit_code = pytest.main(args)
    sys.exit(exit_code)
