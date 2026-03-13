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
