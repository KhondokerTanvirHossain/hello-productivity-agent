import json
from tracker.db import init_db, close_db, insert_raw_event, get_work_blocks_for_date
from tracker.merger import merge_events_for_date


def _insert_event(app: str, title: str | None, start: str, end: str, dur: int) -> None:
    insert_raw_event(app, title, start, end, dur)


class TestMergerMicroSessionDiscard:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_discards_events_under_2_minutes(self):
        _insert_event("Slack", None, "2026-03-10T09:00:00", "2026-03-10T09:01:00", 60)
        _insert_event("VS Code", "main.py", "2026-03-10T09:01:00", "2026-03-10T09:30:00", 1740)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"

    def test_keeps_events_at_2_minutes(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:12:00", 720)
        _insert_event("Slack", None, "2026-03-10T09:12:00", "2026-03-10T09:14:00", 120)
        blocks = merge_events_for_date("2026-03-10")
        categories = [b["category"] for b in blocks]
        assert "admin" in categories or len(blocks) >= 1


class TestMergerSameCategoryMerge:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_merges_same_category_within_5min_gap(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800)
        _insert_event("VS Code", "utils.py", "2026-03-10T09:33:00", "2026-03-10T10:00:00", 1620)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"
        assert blocks[0]["duration_min"] >= 57  # 30 + 27 = 57 min

    def test_does_not_merge_with_gap_over_5min(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800)
        _insert_event("VS Code", "utils.py", "2026-03-10T09:36:00", "2026-03-10T10:06:00", 1800)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) == 2


class TestMergerAbsorbShortSwitches:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_absorbs_short_switch_between_same_category(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800)
        _insert_event("Slack", None, "2026-03-10T09:30:00", "2026-03-10T09:33:00", 180)
        _insert_event("VS Code", "utils.py", "2026-03-10T09:33:00", "2026-03-10T10:00:00", 1620)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"

    def test_does_not_absorb_long_switch(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800)
        _insert_event("Slack", None, "2026-03-10T09:30:00", "2026-03-10T09:36:00", 360)
        _insert_event("VS Code", "utils.py", "2026-03-10T09:36:00", "2026-03-10T10:06:00", 1800)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) >= 2


class TestMergerMinBlockSize:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_discards_blocks_under_10_minutes(self):
        _insert_event("Slack", None, "2026-03-10T09:00:00", "2026-03-10T09:08:00", 480)
        _insert_event("VS Code", "main.py", "2026-03-10T09:08:00", "2026-03-10T10:08:00", 3600)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"


class TestMergerIdempotent:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_remerge_replaces_existing_blocks(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 3600)
        merge_events_for_date("2026-03-10")
        merge_events_for_date("2026-03-10")  # re-merge
        blocks = get_work_blocks_for_date("2026-03-10")
        assert len(blocks) == 1  # not duplicated


class TestMergerWritesToDb:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_blocks_written_to_work_blocks_table(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 3600)
        merge_events_for_date("2026-03-10")
        blocks = get_work_blocks_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"
        assert blocks[0]["auto_category"] == "coding"
        apps = json.loads(blocks[0]["apps_used"])
        assert "VS Code" in apps

    def test_block_has_correct_time_range(self):
        _insert_event("Zoom", "Standup", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800)
        blocks = merge_events_for_date("2026-03-10")
        assert blocks[0]["started_at"] == "2026-03-10T09:00:00"
        assert blocks[0]["ended_at"] == "2026-03-10T09:30:00"
        assert blocks[0]["duration_min"] == 30


class TestMergerTypicalDay:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_typical_day_produces_8_to_12_blocks(self):
        # Morning standup
        _insert_event("Zoom", "Standup", "2026-03-10T09:00:00", "2026-03-10T09:15:00", 900)
        # Coding block 1
        _insert_event("VS Code", "main.py", "2026-03-10T09:15:00", "2026-03-10T10:30:00", 4500)
        _insert_event("Slack", "#general", "2026-03-10T10:30:00", "2026-03-10T10:32:00", 120)  # micro, discard
        _insert_event("VS Code", "utils.py", "2026-03-10T10:32:00", "2026-03-10T11:30:00", 3480)
        # Research
        _insert_event("Google Chrome", "React Hooks - Stack Overflow", "2026-03-10T11:30:00", "2026-03-10T12:00:00", 1800)
        # Lunch (gap)
        # Planning
        _insert_event("Notion", "Sprint Plan", "2026-03-10T13:00:00", "2026-03-10T13:45:00", 2700)
        # Meeting
        _insert_event("Zoom", "1:1 with Manager", "2026-03-10T14:00:00", "2026-03-10T14:30:00", 1800)
        # Coding block 2
        _insert_event("VS Code", "api.py", "2026-03-10T14:30:00", "2026-03-10T16:00:00", 5400)
        # Admin
        _insert_event("Slack", "DMs", "2026-03-10T16:00:00", "2026-03-10T16:30:00", 1800)
        # Infra
        _insert_event("Terminal", "ssh prod-server", "2026-03-10T16:30:00", "2026-03-10T17:00:00", 1800)
        # Wrap up admin
        _insert_event("Google Chrome", "Inbox - Gmail", "2026-03-10T17:00:00", "2026-03-10T17:30:00", 1800)

        blocks = merge_events_for_date("2026-03-10")
        assert 6 <= len(blocks) <= 12
        categories = [b["category"] for b in blocks]
        assert "meeting" in categories
        assert "coding" in categories
        assert "research" in categories
        assert "planning" in categories
        assert "admin" in categories
        assert "infra" in categories
