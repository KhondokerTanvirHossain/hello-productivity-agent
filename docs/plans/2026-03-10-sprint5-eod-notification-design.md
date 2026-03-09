# Sprint 5 Design — EOD Notification

## Scope

At 6pm daily, the agent merges the day's raw events into work blocks, then sends a macOS notification prompting the user to review. One new module (`notifier.py`), one modified module (`agent.py`). No `scheduler.py` — the agent handles timing.

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `tracker/notifier.py` | Send macOS notification via osascript + open review URL |
| `tracker/agent.py` | Add EOD check to poll loop |
| `tests/test_notifier.py` | Test notification command building (mock subprocess) |
| `tests/test_agent.py` | Test EOD trigger logic (mock time + notifier) |

## Design Decisions

- **No scheduler.py** — agent already runs all day with 5s poll loop. Adding a time check is trivial and avoids a second daemon.
- **Hardcoded 6pm** (`NOTIFY_HOUR = 18`) — no config complexity in Phase 1.
- **Merge then notify** — ensures work blocks are fresh when user clicks through to review.
- **Fire once per day** — `_notified_date` tracks last notification date. Fires the first time agent sees it's past 18:00. If PC was off at 6pm, fires when agent next runs.
- **Review URL** — opens `http://localhost:5173/review` (dashboard not built yet, but URL is wired now).
- **Errors never crash agent** — notifier catches all exceptions and returns False.

## notifier.py

**Public API:**
```
send_eod_notification() -> bool
```

Implementation:
1. Run `osascript -e 'display notification "Time to review your day!" with title "Productivity Tracker"'`
2. Run `open http://localhost:5173/review`
3. Return True on success, False on error
4. Log errors, never raise

## agent.py Changes

**New constant:**
```
NOTIFY_HOUR: int = 18
```

**New state key:**
```
state["notified_date"] = None
```

**New function:**
```
eod_check(state: dict) -> None
```

Logic:
1. `now = datetime.now()`
2. If `now.hour < NOTIFY_HOUR` → return
3. `today = now.strftime("%Y-%m-%d")`
4. If `state["notified_date"] == today` → return
5. `merge_events_for_date(today)`
6. `send_eod_notification()`
7. `state["notified_date"] = today`

Called every tick in the main loop, alongside `poll_tick`.

## Testing Strategy

**notifier tests (mock subprocess):**
- Verify osascript command is correct
- Verify `open` URL is called
- Verify returns True on success
- Verify returns False on subprocess error
- Verify returns False on unexpected exception

**agent EOD tests (mock datetime.now + send_eod_notification):**
- Does not fire before 18:00
- Fires at 18:00
- Does not fire twice same day
- Fires on next day (new date)
- Fires if agent starts after 18:00 (late start scenario)

## Done Criteria

Agent running past 6pm triggers macOS notification once, merges events first. Tests cover all timing edge cases.
