# Sprint 1 Design — Database & Project Setup

## Scope

Set up the Python project foundation and SQLite database layer. No agent, no API, no UI — just the data layer that everything else builds on.

## Files to Create

| File | Purpose |
|------|---------|
| `requirements.txt` | All Python deps for Phase 1 |
| `tracker/__init__.py` | Package init (empty) |
| `tracker/db.py` | SQLite schema, connection singleton, basic CRUD |

## Design Decisions

- **Module-level singleton connection** — `get_connection()` lazily creates and caches one `sqlite3.Connection`. Matches TRD requirement to keep connection open for daemon lifetime.
- **No config.py yet** — only config value needed is DB path, stored as constant in `db.py`. Add config module in Sprint 2 when agent needs poll interval, notification time, etc.
- **No write batching** — added in Sprint 2 when the agent polling loop exists.
- **No summary CRUD helpers** — added in Sprint 4 when API needs them.
- **All deps in requirements.txt upfront** — even though Sprint 1 only uses sqlite3 (stdlib), listing all deps means one `pip install` covers all sprints.

## Schema (from TRD, unchanged)

```sql
CREATE TABLE IF NOT EXISTS raw_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT NOT NULL,
    window_title TEXT,
    started_at DATETIME NOT NULL,
    ended_at DATETIME,
    duration_sec INTEGER
);

CREATE TABLE IF NOT EXISTS work_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    started_at DATETIME NOT NULL,
    ended_at DATETIME NOT NULL,
    duration_min INTEGER NOT NULL,
    category TEXT NOT NULL,
    auto_category TEXT NOT NULL,
    user_confirmed BOOLEAN DEFAULT 0,
    apps_used TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    total_tracked_min INTEGER,
    category_breakdown TEXT,
    review_completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## db.py Public API

```
init_db(db_path: str | None = None) -> None
    Creates ~/.productivity-tracker/ dir, opens connection, runs CREATE TABLE statements.
    Optional db_path for testing with :memory:.

get_connection() -> sqlite3.Connection
    Returns cached connection. Raises if init_db() not called.

close_db() -> None
    Closes connection, resets singleton.

insert_raw_event(app_name, window_title, started_at, ended_at, duration_sec) -> int
    Returns inserted row id.

get_raw_events_for_date(date: str) -> list[dict]
    Returns raw events for a given date string (YYYY-MM-DD).

insert_work_block(date, started_at, ended_at, duration_min, category, auto_category, apps_used, note) -> int
    Returns inserted row id.

get_work_blocks_for_date(date: str) -> list[dict]
    Returns work blocks for a given date string.
```

## Done Criteria

`python -c "from tracker.db import init_db; init_db()"` creates `~/.productivity-tracker/tracker.db` with all 3 tables.

## requirements.txt

```
pyobjc-framework-Cocoa
pyobjc-framework-Quartz
fastapi
uvicorn
```
