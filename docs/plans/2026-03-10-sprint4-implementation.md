# Sprint 4: FastAPI Server — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a FastAPI REST API exposing work blocks and weekly summaries for the React dashboard, with 3 endpoints: today's blocks, weekly summary, and block update.

**Architecture:** `api/server.py` creates the FastAPI app with CORS and DB lifecycle hooks. `api/routes.py` defines an APIRouter with 3 endpoints that call db.py helpers. Two new db.py helpers (`update_work_block`, `get_work_blocks_for_range`) support the PATCH and weekly summary endpoints. Server runs on port 9147.

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, httpx (for TestClient), sqlite3, pytest

---

### Task 1: Install Dependencies

**Step 1: Install FastAPI, uvicorn, and httpx**

Run: `source .venv/bin/activate && pip install fastapi uvicorn httpx`

**Step 2: Verify installation**

Run: `source .venv/bin/activate && python -c "import fastapi; import uvicorn; import httpx; print('OK')"`
Expected: `OK`

---

### Task 2: New DB Helpers — Tests First

**Files:**
- Modify: `tests/test_db.py`

**Step 1: Write failing tests**

Add to the import line in `tests/test_db.py` — append `update_work_block, get_work_blocks_for_range` to the existing import.

Append these test classes to `tests/test_db.py`:

```python
class TestUpdateWorkBlock:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_update_category(self):
        block_id = insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        result = update_work_block(block_id, category="meeting", note=None, user_confirmed=None)
        assert result is not None
        assert result["category"] == "meeting"
        assert result["auto_category"] == "coding"  # unchanged

    def test_update_note(self):
        block_id = insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        result = update_work_block(block_id, category=None, note="Sprint planning", user_confirmed=None)
        assert result["note"] == "Sprint planning"
        assert result["category"] == "coding"  # unchanged

    def test_update_user_confirmed(self):
        block_id = insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        result = update_work_block(block_id, category=None, note=None, user_confirmed=True)
        assert result["user_confirmed"] == 1

    def test_update_multiple_fields(self):
        block_id = insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        result = update_work_block(block_id, category="meeting", note="Standup", user_confirmed=True)
        assert result["category"] == "meeting"
        assert result["note"] == "Standup"
        assert result["user_confirmed"] == 1

    def test_update_nonexistent_returns_none(self):
        result = update_work_block(999, category="meeting", note=None, user_confirmed=None)
        assert result is None

    def test_update_no_fields_returns_unchanged(self):
        block_id = insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        result = update_work_block(block_id, category=None, note=None, user_confirmed=None)
        assert result is not None
        assert result["category"] == "coding"


class TestGetWorkBlocksForRange:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_returns_blocks_in_range(self):
        insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        insert_work_block("2026-03-11", "2026-03-11T09:00:00", "2026-03-11T10:00:00", 60, "meeting", "meeting", '["Zoom"]', None)
        insert_work_block("2026-03-12", "2026-03-12T09:00:00", "2026-03-12T10:00:00", 60, "admin", "admin", '["Slack"]', None)
        blocks = get_work_blocks_for_range("2026-03-10", "2026-03-11")
        assert len(blocks) == 2

    def test_excludes_blocks_outside_range(self):
        insert_work_block("2026-03-09", "2026-03-09T09:00:00", "2026-03-09T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "meeting", "meeting", '["Zoom"]', None)
        blocks = get_work_blocks_for_range("2026-03-10", "2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "meeting"

    def test_returns_empty_for_no_blocks(self):
        blocks = get_work_blocks_for_range("2026-03-10", "2026-03-16")
        assert blocks == []

    def test_ordered_by_started_at(self):
        insert_work_block("2026-03-10", "2026-03-10T14:00:00", "2026-03-10T15:00:00", 60, "meeting", "meeting", '["Zoom"]', None)
        insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        blocks = get_work_blocks_for_range("2026-03-10", "2026-03-10")
        assert blocks[0]["started_at"] == "2026-03-10T09:00:00"
        assert blocks[1]["started_at"] == "2026-03-10T14:00:00"
```

**Step 2: Run tests to verify they fail**

Run: `source .venv/bin/activate && python -m pytest tests/test_db.py::TestUpdateWorkBlock -v`
Expected: FAIL — `ImportError: cannot import name 'update_work_block'`

---

### Task 3: New DB Helpers — Implementation

**Files:**
- Modify: `tracker/db.py` (append after `delete_work_blocks_for_date`)

**Step 1: Write implementation**

Append to `tracker/db.py`:

```python
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
```

**Step 2: Run all db tests**

Run: `source .venv/bin/activate && python -m pytest tests/test_db.py -v`
Expected: All tests PASS (22 existing + 10 new)

**Step 3: Commit**

```bash
git add tracker/db.py tests/test_db.py
git commit -m "feat: add update_work_block and get_work_blocks_for_range helpers"
```

---

### Task 4: API Server + Routes — Tests First

**Files:**
- Create: `tests/test_api.py`

**Step 1: Write failing tests**

```python
import json
from fastapi.testclient import TestClient
from tracker.db import init_db, close_db, insert_work_block
from api.server import app


def _setup_db():
    init_db(":memory:")


def _teardown_db():
    close_db()


class TestGetBlocksToday:
    def setup_method(self):
        _setup_db()
        self.client = TestClient(app, raise_server_exceptions=False)

    def teardown_method(self):
        _teardown_db()

    def test_returns_empty_blocks(self):
        response = self.client.get("/blocks/today")
        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        assert data["blocks"] == []

    def test_returns_todays_blocks(self):
        from datetime import date
        today = date.today().isoformat()
        insert_work_block(today, f"{today}T09:00:00", f"{today}T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        response = self.client.get("/blocks/today")
        assert response.status_code == 200
        data = response.json()
        assert len(data["blocks"]) == 1
        assert data["blocks"][0]["category"] == "coding"

    def test_apps_used_is_parsed_array(self):
        from datetime import date
        today = date.today().isoformat()
        insert_work_block(today, f"{today}T09:00:00", f"{today}T10:00:00", 60, "coding", "coding", '["VS Code", "Terminal"]', None)
        response = self.client.get("/blocks/today")
        data = response.json()
        assert data["blocks"][0]["apps_used"] == ["VS Code", "Terminal"]

    def test_user_confirmed_is_boolean(self):
        from datetime import date
        today = date.today().isoformat()
        insert_work_block(today, f"{today}T09:00:00", f"{today}T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        response = self.client.get("/blocks/today")
        data = response.json()
        assert data["blocks"][0]["user_confirmed"] is False


class TestGetSummaryWeek:
    def setup_method(self):
        _setup_db()
        self.client = TestClient(app, raise_server_exceptions=False)

    def teardown_method(self):
        _teardown_db()

    def test_returns_empty_week(self):
        response = self.client.get("/summary/week")
        assert response.status_code == 200
        data = response.json()
        assert "start_date" in data
        assert "end_date" in data
        assert data["total_tracked_min"] == 0
        assert data["category_breakdown"] == {}

    def test_returns_weekly_summary_with_data(self):
        insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        insert_work_block("2026-03-10", "2026-03-10T10:00:00", "2026-03-10T11:00:00", 60, "meeting", "meeting", '["Zoom"]', None)
        insert_work_block("2026-03-11", "2026-03-11T09:00:00", "2026-03-11T10:30:00", 90, "coding", "coding", '["VS Code"]', None)
        response = self.client.get("/summary/week?date=2026-03-10")
        assert response.status_code == 200
        data = response.json()
        assert data["total_tracked_min"] == 210
        assert data["category_breakdown"]["coding"] == 150
        assert data["category_breakdown"]["meeting"] == 60

    def test_daily_breakdown(self):
        insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        response = self.client.get("/summary/week?date=2026-03-10")
        data = response.json()
        assert len(data["daily"]) == 7
        day = next(d for d in data["daily"] if d["date"] == "2026-03-10")
        assert day["total_min"] == 60
        assert day["breakdown"]["coding"] == 60

    def test_custom_date_param(self):
        response = self.client.get("/summary/week?date=2026-03-12")
        assert response.status_code == 200
        data = response.json()
        assert data["start_date"] == "2026-03-09"
        assert data["end_date"] == "2026-03-15"


class TestPatchBlock:
    def setup_method(self):
        _setup_db()
        self.client = TestClient(app, raise_server_exceptions=False)

    def teardown_method(self):
        _teardown_db()

    def test_update_category(self):
        block_id = insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        response = self.client.patch(f"/blocks/{block_id}", json={"category": "meeting"})
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "meeting"
        assert data["auto_category"] == "coding"

    def test_update_note(self):
        block_id = insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        response = self.client.patch(f"/blocks/{block_id}", json={"note": "Sprint planning"})
        assert response.status_code == 200
        assert response.json()["note"] == "Sprint planning"

    def test_update_user_confirmed(self):
        block_id = insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        response = self.client.patch(f"/blocks/{block_id}", json={"user_confirmed": True})
        assert response.status_code == 200
        assert response.json()["user_confirmed"] is True

    def test_partial_update(self):
        block_id = insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        response = self.client.patch(f"/blocks/{block_id}", json={"note": "test"})
        assert response.status_code == 200
        data = response.json()
        assert data["note"] == "test"
        assert data["category"] == "coding"

    def test_404_for_missing_block(self):
        response = self.client.patch("/blocks/999", json={"category": "meeting"})
        assert response.status_code == 404
```

**Step 2: Run tests to verify they fail**

Run: `source .venv/bin/activate && python -m pytest tests/test_api.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api'`

---

### Task 5: API Server + Routes — Implementation

**Files:**
- Create: `api/__init__.py`
- Create: `api/server.py`
- Create: `api/routes.py`

**Step 1: Create package marker**

Create `api/__init__.py` as an empty file.

**Step 2: Write routes.py**

```python
import json
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from tracker.db import get_work_blocks_for_date, get_work_blocks_for_range, update_work_block

router = APIRouter()


def _format_block(block: dict) -> dict:
    apps_raw = block.get("apps_used")
    apps_list = json.loads(apps_raw) if apps_raw else []
    return {
        "id": block["id"],
        "date": block["date"],
        "started_at": block["started_at"],
        "ended_at": block["ended_at"],
        "duration_min": block["duration_min"],
        "category": block["category"],
        "auto_category": block["auto_category"],
        "user_confirmed": bool(block["user_confirmed"]),
        "apps_used": apps_list,
        "note": block.get("note"),
    }


@router.get("/blocks/today")
def get_blocks_today():
    today = date.today().isoformat()
    blocks = get_work_blocks_for_date(today)
    return {
        "date": today,
        "blocks": [_format_block(b) for b in blocks],
    }


def _week_bounds(d: date) -> tuple[date, date]:
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


@router.get("/summary/week")
def get_summary_week(date: str | None = None):
    if date:
        target = __import__("datetime").date.fromisoformat(date)
    else:
        target = __import__("datetime").date.today()

    monday, sunday = _week_bounds(target)
    blocks = get_work_blocks_for_range(monday.isoformat(), sunday.isoformat())

    total_min = sum(b["duration_min"] for b in blocks)
    category_breakdown: dict[str, int] = {}
    for b in blocks:
        category_breakdown[b["category"]] = category_breakdown.get(b["category"], 0) + b["duration_min"]

    daily = []
    for i in range(7):
        day = monday + timedelta(days=i)
        day_str = day.isoformat()
        day_blocks = [b for b in blocks if b["date"] == day_str]
        day_total = sum(b["duration_min"] for b in day_blocks)
        day_breakdown: dict[str, int] = {}
        for b in day_blocks:
            day_breakdown[b["category"]] = day_breakdown.get(b["category"], 0) + b["duration_min"]
        daily.append({
            "date": day_str,
            "total_min": day_total,
            "breakdown": day_breakdown,
        })

    return {
        "start_date": monday.isoformat(),
        "end_date": sunday.isoformat(),
        "total_tracked_min": total_min,
        "category_breakdown": category_breakdown,
        "daily": daily,
    }


class BlockUpdate(BaseModel):
    category: str | None = None
    note: str | None = None
    user_confirmed: bool | None = None


@router.patch("/blocks/{block_id}")
def patch_block(block_id: int, body: BlockUpdate):
    result = update_work_block(
        block_id,
        category=body.category,
        note=body.note,
        user_confirmed=body.user_confirmed,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Block not found")
    return _format_block(result)
```

**Step 3: Write server.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from tracker.db import init_db, close_db
from api.routes import router

app = FastAPI(title="Productivity Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


@app.on_event("shutdown")
def shutdown():
    close_db()


app.include_router(router)
```

**Step 4: Run all API tests**

Run: `source .venv/bin/activate && python -m pytest tests/test_api.py -v`
Expected: All tests PASS

**Step 5: Run full test suite**

Run: `source .venv/bin/activate && python -m pytest tests/ -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add api/__init__.py api/server.py api/routes.py tests/test_api.py
git commit -m "feat: add FastAPI server with blocks and summary endpoints"
```

---

### Task 6: Smoke Test

**Step 1: Start the server**

Run: `source .venv/bin/activate && uvicorn api.server:app --port 9147`

**Step 2: Test endpoints with curl (in another terminal)**

```bash
# Today's blocks (likely empty unless agent has been running)
curl -s http://localhost:9147/blocks/today | python -m json.tool

# Weekly summary
curl -s "http://localhost:9147/summary/week?date=2026-03-10" | python -m json.tool

# Check CORS headers
curl -s -I -X OPTIONS http://localhost:9147/blocks/today \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"
```

Expected: JSON responses with correct structure. CORS headers present.

**Step 3: Stop server (Ctrl+C)**

**Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: Sprint 4 complete — FastAPI server on port 9147"
```

---

## Task Dependency Graph

```
Task 1 (install deps)
       ↓
Task 2 (db helper tests) → Task 3 (db helper implementation)
                                    ↓
Task 4 (API tests) → Task 5 (API implementation)
                            ↓
                     Task 6 (smoke test)
```

Tasks are sequential. Each depends on the previous.
