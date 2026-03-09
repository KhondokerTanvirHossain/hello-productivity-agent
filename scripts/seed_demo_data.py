"""Seed demo work blocks for dashboard testing."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tracker.db import init_db, get_connection
from datetime import date

def seed():
    init_db()
    conn = get_connection()
    today = date.today().isoformat()

    blocks = [
        (today, f"{today}T09:00:00", f"{today}T10:30:00", 90, "coding", "coding", 0, '["VS Code", "GitHub"]', None),
        (today, f"{today}T10:30:00", f"{today}T11:00:00", 30, "admin", "admin", 0, '["Slack"]', None),
        (today, f"{today}T11:00:00", f"{today}T12:00:00", 60, "meeting", "meeting", 0, '["Zoom"]', None),
        (today, f"{today}T13:00:00", f"{today}T14:30:00", 90, "coding", "coding", 0, '["VS Code", "Terminal"]', None),
        (today, f"{today}T14:30:00", f"{today}T15:00:00", 30, "research", "research", 0, '["Google Chrome"]', None),
        (today, f"{today}T15:00:00", f"{today}T16:00:00", 60, "planning", "planning", 0, '["Notion", "Linear"]', None),
        (today, f"{today}T16:00:00", f"{today}T17:00:00", 60, "coding", "coding", 0, '["VS Code"]', None),
        (today, f"{today}T17:00:00", f"{today}T17:30:00", 30, "admin", "admin", 0, '["Gmail", "Slack"]', None),
    ]

    conn.execute("DELETE FROM work_blocks WHERE date = ?", (today,))
    for b in blocks:
        conn.execute(
            "INSERT INTO work_blocks (date, started_at, ended_at, duration_min, category, auto_category, user_confirmed, apps_used, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            b,
        )
    conn.commit()
    print(f"Seeded {len(blocks)} work blocks for {today}")

if __name__ == "__main__":
    seed()
