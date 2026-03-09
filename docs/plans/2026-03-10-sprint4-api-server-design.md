# Sprint 4 Design — FastAPI Server

## Scope

REST API server exposing work blocks and weekly summaries to the React dashboard. Three endpoints: today's blocks, weekly summary, and block update (for EOD review).

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `api/__init__.py` | Empty package marker |
| `api/server.py` | FastAPI app, CORS, startup/shutdown hooks |
| `api/routes.py` | APIRouter with 3 endpoints |
| `tracker/db.py` | Add `update_work_block` and `get_work_blocks_for_range` |
| `tests/test_api.py` | API endpoint tests via TestClient |
| `tests/test_db.py` | Tests for 2 new db helpers |

## Design Decisions

- **Split server.py + routes.py** — matches CLAUDE.md project structure, clean separation.
- **Compute weekly summary on-the-fly** — query work_blocks directly, no daily_summaries pipeline needed yet.
- **init_db() on startup** — separate process from agent, WAL mode handles concurrent reads.
- **CORS allow all origins** — local-only tool, no internet exposure.
- **Port 9147** — avoids conflicts with common dev server ports.
- **No auth, no rate limiting** — localhost only.

## New db.py Helpers

### update_work_block

```python
def update_work_block(block_id: int, category: str | None, note: str | None, user_confirmed: bool | None) -> dict | None:
```

Updates only provided fields (non-None). Returns updated row as dict, or None if block_id not found.

### get_work_blocks_for_range

```python
def get_work_blocks_for_range(start_date: str, end_date: str) -> list[dict]:
```

Returns all work_blocks where `date BETWEEN start_date AND end_date`, ordered by started_at.

## API Endpoints

### GET /blocks/today

Returns today's work blocks.

**Response:**
```json
{
  "date": "2026-03-10",
  "blocks": [
    {
      "id": 1,
      "started_at": "2026-03-10T09:00:00",
      "ended_at": "2026-03-10T10:30:00",
      "duration_min": 90,
      "category": "coding",
      "auto_category": "coding",
      "user_confirmed": false,
      "apps_used": ["VS Code", "Terminal"],
      "note": null
    }
  ]
}
```

Note: `apps_used` is stored as JSON string in DB, parsed to array in response.

### GET /summary/week?date=YYYY-MM-DD

Returns weekly summary computed from work_blocks. Date param optional, defaults to today. Computes Monday-Sunday week containing the given date.

**Response:**
```json
{
  "start_date": "2026-03-09",
  "end_date": "2026-03-15",
  "total_tracked_min": 420,
  "category_breakdown": {"coding": 180, "meeting": 90},
  "daily": [
    {
      "date": "2026-03-09",
      "total_min": 60,
      "breakdown": {"coding": 60}
    }
  ]
}
```

### PATCH /blocks/{block_id}

Updates a work block (EOD review: change category, add note, confirm).

**Request body (all fields optional):**
```json
{
  "category": "meeting",
  "note": "Sprint planning",
  "user_confirmed": true
}
```

**Response:** Updated block object (same shape as GET response blocks).

**404** if block_id not found.

## Server Setup

**api/server.py:**
- `FastAPI()` app creation
- `CORSMiddleware(allow_origins=["*"])`
- `@app.on_event("startup")` → `init_db()`
- `@app.on_event("shutdown")` → `close_db()`
- `app.include_router(router)`

**Run:** `uvicorn api.server:app --port 9147`

## Testing Strategy

- FastAPI `TestClient` (synchronous, no real server)
- `:memory:` DB via setup/teardown fixtures
- Test cases:
  - GET /blocks/today — empty, with blocks, correct JSON shape
  - GET /summary/week — empty week, with data, custom date param, category aggregation
  - PATCH /blocks/{id} — update category, note, user_confirmed, partial update, 404
  - New db helpers — update_work_block field updates, get_work_blocks_for_range filtering

## Done Criteria

All 3 endpoints return correct JSON. TestClient tests pass. Server starts with `uvicorn api.server:app --port 9147`.
