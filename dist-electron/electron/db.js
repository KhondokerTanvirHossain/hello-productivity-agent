"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
exports.getDb = getDb;
exports.closeDb = closeDb;
exports.insertRawEvent = insertRawEvent;
exports.getRawEventsForDate = getRawEventsForDate;
exports.updateRawEventEnd = updateRawEventEnd;
exports.insertWorkBlock = insertWorkBlock;
exports.getWorkBlocksForDate = getWorkBlocksForDate;
exports.hasConfirmedBlocksForDate = hasConfirmedBlocksForDate;
exports.deleteWorkBlocksForDate = deleteWorkBlocksForDate;
exports.updateWorkBlock = updateWorkBlock;
exports.getWorkBlocksForRange = getWorkBlocksForRange;
// electron/db.ts
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
let db = null;
function initDb(dbPath = ":memory:") {
    db = new better_sqlite3_1.default(dbPath);
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
function getDb() {
    if (!db)
        throw new Error("Database not initialized. Call initDb() first.");
    return db;
}
function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}
function insertRawEvent(appName, windowTitle, startedAt, endedAt, durationSec) {
    const stmt = getDb().prepare("INSERT INTO raw_events (app_name, window_title, started_at, ended_at, duration_sec) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run(appName, windowTitle, startedAt, endedAt, durationSec);
    return Number(result.lastInsertRowid);
}
function getRawEventsForDate(date) {
    const stmt = getDb().prepare("SELECT * FROM raw_events WHERE DATE(started_at) = ?");
    return stmt.all(date);
}
function updateRawEventEnd(eventId, endedAt, durationSec) {
    getDb()
        .prepare("UPDATE raw_events SET ended_at = ?, duration_sec = ? WHERE id = ?")
        .run(endedAt, durationSec, eventId);
}
function insertWorkBlock(block) {
    const stmt = getDb().prepare(`INSERT INTO work_blocks (date, started_at, ended_at, duration_min, category, auto_category, apps_used, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const result = stmt.run(block.date, block.started_at, block.ended_at, block.duration_min, block.category, block.auto_category, block.apps_used, block.note);
    return Number(result.lastInsertRowid);
}
function getWorkBlocksForDate(date) {
    return getDb()
        .prepare("SELECT * FROM work_blocks WHERE date = ? ORDER BY started_at")
        .all(date);
}
function hasConfirmedBlocksForDate(date) {
    const row = getDb()
        .prepare("SELECT 1 FROM work_blocks WHERE date = ? AND user_confirmed = 1 LIMIT 1")
        .get(date);
    return row !== undefined;
}
function deleteWorkBlocksForDate(date) {
    getDb().prepare("DELETE FROM work_blocks WHERE date = ?").run(date);
}
function updateWorkBlock(blockId, updates) {
    const setClauses = [];
    const params = [];
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
function getWorkBlocksForRange(startDate, endDate) {
    return getDb()
        .prepare("SELECT * FROM work_blocks WHERE date BETWEEN ? AND ? ORDER BY started_at")
        .all(startDate, endDate);
}
//# sourceMappingURL=db.js.map