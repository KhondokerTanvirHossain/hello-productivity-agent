from unittest.mock import patch, call
from tracker.notifier import send_eod_notification, REVIEW_URL


class TestSendEodNotification:
    @patch("tracker.notifier.subprocess.run")
    def test_sends_osascript_notification(self, mock_run):
        send_eod_notification()
        osascript_call = mock_run.call_args_list[0]
        args = osascript_call[0][0]
        assert args[0] == "osascript"
        assert args[1] == "-e"
        assert "Productivity Tracker" in args[2]
        assert "Time to review your day" in args[2]

    @patch("tracker.notifier.subprocess.run")
    def test_opens_review_url(self, mock_run):
        send_eod_notification()
        open_call = mock_run.call_args_list[1]
        args = open_call[0][0]
        assert args[0] == "open"
        assert args[1] == REVIEW_URL

    @patch("tracker.notifier.subprocess.run")
    def test_returns_true_on_success(self, mock_run):
        result = send_eod_notification()
        assert result is True

    @patch("tracker.notifier.subprocess.run")
    def test_returns_false_on_subprocess_error(self, mock_run):
        mock_run.side_effect = FileNotFoundError("osascript not found")
        result = send_eod_notification()
        assert result is False

    @patch("tracker.notifier.subprocess.run")
    def test_returns_false_on_unexpected_error(self, mock_run):
        mock_run.side_effect = RuntimeError("unexpected")
        result = send_eod_notification()
        assert result is False

    @patch("tracker.notifier.subprocess.run")
    def test_calls_subprocess_twice(self, mock_run):
        send_eod_notification()
        assert mock_run.call_count == 2
