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

if __name__ == "__main__":
    exit_code = pytest.main(["tests/", "-v"])
    sys.exit(exit_code)
