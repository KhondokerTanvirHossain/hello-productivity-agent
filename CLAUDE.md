# Productivity Tracker — Project Bible

> This file is the single source of truth for this project.
> Read it fully before writing any code.

---

## What We're Building

A **local, private, macOS productivity tracker** inspired by Rize — but free, self-hosted, and owned by the user.

The user is a **software engineer who is also a manager**. Their day is extremely fragmented across meetings, coding, research, infra, planning, biz dev, and admin. They previously tracked work in a spreadsheet (tedious) and tried Rize (loved it, too expensive).

**Core loop:**
1. Silent background agent tracks active app/window all day
2. Auto-merges fragments into meaningful work blocks
3. Auto-categorizes each block into one of 7 work buckets
4. At 6pm → macOS notification → open browser → review & tag the day in 2-3 mins
5. Dashboard shows daily + weekly breakdown by category

---

## User Profile

- **OS:** macOS
- **Role:** Software engineer + manager (manager tasks = higher priority)
- **Work style:** Highly fragmented day, lots of context switching
- **Tracking preference:** Category-level (not project-level)
- **Review style:** Quick — confirm/fix auto-detected tags, not write essays
- **Notification preference:** End of day (6pm) summary prompt only

---

## Work Categories (The 7 Buckets)

These are fixed. Every tracked block must map to one of these:

| Category | ID | Color |
|---|---|---|
| Meetings | `meeting` | #6366F1 (indigo) |
| Coding / Engineering | `coding` | #10B981 (green) |
| Research | `research` | #F59E0B (amber) |
| Business Development | `bizdev` | #EF4444 (red) |
| Infrastructure / DevOps | `infra` | #8B5CF6 (purple) |
| Planning / Strategy | `planning` | #3B82F6 (blue) |
| Admin / Email / Slack | `admin` | #6B7280 (gray) |

---

## App → Category Mapping Rules

Auto-categorization logic. Apply in order (first match wins):

### Meetings
- `zoom.us`, `Zoom` → meeting
- `Google Meet`, `meet.google.com` → meeting
- `Microsoft Teams`, `teams.microsoft.com` → meeting
- `Whereby`, `Around`, `Loom` → meeting
- Calendar event is active (Google Calendar sync) → meeting override

### Coding / Engineering
- `Code`, `VS Code`, `Visual Studio Code` → coding
- `Xcode` → coding
- `IntelliJ`, `PyCharm`, `WebStorm`, `Rider`, `GoLand` → coding
- `Terminal`, `iTerm`, `iTerm2`, `Warp` → coding (unless title contains `ssh` → infra)
- `GitHub` (browser) → coding
- `Cursor` → coding

### Infrastructure / DevOps
- Terminal with window title containing: `ssh`, `kubectl`, `k9s`, `terraform`, `ansible`, `docker`, `aws`, `gcp`, `az ` → infra
- `Docker Desktop` → infra
- AWS Console, GCP Console, Azure Portal (browser) → infra
- `Datadog`, `Grafana`, `PagerDuty` → infra

### Research
- Browser with title containing: `- Medium`, `arxiv`, `Wikipedia`, `Stack Overflow`, `stackoverflow.com`, `Hacker News`, `news.ycombinator`, `Reddit` → research
- `Notion` (reading mode, inferred) → research (ambiguous, mark for EOD review)

### Business Development
- `LinkedIn` → bizdev
- `Hunter`, `Apollo`, `Salesforce`, `HubSpot` → bizdev
- Browser title containing: `proposal`, `contract`, `pitch` → bizdev

### Planning / Strategy
- `Notion` → planning (default for Notion unless overridden)
- `Miro`, `FigJam`, `Whimsical`, `Lucidchart` → planning
- `Linear`, `Jira`, `Asana`, `ClickUp` → planning
- `Google Docs` (browser, document editing) → planning
- `Obsidian` → planning

### Admin / Email / Slack
- `Slack` → admin
- `Mail`, `Apple Mail`, `Spark`, `Superhuman` → admin
- `Gmail` (browser) → admin
- `Google Calendar` (browser, when not in a meeting) → admin
- `Telegram`, `WhatsApp` (desktop) → admin

### Ambiguous / Needs Review
- Generic browser with no clear signal → mark as `?` for EOD review
- `Finder`, `System Preferences` → skip (don't log)
- Short sessions < 2 min → discard entirely

---

## Session Merging Logic

This is critical. Raw events are noisy. Apply these rules before showing anything to the user:

1. **Discard micro-sessions** — any app focus < 2 minutes is discarded
2. **Merge interruptions** — if the same category appears within a 5-minute gap, merge into one continuous session
3. **Absorb short switches** — if a different app appears for < 5 minutes sandwiched between the same category, absorb it into that category (e.g., VS Code → Slack 3min → VS Code becomes one Coding block)
4. **Result target** — aim for 8-12 meaningful blocks per day for EOD review
5. **Minimum block size** — merged blocks shown at EOD should be at least 10 minutes

---

## End-of-Day Review Flow

Triggered at **6pm via macOS notification** (`osascript` or `terminal-notifier`).

User clicks notification → browser opens to `http://localhost:5173/review`

The review screen shows:
- A **timeline of today** — each merged block as a card
- Each card shows: time range, auto-detected category (color-coded), app(s) used
- User can: **confirm** (one click) or **change category** (dropdown of 7 options)
- Optional: add a short note per block (one line, not required)
- "Done" button → saves to DB, shows today's summary pie chart

Target: **2-3 minutes** to complete. Keep it frictionless.

---

## Data Storage

**SQLite only. No external DB. No cloud.**

### Tables

```sql
-- Raw app events (write frequently, cheap)
CREATE TABLE raw_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT NOT NULL,
    window_title TEXT,
    started_at DATETIME NOT NULL,
    ended_at DATETIME,
    duration_sec INTEGER
);

-- Merged, categorized blocks (what user sees and reviews)
CREATE TABLE work_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    started_at DATETIME NOT NULL,
    ended_at DATETIME NOT NULL,
    duration_min INTEGER NOT NULL,
    category TEXT NOT NULL,          -- one of the 7 category IDs
    auto_category TEXT NOT NULL,     -- what the system guessed
    user_confirmed BOOLEAN DEFAULT 0,
    apps_used TEXT,                  -- JSON array of app names
    note TEXT,                       -- optional user note
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily summaries (computed at EOD, cached)
CREATE TABLE daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    total_tracked_min INTEGER,
    category_breakdown TEXT,         -- JSON: {category: minutes}
    review_completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Database location:** `~/.productivity-tracker/tracker.db`
**Config location:** `~/.productivity-tracker/config.json`

---

## Project Structure

```
productivity-tracker/
├── CLAUDE.md                  ← this file
├── README.md
├── requirements.txt
│
├── tracker/
│   ├── agent.py               ← main daemon (polls active window every 5s)
│   ├── window_macos.py        ← macOS-specific: NSWorkspace + AppleScript
│   ├── categorizer.py         ← app → category mapping logic
│   ├── merger.py              ← session merging algorithm
│   ├── db.py                  ← SQLite read/write helpers
│   ├── notifier.py            ← 6pm macOS notification trigger
│   └── scheduler.py           ← runs notifier at 6pm daily
│
├── api/
│   ├── server.py              ← FastAPI server (localhost:8000)
│   └── routes.py              ← GET /blocks/today, GET /summary/week, PATCH /blocks/:id
│
├── dashboard/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── pages/
│       │   ├── Review.jsx     ← EOD review screen (primary screen)
│       │   ├── Today.jsx      ← today's timeline
│       │   └── Weekly.jsx     ← weekly category breakdown
│       └── components/
│           ├── BlockCard.jsx  ← individual work block card
│           ├── CategoryPill.jsx
│           └── TimelineBar.jsx
│
├── scripts/
│   ├── setup.sh               ← one-command setup script
│   └── launchd_plist.xml      ← macOS LaunchAgent (auto-start on login)
│
└── data/
    └── .gitkeep               ← DB lives in ~/.productivity-tracker/, not here
```

---

## Tech Stack

| Component | Technology | Why |
|---|---|---|
| Tracker agent | Python 3.11+ | Cross-platform later, great macOS libs |
| macOS window detection | `pyobjc` + `AppKit`/`NSWorkspace` | Native, reliable, low CPU |
| Database | SQLite via `sqlite3` (stdlib) | Zero dependencies, perfect scale |
| API server | FastAPI + uvicorn | Fast, typed, async |
| Dashboard | React + Vite + Tailwind | Fast dev, good charts |
| Charts | Recharts | Simple, React-native |
| Notifications | `osascript` (AppleScript) | No extra deps on macOS |
| Auto-start | macOS LaunchAgent (launchd) | Proper macOS daemon pattern |

---

## Phase 1 Scope (Build This First)

**In scope:**
- [x] macOS window tracker daemon
- [x] App → category auto-mapping
- [x] Session merging algorithm
- [x] SQLite storage
- [x] FastAPI server with today/week endpoints
- [x] EOD review UI (React)
- [x] Daily summary / weekly breakdown UI
- [x] 6pm macOS notification
- [x] LaunchAgent setup for auto-start

**Out of scope for Phase 1:**
- [ ] Meeting audio recording (Phase 2)
- [ ] Google Calendar integration (Phase 2 — needed for meeting audio trigger)
- [ ] Browser extension (optional Phase 3)
- [ ] Mobile app (future)

---

## Phase 2 Scope (Meeting Intelligence — Do Not Build Yet)

Document for future reference:

- Watch Google Calendar API for events starting within 2 minutes
- Auto-start mic recording using `sounddevice` or `pyaudio`
- On event end → stop recording → run OpenAI Whisper (local, `whisper` Python package)
- Feed transcript to local LLM or Claude API → generate: summary, key decisions, action items
- Attach output to the work block for that meeting time
- Trigger: Google Calendar event start (not manual)
- For in-person: same flow, mic always available

---

## Key Design Principles

1. **Silent by default** — tracker runs invisibly, never interrupts the user during the day
2. **Opt-out not opt-in** — tracking is always on; user pauses it deliberately if needed
3. **Friction-free review** — EOD review must be completable in under 3 minutes
4. **Local first, always** — no data ever leaves the machine in Phase 1
5. **Forgiveness over precision** — a good enough auto-category is better than asking the user to classify everything
6. **Don't over-engineer** — SQLite is fine, no need for Postgres; FastAPI is fine, no need for complex queuing

---

## Setup Instructions (to be written as scripts/setup.sh)

```bash
# 1. Install Python deps
pip install pyobjc-framework-Cocoa fastapi uvicorn sqlite3

# 2. Install dashboard deps
cd dashboard && npm install

# 3. Create DB directory
mkdir -p ~/.productivity-tracker

# 4. Run tracker agent
python tracker/agent.py &

# 5. Run API server
uvicorn api.server:app --port 8000 &

# 6. Run dashboard
cd dashboard && npm run dev
# Open http://localhost:5173
```

---

## Electron App — Build & Distribution

The app has been migrated to Electron (branch: `feature/electron-migration`, worktree: `.worktrees/electron-migration`).

### Run locally
```bash
cd .worktrees/electron-migration
npm install
npm start
```

### Build DMG for distribution
```bash
npm run dist
# Output:
#   dist/Productivity Tracker-1.0.0-arm64.dmg  ← Apple Silicon (M1/M2/M3)
#   dist/Productivity Tracker-1.0.0.dmg        ← Intel
```

### Share with others
1. Run `npm run dist` to produce the DMG files
2. Share the appropriate DMG (arm64 for Apple Silicon, non-arm64 for Intel)
3. Recipient: open DMG → drag app to Applications → right-click → Open (first time only, Gatekeeper bypass)

### Key fixes required for Electron on macOS
- Preload script must be compiled as CommonJS (`tsconfig.preload.json` with `"module": "CommonJS"`)
- Dashboard must use `HashRouter` not `BrowserRouter` (file:// protocol doesn't support path-based routing)
- Vite build must strip `crossorigin` attribute (custom plugin in `vite.config.js`)
- `electron-builder` needs `"publish": null` to skip auto-update metadata generation

### Data location (Electron)
```
~/Library/Application Support/productivity-tracker/tracker.db
```
(Note: different from original Python version which used `~/.productivity-tracker/tracker.db`)

---

## Questions Already Decided (Do Not Re-Ask)

- ✅ macOS only for now
- ✅ Categories are fixed (the 7 above) — no custom categories in Phase 1
- ✅ EOD review triggered at 6pm notification
- ✅ Merge interruptions < 5 min, discard sessions < 2 min
- ✅ SQLite, local only
- ✅ Web dashboard (not menubar app) for Phase 1
- ✅ No Google Calendar in Phase 1 (Phase 2 only)
- ✅ No browser extension in Phase 1
