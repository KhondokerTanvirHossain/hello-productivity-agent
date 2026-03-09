# Sprint 2 Design — macOS Window Tracker Daemon

## Scope

Background daemon that polls the active macOS window every 5s and writes raw events to SQLite. Merges consecutive same-app polls into a single row (write-through with in-place update).

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `tracker/window_macos.py` | Create | Get active app name + window title via NSWorkspace + Quartz |
| `tracker/agent.py` | Create | Daemon: poll loop, event tracking state machine, SIGTERM handler |
| `tracker/db.py` | Modify | Add `update_raw_event_end()` helper |

## Design Decisions

- **Write-through, not batched** — each poll tick writes or updates SQLite immediately. Crash-safe, and WAL mode handles 12 writes/min trivially.
- **Hardcoded skip list** — Finder, System Preferences, System Settings, loginwindow, ScreenSaverEngine. No config file. Matches RULES (no config creep).
- **In-place update for same-app continuation** — if the same app+title is still active, update the existing row's `ended_at` and `duration_sec` instead of inserting a new row. Produces clean, pre-merged raw events.
- **Never crash** — all pyobjc calls wrapped in try/except. Failures log a warning and skip the tick.

## window_macos.py

**Public API:**
```
get_active_window() -> tuple[str, str | None] | None
    Returns (app_name, window_title) or None if skipped/error.
```

**Implementation:**
- `NSWorkspace.sharedWorkspace().activeApplication()` → `NSApplicationName` + PID
- `CGWindowListCopyWindowInfo` filtered by active app PID → frontmost window's `kCGWindowName`
- Skip set check → return None if app is in SKIP_APPS

**Skip set:**
```python
SKIP_APPS: set[str] = {
    "Finder",
    "System Preferences",
    "System Settings",
    "loginwindow",
    "ScreenSaverEngine",
}
```

## agent.py

**State machine:**
- Track `_current_event: dict | None` in memory (id, app_name, window_title, started_at)
- Each tick:
  - `get_active_window()` → `(app, title)` or `None`
  - Same app+title → `update_raw_event_end()` on existing row
  - Different app/title → finalize current, `insert_raw_event()` for new
  - None (skipped) → finalize current, set to None
- `time.sleep(5)` between ticks

**Graceful shutdown:**
- `signal.signal(SIGTERM, handler)` + `signal.signal(SIGINT, handler)`
- Handler sets `_running = False`
- Main loop checks `_running` each tick
- On exit: finalize current event, `close_db()`

**Entry point:** `if __name__ == "__main__": main()`

## db.py Addition

```
update_raw_event_end(event_id: int, ended_at: str, duration_sec: int) -> None
    Updates ended_at and duration_sec for an existing raw_events row.
```

## Testing Strategy

- `window_macos.py` — test skip logic and return type with mocked NSWorkspace/Quartz
- `agent.py` — test event tracking state machine: same-app continuation, app switch, skip app, shutdown. Mock `get_active_window()` and `time.sleep()`
- `update_raw_event_end` — test with `:memory:` DB

## Done Criteria

- Agent runs for 5 minutes with correct raw_events entries
- CPU < 1% (verified via `top -pid`)
- SIGTERM triggers clean shutdown
- Skipped apps produce no rows
