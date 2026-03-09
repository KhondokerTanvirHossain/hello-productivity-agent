from unittest.mock import patch, MagicMock
from tracker.window_macos import get_active_window, SKIP_APPS


class TestSkipApps:
    def test_skip_apps_contains_finder(self):
        assert "Finder" in SKIP_APPS

    def test_skip_apps_contains_system_settings(self):
        assert "System Settings" in SKIP_APPS

    def test_skip_apps_contains_system_preferences(self):
        assert "System Preferences" in SKIP_APPS

    def test_skip_apps_contains_loginwindow(self):
        assert "loginwindow" in SKIP_APPS

    def test_skip_apps_contains_screensaver(self):
        assert "ScreenSaverEngine" in SKIP_APPS


class TestGetActiveWindow:
    @patch("tracker.window_macos._get_window_title")
    @patch("tracker.window_macos._get_active_app")
    def test_returns_app_and_title(self, mock_app, mock_title):
        mock_app.return_value = ("VS Code", 1234)
        mock_title.return_value = "main.py"
        result = get_active_window()
        assert result == ("VS Code", "main.py")

    @patch("tracker.window_macos._get_window_title")
    @patch("tracker.window_macos._get_active_app")
    def test_returns_none_for_skipped_app(self, mock_app, mock_title):
        mock_app.return_value = ("Finder", 1234)
        mock_title.return_value = "Desktop"
        result = get_active_window()
        assert result is None

    @patch("tracker.window_macos._get_window_title")
    @patch("tracker.window_macos._get_active_app")
    def test_returns_none_title_when_unavailable(self, mock_app, mock_title):
        mock_app.return_value = ("Terminal", 5678)
        mock_title.return_value = None
        result = get_active_window()
        assert result == ("Terminal", None)

    @patch("tracker.window_macos._get_active_app")
    def test_returns_none_when_no_active_app(self, mock_app):
        mock_app.return_value = None
        result = get_active_window()
        assert result is None

    @patch("tracker.window_macos._get_active_app")
    def test_returns_none_on_exception(self, mock_app):
        mock_app.side_effect = Exception("NSWorkspace error")
        result = get_active_window()
        assert result is None
