# Sprint 8: Live Today Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Today page show live data by merging raw events on the fly, with 60-second auto-refresh.

**Architecture:** New `GET /blocks/today/live` endpoint calls `merge_events_for_date()` on each request. Today.jsx switches to this endpoint and polls every 60 seconds. Review page stays unchanged.

**Tech Stack:** Python/FastAPI, React, existing merger module

---

### Task 1: Live Endpoint — Test First

**Files:**
- Modify: `tests/test_api.py`

**Step 1: Add test class for the live endpoint**

Append to `tests/test_api.py`:

```python
from tracker.db import insert_raw_event


class TestGetBlocksTodayLive:
    def setup_method(self):
        _setup_db()
        self.client = TestClient(app, raise_server_exceptions=False)

    def teardown_method(self):
        _teardown_db()

    def test_returns_empty_when_no_raw_events(self):
        response = self.client.get("/blocks/today/live")
        assert response.status_code == 200
        data = response.json()
        assert data["blocks"] == []

    def test_merges_raw_events_into_blocks(self):
        from datetime import date
        today = date.today().isoformat()
        # Insert raw events long enough to survive merge filters (>2min each, >10min total)
        insert_raw_event("VS Code", "main.py", f"{today}T09:00:00", f"{today}T09:15:00", 900)
        insert_raw_event("VS Code", "utils.py", f"{today}T09:15:00", f"{today}T09:30:00", 900)
        response = self.client.get("/blocks/today/live")
        assert response.status_code == 200
        data = response.json()
        assert len(data["blocks"]) >= 1
        assert data["blocks"][0]["category"] == "coding"
```

Also add `insert_raw_event` to the import on line 3:

Change:
```python
from tracker.db import init_db, close_db, insert_work_block
```
to:
```python
from tracker.db import init_db, close_db, insert_work_block, insert_raw_event
```

**Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && python3 -m pytest tests/test_api.py::TestGetBlocksTodayLive -v`
Expected: FAIL — 404 (endpoint doesn't exist yet)

---

### Task 2: Live Endpoint — Implementation

**Files:**
- Modify: `api/routes.py`

**Step 1: Add import for merge_events_for_date**

Add to the imports in `api/routes.py`:

```python
from tracker.merger import merge_events_for_date
```

**Step 2: Add the live endpoint**

Add after the existing `get_blocks_today` function (after line 36):

```python
@router.get("/blocks/today/live")
def get_blocks_today_live():
    today = date.today().isoformat()
    merge_events_for_date(today)
    blocks = get_work_blocks_for_date(today)
    return {
        "date": today,
        "blocks": [_format_block(b) for b in blocks],
    }
```

**Step 3: Run tests**

Run: `source .venv/bin/activate && python3 -m pytest tests/test_api.py -v`
Expected: All tests PASS (including the 2 new ones)

**Step 4: Run full test suite**

Run: `source .venv/bin/activate && python3 -m pytest tests/ -v`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add api/routes.py tests/test_api.py
git commit -m "feat: add GET /blocks/today/live endpoint with on-the-fly merge"
```

---

### Task 3: Today Page — Auto-Refresh

**Files:**
- Modify: `dashboard/src/pages/Today.jsx`

**Step 1: Update Today.jsx**

Replace the entire file content with:

```jsx
import { useState, useEffect } from "react";
import BlockCard from "../components/BlockCard";
import TimelineBar from "../components/TimelineBar";

export default function Today() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBlocks = () => {
    fetch("/blocks/today/live")
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setBlocks(data.blocks);
        setLoading(false);
        setError(null);
      })
      .catch(() => {
        setError("Cannot connect to tracker API. Is the server running on port 9147?");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBlocks();
    const interval = setInterval(fetchBlocks, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (blocks.length === 0)
    return <p className="text-gray-500">No activity tracked today.</p>;

  const totalMin = blocks.reduce((sum, b) => sum + b.duration_min, 0);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Today</h1>
        <span className="text-sm text-gray-500">
          {hours}h {mins}m tracked
        </span>
      </div>
      <TimelineBar blocks={blocks} />
      {blocks.map((block) => (
        <BlockCard key={block.id} block={block} editable={false} />
      ))}
    </div>
  );
}
```

Key changes from the original:
- Fetch URL changed from `/blocks/today` to `/blocks/today/live`
- Extracted `fetchBlocks` function for reuse
- Added `setInterval(fetchBlocks, 60000)` for 60-second auto-refresh
- Added `clearInterval` cleanup on unmount
- Added `setError(null)` on successful fetch (clears stale errors)

**Step 2: Verify dashboard builds**

Run: `cd dashboard && npx vite build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add dashboard/src/pages/Today.jsx
git commit -m "feat: Today page uses live endpoint with 60s auto-refresh"
```

---

### Task 4: Add proxy route for live endpoint

**Files:**
- Modify: `dashboard/vite.config.js`

**Step 1: Check if proxy already covers `/blocks/today/live`**

The existing Vite proxy config proxies `/blocks` to `http://localhost:9147`. Since `/blocks/today/live` starts with `/blocks`, it is already covered by the existing proxy. **No change needed.**

This task is a verification-only step — confirm the proxy works.

**Step 2: Verify end-to-end**

With the API server running on port 9147 and the dashboard on port 5173:

Run: `curl -s http://localhost:9147/blocks/today/live | head -20`
Expected: JSON response with `date` and `blocks` fields

**Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: Sprint 8 complete — live Today page"
```

(Only if there are uncommitted changes)

---

## Task Dependency Graph

```
Task 1 (test) → Task 2 (endpoint implementation)
                         ↓
                   Task 3 (Today.jsx update)
                         ↓
                   Task 4 (verify proxy + end-to-end)
```

All sequential. Tasks 1-2 are the backend (TDD). Task 3 is the frontend. Task 4 is verification.
