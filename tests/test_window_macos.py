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
    @patch("tracker.window_macos._get_window_title_quartz")
    @patch("tracker.window_macos._get_window_title_ax")
    @patch("tracker.window_macos._get_browser_info_applescript")
    @patch("tracker.window_macos._get_active_app")
    def test_returns_app_and_title_from_applescript(self, mock_app, mock_browser, mock_ax, mock_quartz):
        mock_app.return_value = ("Google Chrome", 1234)
        mock_browser.return_value = "GitHub | https://github.com"
        result = get_active_window()
        assert result == ("Google Chrome", "GitHub | https://github.com")
        mock_ax.assert_not_called()
        mock_quartz.assert_not_called()

    @patch("tracker.window_macos._get_window_title_quartz")
    @patch("tracker.window_macos._get_window_title_ax")
    @patch("tracker.window_macos._get_browser_info_applescript")
    @patch("tracker.window_macos._get_active_app")
    def test_falls_back_to_ax(self, mock_app, mock_browser, mock_ax, mock_quartz):
        mock_app.return_value = ("VS Code", 1234)
        mock_browser.return_value = None
        mock_ax.return_value = "main.py"
        result = get_active_window()
        assert result == ("VS Code", "main.py")
        mock_quartz.assert_not_called()

    @patch("tracker.window_macos._get_window_title_quartz")
    @patch("tracker.window_macos._get_window_title_ax")
    @patch("tracker.window_macos._get_browser_info_applescript")
    @patch("tracker.window_macos._get_active_app")
    def test_falls_back_to_quartz(self, mock_app, mock_browser, mock_ax, mock_quartz):
        mock_app.return_value = ("Terminal", 5678)
        mock_browser.return_value = None
        mock_ax.return_value = None
        mock_quartz.return_value = "bash"
        result = get_active_window()
        assert result == ("Terminal", "bash")

    @patch("tracker.window_macos._get_window_title_quartz")
    @patch("tracker.window_macos._get_window_title_ax")
    @patch("tracker.window_macos._get_browser_info_applescript")
    @patch("tracker.window_macos._get_active_app")
    def test_returns_none_for_skipped_app(self, mock_app, mock_browser, mock_ax, mock_quartz):
        mock_app.return_value = ("Finder", 1234)
        result = get_active_window()
        assert result is None
        mock_browser.assert_not_called()

    @patch("tracker.window_macos._get_window_title_quartz")
    @patch("tracker.window_macos._get_window_title_ax")
    @patch("tracker.window_macos._get_browser_info_applescript")
    @patch("tracker.window_macos._get_active_app")
    def test_returns_none_title_when_all_fail(self, mock_app, mock_browser, mock_ax, mock_quartz):
        mock_app.return_value = ("Terminal", 5678)
        mock_browser.return_value = None
        mock_ax.return_value = None
        mock_quartz.return_value = None
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
