# Electron Migration Design Spec

> Migrate the productivity tracker from a Python+React browser-based app to a cross-platform Electron desktop app.

## Context & Motivation

The current app runs as 3 separate processes: a Python daemon (window tracker), a FastAPI server, and a Vite dev server serving React in a browser. This works for local development but isn't distributable as a real desktop app.

The goal: ship a single installable `.app` / `.exe` / `.AppImage` that behaves like Rize — runs silently in the system tray, tracks windows, and opens a native window for review.

### Key Constraints

- **Cross-platform is architectural requirement** — Mac first, but Windows/Linux must not require a rewrite. *(Note: CLAUDE.md says "macOS only for now" — this spec supersedes that decision per owner direction during brainstorming on 2026-03-13.)*
- **Minimize change** — reuse existing React UI with minimal edits
- **Single app bundle** — user installs one thing, not three processes
- **Python is fully replaced** — all logic moves to TypeScript to avoid dual-runtime packaging complexity

### Why Electron

- Proven for this exact use case (Rize uses Electron)
- React UI drops in with near-zero changes
- Cross-platform out of the box (Mac/Win/Linux)
- Python → TypeScript is a straightforward port
- `active-win` package provides cross-platform window detection (maintained, battle-tested)
- Mature ecosystem, extensive documentation

### What Was Considered and Rejected

- **Tauri (Rust shell)**: Smaller bundle (~15MB vs ~160MB), lower RAM. Rejected because it requires Rust for all backend logic — steep learning curve, and porting Python → Rust is significantly harder than Python → TypeScript.
- **Keep Python as sidecar**: Adds ~50MB for bundled Python runtime, dual-runtime debugging complexity, and Python's window detection (`pyobjc`) is macOS-only anyway. Cross-platform window detection needs `active-win` (Node) regardless.
- **Rewrite UI in SwiftUI**: macOS-only, defeats cross-platform requirement.

---

## Architecture

### Current (3 separate processes)

```
┌──────────────┐
│ Python agent │  polls windows every 5s, writes to SQLite
├──────────────┤
│ FastAPI      │  localhost:8000, serves REST API
├──────────────┤
│ Vite + React │  localhost:5173, browser-based dashboard
└──────────────┘
```

### New (1 Electron app)

```
┌─────────────────────────────────────┐
│  Electron App (.app / .exe)         │
│                                     │
│  Main Process (Node.js)             │
│  ├─ ipc.ts        (route handlers)  │
│  ├─ tray.ts       (system tray)     │
│  └─ notifier.ts   (6pm trigger)     │
│                                     │
│  Worker Thread                      │
│  ├─ tracker.ts    (active-win)      │
│  ├─ categorizer.ts                  │
│  ├─ merger.ts                       │
│  └─ db.ts         (better-sqlite3)  │
│                                     │
│  Renderer Process                   │
│  └─ React UI (existing, minor edits)│
└─────────────────────────────────────┘
```

---

## Project Structure

```
productivity-tracker/
├── CLAUDE.md
├── package.json              ← root: electron + electron-builder deps
├── electron-builder.yml      ← packaging config
├── tsconfig.main.json        ← TypeScript config for electron/ (CJS, Node target)
├── tsconfig.json             ← Base config
│
├── shared/
│   └── types.ts              ← shared types (WorkBlock, WeeklySummary, etc.)
│
├── electron/
│   ├── main.ts               ← app entry point, window creation, lifecycle
│   ├── preload.ts            ← secure IPC bridge (contextBridge)
│   ├── tracker.ts            ← window polling loop using active-win
│   ├── categorizer.ts        ← app → category mapping rules
│   ├── merger.ts             ← session merging algorithm
│   ├── db.ts                 ← SQLite via better-sqlite3
│   ├── ipc.ts                ← IPC handlers (replaces FastAPI routes)
│   ├── tray.ts               ← system tray icon + menu
│   └── notifier.ts           ← 6pm daily notification
│
├── dashboard/                ← existing React app
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.ts            ← NEW: thin typed wrapper over IPC calls
│       ├── electron.d.ts     ← NEW: Window type augmentation for electronAPI
│       ├── pages/
│       │   ├── Review.jsx    ← swap fetch() → api.ts calls
│       │   ├── Today.jsx     ← swap fetch() → api.ts calls
│       │   └── Weekly.jsx    ← swap fetch() → api.ts calls
│       └── components/
│           ├── BlockCard.jsx      ← no change
│           ├── CategoryPill.jsx   ← no change
│           └── TimelineBar.jsx    ← no change
│
└── scripts/
    └── setup.sh              ← updated for Electron workflow
```

---

## What Stays, What Changes, What's Removed, What's New

### Stays (no or minimal changes)

| Component | Change Required |
|---|---|
| React components (BlockCard, CategoryPill, TimelineBar) | None |
| React pages (Review, Today, Weekly) | Replace `fetch()` calls with `api.ts` wrapper |
| Categorizer rules | Same logic, ported Python → TypeScript |
| Merger algorithm | Same logic, ported Python → TypeScript |
| SQLite schema (3 tables) | Identical |
| Tailwind CSS + Recharts | None |

### Removed

| Component | Reason |
|---|---|
| `api/server.py` + `api/routes.py` (FastAPI) | Replaced by Electron IPC handlers |
| `tracker/window_macos.py` (pyobjc) | Replaced by `active-win` (cross-platform) |
| `tracker/agent.py` (Python daemon) | Replaced by `electron/tracker.ts` |
| `tracker/categorizer.py` | Ported to `electron/categorizer.ts` |
| `tracker/merger.py` | Ported to `electron/merger.ts` |
| `tracker/db.py` | Ported to `electron/db.ts` |
| `tracker/notifier.py` + `tracker/scheduler.py` | Replaced by `electron/notifier.ts` |
| `scripts/launchd_plist.xml` | Electron handles auto-launch |
| `requirements.txt` | No Python |

### New

| Component | Purpose |
|---|---|
| `electron/main.ts` | App entry, window management, lifecycle |
| `electron/preload.ts` | Secure IPC bridge between main/renderer |
| `electron/tracker.ts` | Window polling via `active-win` |
| `electron/categorizer.ts` | TypeScript port of categorizer.py |
| `electron/merger.ts` | TypeScript port of merger.py |
| `electron/db.ts` | SQLite via `better-sqlite3` |
| `electron/ipc.ts` | IPC handlers (replaces REST routes) |
| `electron/tray.ts` | System tray icon and menu |
| `electron/notifier.ts` | 6pm notification trigger |
| `dashboard/src/api.ts` | Thin IPC wrapper so React components stay clean |
| `electron-builder.yml` | Packaging configuration |

---

## Data Flow

### API Layer Change

**Before (HTTP):**
```
React UI → fetch('http://localhost:8000/blocks/today') → FastAPI → SQLite
```

**After (IPC):**
```
React UI → window.electronAPI.getBlocksToday() → Main Process → SQLite
```

### IPC Channels

| Current FastAPI Route | IPC Channel | Payload |
|---|---|---|
| `GET /blocks/today` | `get-blocks-today` | none → WorkBlock[] |
| `GET /summary/week` | `get-summary-week` | none → WeeklySummary |
| `PATCH /blocks/:id` | `update-block` | {id, category?, note?, confirmed?} → WorkBlock |
| *(new)* | `get-tracker-status` | none → {running, paused} |
| *(new)* | `pause-tracking` | none → void |
| *(new)* | `resume-tracking` | none → void |

### React API Wrapper

A single new file `dashboard/src/api.ts` abstracts IPC from components:

```ts
// dashboard/src/api.ts
import type { WorkBlock, WeeklySummary, UpdateBlockPayload } from './types'

export const api = {
  getBlocksToday: (): Promise<WorkBlock[]> => window.electronAPI.getBlocksToday(),
  getSummaryWeek: (): Promise<WeeklySummary> => window.electronAPI.getSummaryWeek(),
  updateBlock: (id: number, data: UpdateBlockPayload): Promise<WorkBlock> =>
    window.electronAPI.updateBlock(id, data),
}
```

A `dashboard/src/electron.d.ts` file augments the `Window` type:

```ts
// dashboard/src/electron.d.ts
interface ElectronAPI {
  getBlocksToday(): Promise<WorkBlock[]>
  getSummaryWeek(): Promise<WeeklySummary>
  updateBlock(id: number, data: UpdateBlockPayload): Promise<WorkBlock>
  getTrackerStatus(): Promise<{ running: boolean; paused: boolean }>
  pauseTracking(): Promise<void>
  resumeTracking(): Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

Shared types (`WorkBlock`, `WeeklySummary`, `UpdateBlockPayload`) are defined in a `shared/types.ts` file used by both electron/ and dashboard/.

Pages import from `api.ts` instead of calling `fetch()` directly. This is the only change to React code.

### Preload Security

Renderer process never gets direct Node.js access. The preload script whitelists IPC methods:

```ts
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getBlocksToday: () => ipcRenderer.invoke('get-blocks-today'),
  getSummaryWeek: () => ipcRenderer.invoke('get-summary-week'),
  updateBlock: (id: number, data: object) => ipcRenderer.invoke('update-block', id, data),
  getTrackerStatus: () => ipcRenderer.invoke('get-tracker-status'),
  pauseTracking: () => ipcRenderer.invoke('pause-tracking'),
  resumeTracking: () => ipcRenderer.invoke('resume-tracking'),
})
```

---

## Tracker Loop

Runs in a **Worker thread** (not the main process) to avoid blocking the UI event loop. The main process spawns the worker on app start; the worker communicates via `parentPort` messages:

```
every 5 seconds:
  → active-win() returns { owner.name, title }
  → write to raw_events table
  → categorizer assigns category

every 5 minutes:
  → merger runs on recent raw_events
  → produces/updates work_blocks table

at 6pm daily:
  → Electron Notification API fires
  → user clicks → app window opens to /review route
```

### Window Detection

**Base layer (cross-platform):** `active-win` provides app name + window title on all platforms:

```ts
import activeWindow from 'active-win'

const win = await activeWindow()
// win.owner.name  → "Google Chrome"
// win.title       → "GitHub - Pull Request #42"
// win.owner.path  → "/Applications/Google Chrome.app"
```

**Browser URL enrichment (platform-specific):** `active-win` does NOT return browser tab URLs. The current Python app uses AppleScript to get the actual URL from Chrome/Safari/Arc, which is critical for categorization (e.g., `github.com` → coding vs `linkedin.com` → bizdev).

This requires a platform-specific enrichment layer in `electron/tracker.ts`:

| Platform | Browser URL method |
|---|---|
| **macOS** | AppleScript via Node `child_process.execFile('osascript', ...)` — same approach as current Python, just called from Node |
| **Windows** | UI Automation API (future) or browser extension |
| **Linux** | Browser extension (future) |

For the Mac-first launch, AppleScript URL detection carries over. Cross-platform URL detection is a known gap that can be addressed via a lightweight browser extension in a later phase.

The categorizer falls back gracefully: if no URL is available, it categorizes based on window title alone (which still covers most cases like "GitHub - Pull Request #42" matching coding).

---

## App Behavior

| Feature | Implementation |
|---|---|
| **Auto-start on login** | Electron's built-in `app.setLoginItemSettings()` on macOS/Windows; `.desktop` autostart file on Linux |
| **System tray** | Electron `Tray` API — app lives in menubar |
| **Tray menu** | Pause/Resume, Open Dashboard, Quit |
| **Close window = hide** | `win.on('close')` hides instead of quitting |
| **6pm notification** | Electron `Notification` API, click opens window (see Notification Flow below) |
| **6pm scheduling** | `node-cron` (`cron('0 18 * * *', ...)`) — handles sleep/wake correctly unlike raw `setTimeout` |
| **DB location** | `app.getPath('userData')/tracker.db` (OS-standard per platform, with migration — see below) |

---

## Database Migration

On first launch, the app checks for an existing database at the legacy path `~/.productivity-tracker/tracker.db`. If found:

1. Copy `tracker.db` to `app.getPath('userData')/tracker.db`
2. Copy `config.json` if present
3. Rename the old directory to `~/.productivity-tracker.bak-{timestamp}/` (preserves data, avoids overwriting previous backups)
4. Show a one-time notification: "Migrated your existing data to the new location"

Config location moves to `app.getPath('userData')/config.json`, following OS conventions.

---

## Notification Flow (6pm Review)

1. On app start, `notifier.ts` sets up a `node-cron` job: `cron('0 18 * * *', ...)` — fires at 6pm daily, handles sleep/wake correctly
2. At 6pm, fires `new Notification({ title: 'Time to review your day', body: 'Click to open your daily review' })`
3. On notification click handler in main process:
   - If window is hidden → `win.show()` + `win.focus()`
   - Send IPC message to renderer: `win.webContents.send('navigate', '/review')`
   - Renderer listens for `navigate` events and calls `react-router`'s `navigate()`

---

## SQLite Schema

Identical to current design. No changes:

```sql
CREATE TABLE raw_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT NOT NULL,
    window_title TEXT,
    started_at DATETIME NOT NULL,
    ended_at DATETIME,
    duration_sec INTEGER
);

CREATE TABLE work_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    started_at DATETIME NOT NULL,
    ended_at DATETIME NOT NULL,
    duration_min INTEGER NOT NULL,
    category TEXT NOT NULL,
    auto_category TEXT NOT NULL,
    user_confirmed BOOLEAN DEFAULT 0,
    apps_used TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    total_tracked_min INTEGER,
    category_breakdown TEXT,
    review_completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Packaging & Distribution

### Build Pipeline

```
electron/ (TypeScript) ──→ tsc ──┐
                                 ├──→ electron-builder ──→ installers
dashboard/ (React)     ──→ vite ─┘
```

### Output Per Platform

| Platform | Format | Size |
|---|---|---|
| macOS | `.dmg` containing `.app` | ~160 MB |
| Windows | `.exe` installer (NSIS) | ~160 MB |
| Linux | `.AppImage` + `.deb` | ~160 MB |

### Dependencies

**Electron main process:**
- `electron` — app shell
- `electron-builder` — packaging (dev only)
- `active-win` — cross-platform window detection
- `better-sqlite3` — SQLite with sync API (requires `@electron/rebuild` for native ABI compatibility)
- `node-cron` — reliable 6pm scheduling that survives sleep/wake
- `@electron/rebuild` — rebuilds native modules against Electron's Node ABI (dev only)
- (auto-launch uses Electron's built-in `app.setLoginItemSettings()` — no extra dependency)

**Dashboard (existing + unchanged):**
- `react`, `react-dom`
- `react-router-dom`
- `recharts`
- `tailwindcss`
- `vite`

### Distribution (Phase 1)

- Build locally: `npm run dist`
- Share installers directly (GitHub Releases or direct download)
- Auto-update via `electron-updater` pointing to GitHub Releases (can be added later)

---

## Migration Effort Summary

| Task | Effort | Notes |
|---|---|---|
| Scaffold Electron app (main, preload, tray) | Small | Boilerplate, well-documented |
| Port categorizer.py → categorizer.ts | Small | Pure logic, same rules |
| Port merger.py → merger.ts | Small | Pure logic, same algorithm |
| Port db.py → db.ts | Small | Same queries, different driver |
| Replace window_macos.py with active-win | Small | Simpler — active-win does the hard work |
| Replace FastAPI routes with IPC handlers | Small | 1:1 mapping |
| Add api.ts wrapper in React | Tiny | ~20 lines |
| Update React pages to use api.ts | Tiny | Find-replace fetch calls |
| System tray + notifications | Small | Electron APIs, well-documented |
| Electron-builder packaging config | Small | Config file + testing |
| DB migration (first-launch check) | Tiny | Copy file + rename old dir |
| Port existing Python tests → TypeScript | Small | categorizer + merger tests |
| **Total** | **Medium** | Mostly porting, no new algorithms |

---

## Testing Strategy

Existing Python tests for categorizer and merger should be ported to TypeScript (Jest or Vitest). These are the highest-logic modules and the port must be validated:

- `categorizer.test.ts` — same test cases as current Python tests
- `merger.test.ts` — same test cases
- `db.test.ts` — basic CRUD against an in-memory SQLite

React component tests remain unchanged.

---

## Security

- **Preload isolation**: Renderer has no direct Node.js access; only whitelisted IPC methods via `contextBridge`
- **Content Security Policy**: The renderer loads from a custom `file://` or `app://` protocol. A strict CSP meta tag in `index.html` restricts scripts to same-origin only
- **No remote content**: The app never loads external URLs in the main window

---

## Phase 2 Compatibility Note

Phase 2 (Meeting Intelligence) in CLAUDE.md relies on Python packages (`sounddevice`, `pyaudio`, `whisper`). After this migration, Phase 2 options include:

- **Node native audio**: `node-audiorecorder` or Electron's `desktopCapturer` for mic access
- **Whisper via subprocess**: Download and call `whisper.cpp` binary from Electron (no Python needed)
- **Python sidecar just for Phase 2**: Bundle a Python binary only when meeting intelligence is enabled

This is a Phase 2 concern and does not block this migration, but the architecture supports all three options.
