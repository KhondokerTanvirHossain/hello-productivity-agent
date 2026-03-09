# Sprint 5: EOD Notification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** At 6pm daily, merge the day's raw events into work blocks, then send a macOS notification prompting the user to review their day.

**Architecture:** `notifier.py` is a standalone module that sends macOS notifications via `osascript` and opens the review URL. `agent.py` gains an `eod_check()` function called every tick that fires once per day after 18:00 — it merges events then notifies. No separate scheduler process.

**Tech Stack:** Python 3.11+, subprocess (osascript), pytest, unittest.mock

---

### Task 1: Notifier — Tests First

**Files:**
- Create: `tests/test_notifier.py`

**Step 1: Write failing tests**

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `source .venv/bin/activate && python -m pytest tests/test_notifier.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'tracker.notifier'`

---

### Task 2: Notifier — Implementation

**Files:**
- Create: `tracker/notifier.py`

**Step 1: Write implementation**

```python
import logging
import subprocess

logger = logging.getLogger(__name__)

REVIEW_URL: str = "http://localhost:5173/review"


def send_eod_notification() -> bool:
    try:
        subprocess.run(
            [
                "osascript",
                "-e",
                'display notification "Time to review your day!" with title "Productivity Tracker"',
            ],
            check=False,
        )
        subprocess.run(["open", REVIEW_URL], check=False)
        return True
    except Exception:
        logger.warning("Failed to send EOD notification", exc_info=True)
        return False
```

**Step 2: Run all notifier tests**

Run: `source .venv/bin/activate && python -m pytest tests/test_notifier.py -v`
Expected: All 6 tests PASS

**Step 3: Run full test suite**

Run: `source .venv/bin/activate && python -m pytest tests/ -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add tracker/notifier.py tests/test_notifier.py
git commit -m "feat: add macOS EOD notification via osascript"
```

---

### Task 3: Agent EOD Check — Tests First

**Files:**
- Modify: `tests/test_agent.py`

**Step 1: Add EOD tests**

Add to the import line in `tests/test_agent.py`:
- Import `eod_check` from `tracker.agent`
- Import `MagicMock` from `unittest.mock`

Append this test class to `tests/test_agent.py`:

```python
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
```

Also add `from datetime import datetime` to the imports at the top.

**Step 2: Run tests to verify they fail**

Run: `source .venv/bin/activate && python -m pytest tests/test_agent.py::TestEodCheck -v`
Expected: FAIL — `ImportError: cannot import name 'eod_check'`

---

### Task 4: Agent EOD Check — Implementation

**Files:**
- Modify: `tracker/agent.py`

**Step 1: Add imports and constant**

Add to the imports in `tracker/agent.py`:

```python
from tracker.merger import merge_events_for_date
from tracker.notifier import send_eod_notification
```

Add after `POLL_INTERVAL`:

```python
NOTIFY_HOUR: int = 18
```

**Step 2: Add eod_check function**

Add after `poll_tick` function:

```python
def eod_check(state: dict) -> None:
    now = datetime.now()
    if now.hour < NOTIFY_HOUR:
        return
    today = now.strftime("%Y-%m-%d")
    if state.get("notified_date") == today:
        return
    logger.info("EOD trigger: merging events and sending notification")
    merge_events_for_date(today)
    send_eod_notification()
    state["notified_date"] = today
```

**Step 3: Update main() to use eod_check**

In `tracker/agent.py`, update the `main()` function:

Change the state initialization from:
```python
    state: dict = {"current_event": None}
```
to:
```python
    state: dict = {"current_event": None, "notified_date": None}
```

Change the main loop from:
```python
        while _running:
            try:
                poll_tick(state)
            except Exception:
                logger.warning("Error in poll tick", exc_info=True)
            time.sleep(POLL_INTERVAL)
```
to:
```python
        while _running:
            try:
                poll_tick(state)
            except Exception:
                logger.warning("Error in poll tick", exc_info=True)
            try:
                eod_check(state)
            except Exception:
                logger.warning("Error in EOD check", exc_info=True)
            time.sleep(POLL_INTERVAL)
```

**Step 4: Run all agent tests**

Run: `source .venv/bin/activate && python -m pytest tests/test_agent.py -v`
Expected: All 11 tests PASS (6 existing + 5 new)

**Step 5: Run full test suite**

Run: `source .venv/bin/activate && python -m pytest tests/ -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add tracker/agent.py tests/test_agent.py
git commit -m "feat: add EOD merge + notification trigger to agent"
```

---

### Task 5: Integration Verification

**Step 1: Run complete test suite**

Run: `source .venv/bin/activate && python -m pytest tests/ -v`
Expected: All tests PASS

**Step 2: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: Sprint 5 complete — EOD notification at 6pm"
```

---

## Task Dependency Graph

```
Task 1 (notifier tests) → Task 2 (notifier implementation)
                                    ↓
Task 3 (agent EOD tests) → Task 4 (agent EOD implementation)
                                    ↓
                             Task 5 (integration verification)
```

Tasks 1-2 are independent from the agent. Tasks 3-4 depend on notifier being complete. Task 5 is final verification.
