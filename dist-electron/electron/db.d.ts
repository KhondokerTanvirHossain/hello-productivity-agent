import Database from "better-sqlite3";
export declare function initDb(dbPath?: string): void;
export declare function getDb(): Database.Database;
export declare function closeDb(): void;
export declare function insertRawEvent(appName: string, windowTitle: string | null, startedAt: string, endedAt: string | null, durationSec: number | null): number;
export declare function getRawEventsForDate(date: string): any[];
export declare function updateRawEventEnd(eventId: number, endedAt: string, durationSec: number): void;
export declare function insertWorkBlock(block: {
    date: string;
    started_at: string;
    ended_at: string;
    duration_min: number;
    category: string;
    auto_category: string;
    apps_used: string | null;
    note: string | null;
}): number;
export declare function getWorkBlocksForDate(date: string): any[];
export declare function hasConfirmedBlocksForDate(date: string): boolean;
export declare function deleteWorkBlocksForDate(date: string): void;
export declare function updateWorkBlock(blockId: number, updates: {
    category?: string;
    note?: string | null;
    user_confirmed?: boolean;
}): any | null;
export declare function getWorkBlocksForRange(startDate: string, endDate: string): any[];
//# sourceMappingURL=db.d.ts.map