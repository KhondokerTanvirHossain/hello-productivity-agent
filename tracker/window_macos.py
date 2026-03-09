import logging

logger = logging.getLogger(__name__)

SKIP_APPS: set[str] = {
    "Finder",
    "System Preferences",
    "System Settings",
    "loginwindow",
    "ScreenSaverEngine",
}


def _get_active_app() -> tuple[str, int] | None:
    from AppKit import NSWorkspace

    workspace = NSWorkspace.sharedWorkspace()
    active_app = workspace.activeApplication()
    if active_app is None:
        return None
    app_name = active_app.get("NSApplicationName")
    pid = active_app.get("NSApplicationProcessIdentifier")
    if app_name is None or pid is None:
        return None
    return (app_name, pid)


def _get_window_title(pid: int) -> str | None:
    from Quartz import (
        CGWindowListCopyWindowInfo,
        kCGWindowListOptionOnScreenOnly,
        kCGNullWindowID,
    )

    window_list = CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly, kCGNullWindowID
    )
    if window_list is None:
        return None
    for window in window_list:
        if window.get("kCGWindowOwnerPID") == pid:
            title = window.get("kCGWindowName")
            if title:
                return title
    return None


def get_active_window() -> tuple[str, str | None] | None:
    try:
        app_info = _get_active_app()
        if app_info is None:
            return None
        app_name, pid = app_info
        if app_name in SKIP_APPS:
            return None
        title = _get_window_title(pid)
        return (app_name, title)
    except Exception:
        logger.warning("Failed to get active window", exc_info=True)
        return None
