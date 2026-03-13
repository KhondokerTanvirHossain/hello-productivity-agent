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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateToStr(d: Date): string {
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
