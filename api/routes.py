import json
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from tracker.db import get_work_blocks_for_date, get_work_blocks_for_range, update_work_block
from tracker.merger import merge_events_for_date

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


@router.get("/blocks/today/live")
def get_blocks_today_live():
    today = date.today().isoformat()
    merge_events_for_date(today)
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
    from datetime import date as date_cls
    if date:
        target = date_cls.fromisoformat(date)
    else:
        target = date_cls.today()

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
