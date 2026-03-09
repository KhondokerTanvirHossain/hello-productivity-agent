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
