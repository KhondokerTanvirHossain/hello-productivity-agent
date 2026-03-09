# Sprint 1: Database & Project Setup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the SQLite data layer (schema + CRUD helpers) that all future sprints build on.

**Architecture:** Module-level singleton connection in `tracker/db.py`. Three tables (raw_events, work_blocks, daily_summaries) created via `CREATE TABLE IF NOT EXISTS`. CRUD helpers return row IDs on insert and `list[dict]` on query. Tests use `:memory:` SQLite databases.

**Tech Stack:** Python 3.11+, sqlite3 (stdlib), pytest

---

### Task 1: Project Foundation Files

**Files:**
- Create: `requirements.txt`
- Create: `tracker/__init__.py`
- Create: `tests/__init__.py`

**Step 1: Create requirements.txt**

```
pyobjc-framework-Cocoa
pyobjc-framework-Quartz
fastapi
uvicorn
```

**Step 2: Create empty package inits**

```python
# tracker/__init__.py — empty
```

```python
# tests/__init__.py — empty
```

**Step 3: Install test dependency**

Run: `pip install pytest`

**Step 4: Commit**

```bash
git add requirements.txt tracker/__init__.py tests/__init__.py
git commit -m "chore: add requirements.txt and package inits for Sprint 1"
```

---

### Task 2: Schema Init + Connection Singleton — Tests First

**Files:**
- Create: `tests/test_db.py`

**Step 1: Write failing tests for init_db, get_connection, close_db**

```python
import sqlite3
import pytest
from tracker.db import init_db, get_connection, close_db


class TestInitDb:
    def setup_method(self):
        """Use :memory: DB for each test."""
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_init_creates_raw_events_table(self):
        conn = get_connection()
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='raw_events'"
        )
        assert cursor.fetchone() is not None

    def test_init_creates_work_blocks_table(self):
        conn = get_connection()
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='work_blocks'"
        )
        assert cursor.fetchone() is not None

    def test_init_creates_daily_summaries_table(self):
        conn = get_connection()
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_summaries'"
        )
        assert cursor.fetchone() is not None

    def test_get_connection_returns_same_connection(self):
        conn1 = get_connection()
        conn2 = get_connection()
        assert conn1 is conn2

    def test_get_connection_before_init_raises(self):
        close_db()
        with pytest.raises(RuntimeError):
            get_connection()

    def test_close_db_resets_connection(self):
        close_db()
        with pytest.raises(RuntimeError):
            get_connection()

    def test_init_db_idempotent(self):
        init_db(":memory:")  # second call should not crash
        conn = get_connection()
        assert conn is not None
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/tanvirhossain/Documents/projects/github/hello-prodcutivity-agent && python -m pytest tests/test_db.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'tracker.db'`

---

### Task 3: Schema Init + Connection Singleton — Implementation

**Files:**
- Create: `tracker/db.py`

**Step 1: Implement init_db, get_connection, close_db**

```python
import os
import sqlite3

DEFAULT_DB_PATH: str = os.path.expanduser("~/.productivity-tracker/tracker.db")

_conn: sqlite3.Connection | None = None


def init_db(db_path: str | None = None) -> None:
    global _conn
    path = db_path or DEFAULT_DB_PATH

    if path != ":memory:":
        os.makedirs(os.path.dirname(path), exist_ok=True)

    _conn = sqlite3.connect(path)
    _conn.row_factory = sqlite3.Row
    _conn.execute("PRAGMA journal_mode=WAL")

    _conn.executescript("""
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
    """)


def get_connection() -> sqlite3.Connection:
    if _conn is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _conn


def close_db() -> None:
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None
```

**Step 2: Run tests to verify they pass**

Run: `cd /Users/tanvirhossain/Documents/projects/github/hello-prodcutivity-agent && python -m pytest tests/test_db.py -v`
Expected: All 7 tests PASS

**Step 3: Commit**

```bash
git add tracker/db.py tests/test_db.py
git commit -m "feat: add SQLite schema init and connection singleton"
```

---

### Task 4: insert_raw_event + get_raw_events_for_date — Tests First

**Files:**
- Modify: `tests/test_db.py`

**Step 1: Add failing tests for raw event CRUD**

Append to `tests/test_db.py`:

```python
from tracker.db import insert_raw_event, get_raw_events_for_date


class TestRawEvents:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_insert_raw_event_returns_id(self):
        row_id = insert_raw_event(
            app_name="VS Code",
            window_title="main.py",
            started_at="2026-03-10T09:00:00",
            ended_at="2026-03-10T09:05:00",
            duration_sec=300,
        )
        assert row_id == 1

    def test_insert_multiple_returns_incrementing_ids(self):
        id1 = insert_raw_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:05:00", 300)
        id2 = insert_raw_event("Slack", None, "2026-03-10T09:05:00", "2026-03-10T09:07:00", 120)
        assert id2 == id1 + 1

    def test_get_raw_events_for_date_returns_matching(self):
        insert_raw_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:05:00", 300)
        insert_raw_event("Slack", None, "2026-03-11T10:00:00", "2026-03-11T10:02:00", 120)

        events = get_raw_events_for_date("2026-03-10")
        assert len(events) == 1
        assert events[0]["app_name"] == "VS Code"

    def test_get_raw_events_for_date_empty(self):
        events = get_raw_events_for_date("2026-03-10")
        assert events == []

    def test_raw_event_fields_complete(self):
        insert_raw_event("Terminal", "ssh prod", "2026-03-10T14:00:00", "2026-03-10T14:30:00", 1800)
        events = get_raw_events_for_date("2026-03-10")
        event = events[0]
        assert event["app_name"] == "Terminal"
        assert event["window_title"] == "ssh prod"
        assert event["started_at"] == "2026-03-10T14:00:00"
        assert event["ended_at"] == "2026-03-10T14:30:00"
        assert event["duration_sec"] == 1800
```

**Step 2: Run to verify failures**

Run: `python -m pytest tests/test_db.py::TestRawEvents -v`
Expected: FAIL — `ImportError: cannot import name 'insert_raw_event'`

---

### Task 5: insert_raw_event + get_raw_events_for_date — Implementation

**Files:**
- Modify: `tracker/db.py`

**Step 1: Add raw event CRUD functions to db.py**

Append to `tracker/db.py`:

```python
def insert_raw_event(
    app_name: str,
    window_title: str | None,
    started_at: str,
    ended_at: str | None,
    duration_sec: int | None,
) -> int:
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO raw_events (app_name, window_title, started_at, ended_at, duration_sec) VALUES (?, ?, ?, ?, ?)",
        (app_name, window_title, started_at, ended_at, duration_sec),
    )
    conn.commit()
    return cursor.lastrowid


def get_raw_events_for_date(date: str) -> list[dict]:
    conn = get_connection()
    cursor = conn.execute(
        "SELECT * FROM raw_events WHERE DATE(started_at) = ?",
        (date,),
    )
    return [dict(row) for row in cursor.fetchall()]
```

**Step 2: Run tests**

Run: `python -m pytest tests/test_db.py -v`
Expected: All 12 tests PASS (7 schema + 5 raw events)

**Step 3: Commit**

```bash
git add tracker/db.py tests/test_db.py
git commit -m "feat: add insert_raw_event and get_raw_events_for_date"
```

---

### Task 6: insert_work_block + get_work_blocks_for_date — Tests First

**Files:**
- Modify: `tests/test_db.py`

**Step 1: Add failing tests for work block CRUD**

Append to `tests/test_db.py`:

```python
import json
from tracker.db import insert_work_block, get_work_blocks_for_date


class TestWorkBlocks:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_insert_work_block_returns_id(self):
        row_id = insert_work_block(
            date="2026-03-10",
            started_at="2026-03-10T09:00:00",
            ended_at="2026-03-10T10:30:00",
            duration_min=90,
            category="coding",
            auto_category="coding",
            apps_used=json.dumps(["VS Code", "Terminal"]),
            note=None,
        )
        assert row_id == 1

    def test_get_work_blocks_for_date(self):
        insert_work_block(
            date="2026-03-10",
            started_at="2026-03-10T09:00:00",
            ended_at="2026-03-10T10:30:00",
            duration_min=90,
            category="coding",
            auto_category="coding",
            apps_used=json.dumps(["VS Code"]),
            note="Morning coding session",
        )
        insert_work_block(
            date="2026-03-11",
            started_at="2026-03-11T09:00:00",
            ended_at="2026-03-11T10:00:00",
            duration_min=60,
            category="meeting",
            auto_category="meeting",
            apps_used=json.dumps(["Zoom"]),
            note=None,
        )

        blocks = get_work_blocks_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"
        assert blocks[0]["duration_min"] == 90
        assert blocks[0]["note"] == "Morning coding session"

    def test_get_work_blocks_for_date_empty(self):
        blocks = get_work_blocks_for_date("2026-03-10")
        assert blocks == []

    def test_work_block_apps_used_is_json_string(self):
        insert_work_block(
            date="2026-03-10",
            started_at="2026-03-10T09:00:00",
            ended_at="2026-03-10T10:30:00",
            duration_min=90,
            category="coding",
            auto_category="coding",
            apps_used=json.dumps(["VS Code", "Terminal"]),
            note=None,
        )
        blocks = get_work_blocks_for_date("2026-03-10")
        apps = json.loads(blocks[0]["apps_used"])
        assert apps == ["VS Code", "Terminal"]

    def test_work_block_user_confirmed_defaults_false(self):
        insert_work_block(
            date="2026-03-10",
            started_at="2026-03-10T09:00:00",
            ended_at="2026-03-10T10:30:00",
            duration_min=90,
            category="coding",
            auto_category="coding",
            apps_used=json.dumps(["VS Code"]),
            note=None,
        )
        blocks = get_work_blocks_for_date("2026-03-10")
        assert blocks[0]["user_confirmed"] == 0
```

**Step 2: Run to verify failures**

Run: `python -m pytest tests/test_db.py::TestWorkBlocks -v`
Expected: FAIL — `ImportError: cannot import name 'insert_work_block'`

---

### Task 7: insert_work_block + get_work_blocks_for_date — Implementation

**Files:**
- Modify: `tracker/db.py`

**Step 1: Add work block CRUD functions to db.py**

Append to `tracker/db.py`:

```python
def insert_work_block(
    date: str,
    started_at: str,
    ended_at: str,
    duration_min: int,
    category: str,
    auto_category: str,
    apps_used: str | None,
    note: str | None,
) -> int:
    conn = get_connection()
    cursor = conn.execute(
        """INSERT INTO work_blocks
        (date, started_at, ended_at, duration_min, category, auto_category, apps_used, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (date, started_at, ended_at, duration_min, category, auto_category, apps_used, note),
    )
    conn.commit()
    return cursor.lastrowid


def get_work_blocks_for_date(date: str) -> list[dict]:
    conn = get_connection()
    cursor = conn.execute(
        "SELECT * FROM work_blocks WHERE date = ?",
        (date,),
    )
    return [dict(row) for row in cursor.fetchall()]
```

**Step 2: Run all tests**

Run: `python -m pytest tests/test_db.py -v`
Expected: All 17 tests PASS (7 schema + 5 raw events + 5 work blocks)

**Step 3: Commit**

```bash
git add tracker/db.py tests/test_db.py
git commit -m "feat: add insert_work_block and get_work_blocks_for_date"
```

---

### Task 8: Smoke Test — Done Criteria Verification

**Step 1: Run the done criteria command**

Run: `python -c "from tracker.db import init_db; init_db()"`
Expected: No error. File exists at `~/.productivity-tracker/tracker.db`.

**Step 2: Verify tables with sqlite3 CLI**

Run: `sqlite3 ~/.productivity-tracker/tracker.db ".tables"`
Expected output: `daily_summaries  raw_events       work_blocks`

**Step 3: Run full test suite one final time**

Run: `python -m pytest tests/test_db.py -v`
Expected: All 17 tests PASS

**Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: Sprint 1 complete — database foundation"
```

---

## Task Dependency Graph

```
Task 1 (foundation files)
    ↓
Task 2 (schema tests) → Task 3 (schema implementation)
                              ↓
Task 4 (raw event tests) → Task 5 (raw event implementation)
                                    ↓
Task 6 (work block tests) → Task 7 (work block implementation)
                                      ↓
                               Task 8 (smoke test)
```

All tasks are sequential — each depends on the previous.
