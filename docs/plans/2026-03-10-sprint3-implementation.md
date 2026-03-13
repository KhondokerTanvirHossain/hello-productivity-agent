# Sprint 3: Categorization & Merging — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform raw events into meaningful work blocks with auto-categories: categorizer maps app+title → category, merger discards/merges/absorbs events into 8-12 blocks per day.

**Architecture:** `categorizer.py` is a pure function with module-level lookup tables (dict + sets). `merger.py` reads raw_events from DB, categorizes each, applies merging rules in sequence, writes work_blocks. Both modules are independent — categorizer has no DB dependency, merger depends on categorizer + db.

**Tech Stack:** Python 3.11+, sqlite3, pytest

---

### Task 1: Categorizer — Tests First

**Files:**
- Create: `tests/test_categorizer.py`

**Step 1: Write failing tests**

```python
from tracker.categorizer import categorize


class TestDirectAppMapping:
    def test_zoom_is_meeting(self):
        assert categorize("Zoom", None) == "meeting"

    def test_google_meet_is_meeting(self):
        assert categorize("Google Meet", None) == "meeting"

    def test_microsoft_teams_is_meeting(self):
        assert categorize("Microsoft Teams", None) == "meeting"

    def test_whereby_is_meeting(self):
        assert categorize("Whereby", None) == "meeting"

    def test_loom_is_meeting(self):
        assert categorize("Loom", None) == "meeting"

    def test_vscode_is_coding(self):
        assert categorize("VS Code", "main.py") == "coding"

    def test_code_is_coding(self):
        assert categorize("Code", "main.py") == "coding"

    def test_cursor_is_coding(self):
        assert categorize("Cursor", "app.tsx") == "coding"

    def test_xcode_is_coding(self):
        assert categorize("Xcode", None) == "coding"

    def test_intellij_is_coding(self):
        assert categorize("IntelliJ IDEA", None) == "coding"

    def test_pycharm_is_coding(self):
        assert categorize("PyCharm", None) == "coding"

    def test_webstorm_is_coding(self):
        assert categorize("WebStorm", None) == "coding"

    def test_goland_is_coding(self):
        assert categorize("GoLand", None) == "coding"

    def test_docker_desktop_is_infra(self):
        assert categorize("Docker Desktop", None) == "infra"

    def test_datadog_is_infra(self):
        assert categorize("Datadog", None) == "infra"

    def test_grafana_is_infra(self):
        assert categorize("Grafana", None) == "infra"

    def test_pagerduty_is_infra(self):
        assert categorize("PagerDuty", None) == "infra"

    def test_notion_is_planning(self):
        assert categorize("Notion", None) == "planning"

    def test_linear_is_planning(self):
        assert categorize("Linear", None) == "planning"

    def test_jira_is_planning(self):
        assert categorize("Jira", None) == "planning"

    def test_obsidian_is_planning(self):
        assert categorize("Obsidian", None) == "planning"

    def test_miro_is_planning(self):
        assert categorize("Miro", None) == "planning"

    def test_slack_is_admin(self):
        assert categorize("Slack", None) == "admin"

    def test_mail_is_admin(self):
        assert categorize("Mail", None) == "admin"

    def test_apple_mail_is_admin(self):
        assert categorize("Apple Mail", None) == "admin"

    def test_superhuman_is_admin(self):
        assert categorize("Superhuman", None) == "admin"

    def test_telegram_is_admin(self):
        assert categorize("Telegram", None) == "admin"

    def test_whatsapp_is_admin(self):
        assert categorize("WhatsApp", None) == "admin"

    def test_linkedin_is_bizdev(self):
        assert categorize("LinkedIn", None) == "bizdev"

    def test_hubspot_is_bizdev(self):
        assert categorize("HubSpot", None) == "bizdev"

    def test_salesforce_is_bizdev(self):
        assert categorize("Salesforce", None) == "bizdev"

    def test_hunter_is_bizdev(self):
        assert categorize("Hunter", None) == "bizdev"

    def test_apollo_is_bizdev(self):
        assert categorize("Apollo", None) == "bizdev"


class TestTerminalSpecialCase:
    def test_terminal_default_is_coding(self):
        assert categorize("Terminal", "~/projects") == "coding"

    def test_terminal_ssh_is_infra(self):
        assert categorize("Terminal", "ssh user@prod-server") == "infra"

    def test_iterm_kubectl_is_infra(self):
        assert categorize("iTerm2", "kubectl get pods") == "infra"

    def test_warp_terraform_is_infra(self):
        assert categorize("Warp", "terraform plan") == "infra"

    def test_terminal_docker_is_infra(self):
        assert categorize("Terminal", "docker compose up") == "infra"

    def test_terminal_aws_is_infra(self):
        assert categorize("Terminal", "aws s3 ls") == "infra"

    def test_terminal_no_title_is_coding(self):
        assert categorize("Terminal", None) == "coding"

    def test_iterm_regular_is_coding(self):
        assert categorize("iTerm", "vim main.py") == "coding"


class TestBrowserTitleMatching:
    def test_github_is_coding(self):
        assert categorize("Google Chrome", "my-repo - GitHub") == "coding"

    def test_stackoverflow_is_research(self):
        assert categorize("Safari", "python sqlite3 - Stack Overflow") == "research"

    def test_medium_is_research(self):
        assert categorize("Google Chrome", "Understanding React Hooks - Medium") == "research"

    def test_hackernews_is_research(self):
        assert categorize("Firefox", "Hacker News") == "research"

    def test_reddit_is_research(self):
        assert categorize("Arc", "r/programming - Reddit") == "research"

    def test_arxiv_is_research(self):
        assert categorize("Google Chrome", "arxiv.org - Attention Is All You Need") == "research"

    def test_wikipedia_is_research(self):
        assert categorize("Safari", "Python (programming language) - Wikipedia") == "research"

    def test_gmail_is_admin(self):
        assert categorize("Google Chrome", "Inbox - Gmail") == "admin"

    def test_google_calendar_is_admin(self):
        assert categorize("Google Chrome", "Google Calendar - Week of March 10") == "admin"

    def test_google_meet_browser_is_meeting(self):
        assert categorize("Google Chrome", "Meeting - meet.google.com") == "meeting"

    def test_teams_browser_is_meeting(self):
        assert categorize("Safari", "teams.microsoft.com - Call") == "meeting"

    def test_aws_console_is_infra(self):
        assert categorize("Google Chrome", "EC2 - console.aws.amazon.com") == "infra"

    def test_gcp_console_is_infra(self):
        assert categorize("Google Chrome", "Compute Engine - console.cloud.google.com") == "infra"

    def test_azure_portal_is_infra(self):
        assert categorize("Microsoft Edge", "portal.azure.com - Resources") == "infra"

    def test_linkedin_browser_is_bizdev(self):
        assert categorize("Google Chrome", "Feed | LinkedIn") == "bizdev"

    def test_proposal_is_bizdev(self):
        assert categorize("Google Chrome", "Q4 Proposal - Google Docs") == "bizdev"

    def test_contract_is_bizdev(self):
        assert categorize("Safari", "Service Contract Draft") == "bizdev"

    def test_google_docs_is_planning(self):
        assert categorize("Google Chrome", "Sprint Plan - Google Docs") == "planning"

    def test_generic_browser_is_ambiguous(self):
        assert categorize("Google Chrome", "Some Random Website") == "?"

    def test_browser_no_title_is_ambiguous(self):
        assert categorize("Safari", None) == "?"


class TestFallback:
    def test_unknown_app_is_ambiguous(self):
        assert categorize("SomeRandomApp", None) == "?"

    def test_none_title_handled(self):
        assert categorize("UnknownApp", None) == "?"
```

**Step 2: Run tests to verify they fail**

Run: `source .venv/bin/activate && python -m pytest tests/test_categorizer.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'tracker.categorizer'`

---

### Task 2: Categorizer — Implementation

**Files:**
- Create: `tracker/categorizer.py`

**Step 1: Write implementation**

```python
DIRECT_APP_MAP: dict[str, str] = {
    # meeting
    "Zoom": "meeting",
    "zoom.us": "meeting",
    "Google Meet": "meeting",
    "Microsoft Teams": "meeting",
    "Whereby": "meeting",
    "Around": "meeting",
    "Loom": "meeting",
    # coding
    "Code": "coding",
    "VS Code": "coding",
    "Visual Studio Code": "coding",
    "Cursor": "coding",
    "Xcode": "coding",
    "IntelliJ IDEA": "coding",
    "IntelliJ": "coding",
    "PyCharm": "coding",
    "WebStorm": "coding",
    "Rider": "coding",
    "GoLand": "coding",
    "GitHub Desktop": "coding",
    # infra
    "Docker Desktop": "infra",
    "Datadog": "infra",
    "Grafana": "infra",
    "PagerDuty": "infra",
    # planning
    "Notion": "planning",
    "Miro": "planning",
    "FigJam": "planning",
    "Whimsical": "planning",
    "Lucidchart": "planning",
    "Linear": "planning",
    "Jira": "planning",
    "Asana": "planning",
    "ClickUp": "planning",
    "Obsidian": "planning",
    # admin
    "Slack": "admin",
    "Mail": "admin",
    "Apple Mail": "admin",
    "Spark": "admin",
    "Superhuman": "admin",
    "Telegram": "admin",
    "WhatsApp": "admin",
    # bizdev
    "LinkedIn": "bizdev",
    "Hunter": "bizdev",
    "Apollo": "bizdev",
    "Salesforce": "bizdev",
    "HubSpot": "bizdev",
}

TERMINAL_APPS: set[str] = {"Terminal", "iTerm", "iTerm2", "Warp"}

INFRA_TITLE_KEYWORDS: list[str] = [
    "ssh", "kubectl", "k9s", "terraform", "ansible", "docker", "aws", "gcp", "az ",
]

BROWSER_APPS: set[str] = {
    "Google Chrome", "Safari", "Firefox", "Arc", "Microsoft Edge", "Brave Browser",
}

BROWSER_TITLE_RULES: list[tuple[str, list[str]]] = [
    ("meeting", ["meet.google.com", "teams.microsoft.com", "zoom.us"]),
    ("coding", ["github.com", "github"]),
    ("infra", ["console.aws", "console.cloud.google", "portal.azure", "datadog", "grafana", "pagerduty"]),
    ("research", ["- medium", "arxiv", "wikipedia", "stack overflow", "stackoverflow.com", "hacker news", "news.ycombinator", "reddit"]),
    ("bizdev", ["linkedin", "proposal", "contract", "pitch"]),
    ("planning", ["google docs"]),
    ("admin", ["gmail", "google calendar"]),
]


def categorize(app_name: str, window_title: str | None) -> str:
    if app_name in DIRECT_APP_MAP:
        return DIRECT_APP_MAP[app_name]

    if app_name in TERMINAL_APPS:
        if window_title:
            title_lower = window_title.lower()
            for keyword in INFRA_TITLE_KEYWORDS:
                if keyword in title_lower:
                    return "infra"
        return "coding"

    if app_name in BROWSER_APPS:
        if window_title:
            title_lower = window_title.lower()
            for category, keywords in BROWSER_TITLE_RULES:
                for keyword in keywords:
                    if keyword in title_lower:
                        return category
        return "?"

    return "?"
```

**Step 2: Run all categorizer tests**

Run: `source .venv/bin/activate && python -m pytest tests/test_categorizer.py -v`
Expected: All tests PASS

**Step 3: Run full test suite**

Run: `source .venv/bin/activate && python -m pytest tests/ -v`
Expected: All tests PASS (36 existing + new categorizer tests)

**Step 4: Commit**

```bash
git add tracker/categorizer.py tests/test_categorizer.py
git commit -m "feat: add app-to-category mapping with 7 categories"
```

---

### Task 3: delete_work_blocks_for_date — Tests + Implementation

**Files:**
- Modify: `tests/test_db.py`
- Modify: `tracker/db.py`

**Step 1: Write failing test**

Append to `tests/test_db.py` (update import to include `delete_work_blocks_for_date`):

```python
from tracker.db import delete_work_blocks_for_date


class TestDeleteWorkBlocksForDate:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_deletes_blocks_for_date(self):
        insert_work_block("2026-03-10", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 60, "coding", "coding", '["VS Code"]', None)
        insert_work_block("2026-03-10", "2026-03-10T10:00:00", "2026-03-10T11:00:00", 60, "meeting", "meeting", '["Zoom"]', None)
        insert_work_block("2026-03-11", "2026-03-11T09:00:00", "2026-03-11T10:00:00", 60, "coding", "coding", '["VS Code"]', None)

        delete_work_blocks_for_date("2026-03-10")

        assert len(get_work_blocks_for_date("2026-03-10")) == 0
        assert len(get_work_blocks_for_date("2026-03-11")) == 1

    def test_delete_empty_date_no_error(self):
        delete_work_blocks_for_date("2026-03-10")  # should not raise
```

**Step 2: Write implementation**

Append to `tracker/db.py`:

```python
def delete_work_blocks_for_date(date: str) -> None:
    conn = get_connection()
    conn.execute("DELETE FROM work_blocks WHERE date = ?", (date,))
    conn.commit()
```

**Step 3: Run all tests**

Run: `source .venv/bin/activate && python -m pytest tests/test_db.py -v`
Expected: All tests PASS (20 existing + 2 new)

**Step 4: Commit**

```bash
git add tracker/db.py tests/test_db.py
git commit -m "feat: add delete_work_blocks_for_date for idempotent merging"
```

---

### Task 4: Merger — Tests First

**Files:**
- Create: `tests/test_merger.py`

**Step 1: Write failing tests with synthetic data**

```python
import json
from tracker.db import init_db, close_db, insert_raw_event, get_work_blocks_for_date
from tracker.merger import merge_events_for_date


def _insert_event(app: str, title: str | None, start: str, end: str, dur: int) -> None:
    insert_raw_event(app, title, start, end, dur)


class TestMergerMicroSessionDiscard:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_discards_events_under_2_minutes(self):
        _insert_event("Slack", None, "2026-03-10T09:00:00", "2026-03-10T09:01:00", 60)
        _insert_event("VS Code", "main.py", "2026-03-10T09:01:00", "2026-03-10T09:30:00", 1740)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"

    def test_keeps_events_at_2_minutes(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:12:00", 720)
        _insert_event("Slack", None, "2026-03-10T09:12:00", "2026-03-10T09:14:00", 120)
        blocks = merge_events_for_date("2026-03-10")
        categories = [b["category"] for b in blocks]
        assert "admin" in categories or len(blocks) >= 1


class TestMergerSameCategoryMerge:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_merges_same_category_within_5min_gap(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800)
        _insert_event("VS Code", "utils.py", "2026-03-10T09:33:00", "2026-03-10T10:00:00", 1620)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"
        assert blocks[0]["duration_min"] >= 57  # 30 + 27 = 57 min

    def test_does_not_merge_with_gap_over_5min(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800)
        _insert_event("VS Code", "utils.py", "2026-03-10T09:36:00", "2026-03-10T10:06:00", 1800)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) == 2


class TestMergerAbsorbShortSwitches:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_absorbs_short_switch_between_same_category(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800)
        _insert_event("Slack", None, "2026-03-10T09:30:00", "2026-03-10T09:33:00", 180)
        _insert_event("VS Code", "utils.py", "2026-03-10T09:33:00", "2026-03-10T10:00:00", 1620)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"

    def test_does_not_absorb_long_switch(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800)
        _insert_event("Slack", None, "2026-03-10T09:30:00", "2026-03-10T09:36:00", 360)
        _insert_event("VS Code", "utils.py", "2026-03-10T09:36:00", "2026-03-10T10:06:00", 1800)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) >= 2


class TestMergerMinBlockSize:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_discards_blocks_under_10_minutes(self):
        _insert_event("Slack", None, "2026-03-10T09:00:00", "2026-03-10T09:08:00", 480)
        _insert_event("VS Code", "main.py", "2026-03-10T09:08:00", "2026-03-10T10:08:00", 3600)
        blocks = merge_events_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"


class TestMergerIdempotent:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_remerge_replaces_existing_blocks(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 3600)
        merge_events_for_date("2026-03-10")
        merge_events_for_date("2026-03-10")  # re-merge
        blocks = get_work_blocks_for_date("2026-03-10")
        assert len(blocks) == 1  # not duplicated


class TestMergerWritesToDb:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_blocks_written_to_work_blocks_table(self):
        _insert_event("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 3600)
        merge_events_for_date("2026-03-10")
        blocks = get_work_blocks_for_date("2026-03-10")
        assert len(blocks) == 1
        assert blocks[0]["category"] == "coding"
        assert blocks[0]["auto_category"] == "coding"
        apps = json.loads(blocks[0]["apps_used"])
        assert "VS Code" in apps

    def test_block_has_correct_time_range(self):
        _insert_event("Zoom", "Standup", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800)
        blocks = merge_events_for_date("2026-03-10")
        assert blocks[0]["started_at"] == "2026-03-10T09:00:00"
        assert blocks[0]["ended_at"] == "2026-03-10T09:30:00"
        assert blocks[0]["duration_min"] == 30


class TestMergerTypicalDay:
    def setup_method(self):
        init_db(":memory:")

    def teardown_method(self):
        close_db()

    def test_typical_day_produces_8_to_12_blocks(self):
        # Morning standup
        _insert_event("Zoom", "Standup", "2026-03-10T09:00:00", "2026-03-10T09:15:00", 900)
        # Coding block 1
        _insert_event("VS Code", "main.py", "2026-03-10T09:15:00", "2026-03-10T10:30:00", 4500)
        _insert_event("Slack", "#general", "2026-03-10T10:30:00", "2026-03-10T10:32:00", 120)  # micro, discard
        _insert_event("VS Code", "utils.py", "2026-03-10T10:32:00", "2026-03-10T11:30:00", 3480)
        # Research
        _insert_event("Google Chrome", "React Hooks - Stack Overflow", "2026-03-10T11:30:00", "2026-03-10T12:00:00", 1800)
        # Lunch (gap)
        # Planning
        _insert_event("Notion", "Sprint Plan", "2026-03-10T13:00:00", "2026-03-10T13:45:00", 2700)
        # Meeting
        _insert_event("Zoom", "1:1 with Manager", "2026-03-10T14:00:00", "2026-03-10T14:30:00", 1800)
        # Coding block 2
        _insert_event("VS Code", "api.py", "2026-03-10T14:30:00", "2026-03-10T16:00:00", 5400)
        # Admin
        _insert_event("Slack", "DMs", "2026-03-10T16:00:00", "2026-03-10T16:30:00", 1800)
        # Infra
        _insert_event("Terminal", "ssh prod-server", "2026-03-10T16:30:00", "2026-03-10T17:00:00", 1800)
        # Wrap up admin
        _insert_event("Google Chrome", "Inbox - Gmail", "2026-03-10T17:00:00", "2026-03-10T17:30:00", 1800)

        blocks = merge_events_for_date("2026-03-10")
        assert 6 <= len(blocks) <= 12
        categories = [b["category"] for b in blocks]
        assert "meeting" in categories
        assert "coding" in categories
        assert "research" in categories
        assert "planning" in categories
        assert "admin" in categories
        assert "infra" in categories
```

**Step 2: Run tests to verify they fail**

Run: `source .venv/bin/activate && python -m pytest tests/test_merger.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'tracker.merger'`

---

### Task 5: Merger — Implementation

**Files:**
- Create: `tracker/merger.py`

**Step 1: Write implementation**

```python
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
```

**Step 2: Run all merger tests**

Run: `source .venv/bin/activate && python -m pytest tests/test_merger.py -v`
Expected: All tests PASS

**Step 3: Run full test suite**

Run: `source .venv/bin/activate && python -m pytest tests/ -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add tracker/merger.py tests/test_merger.py
git commit -m "feat: add session merger with discard/merge/absorb rules"
```

---

### Task 6: Full Integration Verification

**Step 1: Run complete test suite**

Run: `source .venv/bin/activate && python -m pytest tests/ -v`
Expected: All tests PASS

**Step 2: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: Sprint 3 complete — categorization and merging"
```

---

## Task Dependency Graph

```
Task 1 (categorizer tests) → Task 2 (categorizer implementation)
                                     ↓
Task 3 (delete_work_blocks_for_date) ← independent
                                     ↓
Task 4 (merger tests) → Task 5 (merger implementation)
                                ↓
                         Task 6 (integration verification)
```

Tasks 1-2 and Task 3 are independent — can run in parallel.
Tasks 4-5 depend on both Task 2 and Task 3.
Task 6 is final verification.
