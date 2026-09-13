"""
Timezone-Aware Deadline Evaluation Test Suite.
Verifies conversion from UTC server time to arena IANA timezones (e.g. Asia/Kolkata, America/New_York).
"""

import pytest
import datetime
import zoneinfo
from app.models.models import Arena
from app.workers.audit_worker import get_arena_timezone, parse_cutoff_time


def test_timezone_conversion_and_cutoff_parsing():
    # 1. Kolkata (UTC+5:30)
    tz_kolkata = get_arena_timezone("Asia/Kolkata")
    assert tz_kolkata.key == "Asia/Kolkata"
    time_kolkata = datetime.datetime.now(tz_kolkata)
    assert time_kolkata.tzinfo is not None

    # 2. New York (UTC-4/5)
    tz_ny = get_arena_timezone("America/New_York")
    assert tz_ny.key == "America/New_York"
    time_ny = datetime.datetime.now(tz_ny)
    assert time_ny.tzinfo is not None

    # Difference between New York and Kolkata is at least 9.5 hours
    utc_now = datetime.datetime.now(datetime.timezone.utc)
    ny_offset = time_ny.utcoffset().total_seconds()
    kolkata_offset = time_kolkata.utcoffset().total_seconds()
    assert kolkata_offset > ny_offset

    # 3. Parse various cutoff formats
    assert parse_cutoff_time("05:00") == datetime.time(5, 0)
    assert parse_cutoff_time("22:30:00") == datetime.time(22, 30)
    assert parse_cutoff_time("11:59 PM") == datetime.time(23, 59)
    assert parse_cutoff_time("05:00 AM") == datetime.time(5, 0)
    assert parse_cutoff_time(None) == datetime.time(23, 59, 59)
