import sqlite3
import pytest
import json
from tracker.db import init_db, get_connection, close_db, insert_raw_event, get_raw_events_for_date, insert_work_block, get_work_blocks_for_date


class TestInitDb:
    def setup_method(self):
        """Use :memory: DB for each test."""
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_init_creates_raw_events_table(self):
        conn = get_connection()
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='raw_events'"
        )
        assert cursor.fetchone() is not None

    def test_init_creates_work_blocks_table(self):
        conn = get_connection()
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='work_blocks'"
        )
        assert cursor.fetchone() is not None

    def test_init_creates_daily_summaries_table(self):
        conn = get_connection()
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_summaries'"
        )
        assert cursor.fetchone() is not None

    def test_get_connection_returns_same_connection(self):
        conn1 = get_connection()
        conn2 = get_connection()
        assert conn1 is conn2

    def test_get_connection_before_init_raises(self):
        close_db()
        with pytest.raises(RuntimeError):
            get_connection()

    def test_close_db_resets_connection(self):
        close_db()
        with pytest.raises(RuntimeError):
            get_connection()

    def test_init_db_idempotent(self):
        init_db(":memory:")  # second call should not crash
        conn = get_connection()
        assert conn is not None


class TestRawEvents:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_insert_raw_event_returns_id(self):
        row_id = insert_raw_event(
            app_name="VS Code",
            window_title="main.py",
            started_at="2026-03-10T09:00:00",
            ended_at="2026-03-10T09:05:00",
            duration_sec=300,
        )
        assert row_id == 1

    def test_insert_multiple_returns_incrementing_ids(self):
        id1 = insert_raw_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:05:00", 300)
        id2 = insert_raw_event("Slack", None, "2026-03-10T09:05:00", "2026-03-10T09:07:00", 120)
        assert id2 == id1 + 1

    def test_get_raw_events_for_date_returns_matching(self):
        insert_raw_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:05:00", 300)
        insert_raw_event("Slack", None, "2026-03-11T10:00:00", "2026-03-11T10:02:00", 120)

        events = get_raw_events_for_date("2026-03-10")
        assert len(events) == 1
        assert events[0]["app_name"] == "VS Code"

    def test_get_raw_events_for_date_empty(self):
        events = get_raw_events_for_date("2026-03-10")
        assert events == []

    def test_raw_event_fields_complete(self):
        insert_raw_event("Terminal", "ssh prod", "2026-03-10T14:00:00", "2026-03-10T14:30:00", 1800)
        events = get_raw_events_for_date("2026-03-10")
        event = events[0]
        assert event["app_name"] == "Terminal"
        assert event["window_title"] == "ssh prod"
        assert event["started_at"] == "2026-03-10T14:00:00"
        assert event["ended_at"] == "2026-03-10T14:30:00"
        assert event["duration_sec"] == 1800


class TestWorkBlocks:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_insert_work_block_returns_id(self):
        row_id = insert_work_block(
            date="2026-03-10",
            started_at="2026-03-10T09:00:00",
            ended_at="2026-03-10T10:30:00",
            duration_min=90,
            category="coding",
            auto_category="coding",
            apps_used=json.dumps(["VS Code", "Terminal"]),
            note=None,
        )
        assert row_id == 1

    def test_get_work_blocks_for_date(self):
        insert_work_block(
            date="2026-03-10",
            started_at="2026-03-10T09:00:00",
            ended_at="2026-03-10T10:30:00",
            duration_min=90,
            category="coding",
            auto_category="coding",
            apps_used=json.dumps(["VS Code"]),
            note="Morning coding session",
        )
        insert_work_block(
            date="2026-03-11",
            started_at="2026-03-11T09:00:00",
            ended_at="2026-03-11T10:00:00",
            duration_min=60,
            category="meeting",
            auto_category="meeting",
            apps_used=json.dumps(["Zoom"]),
            note=None,
        )

        blocks = get_work_blocks_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"
        assert blocks[0]["duration_min"] == 90
        assert blocks[0]["note"] == "Morning coding session"

    def test_get_work_blocks_for_date_empty(self):
        blocks = get_work_blocks_for_date("2026-03-10")
        assert blocks == []

    def test_work_block_apps_used_is_json_string(self):
        insert_work_block(
            date="2026-03-10",
            started_at="2026-03-10T09:00:00",
            ended_at="2026-03-10T10:30:00",
            duration_min=90,
            category="coding",
            auto_category="coding",
            apps_used=json.dumps(["VS Code", "Terminal"]),
            note=None,
        )
        blocks = get_work_blocks_for_date("2026-03-10")
        apps = json.loads(blocks[0]["apps_used"])
        assert apps == ["VS Code", "Terminal"]

    def test_work_block_user_confirmed_defaults_false(self):
        insert_work_block(
            date="2026-03-10",
            started_at="2026-03-10T09:00:00",
            ended_at="2026-03-10T10:30:00",
            duration_min=90,
            category="coding",
            auto_category="coding",
            apps_used=json.dumps(["VS Code"]),
            note=None,
        )
        blocks = get_work_blocks_for_date("2026-03-10")
        assert blocks[0]["user_confirmed"] == 0
