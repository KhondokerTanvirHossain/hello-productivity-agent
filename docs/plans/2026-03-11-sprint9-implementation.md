# Sprint 9: Window Title Detection — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix window title detection so the tracker captures real page titles (and URLs for Chrome/Safari), enabling the existing categorizer browser rules to fire correctly.

**Architecture:** Replace the broken Quartz `kCGWindowName` approach in `window_macos.py` with a 3-tier fallback: AppleScript for Chromium/Safari browsers (gets title + URL), Accessibility API for Firefox and other apps, Quartz as final fallback. The categorizer needs no changes — existing rules match on the richer titles automatically.

**Tech Stack:** pyobjc (AppKit, HIServices), osascript subprocess, existing Python stdlib

**Spec:** `docs/plans/2026-03-11-sprint9-window-title-detection-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `tracker/window_macos.py` | Modify | Add AppleScript browser detection, AX API fallback, update `get_active_window()` |
| `tests/test_categorizer.py` | Modify | Add tests for URL-enriched browser titles |
| `tracker/agent.py` | No change | Already consumes `(app_name, window_title)` — titles just get richer |
| `tracker/categorizer.py` | No change | Existing rules match URL strings via substring |

---

### Task 1: Add categorizer tests for URL-enriched browser titles

These tests verify the categorizer works with the new `"title | url"` format that Chrome/Safari will produce.

**Files:**
- Modify: `tests/test_categorizer.py`

- [ ] **Step 1: Add new test class `TestBrowserTitleWithUrl`**

Append to `tests/test_categorizer.py`:

```python
class TestBrowserTitleWithUrl:
    """Tests for categorizer with title | url format from AppleScript browsers."""

    def test_gmail_with_url(self):
        assert categorize("Google Chrome", "Inbox (3) - Gmail | https://mail.google.com/mail/u/0/#inbox") == "admin"

    def test_google_meet_with_url(self):
        assert categorize("Google Chrome", "Meeting Room | https://meet.google.com/abc-defg-hij") == "meeting"

    def test_github_with_url(self):
        assert categorize("Google Chrome", "Pull requests · my-org/my-repo | https://github.com/my-org/my-repo/pulls") == "coding"

    def test_stackoverflow_with_url(self):
        assert categorize("Safari", "python - How to parse JSON | https://stackoverflow.com/questions/123") == "research"

    def test_linkedin_with_url(self):
        assert categorize("Google Chrome", "Feed | LinkedIn | https://www.linkedin.com/feed/") == "bizdev"

    def test_google_docs_with_url(self):
        assert categorize("Google Chrome", "Sprint Planning Doc | https://docs.google.com/document/d/abc") == "planning"

    def test_aws_console_with_url(self):
        assert categorize("Google Chrome", "EC2 Management Console | https://console.aws.amazon.com/ec2") == "infra"

    def test_hacker_news_with_url(self):
        assert categorize("Firefox", "Hacker News | https://news.ycombinator.com") == "research"

    def test_unknown_site_with_url(self):
        assert categorize("Google Chrome", "Some Blog Post | https://example.com/blog") == "?"
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `source .venv/bin/activate && python3 -m pytest tests/test_categorizer.py::TestBrowserTitleWithUrl -v`
Expected: All 9 tests PASS (categorizer already does substring matching, URLs contain the keywords)

- [ ] **Step 3: Commit**

```bash
git add tests/test_categorizer.py
git commit -m "test: add categorizer tests for URL-enriched browser titles"
```

---

### Task 2: Add AppleScript browser title detection to window_macos.py

**Files:**
- Modify: `tracker/window_macos.py`

- [ ] **Step 1: Add `_get_browser_info_applescript` function**

Add after the `SKIP_APPS` definition (after line 11), before `_get_active_app`:

```python
import subprocess

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
```

- [ ] **Step 2: Run existing tests to verify nothing is broken**

Run: `source .venv/bin/activate && python3 -m pytest tests/ -v`
Expected: All tests PASS (new function not called yet)

- [ ] **Step 3: Commit**

```bash
git add tracker/window_macos.py
git commit -m "feat: add AppleScript browser title detection for Chrome/Safari/Arc/Brave"
```

---

### Task 3: Add Accessibility API (AXTitle) fallback to window_macos.py

**Files:**
- Modify: `tracker/window_macos.py`

- [ ] **Step 1: Add `_get_window_title_ax` function**

Add after the `_get_browser_info_applescript` function:

```python
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
```

- [ ] **Step 2: Run existing tests to verify nothing is broken**

Run: `source .venv/bin/activate && python3 -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tracker/window_macos.py
git commit -m "feat: add Accessibility API (AXTitle) window title fallback"
```

---

### Task 4: Wire up the 3-tier fallback chain in get_active_window

**Files:**
- Modify: `tracker/window_macos.py`

- [ ] **Step 1: Replace `_get_window_title` and update `get_active_window`**

Replace the existing `_get_window_title` function (lines 28-45) with:

```python
def _get_window_title_quartz(pid: int) -> str | None:
    """Get window title via Quartz API (original method, often returns empty)."""
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
```

Replace the existing `get_active_window` function (lines 48-60) with:

```python
def get_active_window() -> tuple[str, str | None] | None:
    """Get the active window's app name and title using a 3-tier fallback.

    Priority:
    1. AppleScript (Chrome/Safari/Arc/Brave — gets title + URL)
    2. Accessibility API (Firefox, VS Code, terminals — gets window title)
    3. Quartz kCGWindowName (final fallback)
    """
    try:
        app_info = _get_active_app()
        if app_info is None:
            return None
        app_name, pid = app_info
        if app_name in SKIP_APPS:
            return None

        # Tier 1: AppleScript for supported browsers
        browser_title = _get_browser_info_applescript(app_name)
        if browser_title:
            return (app_name, browser_title)

        # Tier 2: Accessibility API
        ax_title = _get_window_title_ax(pid)
        if ax_title:
            return (app_name, ax_title)

        # Tier 3: Quartz (original method)
        quartz_title = _get_window_title_quartz(pid)
        return (app_name, quartz_title)
    except Exception:
        logger.warning("Failed to get active window", exc_info=True)
        return None
```

- [ ] **Step 2: Run all tests**

Run: `source .venv/bin/activate && python3 -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 3: Manual verification — test the tracker picks up titles**

Run a quick manual test:

```bash
source .venv/bin/activate && python3 -c "
from tracker.window_macos import get_active_window
result = get_active_window()
print(f'Result: {result}')
"
```

Expected: Returns `('app_name', 'some window title')` with a non-empty title.

- [ ] **Step 4: Commit**

```bash
git add tracker/window_macos.py
git commit -m "feat: wire up 3-tier window title detection (AppleScript → AX → Quartz)"
```

---

### Task 5: Add Accessibility permission warning on startup

**Files:**
- Modify: `tracker/window_macos.py`

- [ ] **Step 1: Add `check_accessibility` function**

Add after the imports at the top of `window_macos.py`:

```python
def check_accessibility() -> bool:
    """Check if the process has Accessibility permission. Logs a warning if not."""
    try:
        import objc
        from Foundation import NSBundle

        bundle = NSBundle.bundleWithPath_(
            "/System/Library/Frameworks/ApplicationServices.framework"
            "/Frameworks/HIServices.framework"
        )
        bundle.load()
        fn: dict = {}
        objc.loadBundleFunctions(bundle, fn, [("AXIsProcessTrusted", b"Z")])
        trusted = fn["AXIsProcessTrusted"]()
        if not trusted:
            logger.warning(
                "Accessibility permission not granted. Window titles for Firefox "
                "and other apps will be empty. Grant access in System Preferences > "
                "Privacy & Security > Accessibility for the Python binary."
            )
        return trusted
    except Exception:
        logger.debug("Could not check accessibility status", exc_info=True)
        return False
```

- [ ] **Step 2: Call `check_accessibility` from agent.py on startup**

In `tracker/agent.py`, add after `init_db()` (line 90):

```python
from tracker.window_macos import check_accessibility
check_accessibility()
```

Wait — to keep agent.py's import section clean, add the import at the top with the other tracker imports. Change line 7:

```python
from tracker.window_macos import get_active_window, check_accessibility
```

Then add after `init_db()` (line 90, which becomes line 91 after import change):

```python
    check_accessibility()
```

- [ ] **Step 3: Run all tests**

Run: `source .venv/bin/activate && python3 -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add tracker/window_macos.py tracker/agent.py
git commit -m "feat: add Accessibility permission check with warning on startup"
```

---

### Task 6: Restart agent and verify end-to-end

- [ ] **Step 1: Restart the tracker agent to pick up new code**

```bash
launchctl unload ~/Library/LaunchAgents/com.productivity-tracker.agent.plist
launchctl load ~/Library/LaunchAgents/com.productivity-tracker.agent.plist
```

- [ ] **Step 2: Wait 30 seconds, then check raw events for window titles**

```bash
sqlite3 ~/.productivity-tracker/tracker.db "SELECT app_name, window_title, started_at FROM raw_events ORDER BY id DESC LIMIT 10;"
```

Expected: Recent events should now have non-empty `window_title` values, especially for browsers.

- [ ] **Step 3: Check agent logs for any errors**

```bash
cat /tmp/com.productivity-tracker.agent.log | tail -20
```

Expected: No errors related to AppleScript or AX API. May see the accessibility warning if Python doesn't have AX permission yet.

- [ ] **Step 4: Verify the live endpoint returns categorized browser blocks**

Open a browser, use it for a couple minutes, then:

```bash
curl -s http://localhost:9147/blocks/today/live | python3 -m json.tool
```

Expected: Browser blocks should now show specific categories (admin, coding, research, etc.) instead of "?" based on the page title/URL.
