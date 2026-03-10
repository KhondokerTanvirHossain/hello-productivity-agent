import logging
import subprocess

logger = logging.getLogger(__name__)

SKIP_APPS: set[str] = {
    "Finder",
    "System Preferences",
    "System Settings",
    "loginwindow",
    "ScreenSaverEngine",
}

# Browsers that support AppleScript for tab title + URL
_APPLESCRIPT_BROWSERS: dict[str, tuple[str, str]] = {
    "Google Chrome": (
        'tell application "Google Chrome" to if (count of windows) > 0 then return title of active tab of front window',
        'tell application "Google Chrome" to if (count of windows) > 0 then return URL of active tab of front window',
    ),
    "Safari": (
        'tell application "Safari" to if (count of documents) > 0 then return name of front document',
        'tell application "Safari" to if (count of documents) > 0 then return URL of front document',
    ),
    "Arc": (
        'tell application "Arc" to if (count of windows) > 0 then return title of active tab of front window',
        'tell application "Arc" to if (count of windows) > 0 then return URL of active tab of front window',
    ),
    "Brave Browser": (
        'tell application "Brave Browser" to if (count of windows) > 0 then return title of active tab of front window',
        'tell application "Brave Browser" to if (count of windows) > 0 then return URL of active tab of front window',
    ),
}


def _run_osascript(script: str) -> str | None:
    """Run an AppleScript and return stdout, or None on failure."""
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, text=True, timeout=2,
        )
        text = result.stdout.strip()
        return text if text else None
    except Exception:
        return None


def _get_browser_info_applescript(app_name: str) -> str | None:
    """Get browser tab title + URL via AppleScript. Returns 'title | url' or just 'title'."""
    scripts = _APPLESCRIPT_BROWSERS.get(app_name)
    if scripts is None:
        return None
    title_script, url_script = scripts
    title = _run_osascript(title_script)
    if title is None:
        return None
    url = _run_osascript(url_script)
    if url:
        return f"{title} | {url}"
    return title


def _get_window_title_ax(pid: int) -> str | None:
    """Get window title via macOS Accessibility API. Requires Accessibility permission."""
    try:
        import objc
        from Foundation import NSBundle

        bundle = NSBundle.bundleWithPath_(
            "/System/Library/Frameworks/ApplicationServices.framework"
            "/Frameworks/HIServices.framework"
        )
        if not bundle.load():
            return None

        fn: dict = {}
        objc.loadBundleFunctions(bundle, fn, [
            ("AXUIElementCreateApplication", b"@i"),
            ("AXUIElementCopyAttributeValue", b"i@@o^@"),
        ])

        app_ref = fn["AXUIElementCreateApplication"](pid)
        err, windows = fn["AXUIElementCopyAttributeValue"](app_ref, "AXWindows", None)
        if err != 0 or not windows or len(windows) == 0:
            return None

        err, title = fn["AXUIElementCopyAttributeValue"](windows[0], "AXTitle", None)
        if err != 0 or not title:
            return None

        return str(title)
    except Exception:
        logger.debug("AX API failed for pid %d", pid, exc_info=True)
        return None


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
