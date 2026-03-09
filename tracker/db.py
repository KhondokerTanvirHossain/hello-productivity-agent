import os
import sqlite3

DEFAULT_DB_PATH: str = os.path.expanduser("~/.productivity-tracker/tracker.db")

_conn: sqlite3.Connection | None = None


def init_db(db_path: str | None = None) -> None:
    global _conn
    path = db_path or DEFAULT_DB_PATH

    if path != ":memory:":
        os.makedirs(os.path.dirname(path), exist_ok=True)

    _conn = sqlite3.connect(path, check_same_thread=False)
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


def update_raw_event_end(event_id: int, ended_at: str, duration_sec: int) -> None:
    conn = get_connection()
    conn.execute(
        "UPDATE raw_events SET ended_at = ?, duration_sec = ? WHERE id = ?",
        (ended_at, duration_sec, event_id),
    )
    conn.commit()


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


def delete_work_blocks_for_date(date: str) -> None:
    conn = get_connection()
    conn.execute("DELETE FROM work_blocks WHERE date = ?", (date,))
    conn.commit()


def update_work_block(
    block_id: int,
    category: str | None,
    note: str | None,
    user_confirmed: bool | None,
) -> dict | None:
    conn = get_connection()
    updates = []
    params = []
    if category is not None:
        updates.append("category = ?")
        params.append(category)
    if note is not None:
        updates.append("note = ?")
        params.append(note)
    if user_confirmed is not None:
        updates.append("user_confirmed = ?")
        params.append(1 if user_confirmed else 0)
    if updates:
        params.append(block_id)
        conn.execute(
            f"UPDATE work_blocks SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        conn.commit()
    cursor = conn.execute("SELECT * FROM work_blocks WHERE id = ?", (block_id,))
    row = cursor.fetchone()
    if row is None:
        return None
    return dict(row)


def get_work_blocks_for_range(start_date: str, end_date: str) -> list[dict]:
    conn = get_connection()
    cursor = conn.execute(
        "SELECT * FROM work_blocks WHERE date BETWEEN ? AND ? ORDER BY started_at",
        (start_date, end_date),
    )
    return [dict(row) for row in cursor.fetchall()]
