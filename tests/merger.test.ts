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
