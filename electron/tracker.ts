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
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
