# Sprint 3 Design — Categorization & Merging

## Scope

Two modules that transform raw events into meaningful work blocks: `categorizer.py` maps app+title to one of 7 categories, `merger.py` merges/discards/absorbs raw events into 8-12 blocks per day.

## Files to Create

| File | Purpose |
|------|---------|
| `tracker/categorizer.py` | App name + window title → category ID |
| `tracker/merger.py` | Raw events → merged work blocks in DB |

No db.py changes needed.

## Design Decisions

- **Simple `in` checks, no regex** — keywords are plain substrings, `in` on `title.lower()` is simpler and faster.
- **Hardcoded browser set** — `{"Google Chrome", "Safari", "Firefox", "Arc", "Microsoft Edge", "Brave Browser"}`. Explicit, no false positives.
- **First-match-wins ordering** — categorizer checks in priority order: direct app → terminal special case → browser title → fallback `?`.
- **Idempotent merging** — delete existing work_blocks for the date before re-merging. Allows re-trigger.

## categorizer.py

**Public API:**
```
categorize(app_name: str, window_title: str | None) -> str
    Returns: "meeting" | "coding" | "research" | "bizdev" | "infra" | "planning" | "admin" | "?"
```

**Matching order (first match wins):**

1. Direct app lookup table:
   - meeting: Zoom, Google Meet, Microsoft Teams, Whereby, Around, Loom
   - coding: VS Code, Code, Cursor, Xcode, IntelliJ IDEA, PyCharm, WebStorm, Rider, GoLand, GitHub Desktop
   - infra: Docker Desktop, Datadog, Grafana, PagerDuty
   - planning: Notion, Miro, FigJam, Whimsical, Lucidchart, Linear, Jira, Asana, ClickUp, Obsidian
   - admin: Slack, Mail, Apple Mail, Spark, Superhuman, Telegram, WhatsApp
   - bizdev: HubSpot, Salesforce

2. Terminal special case (Terminal, iTerm, iTerm2, Warp):
   - Title contains any of: ssh, kubectl, k9s, terraform, ansible, docker, aws, gcp, az → infra
   - Otherwise → coding

3. Browser title matching (Chrome, Safari, Firefox, Arc, Edge, Brave):
   - Priority order: meeting → coding → infra → research → bizdev → planning → admin → ?
   - Keywords per category defined as sets

4. Fallback → "?"

## merger.py

**Public API:**
```
merge_events_for_date(date: str) -> list[dict]
    Reads raw_events, categorizes, merges, writes work_blocks, returns blocks.
```

**Algorithm:**
1. Fetch raw events for date, sorted by started_at
2. Categorize each via categorize()
3. Discard micro-sessions (duration_sec < 120)
4. Merge interruptions (same category, gap < 5 min → one block)
5. Absorb short switches (event < 5 min sandwiched between same category → absorb)
6. Discard short blocks (duration_min < 10)
7. Delete existing work_blocks for date (idempotent)
8. Insert merged blocks via insert_work_block()

## Testing Strategy

- Categorizer: pure function, test each category + browser titles + terminal special case + fallback
- Merger: synthetic raw_events in :memory: DB. Cover micro-session discard, same-category merge, short-switch absorption, min block size, typical day (8-12 blocks)

## Done Criteria

Synthetic day of raw events → merger produces 8-12 work blocks with correct auto-categories.
