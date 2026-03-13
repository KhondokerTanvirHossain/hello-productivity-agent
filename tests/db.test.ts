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
