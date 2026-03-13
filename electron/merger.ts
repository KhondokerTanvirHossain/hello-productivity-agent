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
  const merged: MergeBlock[] = [{ ...categorized[0], apps: new Set(categorized[0].apps) }];

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
