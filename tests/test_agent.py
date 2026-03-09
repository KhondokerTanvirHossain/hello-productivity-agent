from unittest.mock import patch
from tracker.db import init_db, close_db, get_raw_events_for_date
from tracker.agent import poll_tick


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
