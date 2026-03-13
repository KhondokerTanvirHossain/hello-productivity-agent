"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTracker = startTracker;
exports.stopTracker = stopTracker;
// electron/tracker.ts
const active_win_1 = __importDefault(require("active-win"));
const child_process_1 = require("child_process");
const db_1 = require("./db");
const merger_1 = require("./merger");
const ipc_1 = require("./ipc");
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
let currentEvent = null;
let pollTimer = null;
let mergeTimer = null;
function nowStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function secondsSince(startedAt) {
    return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
}
function getBrowserUrl(appName) {
    if (process.platform !== "darwin")
        return Promise.resolve(null);
    if (!BROWSER_APPS.has(appName))
        return Promise.resolve(null);
    const script = appName === "Safari"
        ? `tell application "Safari" to get URL of front document`
        : `tell application "${appName}" to get URL of active tab of front window`;
    return new Promise((resolve) => {
        (0, child_process_1.execFile)("osascript", ["-e", script], { timeout: 2000 }, (err, stdout) => {
            if (err || !stdout.trim()) {
                resolve(null);
            }
            else {
                resolve(stdout.trim());
            }
        });
    });
}
async function pollTick() {
    if ((0, ipc_1.isTrackerPaused)())
        return;
    const win = await (0, active_win_1.default)();
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
    if (currentEvent &&
        currentEvent.app_name === appName &&
        currentEvent.window_title === windowTitle) {
        const now = nowStr();
        const duration = secondsSince(currentEvent.started_at);
        (0, db_1.updateRawEventEnd)(currentEvent.id, now, duration);
        return;
    }
    // New window — insert new event
    const now = nowStr();
    const rowId = (0, db_1.insertRawEvent)(appName, windowTitle, now, now, 0);
    currentEvent = {
        id: rowId,
        app_name: appName,
        window_title: windowTitle,
        started_at: now,
    };
}
function mergeToday() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    try {
        (0, merger_1.mergeEventsForDate)(today);
    }
    catch {
        // Non-critical — will retry next interval
    }
}
function startTracker() {
    pollTimer = setInterval(() => {
        pollTick().catch(() => { });
    }, POLL_INTERVAL_MS);
    mergeTimer = setInterval(mergeToday, MERGE_INTERVAL_MS);
}
function stopTracker() {
    if (pollTimer)
        clearInterval(pollTimer);
    if (mergeTimer)
        clearInterval(mergeTimer);
    currentEvent = null;
}
//# sourceMappingURL=tracker.js.map