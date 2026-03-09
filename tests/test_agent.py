from unittest.mock import patch
from datetime import datetime
from tracker.db import init_db, close_db, get_raw_events_for_date
from tracker.agent import poll_tick, eod_check


class TestPollTick:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    @patch("tracker.agent.get_active_window")
    def test_new_app_creates_event(self, mock_window):
        mock_window.return_value = ("VS Code", "main.py")
        state = {"current_event": None}
        poll_tick(state)
        assert state["current_event"] is not None
        assert state["current_event"]["app_name"] == "VS Code"
        assert state["current_event"]["id"] is not None

    @patch("tracker.agent.get_active_window")
    def test_same_app_extends_event(self, mock_window):
        mock_window.return_value = ("VS Code", "main.py")
        state = {"current_event": None}
        poll_tick(state)
        first_id = state["current_event"]["id"]
        poll_tick(state)
        assert state["current_event"]["id"] == first_id  # same row, updated

    @patch("tracker.agent.get_active_window")
    def test_different_app_finalizes_and_creates_new(self, mock_window):
        mock_window.return_value = ("VS Code", "main.py")
        state = {"current_event": None}
        poll_tick(state)
        first_id = state["current_event"]["id"]

        mock_window.return_value = ("Slack", "general")
        poll_tick(state)
        assert state["current_event"]["id"] != first_id
        assert state["current_event"]["app_name"] == "Slack"

    @patch("tracker.agent.get_active_window")
    def test_skipped_app_finalizes_current(self, mock_window):
        mock_window.return_value = ("VS Code", "main.py")
        state = {"current_event": None}
        poll_tick(state)

        mock_window.return_value = None  # skipped app
        poll_tick(state)
        assert state["current_event"] is None

    @patch("tracker.agent.get_active_window")
    def test_skipped_app_when_no_current(self, mock_window):
        mock_window.return_value = None
        state = {"current_event": None}
        poll_tick(state)  # should not raise
        assert state["current_event"] is None

    @patch("tracker.agent.get_active_window")
    def test_different_title_same_app_creates_new(self, mock_window):
        mock_window.return_value = ("VS Code", "main.py")
        state = {"current_event": None}
        poll_tick(state)
        first_id = state["current_event"]["id"]

        mock_window.return_value = ("VS Code", "utils.py")
        poll_tick(state)
        assert state["current_event"]["id"] != first_id
        assert state["current_event"]["window_title"] == "utils.py"


class TestEodCheck:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    @patch("tracker.agent.send_eod_notification")
    @patch("tracker.agent.merge_events_for_date")
    @patch("tracker.agent.datetime")
    def test_does_not_fire_before_18(self, mock_dt, mock_merge, mock_notify):
        mock_dt.now.return_value = datetime(2026, 3, 10, 17, 59, 0)
        state = {"current_event": None, "notified_date": None}
        eod_check(state)
        mock_merge.assert_not_called()
        mock_notify.assert_not_called()
        assert state["notified_date"] is None

    @patch("tracker.agent.send_eod_notification")
    @patch("tracker.agent.merge_events_for_date")
    @patch("tracker.agent.datetime")
    def test_fires_at_18(self, mock_dt, mock_merge, mock_notify):
        mock_dt.now.return_value = datetime(2026, 3, 10, 18, 0, 0)
        state = {"current_event": None, "notified_date": None}
        eod_check(state)
        mock_merge.assert_called_once_with("2026-03-10")
        mock_notify.assert_called_once()
        assert state["notified_date"] == "2026-03-10"

    @patch("tracker.agent.send_eod_notification")
    @patch("tracker.agent.merge_events_for_date")
    @patch("tracker.agent.datetime")
    def test_does_not_fire_twice_same_day(self, mock_dt, mock_merge, mock_notify):
        mock_dt.now.return_value = datetime(2026, 3, 10, 18, 5, 0)
        state = {"current_event": None, "notified_date": "2026-03-10"}
        eod_check(state)
        mock_merge.assert_not_called()
        mock_notify.assert_not_called()

    @patch("tracker.agent.send_eod_notification")
    @patch("tracker.agent.merge_events_for_date")
    @patch("tracker.agent.datetime")
    def test_fires_on_new_day(self, mock_dt, mock_merge, mock_notify):
        mock_dt.now.return_value = datetime(2026, 3, 11, 18, 30, 0)
        state = {"current_event": None, "notified_date": "2026-03-10"}
        eod_check(state)
        mock_merge.assert_called_once_with("2026-03-11")
        mock_notify.assert_called_once()
        assert state["notified_date"] == "2026-03-11"

    @patch("tracker.agent.send_eod_notification")
    @patch("tracker.agent.merge_events_for_date")
    @patch("tracker.agent.datetime")
    def test_fires_on_late_start(self, mock_dt, mock_merge, mock_notify):
        mock_dt.now.return_value = datetime(2026, 3, 10, 20, 0, 0)
        state = {"current_event": None, "notified_date": None}
        eod_check(state)
        mock_merge.assert_called_once_with("2026-03-10")
        mock_notify.assert_called_once()
        assert state["notified_date"] == "2026-03-10"
