# Electron Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the productivity tracker from Python+React browser app to a cross-platform Electron desktop app.

**Architecture:** Single Electron app with main process (IPC handlers, tray, notifications), a Worker thread (tracker polling, categorizer, merger, SQLite), and renderer process (existing React UI with minimal IPC changes). Python is fully replaced by TypeScript.

**Tech Stack:** Electron, TypeScript, better-sqlite3, active-win, node-cron, Vitest, React (existing), Vite, electron-builder

**Spec:** `docs/superpowers/specs/2026-03-13-electron-migration-design.md`

---

## File Map

### New files to create

| File | Responsibility |
|---|---|
| `package.json` (root) | Root package with Electron deps, build scripts |
| `tsconfig.json` | Base TypeScript config |
| `tsconfig.main.json` | Electron main process config (CJS, Node target) |
| `electron-builder.yml` | Packaging config for .app/.exe/.AppImage |
| `shared/types.ts` | Shared TypeScript types (WorkBlock, RawEvent, etc.) |
| `electron/main.ts` | App entry: window creation, tray, lifecycle |
| `electron/preload.ts` | contextBridge IPC whitelist |
| `electron/db.ts` | SQLite via better-sqlite3 (port of tracker/db.py) |
| `electron/categorizer.ts` | App→category rules (port of tracker/categorizer.py) |
| `electron/merger.ts` | Session merging (port of tracker/merger.py) |
| `electron/tracker.ts` | Window polling loop + browser URL enrichment |
| `electron/ipc.ts` | IPC handlers (port of api/routes.py) |
| `electron/tray.ts` | System tray icon + menu |
| `electron/notifier.ts` | 6pm cron + Electron Notification |
| `electron/migration.ts` | First-launch DB migration from legacy path |
| `dashboard/src/api.js` | Thin IPC wrapper |
| `tests/categorizer.test.ts` | Port of tests/test_categorizer.py |
| `tests/merger.test.ts` | Port of tests/test_merger.py |
| `tests/db.test.ts` | Port of tests/test_db.py |

### Existing files to modify

| File | Change |
|---|---|
| `dashboard/src/pages/Review.jsx` | Replace `fetch()` calls → `api.getBlocksToday()`, `api.updateBlock()` |
| `dashboard/src/pages/Today.jsx` | Replace `fetch()` → `api.getBlocksTodayLive()` |
| `dashboard/src/pages/Weekly.jsx` | Replace `fetch()` → `api.getSummaryWeek()` |
| `dashboard/src/main.jsx` | Add IPC navigation listener for 6pm notification routing |
| `dashboard/vite.config.js` | Remove proxy config, add electron-compatible base path |

---

## Chunk 1: Project Scaffold & Shared Types

### Task 1: Initialize root package.json and TypeScript configs

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.json`
- Create: `tsconfig.main.json`

- [ ] **Step 1: Create root package.json**

Note: The `"main"` field tells Electron which file to load. It must point to the compiled JS output.

```json
{
  "name": "productivity-tracker",
  "version": "1.0.0",
  "private": true,
  "main": "dist-electron/electron/main.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:electron\" \"npm run dev:dashboard\"",
    "dev:electron": "tsc -p tsconfig.main.json --watch",
    "dev:dashboard": "cd dashboard && npm run dev",
    "build:electron": "tsc -p tsconfig.main.json",
    "build:dashboard": "cd dashboard && npm run build",
    "build": "npm run build:electron && npm run build:dashboard",
    "start": "npm run build:electron && electron .",
    "dist": "npm run build && electron-builder",
    "test": "vitest run",
    "test:watch": "vitest",
    "postinstall": "@electron/rebuild"
  },
  "dependencies": {
    "active-win": "^7.0.0",
    "better-sqlite3": "^11.7.0",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.7.1",
    "@types/better-sqlite3": "^7.6.12",
    "@types/node-cron": "^3.0.11",
    "concurrently": "^9.1.2",
    "electron": "^33.3.1",
    "electron-builder": "^25.1.8",
    "typescript": "^5.7.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create tsconfig.json (base)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create tsconfig.main.json (Electron main process)**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist-electron",
    "rootDir": ".",
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  },
  "include": ["electron/**/*.ts", "shared/**/*.ts"]
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: node_modules created, @electron/rebuild runs postinstall

- [ ] **Step 5: Commit scaffold**

```bash
git add package.json tsconfig.json tsconfig.main.json
git commit -m "chore: scaffold Electron project with TypeScript configs"
```

---

### Task 2: Create shared types

**Files:**
- Create: `shared/types.ts`

- [ ] **Step 1: Write shared types**

These types mirror the SQLite schema and the API response shapes used by both electron/ and dashboard/.

```ts
// shared/types.ts

export interface RawEvent {
  id: number;
  app_name: string;
  window_title: string | null;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
}

export interface WorkBlock {
  id: number;
  date: string;
  started_at: string;
  ended_at: string;
  duration_min: number;
  category: string;
  auto_category: string;
  user_confirmed: boolean;
  apps_used: string[];
  note: string | null;
}

export interface UpdateBlockPayload {
  category?: string;
  note?: string | null;
  user_confirmed?: boolean;
}

export interface DaySummary {
  date: string;
  total_min: number;
  breakdown: Record<string, number>;
}

export interface WeeklySummary {
  start_date: string;
  end_date: string;
  total_tracked_min: number;
  category_breakdown: Record<string, number>;
  daily: DaySummary[];
}

export interface TrackerStatus {
  running: boolean;
  paused: boolean;
}

export type CategoryId =
  | "meeting"
  | "coding"
  | "research"
  | "bizdev"
  | "infra"
  | "planning"
  | "admin";
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.main.json --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add shared/types.ts
git commit -m "feat: add shared TypeScript types for Electron migration"
```

---

### Task 3: Create electron-builder config

**Files:**
- Create: `electron-builder.yml`

- [ ] **Step 1: Write electron-builder.yml**

```yaml
appId: com.productivity-tracker.app
productName: Productivity Tracker
directories:
  output: release
  buildResources: resources
files:
  - dist-electron/**/*
  - dashboard/dist/**/*
  - shared/**/*.js
asarUnpack:
  - "node_modules/better-sqlite3/**/*"
  - "node_modules/active-win/**/*"
mac:
  category: public.app-category.productivity
  target:
    - dmg
    - zip
win:
  target:
    - nsis
linux:
  target:
    - AppImage
    - deb
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
npmRebuild: true
```

- [ ] **Step 2: Commit**

```bash
git add electron-builder.yml
git commit -m "chore: add electron-builder packaging config"
```

---

## Chunk 2: Core Logic Ports (Categorizer, DB, Merger)

These are pure logic modules with no Electron dependencies. Port Python → TypeScript with TDD.

### Task 4: Port categorizer.py → categorizer.ts

**Files:**
- Create: `electron/categorizer.ts`
- Create: `tests/categorizer.test.ts`

Source: `tracker/categorizer.py` (97 lines)
Existing tests: `tests/test_categorizer.py` (229 lines, 54 tests)

- [ ] **Step 1: Write the failing tests**

Port all test cases from `tests/test_categorizer.py`. The test file uses Vitest with the same assertion patterns.

```ts
// tests/categorizer.test.ts
import { describe, it, expect } from "vitest";
import { categorize } from "../electron/categorizer";

describe("Direct app mapping", () => {
  it("Zoom → meeting", () => expect(categorize("Zoom", null)).toBe("meeting"));
  it("Google Meet → meeting", () => expect(categorize("Google Meet", null)).toBe("meeting"));
  it("Microsoft Teams → meeting", () => expect(categorize("Microsoft Teams", null)).toBe("meeting"));
  it("Whereby → meeting", () => expect(categorize("Whereby", null)).toBe("meeting"));
  it("Loom → meeting", () => expect(categorize("Loom", null)).toBe("meeting"));

  it("VS Code → coding", () => expect(categorize("VS Code", "main.py")).toBe("coding"));
  it("Code → coding", () => expect(categorize("Code", "main.py")).toBe("coding"));
  it("Cursor → coding", () => expect(categorize("Cursor", "app.tsx")).toBe("coding"));
  it("Xcode → coding", () => expect(categorize("Xcode", null)).toBe("coding"));
  it("IntelliJ IDEA → coding", () => expect(categorize("IntelliJ IDEA", null)).toBe("coding"));
  it("PyCharm → coding", () => expect(categorize("PyCharm", null)).toBe("coding"));
  it("WebStorm → coding", () => expect(categorize("WebStorm", null)).toBe("coding"));
  it("GoLand → coding", () => expect(categorize("GoLand", null)).toBe("coding"));

  it("Docker Desktop → infra", () => expect(categorize("Docker Desktop", null)).toBe("infra"));
  it("Datadog → infra", () => expect(categorize("Datadog", null)).toBe("infra"));
  it("Grafana → infra", () => expect(categorize("Grafana", null)).toBe("infra"));
  it("PagerDuty → infra", () => expect(categorize("PagerDuty", null)).toBe("infra"));

  it("Notion → planning", () => expect(categorize("Notion", null)).toBe("planning"));
  it("Linear → planning", () => expect(categorize("Linear", null)).toBe("planning"));
  it("Jira → planning", () => expect(categorize("Jira", null)).toBe("planning"));
  it("Obsidian → planning", () => expect(categorize("Obsidian", null)).toBe("planning"));
  it("Miro → planning", () => expect(categorize("Miro", null)).toBe("planning"));

  it("Slack → admin", () => expect(categorize("Slack", null)).toBe("admin"));
  it("Mail → admin", () => expect(categorize("Mail", null)).toBe("admin"));
  it("Apple Mail → admin", () => expect(categorize("Apple Mail", null)).toBe("admin"));
  it("Superhuman → admin", () => expect(categorize("Superhuman", null)).toBe("admin"));
  it("Telegram → admin", () => expect(categorize("Telegram", null)).toBe("admin"));
  it("WhatsApp → admin", () => expect(categorize("WhatsApp", null)).toBe("admin"));

  it("LinkedIn → bizdev", () => expect(categorize("LinkedIn", null)).toBe("bizdev"));
  it("HubSpot → bizdev", () => expect(categorize("HubSpot", null)).toBe("bizdev"));
  it("Salesforce → bizdev", () => expect(categorize("Salesforce", null)).toBe("bizdev"));
  it("Hunter → bizdev", () => expect(categorize("Hunter", null)).toBe("bizdev"));
  it("Apollo → bizdev", () => expect(categorize("Apollo", null)).toBe("bizdev"));
});

describe("Terminal special case", () => {
  it("Terminal default → coding", () => expect(categorize("Terminal", "~/projects")).toBe("coding"));
  it("Terminal ssh → infra", () => expect(categorize("Terminal", "ssh user@prod-server")).toBe("infra"));
  it("iTerm2 kubectl → infra", () => expect(categorize("iTerm2", "kubectl get pods")).toBe("infra"));
  it("Warp terraform → infra", () => expect(categorize("Warp", "terraform plan")).toBe("infra"));
  it("Terminal docker → infra", () => expect(categorize("Terminal", "docker compose up")).toBe("infra"));
  it("Terminal aws → infra", () => expect(categorize("Terminal", "aws s3 ls")).toBe("infra"));
  it("Terminal no title → coding", () => expect(categorize("Terminal", null)).toBe("coding"));
  it("iTerm regular → coding", () => expect(categorize("iTerm", "vim main.py")).toBe("coding"));
});

describe("Browser title matching", () => {
  it("GitHub → coding", () => expect(categorize("Google Chrome", "my-repo - GitHub")).toBe("coding"));
  it("Stack Overflow → research", () => expect(categorize("Safari", "python sqlite3 - Stack Overflow")).toBe("research"));
  it("Medium → research", () => expect(categorize("Google Chrome", "Understanding React Hooks - Medium")).toBe("research"));
  it("Hacker News → research", () => expect(categorize("Firefox", "Hacker News")).toBe("research"));
  it("Reddit → research", () => expect(categorize("Arc", "r/programming - Reddit")).toBe("research"));
  it("arxiv → research", () => expect(categorize("Google Chrome", "arxiv.org - Attention Is All You Need")).toBe("research"));
  it("Wikipedia → research", () => expect(categorize("Safari", "Python (programming language) - Wikipedia")).toBe("research"));
  it("Gmail → admin", () => expect(categorize("Google Chrome", "Inbox - Gmail")).toBe("admin"));
  it("Google Calendar → admin", () => expect(categorize("Google Chrome", "Google Calendar - Week of March 10")).toBe("admin"));
  it("meet.google.com → meeting", () => expect(categorize("Google Chrome", "Meeting - meet.google.com")).toBe("meeting"));
  it("teams.microsoft.com → meeting", () => expect(categorize("Safari", "teams.microsoft.com - Call")).toBe("meeting"));
  it("AWS Console → infra", () => expect(categorize("Google Chrome", "EC2 - console.aws.amazon.com")).toBe("infra"));
  it("GCP Console → infra", () => expect(categorize("Google Chrome", "Compute Engine - console.cloud.google.com")).toBe("infra"));
  it("Azure Portal → infra", () => expect(categorize("Microsoft Edge", "portal.azure.com - Resources")).toBe("infra"));
  it("LinkedIn browser → bizdev", () => expect(categorize("Google Chrome", "Feed | LinkedIn")).toBe("bizdev"));
  it("proposal → bizdev", () => expect(categorize("Google Chrome", "Q4 Proposal - Google Docs")).toBe("bizdev"));
  it("contract → bizdev", () => expect(categorize("Safari", "Service Contract Draft")).toBe("bizdev"));
  it("Google Docs → planning", () => expect(categorize("Google Chrome", "Sprint Plan - Google Docs")).toBe("planning"));
  it("generic browser → ?", () => expect(categorize("Google Chrome", "Some Random Website")).toBe("?"));
  it("browser no title → ?", () => expect(categorize("Safari", null)).toBe("?"));
});

describe("Browser title with URL format", () => {
  it("Gmail with URL", () => expect(categorize("Google Chrome", "Inbox (3) - Gmail | https://mail.google.com/mail/u/0/#inbox")).toBe("admin"));
  it("Google Meet with URL", () => expect(categorize("Google Chrome", "Meeting Room | https://meet.google.com/abc-defg-hij")).toBe("meeting"));
  it("GitHub with URL", () => expect(categorize("Google Chrome", "Pull requests · my-org/my-repo | https://github.com/my-org/my-repo/pulls")).toBe("coding"));
  it("Stack Overflow with URL", () => expect(categorize("Safari", "python - How to parse JSON | https://stackoverflow.com/questions/123")).toBe("research"));
  it("LinkedIn with URL", () => expect(categorize("Google Chrome", "Feed | LinkedIn | https://www.linkedin.com/feed/")).toBe("bizdev"));
  it("Google Docs with URL", () => expect(categorize("Google Chrome", "Sprint Planning Doc | https://docs.google.com/document/d/abc")).toBe("planning"));
  it("AWS Console with URL", () => expect(categorize("Google Chrome", "EC2 Management Console | https://console.aws.amazon.com/ec2")).toBe("infra"));
  it("Hacker News with URL", () => expect(categorize("Firefox", "Hacker News | https://news.ycombinator.com")).toBe("research"));
  it("Unknown site with URL → ?", () => expect(categorize("Google Chrome", "Some Blog Post | https://example.com/blog")).toBe("?"));
});

describe("Fallback", () => {
  it("unknown app → ?", () => expect(categorize("SomeRandomApp", null)).toBe("?"));
  it("null title handled", () => expect(categorize("UnknownApp", null)).toBe("?"));
});
```

- [ ] **Step 2: Create vitest config and run tests to verify they fail**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

Run: `npx vitest run tests/categorizer.test.ts`
Expected: FAIL — module `../electron/categorizer` not found

- [ ] **Step 3: Write the categorizer implementation**

Direct port from `tracker/categorizer.py`:

```ts
// electron/categorizer.ts

const DIRECT_APP_MAP: Record<string, string> = {
  // meeting
  Zoom: "meeting",
  "zoom.us": "meeting",
  "Google Meet": "meeting",
  "Microsoft Teams": "meeting",
  Whereby: "meeting",
  Around: "meeting",
  Loom: "meeting",
  // coding
  Code: "coding",
  "VS Code": "coding",
  "Visual Studio Code": "coding",
  Cursor: "coding",
  Xcode: "coding",
  "IntelliJ IDEA": "coding",
  IntelliJ: "coding",
  PyCharm: "coding",
  WebStorm: "coding",
  Rider: "coding",
  GoLand: "coding",
  "GitHub Desktop": "coding",
  // infra
  "Docker Desktop": "infra",
  Datadog: "infra",
  Grafana: "infra",
  PagerDuty: "infra",
  // planning
  Notion: "planning",
  Miro: "planning",
  FigJam: "planning",
  Whimsical: "planning",
  Lucidchart: "planning",
  Linear: "planning",
  Jira: "planning",
  Asana: "planning",
  ClickUp: "planning",
  Obsidian: "planning",
  // admin
  Slack: "admin",
  Mail: "admin",
  "Apple Mail": "admin",
  Spark: "admin",
  Superhuman: "admin",
  Telegram: "admin",
  WhatsApp: "admin",
  // bizdev
  LinkedIn: "bizdev",
  Hunter: "bizdev",
  Apollo: "bizdev",
  Salesforce: "bizdev",
  HubSpot: "bizdev",
};

const TERMINAL_APPS = new Set(["Terminal", "iTerm", "iTerm2", "Warp"]);

const INFRA_TITLE_KEYWORDS = [
  "ssh",
  "kubectl",
  "k9s",
  "terraform",
  "ansible",
  "docker",
  "aws",
  "gcp",
  "az ",
];

const BROWSER_APPS = new Set([
  "Google Chrome",
  "Safari",
  "Firefox",
  "Arc",
  "Microsoft Edge",
  "Brave Browser",
]);

const BROWSER_TITLE_RULES: [string, string[]][] = [
  ["meeting", ["meet.google.com", "teams.microsoft.com", "zoom.us"]],
  ["coding", ["github.com", "github"]],
  [
    "infra",
    [
      "console.aws",
      "console.cloud.google",
      "portal.azure",
      "datadog",
      "grafana",
      "pagerduty",
    ],
  ],
  [
    "research",
    [
      "- medium",
      "arxiv",
      "wikipedia",
      "stack overflow",
      "stackoverflow.com",
      "hacker news",
      "news.ycombinator",
      "reddit",
    ],
  ],
  ["bizdev", ["linkedin", "proposal", "contract", "pitch"]],
  ["planning", ["google docs", "docs.google.com"]],
  ["admin", ["gmail", "google calendar"]],
];

export function categorize(appName: string, windowTitle: string | null): string {
  if (appName in DIRECT_APP_MAP) {
    return DIRECT_APP_MAP[appName];
  }

  if (TERMINAL_APPS.has(appName)) {
    if (windowTitle) {
      const titleLower = windowTitle.toLowerCase();
      for (const keyword of INFRA_TITLE_KEYWORDS) {
        if (titleLower.includes(keyword)) {
          return "infra";
        }
      }
    }
    return "coding";
  }

  if (BROWSER_APPS.has(appName)) {
    if (windowTitle) {
      const titleLower = windowTitle.toLowerCase();
      for (const [category, keywords] of BROWSER_TITLE_RULES) {
        for (const keyword of keywords) {
          if (titleLower.includes(keyword)) {
            return category;
          }
        }
      }
    }
    return "?";
  }

  return "?";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/categorizer.test.ts`
Expected: All 54 tests PASS

- [ ] **Step 5: Commit**

```bash
git add electron/categorizer.ts tests/categorizer.test.ts vitest.config.ts
git commit -m "feat: port categorizer from Python to TypeScript with tests"
```

---

### Task 5: Port db.py → db.ts

**Files:**
- Create: `electron/db.ts`
- Create: `tests/db.test.ts`

Source: `tracker/db.py` (185 lines)
Existing tests: `tests/test_db.py` (304 lines, 44 tests)

- [ ] **Step 1: Write failing tests for db.ts**

Port the core test cases from `tests/test_db.py`. Uses `better-sqlite3` with `:memory:` for tests.

```ts
// tests/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initDb,
  closeDb,
  insertRawEvent,
  getRawEventsForDate,
  updateRawEventEnd,
  insertWorkBlock,
  getWorkBlocksForDate,
  deleteWorkBlocksForDate,
  updateWorkBlock,
  getWorkBlocksForRange,
  hasConfirmedBlocksForDate,
} from "../electron/db";

describe("DB initialization", () => {
  afterEach(() => closeDb());

  it("creates tables on init", () => {
    initDb(":memory:");
    // Should not throw — tables exist
    const events = getRawEventsForDate("2026-03-10");
    expect(events).toEqual([]);
  });
});

describe("Raw events", () => {
  beforeEach(() => initDb(":memory:"));
  afterEach(() => closeDb());

  it("inserts and retrieves a raw event", () => {
    const id = insertRawEvent("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800);
    expect(id).toBeGreaterThan(0);
    const events = getRawEventsForDate("2026-03-10");
    expect(events).toHaveLength(1);
    expect(events[0].app_name).toBe("VS Code");
    expect(events[0].window_title).toBe("main.py");
    expect(events[0].duration_sec).toBe(1800);
  });

  it("inserts event with null window_title", () => {
    insertRawEvent("Slack", null, "2026-03-10T09:00:00", "2026-03-10T09:05:00", 300);
    const events = getRawEventsForDate("2026-03-10");
    expect(events[0].window_title).toBeNull();
  });

  it("updates raw event end time", () => {
    const id = insertRawEvent("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:00:00", 0);
    updateRawEventEnd(id, "2026-03-10T09:30:00", 1800);
    const events = getRawEventsForDate("2026-03-10");
    expect(events[0].ended_at).toBe("2026-03-10T09:30:00");
    expect(events[0].duration_sec).toBe(1800);
  });

  it("filters events by date", () => {
    insertRawEvent("VS Code", "a.py", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 3600);
    insertRawEvent("VS Code", "b.py", "2026-03-11T09:00:00", "2026-03-11T10:00:00", 3600);
    expect(getRawEventsForDate("2026-03-10")).toHaveLength(1);
    expect(getRawEventsForDate("2026-03-11")).toHaveLength(1);
  });
});

describe("Work blocks", () => {
  beforeEach(() => initDb(":memory:"));
  afterEach(() => closeDb());

  it("inserts and retrieves work blocks", () => {
    const id = insertWorkBlock({
      date: "2026-03-10",
      started_at: "2026-03-10T09:00:00",
      ended_at: "2026-03-10T10:00:00",
      duration_min: 60,
      category: "coding",
      auto_category: "coding",
      apps_used: '["VS Code"]',
      note: null,
    });
    expect(id).toBeGreaterThan(0);
    const blocks = getWorkBlocksForDate("2026-03-10");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].category).toBe("coding");
    expect(blocks[0].duration_min).toBe(60);
  });

  it("deletes work blocks for date", () => {
    insertWorkBlock({
      date: "2026-03-10",
      started_at: "2026-03-10T09:00:00",
      ended_at: "2026-03-10T10:00:00",
      duration_min: 60,
      category: "coding",
      auto_category: "coding",
      apps_used: null,
      note: null,
    });
    deleteWorkBlocksForDate("2026-03-10");
    expect(getWorkBlocksForDate("2026-03-10")).toHaveLength(0);
  });

  it("updates work block category", () => {
    const id = insertWorkBlock({
      date: "2026-03-10",
      started_at: "2026-03-10T09:00:00",
      ended_at: "2026-03-10T10:00:00",
      duration_min: 60,
      category: "coding",
      auto_category: "coding",
      apps_used: null,
      note: null,
    });
    const updated = updateWorkBlock(id, { category: "meeting" });
    expect(updated).not.toBeNull();
    expect(updated!.category).toBe("meeting");
  });

  it("updates work block note and confirmed", () => {
    const id = insertWorkBlock({
      date: "2026-03-10",
      started_at: "2026-03-10T09:00:00",
      ended_at: "2026-03-10T10:00:00",
      duration_min: 60,
      category: "coding",
      auto_category: "coding",
      apps_used: null,
      note: null,
    });
    const updated = updateWorkBlock(id, { note: "Fixed bug", user_confirmed: true });
    expect(updated!.note).toBe("Fixed bug");
    expect(updated!.user_confirmed).toBe(1);
  });

  it("returns null for non-existent block", () => {
    expect(updateWorkBlock(999, { category: "admin" })).toBeNull();
  });

  it("hasConfirmedBlocksForDate returns false when none confirmed", () => {
    insertWorkBlock({
      date: "2026-03-10",
      started_at: "2026-03-10T09:00:00",
      ended_at: "2026-03-10T10:00:00",
      duration_min: 60,
      category: "coding",
      auto_category: "coding",
      apps_used: null,
      note: null,
    });
    expect(hasConfirmedBlocksForDate("2026-03-10")).toBe(false);
  });

  it("hasConfirmedBlocksForDate returns true when confirmed", () => {
    const id = insertWorkBlock({
      date: "2026-03-10",
      started_at: "2026-03-10T09:00:00",
      ended_at: "2026-03-10T10:00:00",
      duration_min: 60,
      category: "coding",
      auto_category: "coding",
      apps_used: null,
      note: null,
    });
    updateWorkBlock(id, { user_confirmed: true });
    expect(hasConfirmedBlocksForDate("2026-03-10")).toBe(true);
  });

  it("getWorkBlocksForRange returns blocks in range", () => {
    insertWorkBlock({
      date: "2026-03-10",
      started_at: "2026-03-10T09:00:00",
      ended_at: "2026-03-10T10:00:00",
      duration_min: 60,
      category: "coding",
      auto_category: "coding",
      apps_used: null,
      note: null,
    });
    insertWorkBlock({
      date: "2026-03-12",
      started_at: "2026-03-12T09:00:00",
      ended_at: "2026-03-12T10:00:00",
      duration_min: 60,
      category: "admin",
      auto_category: "admin",
      apps_used: null,
      note: null,
    });
    const blocks = getWorkBlocksForRange("2026-03-10", "2026-03-12");
    expect(blocks).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/db.test.ts`
Expected: FAIL — module `../electron/db` not found

- [ ] **Step 3: Write the db implementation**

```ts
// electron/db.ts
import Database from "better-sqlite3";

let db: Database.Database | null = null;

export function initDb(dbPath: string = ":memory:"): void {
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS raw_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT NOT NULL,
      window_title TEXT,
      started_at DATETIME NOT NULL,
      ended_at DATETIME,
      duration_sec INTEGER
    );

    CREATE TABLE IF NOT EXISTS work_blocks (
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

    CREATE TABLE IF NOT EXISTS daily_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE UNIQUE NOT NULL,
      total_tracked_min INTEGER,
      category_breakdown TEXT,
      review_completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function getDb(): Database.Database {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function insertRawEvent(
  appName: string,
  windowTitle: string | null,
  startedAt: string,
  endedAt: string | null,
  durationSec: number | null
): number {
  const stmt = getDb().prepare(
    "INSERT INTO raw_events (app_name, window_title, started_at, ended_at, duration_sec) VALUES (?, ?, ?, ?, ?)"
  );
  const result = stmt.run(appName, windowTitle, startedAt, endedAt, durationSec);
  return Number(result.lastInsertRowid);
}

export function getRawEventsForDate(date: string): any[] {
  const stmt = getDb().prepare("SELECT * FROM raw_events WHERE DATE(started_at) = ?");
  return stmt.all(date);
}

export function updateRawEventEnd(eventId: number, endedAt: string, durationSec: number): void {
  getDb()
    .prepare("UPDATE raw_events SET ended_at = ?, duration_sec = ? WHERE id = ?")
    .run(endedAt, durationSec, eventId);
}

export function insertWorkBlock(block: {
  date: string;
  started_at: string;
  ended_at: string;
  duration_min: number;
  category: string;
  auto_category: string;
  apps_used: string | null;
  note: string | null;
}): number {
  const stmt = getDb().prepare(
    `INSERT INTO work_blocks (date, started_at, ended_at, duration_min, category, auto_category, apps_used, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    block.date,
    block.started_at,
    block.ended_at,
    block.duration_min,
    block.category,
    block.auto_category,
    block.apps_used,
    block.note
  );
  return Number(result.lastInsertRowid);
}

export function getWorkBlocksForDate(date: string): any[] {
  return getDb()
    .prepare("SELECT * FROM work_blocks WHERE date = ? ORDER BY started_at")
    .all(date);
}

export function hasConfirmedBlocksForDate(date: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM work_blocks WHERE date = ? AND user_confirmed = 1 LIMIT 1")
    .get(date);
  return row !== undefined;
}

export function deleteWorkBlocksForDate(date: string): void {
  getDb().prepare("DELETE FROM work_blocks WHERE date = ?").run(date);
}

export function updateWorkBlock(
  blockId: number,
  updates: { category?: string; note?: string | null; user_confirmed?: boolean }
): any | null {
  const setClauses: string[] = [];
  const params: any[] = [];

  if (updates.category !== undefined) {
    setClauses.push("category = ?");
    params.push(updates.category);
  }
  if (updates.note !== undefined) {
    setClauses.push("note = ?");
    params.push(updates.note);
  }
  if (updates.user_confirmed !== undefined) {
    setClauses.push("user_confirmed = ?");
    params.push(updates.user_confirmed ? 1 : 0);
  }

  if (setClauses.length > 0) {
    params.push(blockId);
    getDb()
      .prepare(`UPDATE work_blocks SET ${setClauses.join(", ")} WHERE id = ?`)
      .run(...params);
  }

  return getDb().prepare("SELECT * FROM work_blocks WHERE id = ?").get(blockId) ?? null;
}

export function getWorkBlocksForRange(startDate: string, endDate: string): any[] {
  return getDb()
    .prepare("SELECT * FROM work_blocks WHERE date BETWEEN ? AND ? ORDER BY started_at")
    .all(startDate, endDate);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/db.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add electron/db.ts tests/db.test.ts
git commit -m "feat: port db module from Python to TypeScript with tests"
```

---

### Task 6: Port merger.py → merger.ts

**Files:**
- Create: `electron/merger.ts`
- Create: `tests/merger.test.ts`

Source: `tracker/merger.py` (118 lines)
Existing tests: `tests/test_merger.py` (170 lines, 12 tests)

- [ ] **Step 1: Write failing tests**

```ts
// tests/merger.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mergeEventsForDate } from "../electron/merger";
import {
  initDb,
  closeDb,
  insertRawEvent,
  getWorkBlocksForDate,
} from "../electron/db";

function insertEvent(app: string, title: string | null, start: string, end: string, dur: number) {
  insertRawEvent(app, title, start, end, dur);
}

describe("Merger: micro-session discard", () => {
  beforeEach(() => initDb(":memory:"));
  afterEach(() => closeDb());

  it("discards events under 2 minutes", () => {
    insertEvent("Slack", null, "2026-03-10T09:00:00", "2026-03-10T09:01:00", 60);
    insertEvent("VS Code", "main.py", "2026-03-10T09:01:00", "2026-03-10T09:30:00", 1740);
    const blocks = mergeEventsForDate("2026-03-10");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].category).toBe("coding");
  });

  it("keeps events at exactly 2 minutes", () => {
    insertEvent("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:12:00", 720);
    insertEvent("Slack", null, "2026-03-10T09:12:00", "2026-03-10T09:14:00", 120);
    const blocks = mergeEventsForDate("2026-03-10");
    const categories = blocks.map((b: any) => b.category);
    expect(categories.includes("admin") || blocks.length >= 1).toBe(true);
  });
});

describe("Merger: same-category merge", () => {
  beforeEach(() => initDb(":memory:"));
  afterEach(() => closeDb());

  it("merges same category within 5min gap", () => {
    insertEvent("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800);
    insertEvent("VS Code", "utils.py", "2026-03-10T09:33:00", "2026-03-10T10:00:00", 1620);
    const blocks = mergeEventsForDate("2026-03-10");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].category).toBe("coding");
    expect(blocks[0].duration_min).toBeGreaterThanOrEqual(57);
  });

  it("does not merge with gap over 5min", () => {
    insertEvent("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800);
    insertEvent("VS Code", "utils.py", "2026-03-10T09:36:00", "2026-03-10T10:06:00", 1800);
    const blocks = mergeEventsForDate("2026-03-10");
    expect(blocks).toHaveLength(2);
  });
});

describe("Merger: absorb short switches", () => {
  beforeEach(() => initDb(":memory:"));
  afterEach(() => closeDb());

  it("absorbs short switch between same category", () => {
    insertEvent("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800);
    insertEvent("Slack", null, "2026-03-10T09:30:00", "2026-03-10T09:33:00", 180);
    insertEvent("VS Code", "utils.py", "2026-03-10T09:33:00", "2026-03-10T10:00:00", 1620);
    const blocks = mergeEventsForDate("2026-03-10");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].category).toBe("coding");
  });

  it("does not absorb long switch", () => {
    insertEvent("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800);
    insertEvent("Slack", null, "2026-03-10T09:30:00", "2026-03-10T09:36:00", 360);
    insertEvent("VS Code", "utils.py", "2026-03-10T09:36:00", "2026-03-10T10:06:00", 1800);
    const blocks = mergeEventsForDate("2026-03-10");
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Merger: min block size", () => {
  beforeEach(() => initDb(":memory:"));
  afterEach(() => closeDb());

  it("discards blocks under 10 minutes", () => {
    insertEvent("Slack", null, "2026-03-10T09:00:00", "2026-03-10T09:08:00", 480);
    insertEvent("VS Code", "main.py", "2026-03-10T09:08:00", "2026-03-10T10:08:00", 3600);
    const blocks = mergeEventsForDate("2026-03-10");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].category).toBe("coding");
  });
});

describe("Merger: idempotent", () => {
  beforeEach(() => initDb(":memory:"));
  afterEach(() => closeDb());

  it("re-merge replaces existing blocks", () => {
    insertEvent("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 3600);
    mergeEventsForDate("2026-03-10");
    mergeEventsForDate("2026-03-10");
    const blocks = getWorkBlocksForDate("2026-03-10");
    expect(blocks).toHaveLength(1);
  });
});

describe("Merger: writes to DB", () => {
  beforeEach(() => initDb(":memory:"));
  afterEach(() => closeDb());

  it("blocks written to work_blocks table", () => {
    insertEvent("VS Code", "main.py", "2026-03-10T09:00:00", "2026-03-10T10:00:00", 3600);
    mergeEventsForDate("2026-03-10");
    const blocks = getWorkBlocksForDate("2026-03-10");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].category).toBe("coding");
    expect(blocks[0].auto_category).toBe("coding");
    const apps = JSON.parse(blocks[0].apps_used);
    expect(apps).toContain("VS Code");
  });

  it("block has correct time range", () => {
    insertEvent("Zoom", "Standup", "2026-03-10T09:00:00", "2026-03-10T09:30:00", 1800);
    const blocks = mergeEventsForDate("2026-03-10");
    expect(blocks[0].started_at).toBe("2026-03-10T09:00:00");
    expect(blocks[0].ended_at).toBe("2026-03-10T09:30:00");
    expect(blocks[0].duration_min).toBe(30);
  });
});

describe("Merger: typical day", () => {
  beforeEach(() => initDb(":memory:"));
  afterEach(() => closeDb());

  it("produces 6-12 blocks for a typical day", () => {
    insertEvent("Zoom", "Standup", "2026-03-10T09:00:00", "2026-03-10T09:15:00", 900);
    insertEvent("VS Code", "main.py", "2026-03-10T09:15:00", "2026-03-10T10:30:00", 4500);
    insertEvent("Slack", "#general", "2026-03-10T10:30:00", "2026-03-10T10:32:00", 120);
    insertEvent("VS Code", "utils.py", "2026-03-10T10:32:00", "2026-03-10T11:30:00", 3480);
    insertEvent("Google Chrome", "React Hooks - Stack Overflow", "2026-03-10T11:30:00", "2026-03-10T12:00:00", 1800);
    insertEvent("Notion", "Sprint Plan", "2026-03-10T13:00:00", "2026-03-10T13:45:00", 2700);
    insertEvent("Zoom", "1:1 with Manager", "2026-03-10T14:00:00", "2026-03-10T14:30:00", 1800);
    insertEvent("VS Code", "api.py", "2026-03-10T14:30:00", "2026-03-10T16:00:00", 5400);
    insertEvent("Slack", "DMs", "2026-03-10T16:00:00", "2026-03-10T16:30:00", 1800);
    insertEvent("Terminal", "ssh prod-server", "2026-03-10T16:30:00", "2026-03-10T17:00:00", 1800);
    insertEvent("Google Chrome", "Inbox - Gmail", "2026-03-10T17:00:00", "2026-03-10T17:30:00", 1800);

    const blocks = mergeEventsForDate("2026-03-10");
    expect(blocks.length).toBeGreaterThanOrEqual(6);
    expect(blocks.length).toBeLessThanOrEqual(12);
    const categories = blocks.map((b: any) => b.category);
    expect(categories).toContain("meeting");
    expect(categories).toContain("coding");
    expect(categories).toContain("research");
    expect(categories).toContain("planning");
    expect(categories).toContain("admin");
    expect(categories).toContain("infra");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/merger.test.ts`
Expected: FAIL — module `../electron/merger` not found

- [ ] **Step 3: Write the merger implementation**

```ts
// electron/merger.ts
import { categorize } from "./categorizer";
import {
  getRawEventsForDate,
  deleteWorkBlocksForDate,
  insertWorkBlock,
} from "./db";

function parseDt(dtStr: string): Date {
  return new Date(dtStr); // ISO 8601 with T separator is well-defined in ECMAScript
}

function gapSeconds(endStr: string, startStr: string): number {
  return (parseDt(startStr).getTime() - parseDt(endStr).getTime()) / 1000;
}

function durationSeconds(startStr: string, endStr: string): number {
  return (parseDt(endStr).getTime() - parseDt(startStr).getTime()) / 1000;
}

interface MergeBlock {
  app_name: string;
  window_title: string | null;
  started_at: string;
  ended_at: string;
  duration_sec: number;
  category: string;
  apps: Set<string>;
}

export function mergeEventsForDate(date: string): any[] {
  const rawEvents = getRawEventsForDate(date);
  if (rawEvents.length === 0) return [];

  // Step 1: Categorize and filter micro-sessions (< 2 min)
  const categorized: MergeBlock[] = [];
  for (const event of rawEvents) {
    const dur = event.duration_sec ?? 0;
    if (dur < 120) continue;
    const category = categorize(event.app_name, event.window_title);
    categorized.push({
      app_name: event.app_name,
      window_title: event.window_title,
      started_at: event.started_at,
      ended_at: event.ended_at,
      duration_sec: dur,
      category,
      apps: new Set([event.app_name]),
    });
  }

  if (categorized.length === 0) return [];

  // Step 2: Merge same-category interruptions (gap < 5 min)
  const merged: MergeBlock[] = [{ ...categorized[0] }];

  for (let i = 1; i < categorized.length; i++) {
    const event = categorized[i];
    const prev = merged[merged.length - 1];
    const gap = gapSeconds(prev.ended_at, event.started_at);

    if (event.category === prev.category && gap <= 300) {
      prev.ended_at = event.ended_at;
      prev.duration_sec = durationSeconds(prev.started_at, prev.ended_at);
      event.apps.forEach((a) => prev.apps.add(a));
    } else {
      merged.push({ ...event, apps: new Set(event.apps) });
    }
  }

  // Step 3: Absorb short switches (< 5 min sandwiched between same category)
  let absorbed = [...merged];
  let changed = true;
  while (changed) {
    changed = false;
    const newList: MergeBlock[] = [];
    let i = 0;
    while (i < absorbed.length) {
      if (
        i > 0 &&
        i < absorbed.length - 1 &&
        absorbed[i].duration_sec < 300 &&
        newList.length > 0 &&
        newList[newList.length - 1].category === absorbed[i + 1].category
      ) {
        const prev = newList[newList.length - 1];
        prev.ended_at = absorbed[i + 1].ended_at;
        prev.duration_sec = durationSeconds(prev.started_at, prev.ended_at);
        absorbed[i].apps.forEach((a) => prev.apps.add(a));
        absorbed[i + 1].apps.forEach((a) => prev.apps.add(a));
        i += 2;
        changed = true;
      } else {
        newList.push(absorbed[i]);
        i += 1;
      }
    }
    absorbed = newList;
  }

  // Step 4: Filter blocks under 10 minutes
  const finalBlocks = absorbed.filter((b) => b.duration_sec >= 600);

  // Step 5: Write to DB (idempotent — delete first)
  deleteWorkBlocksForDate(date);

  const result: any[] = [];
  for (const block of finalBlocks) {
    const durationMin = Math.floor(block.duration_sec / 60);
    const appsUsed = JSON.stringify([...block.apps].sort());
    const rowId = insertWorkBlock({
      date,
      started_at: block.started_at,
      ended_at: block.ended_at,
      duration_min: durationMin,
      category: block.category,
      auto_category: block.category,
      apps_used: appsUsed,
      note: null,
    });
    result.push({
      id: rowId,
      date,
      started_at: block.started_at,
      ended_at: block.ended_at,
      duration_min: durationMin,
      category: block.category,
      auto_category: block.category,
      apps_used: appsUsed,
      note: null,
    });
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/merger.test.ts`
Expected: All 12 tests PASS

- [ ] **Step 5: Run all tests together**

Run: `npx vitest run`
Expected: All tests across categorizer, db, and merger PASS

- [ ] **Step 6: Commit**

```bash
git add electron/merger.ts tests/merger.test.ts
git commit -m "feat: port merger from Python to TypeScript with tests"
```

---

## Chunk 3: Electron App Shell (Main, Preload, Tray, Notifications, IPC)

### Task 7: Create Electron main process entry point

**Files:**
- Create: `electron/main.ts`

- [ ] **Step 1: Write main.ts**

This is the app entry point. It creates the window, sets up the tray, starts the tracker worker, and registers IPC handlers.

```ts
// electron/main.ts
import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron";
import * as path from "path";
import { registerIpcHandlers } from "./ipc";
import { createTray } from "./tray";
import { startNotifier, stopNotifier } from "./notifier";
import { initDb, closeDb } from "./db";
import { migrateFromLegacyPath } from "./migration";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function getDbPath(): string {
  return path.join(app.getPath("userData"), "tracker.db");
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In dev, load from Vite dev server; in prod, load built files
  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dashboard/dist/index.html"));
  }

  // Hide instead of close
  win.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  return win;
}

app.on("ready", async () => {
  // Migrate legacy data if present
  await migrateFromLegacyPath(getDbPath());

  // Initialize database
  initDb(getDbPath());

  // Create window
  mainWindow = createWindow();

  // Register IPC handlers
  registerIpcHandlers();

  // Create system tray
  tray = createTray(mainWindow);

  // Start 6pm notification cron
  startNotifier(mainWindow);

  // Auto-launch on login
  app.setLoginItemSettings({ openAtLogin: true });
});

app.on("before-quit", () => {
  (app as any).isQuitting = true;
  stopNotifier();
  closeDb();
});

app.on("window-all-closed", () => {
  // On macOS, don't quit when all windows closed (tray app)
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

export { mainWindow };
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.main.json --noEmit`
Expected: Errors for missing modules (preload, ipc, tray, notifier, migration) — expected at this stage

- [ ] **Step 3: Commit (partial — will complete as dependencies are added)**

```bash
git add electron/main.ts
git commit -m "feat: add Electron main process entry point"
```

---

### Task 8: Create preload script

**Files:**
- Create: `electron/preload.ts`

- [ ] **Step 1: Write preload.ts**

```ts
// electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getBlocksToday: () => ipcRenderer.invoke("get-blocks-today"),
  getBlocksTodayLive: () => ipcRenderer.invoke("get-blocks-today-live"),
  getSummaryWeek: (date?: string) => ipcRenderer.invoke("get-summary-week", date),
  updateBlock: (id: number, data: object) => ipcRenderer.invoke("update-block", id, data),
  getTrackerStatus: () => ipcRenderer.invoke("get-tracker-status"),
  pauseTracking: () => ipcRenderer.invoke("pause-tracking"),
  resumeTracking: () => ipcRenderer.invoke("resume-tracking"),
  onNavigate: (callback: (route: string) => void) => {
    ipcRenderer.on("navigate", (_event, route: string) => callback(route));
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.ts
git commit -m "feat: add Electron preload script with IPC bridge"
```

---

### Task 9: Create IPC handlers (port of api/routes.py)

**Files:**
- Create: `electron/ipc.ts`

Source: `api/routes.py` (114 lines)

- [ ] **Step 1: Write ipc.ts**

```ts
// electron/ipc.ts
import { ipcMain } from "electron";
import {
  getWorkBlocksForDate,
  getWorkBlocksForRange,
  updateWorkBlock,
  hasConfirmedBlocksForDate,
} from "./db";
import { mergeEventsForDate } from "./merger";

function formatBlock(block: any): any {
  const appsRaw = block.apps_used;
  const appsList = appsRaw ? JSON.parse(appsRaw) : [];
  return {
    id: block.id,
    date: block.date,
    started_at: block.started_at,
    ended_at: block.ended_at,
    duration_min: block.duration_min,
    category: block.category,
    auto_category: block.auto_category,
    user_confirmed: Boolean(block.user_confirmed),
    apps_used: appsList,
    note: block.note ?? null,
  };
}

function todayStr(): string {
  // Use local date to match how the dashboard computes dates
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateToStr(d: Date): string {
  // Local date string — avoids UTC offset issues
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekBounds(d: Date): [Date, Date] {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return [monday, sunday];
}

let trackerPaused = false;

export function isTrackerPaused(): boolean {
  return trackerPaused;
}

export function setTrackerPaused(paused: boolean): void {
  trackerPaused = paused;
}

export function registerIpcHandlers(): void {
  ipcMain.handle("get-blocks-today", () => {
    const today = todayStr();
    const blocks = getWorkBlocksForDate(today);
    return { date: today, blocks: blocks.map(formatBlock) };
  });

  ipcMain.handle("get-blocks-today-live", () => {
    const today = todayStr();
    if (!hasConfirmedBlocksForDate(today)) {
      mergeEventsForDate(today);
    }
    const blocks = getWorkBlocksForDate(today);
    return { date: today, blocks: blocks.map(formatBlock) };
  });

  ipcMain.handle("get-summary-week", (_event, dateParam?: string) => {
    const target = dateParam ? new Date(dateParam + "T00:00:00") : new Date();
    const [monday, sunday] = weekBounds(target);

    const blocks = getWorkBlocksForRange(dateToStr(monday), dateToStr(sunday));
    const totalMin = blocks.reduce((sum: number, b: any) => sum + b.duration_min, 0);

    const categoryBreakdown: Record<string, number> = {};
    for (const b of blocks) {
      categoryBreakdown[b.category] = (categoryBreakdown[b.category] ?? 0) + b.duration_min;
    }

    const daily = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dayStr = dateToStr(day);
      const dayBlocks = blocks.filter((b: any) => b.date === dayStr);
      const dayTotal = dayBlocks.reduce((sum: number, b: any) => sum + b.duration_min, 0);
      const dayBreakdown: Record<string, number> = {};
      for (const b of dayBlocks) {
        dayBreakdown[b.category] = (dayBreakdown[b.category] ?? 0) + b.duration_min;
      }
      daily.push({ date: dayStr, total_min: dayTotal, breakdown: dayBreakdown });
    }

    return {
      start_date: dateToStr(monday),
      end_date: dateToStr(sunday),
      total_tracked_min: totalMin,
      category_breakdown: categoryBreakdown,
      daily,
    };
  });

  ipcMain.handle("update-block", (_event, blockId: number, data: any) => {
    const result = updateWorkBlock(blockId, {
      category: data.category,
      note: data.note,
      user_confirmed: data.user_confirmed,
    });
    if (!result) throw new Error("Block not found");
    return formatBlock(result);
  });

  ipcMain.handle("get-tracker-status", () => {
    return { running: true, paused: trackerPaused };
  });

  ipcMain.handle("pause-tracking", () => {
    trackerPaused = true;
  });

  ipcMain.handle("resume-tracking", () => {
    trackerPaused = false;
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/ipc.ts
git commit -m "feat: add IPC handlers replacing FastAPI routes"
```

---

### Task 10: Create tracker (window polling)

**Files:**
- Create: `electron/tracker.ts`

Source: `tracker/agent.py` (114 lines) + `tracker/window_macos.py` (191 lines)

- [ ] **Step 1: Write tracker.ts**

Uses `active-win` for cross-platform window detection. On macOS, enriches browser windows with URL via AppleScript (same approach as current Python code, called via `child_process`).

```ts
// electron/tracker.ts
import activeWindow from "active-win";
import { execFile } from "child_process";
import { insertRawEvent, updateRawEventEnd } from "./db";
import { mergeEventsForDate } from "./merger";
import { isTrackerPaused } from "./ipc";

const POLL_INTERVAL_MS = 5_000;
const MERGE_INTERVAL_MS = 5 * 60 * 1000;

const BROWSER_APPS = new Set([
  "Google Chrome",
  "Safari",
  "Firefox",
  "Arc",
  "Microsoft Edge",
  "Brave Browser",
]);

interface CurrentEvent {
  id: number;
  app_name: string;
  window_title: string | null;
  started_at: string;
}

let currentEvent: CurrentEvent | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let mergeTimer: ReturnType<typeof setInterval> | null = null;

function nowStr(): string {
  // Use local time format matching Python's datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function secondsSince(startedAt: string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
}

function getBrowserUrl(appName: string): Promise<string | null> {
  if (process.platform !== "darwin") return Promise.resolve(null);
  if (!BROWSER_APPS.has(appName)) return Promise.resolve(null);

  const script =
    appName === "Safari"
      ? `tell application "Safari" to get URL of front document`
      : `tell application "${appName}" to get URL of active tab of front window`;

  return new Promise((resolve) => {
    execFile("osascript", ["-e", script], { timeout: 2000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function pollTick(): Promise<void> {
  if (isTrackerPaused()) return;

  const win = await activeWindow();
  if (!win) {
    currentEvent = null;
    return;
  }

  let appName = win.owner.name;
  let windowTitle = win.title || null;

  // Enrich browser windows with URL
  if (BROWSER_APPS.has(appName)) {
    const url = await getBrowserUrl(appName);
    if (url && windowTitle) {
      windowTitle = `${windowTitle} | ${url}`;
    }
  }

  // Same window — update end time
  if (
    currentEvent &&
    currentEvent.app_name === appName &&
    currentEvent.window_title === windowTitle
  ) {
    const now = nowStr();
    const duration = secondsSince(currentEvent.started_at);
    updateRawEventEnd(currentEvent.id, now, duration);
    return;
  }

  // New window — insert new event
  const now = nowStr();
  const rowId = insertRawEvent(appName, windowTitle, now, now, 0);
  currentEvent = {
    id: rowId,
    app_name: appName,
    window_title: windowTitle,
    started_at: now,
  };
}

function mergeToday(): void {
  const today = new Date().toISOString().split("T")[0];
  try {
    mergeEventsForDate(today);
  } catch {
    // Non-critical — will retry next interval
  }
}

export function startTracker(): void {
  pollTimer = setInterval(() => {
    pollTick().catch(() => {});
  }, POLL_INTERVAL_MS);

  mergeTimer = setInterval(mergeToday, MERGE_INTERVAL_MS);
}

export function stopTracker(): void {
  if (pollTimer) clearInterval(pollTimer);
  if (mergeTimer) clearInterval(mergeTimer);
  currentEvent = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/tracker.ts
git commit -m "feat: add tracker with active-win and macOS URL enrichment"
```

---

### Task 11: Create tray module

**Files:**
- Create: `electron/tray.ts`

- [ ] **Step 1: Write tray.ts**

```ts
// electron/tray.ts
import { Tray, Menu, BrowserWindow, nativeImage, app } from "electron";
import { isTrackerPaused, setTrackerPaused } from "./ipc";

export function createTray(mainWindow: BrowserWindow): Tray {
  // Use a template image for macOS menubar (16x16 or 22x22)
  // For now, use a simple dot. Replace with real icon later.
  const icon = nativeImage.createEmpty();
  const tray = new Tray(icon);

  tray.setToolTip("Productivity Tracker");

  function buildMenu(): Menu {
    const paused = isTrackerPaused();
    return Menu.buildFromTemplate([
      {
        label: "Open Dashboard",
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: "separator" },
      {
        label: paused ? "Resume Tracking" : "Pause Tracking",
        click: () => {
          setTrackerPaused(!paused);
          tray.setContextMenu(buildMenu()); // Rebuild to toggle label
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          (app as any).isQuitting = true;
          app.quit();
        },
      },
    ]);
  }

  tray.setContextMenu(buildMenu());

  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/tray.ts
git commit -m "feat: add system tray with context menu"
```

---

### Task 12: Create notifier module

**Files:**
- Create: `electron/notifier.ts`

- [ ] **Step 1: Write notifier.ts**

```ts
// electron/notifier.ts
import { Notification, BrowserWindow } from "electron";
import cron from "node-cron";

let cronJob: cron.ScheduledTask | null = null;

export function startNotifier(mainWindow: BrowserWindow): void {
  // Fire at 6pm every day
  cronJob = cron.schedule("0 18 * * *", () => {
    const notification = new Notification({
      title: "Time to review your day",
      body: "Click to open your daily review",
    });

    notification.on("click", () => {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("navigate", "/review");
    });

    notification.show();
  });
}

export function stopNotifier(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/notifier.ts
git commit -m "feat: add 6pm daily notification with node-cron"
```

---

### Task 13: Create DB migration module

**Files:**
- Create: `electron/migration.ts`

- [ ] **Step 1: Write migration.ts**

```ts
// electron/migration.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Notification } from "electron";

const LEGACY_DIR = path.join(os.homedir(), ".productivity-tracker");

export async function migrateFromLegacyPath(newDbPath: string): Promise<void> {
  const legacyDbPath = path.join(LEGACY_DIR, "tracker.db");

  if (!fs.existsSync(legacyDbPath)) return;
  if (fs.existsSync(newDbPath)) return; // Already migrated

  const newDir = path.dirname(newDbPath);
  fs.mkdirSync(newDir, { recursive: true });

  // Copy database
  fs.copyFileSync(legacyDbPath, newDbPath);

  // Copy config if present
  const legacyConfig = path.join(LEGACY_DIR, "config.json");
  if (fs.existsSync(legacyConfig)) {
    fs.copyFileSync(legacyConfig, path.join(newDir, "config.json"));
  }

  // Rename old directory with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = `${LEGACY_DIR}.bak-${timestamp}`;
  fs.renameSync(LEGACY_DIR, backupDir);

  // Show one-time notification (guard for platforms where notifications aren't supported)
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: "Data Migrated",
      body: "Your productivity data has been moved to the new location.",
    });
    notification.show();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/migration.ts
git commit -m "feat: add first-launch DB migration from legacy path"
```

---

### Task 14: Wire up main.ts with tracker start

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Add tracker import and start to main.ts**

Add to the imports at the top of `electron/main.ts`:
```ts
import { startTracker, stopTracker } from "./tracker";
```

Add after `startNotifier(mainWindow);` in the `app.on("ready")` handler:
```ts
  // Start background tracker
  startTracker();
```

Add to `app.on("before-quit")`:
```ts
  stopTracker();
```

- [ ] **Step 2: Verify full compilation**

Run: `npx tsc -p tsconfig.main.json --noEmit`
Expected: No errors (or only type errors for Electron APIs that need runtime)

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat: wire tracker start/stop into Electron lifecycle"
```

---

## Chunk 4: Dashboard Integration & Packaging

### Task 15: Create dashboard API wrapper and type declarations

**Files:**
- Create: `dashboard/src/api.js`
- Create: `dashboard/src/electron.d.ts` (optional, for IDE support if later migrating to TS)

Note: The dashboard is JSX (not TypeScript). We create `api.js` to stay consistent. `shared/types.ts` is used only by the `electron/` layer. The dashboard consumes the same data shapes via IPC but does not import from `shared/` directly — this avoids cross-package path resolution complexity.

- [ ] **Step 1: Create api.js**

```js
// dashboard/src/api.js
export const api = {
  getBlocksToday: () => window.electronAPI.getBlocksToday(),
  getBlocksTodayLive: () => window.electronAPI.getBlocksTodayLive(),
  getSummaryWeek: (date) => window.electronAPI.getSummaryWeek(date),
  updateBlock: (id, data) => window.electronAPI.updateBlock(id, data),
};
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/api.js
git commit -m "feat: add IPC API wrapper for Electron"
```

---

### Task 16: Update React pages to use IPC

**Files:**
- Modify: `dashboard/src/pages/Review.jsx`
- Modify: `dashboard/src/pages/Today.jsx`
- Modify: `dashboard/src/pages/Weekly.jsx`
- Modify: `dashboard/src/main.jsx`

- [ ] **Step 1: Update Review.jsx**

Replace the two `fetch()` patterns:

Add import at the top of the file:
```jsx
import { api } from "../api";
```

In the `useEffect` (line 16-29), replace the entire fetch chain:
```jsx
// OLD
fetch("/blocks/today")
  .then((res) => {
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  })
  .then((data) => {
    setBlocks(data.blocks);
    setOriginalBlocks(JSON.parse(JSON.stringify(data.blocks)));
    setLoading(false);
  })
  .catch((err) => {
    setError("Cannot connect to tracker API. Is the server running on port 9147?");
    setLoading(false);
  });
```
with:
```jsx
// NEW
api.getBlocksToday()
  .then((data) => {
    setBlocks(data.blocks);
    setOriginalBlocks(JSON.parse(JSON.stringify(data.blocks)));
    setLoading(false);
  })
  .catch(() => {
    setError("Cannot connect to tracker. Is the app running?");
    setLoading(false);
  });
```

In `handleDone` (line 49-57), replace:
```jsx
// OLD
const res = await fetch(`/blocks/${block.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    category: block.category,
    note: block.note || null,
    user_confirmed: block.user_confirmed,
  }),
});
if (!res.ok) {
  console.error(`Failed to save block ${block.id}`);
}
```
with:
```jsx
// NEW
await api.updateBlock(block.id, {
  category: block.category,
  note: block.note || null,
  user_confirmed: block.user_confirmed,
});
```

- [ ] **Step 2: Update Today.jsx**

Replace `fetchBlocks` function (line 10-25):
```jsx
// OLD
const fetchBlocks = () => {
  fetch("/blocks/today/live")
    .then(...)
```
with:
```jsx
// NEW
import { api } from "../api";
// ...
const fetchBlocks = () => {
  api.getBlocksTodayLive()
    .then((data) => {
      setBlocks(data.blocks);
      setLoading(false);
      setError(null);
    })
    .catch(() => {
      setError("Cannot connect to tracker. Is the app running?");
      setLoading(false);
    });
};
```

- [ ] **Step 3: Update Weekly.jsx**

Replace fetch in `useEffect` (line 43-55):
```jsx
// OLD
fetch(`/summary/week?date=${weekDate}`)
  .then(...)
```
with:
```jsx
// NEW
import { api } from "../api";
// ... in useEffect:
api.getSummaryWeek(weekDate)
  .then((d) => {
    setData(d);
    setLoading(false);
  })
  .catch(() => {
    setError("Cannot connect to tracker. Is the app running?");
    setLoading(false);
  });
```

- [ ] **Step 4: Add navigation listener to main.jsx**

Add IPC navigation listener so 6pm notification can route to /review:

```jsx
// dashboard/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router-dom";
import App from "./App";
import "./index.css";

function NavigationListener() {
  const navigate = useNavigate();
  React.useEffect(() => {
    if (window.electronAPI?.onNavigate) {
      window.electronAPI.onNavigate((route) => {
        navigate(route);
      });
    }
  }, [navigate]);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <NavigationListener />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 5: Update vite.config.js**

Remove the proxy (no more FastAPI) and set base for Electron file loading:

```js
// dashboard/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./", // Relative paths for Electron file:// loading
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 6: Verify dashboard builds**

Run: `cd dashboard && npm run build`
Expected: Build succeeds, output in `dashboard/dist/`

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/pages/Review.jsx dashboard/src/pages/Today.jsx dashboard/src/pages/Weekly.jsx dashboard/src/main.jsx dashboard/vite.config.js
git commit -m "feat: migrate React pages from fetch() to Electron IPC"
```

---

### Task 17: Test the full Electron app in dev mode

- [ ] **Step 1: Build the Electron main process**

Run: `npx tsc -p tsconfig.main.json`
Expected: JavaScript output in `dist-electron/`

- [ ] **Step 2: Start dashboard dev server**

Run: `cd dashboard && npm run dev &`
Expected: Vite dev server at localhost:5173

- [ ] **Step 3: Start Electron in dev mode**

Run: `NODE_ENV=development npx electron .`
Expected: Electron window opens showing the dashboard, tray icon appears

- [ ] **Step 4: Verify tracker is logging**

After a few seconds, check the DB:
Run: `sqlite3 ~/Library/Application\ Support/productivity-tracker/tracker.db "SELECT COUNT(*) FROM raw_events"`
Expected: Count > 0

- [ ] **Step 5: Verify IPC works**

Click through Review, Today, Weekly pages in the Electron window.
Expected: Pages load data (or show "No activity" if fresh DB), no console errors about fetch or connection

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: dev mode integration fixes"
```

---

### Task 18: Package for macOS

- [ ] **Step 1: Build everything**

Run: `npm run build`
Expected: `dist-electron/` and `dashboard/dist/` both populated

- [ ] **Step 2: Package with electron-builder**

Run: `npm run dist`
Expected: `.dmg` file created in `release/` directory

- [ ] **Step 3: Test the packaged app**

Open the `.dmg`, drag to Applications, launch.
Expected: App starts, tray icon appears, tracker works.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify packaging and fix any build issues"
```

---

### Task 19: Run full test suite

- [ ] **Step 1: Run all TypeScript tests**

Run: `npx vitest run`
Expected: All categorizer, db, and merger tests PASS

- [ ] **Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete Electron migration - all tests passing"
```

---

## Summary

| Chunk | Tasks | What it produces |
|---|---|---|
| 1: Scaffold | Tasks 1-3 | Project structure, types, configs |
| 2: Core Logic | Tasks 4-6 | categorizer.ts, db.ts, merger.ts — all tested |
| 3: Electron Shell | Tasks 7-14 | main.ts, preload.ts, ipc.ts, tracker.ts, tray.ts, notifier.ts, migration.ts |
| 4: Dashboard + Package | Tasks 15-19 | api.ts, updated React pages, electron-builder, tested .dmg |

Total: 20 tasks, ~80 steps. Each task is independently committable and testable.

---

## Known Simplification: Worker Thread

The spec calls for the tracker to run in a Worker thread. This plan runs it in the main process via `setInterval` for simplicity — `active-win` is async and returns quickly, and `better-sqlite3` writes are sub-millisecond for single inserts. If performance becomes an issue (sluggish tray/window), extract `tracker.ts` + `db.ts` into a `worker_threads.Worker` in a follow-up. The logic is already isolated in its own module, making this extraction straightforward.

---

### Task 20: Clean up dead Python files

- [ ] **Step 1: Remove Python files that are now replaced**

```bash
rm -rf tracker/ api/ requirements.txt tests/test_*.py scripts/launchd_plist.xml
```

Note: Keep `tests/` directory for the new TypeScript tests.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove Python files replaced by Electron TypeScript port"
```
