import json
from datetime import datetime

from tracker.categorizer import categorize
from tracker.db import get_raw_events_for_date, delete_work_blocks_for_date, insert_work_block


def _parse_dt(dt_str: str) -> datetime:
    return datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%S")


def _gap_seconds(end_str: str, start_str: str) -> int:
    return int((_parse_dt(start_str) - _parse_dt(end_str)).total_seconds())


def merge_events_for_date(date: str) -> list[dict]:
    raw_events = get_raw_events_for_date(date)
    if not raw_events:
        return []

    # Step 1: Categorize and filter micro-sessions (< 2 min)
    categorized = []
    for event in raw_events:
        dur = event.get("duration_sec") or 0
        if dur < 120:
            continue
        category = categorize(event["app_name"], event.get("window_title"))
        categorized.append({
            "app_name": event["app_name"],
            "window_title": event.get("window_title"),
            "started_at": event["started_at"],
            "ended_at": event["ended_at"],
            "duration_sec": dur,
            "category": category,
        })

    if not categorized:
        return []

    # Step 2: Merge same-category interruptions (gap < 5 min)
    merged = [categorized[0].copy()]
    merged[0]["apps"] = {categorized[0]["app_name"]}

    for event in categorized[1:]:
        prev = merged[-1]
        gap = _gap_seconds(prev["ended_at"], event["started_at"])

        if event["category"] == prev["category"] and gap <= 300:
            prev["ended_at"] = event["ended_at"]
            prev["duration_sec"] = int((_parse_dt(prev["ended_at"]) - _parse_dt(prev["started_at"])).total_seconds())
            prev["apps"].add(event["app_name"])
        else:
            new_block = event.copy()
            new_block["apps"] = {event["app_name"]}
            merged.append(new_block)

    # Step 3: Absorb short switches (< 5 min sandwiched between same category)
    absorbed = list(merged)
    changed = True
    while changed:
        changed = False
        new_list = []
        i = 0
        while i < len(absorbed):
            if (
                i > 0
                and i < len(absorbed) - 1
                and absorbed[i]["duration_sec"] < 300
                and new_list
                and new_list[-1]["category"] == absorbed[i + 1]["category"]
            ):
                # Absorb middle into previous block
                new_list[-1]["ended_at"] = absorbed[i + 1]["ended_at"]
                new_list[-1]["duration_sec"] = int(
                    (_parse_dt(new_list[-1]["ended_at"]) - _parse_dt(new_list[-1]["started_at"])).total_seconds()
                )
                new_list[-1]["apps"].update(absorbed[i]["apps"])
                new_list[-1]["apps"].update(absorbed[i + 1]["apps"])
                i += 2
                changed = True
            else:
                new_list.append(absorbed[i])
                i += 1
        absorbed = new_list

    # Step 4: Filter blocks under 10 minutes
    final_blocks = [b for b in absorbed if b["duration_sec"] >= 600]

    # Step 5: Write to DB (idempotent — delete first)
    delete_work_blocks_for_date(date)

    result = []
    for block in final_blocks:
        duration_min = block["duration_sec"] // 60
        apps_used = json.dumps(sorted(block["apps"]))
        row_id = insert_work_block(
            date=date,
            started_at=block["started_at"],
            ended_at=block["ended_at"],
            duration_min=duration_min,
            category=block["category"],
            auto_category=block["category"],
            apps_used=apps_used,
            note=None,
        )
        result.append({
            "id": row_id,
            "date": date,
            "started_at": block["started_at"],
            "ended_at": block["ended_at"],
            "duration_min": duration_min,
            "category": block["category"],
            "auto_category": block["category"],
            "apps_used": apps_used,
            "note": None,
        })

    return result
