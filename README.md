# Productivity Tracker

A local, private macOS productivity tracker. Silently tracks your active app all day, auto-categorizes work into 7 buckets, and shows a daily review at 6pm. No cloud, no subscription — your data stays on your Mac.

## Install (for others)

### Option A — DMG installer (easiest)

1. Download `Productivity Tracker-1.0.0-arm64.dmg` (Apple Silicon) or `Productivity Tracker-1.0.0.dmg` (Intel)
2. Open the DMG
3. Drag **Productivity Tracker** into **Applications**
4. First launch: right-click the app → **Open** (required once to bypass Gatekeeper since the app is not code-signed)
5. The app starts tracking immediately and lives in your menu bar

### Option B — Run from source

Requirements: Node.js 18+, npm

```bash
git clone <repo-url>
cd hello-prodcutivity-agent
npm install
npm run dist          # builds the DMG
# or to run directly:
npm start
```

### Clean build (if app shows blank screen or stale UI)

```bash
rm -rf dist-electron dashboard/dist && npm start
```

## Uninstall

1. Quit the app (menu bar icon → Quit)
2. Drag **Productivity Tracker** from `/Applications` to Trash
3. To also delete your data: `rm -rf ~/Library/Application\ Support/productivity-tracker`

## Usage

- The app tracks your active window automatically — no setup needed
- Open the app from the menu bar icon or Dock
- **Today** tab — activity blocks for today (appears after ~10 min of use)
- **Weekly** tab — category breakdown for the week
- **Review** tab — end-of-day review, confirm/fix auto-detected categories
- At **6pm** you'll get a macOS notification to review your day

## Work Categories

| Category | Examples |
|---|---|
| Coding | VS Code, Xcode, IntelliJ, Terminal |
| Meetings | Zoom, Google Meet, Teams |
| Research | Browser (Medium, Stack Overflow, HN) |
| Planning | Notion, Linear, Jira, Google Docs |
| Infra / DevOps | Docker, AWS Console, Datadog |
| Biz Dev | LinkedIn, Salesforce, HubSpot |
| Admin | Slack, Mail, Gmail, Calendar |

## Build a new DMG

```bash
npm run dist
# Output: dist/Productivity Tracker-1.0.0-arm64.dmg  (Apple Silicon)
#         dist/Productivity Tracker-1.0.0.dmg         (Intel)
```

## Data

All data is stored locally at:
```
~/Library/Application Support/productivity-tracker/tracker.db
```
SQLite database. Never leaves your machine.
