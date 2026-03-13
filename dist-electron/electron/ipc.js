"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTrackerPaused = isTrackerPaused;
exports.setTrackerPaused = setTrackerPaused;
exports.registerIpcHandlers = registerIpcHandlers;
// electron/ipc.ts
const electron_1 = require("electron");
const db_1 = require("./db");
const merger_1 = require("./merger");
function formatBlock(block) {
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
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateToStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekBounds(d) {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return [monday, sunday];
}
let trackerPaused = false;
function isTrackerPaused() {
    return trackerPaused;
}
function setTrackerPaused(paused) {
    trackerPaused = paused;
}
function registerIpcHandlers() {
    electron_1.ipcMain.handle("get-blocks-today", () => {
        const today = todayStr();
        const blocks = (0, db_1.getWorkBlocksForDate)(today);
        return { date: today, blocks: blocks.map(formatBlock) };
    });
    electron_1.ipcMain.handle("get-blocks-today-live", () => {
        const today = todayStr();
        if (!(0, db_1.hasConfirmedBlocksForDate)(today)) {
            (0, merger_1.mergeEventsForDate)(today);
        }
        const blocks = (0, db_1.getWorkBlocksForDate)(today);
        return { date: today, blocks: blocks.map(formatBlock) };
    });
    electron_1.ipcMain.handle("get-summary-week", (_event, dateParam) => {
        const target = dateParam ? new Date(dateParam + "T00:00:00") : new Date();
        const [monday, sunday] = weekBounds(target);
        const blocks = (0, db_1.getWorkBlocksForRange)(dateToStr(monday), dateToStr(sunday));
        const totalMin = blocks.reduce((sum, b) => sum + b.duration_min, 0);
        const categoryBreakdown = {};
        for (const b of blocks) {
            categoryBreakdown[b.category] = (categoryBreakdown[b.category] ?? 0) + b.duration_min;
        }
        const daily = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            const dayStr = dateToStr(day);
            const dayBlocks = blocks.filter((b) => b.date === dayStr);
            const dayTotal = dayBlocks.reduce((sum, b) => sum + b.duration_min, 0);
            const dayBreakdown = {};
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
    electron_1.ipcMain.handle("update-block", (_event, blockId, data) => {
        const result = (0, db_1.updateWorkBlock)(blockId, {
            category: data.category,
            note: data.note,
            user_confirmed: data.user_confirmed,
        });
        if (!result)
            throw new Error("Block not found");
        return formatBlock(result);
    });
    electron_1.ipcMain.handle("get-tracker-status", () => {
        return { running: true, paused: trackerPaused };
    });
    electron_1.ipcMain.handle("pause-tracking", () => {
        trackerPaused = true;
    });
    electron_1.ipcMain.handle("resume-tracking", () => {
        trackerPaused = false;
    });
}
//# sourceMappingURL=ipc.js.map