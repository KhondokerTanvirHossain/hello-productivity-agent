export interface RawEvent {
    id: number;
    app_name: string;
    window_title: string | null;
    started_at: string;
    ended_at: string | null;
    duration_sec: number | null;
}
export interface WorkBlock {
    id: number;
    date: string;
    started_at: string;
    ended_at: string;
    duration_min: number;
    category: string;
    auto_category: string;
    user_confirmed: boolean;
    apps_used: string[];
    note: string | null;
}
export interface UpdateBlockPayload {
    category?: string;
    note?: string | null;
    user_confirmed?: boolean;
}
export interface DaySummary {
    date: string;
    total_min: number;
    breakdown: Record<string, number>;
}
export interface WeeklySummary {
    start_date: string;
    end_date: string;
    total_tracked_min: number;
    category_breakdown: Record<string, number>;
    daily: DaySummary[];
}
export interface TrackerStatus {
    running: boolean;
    paused: boolean;
}
export type CategoryId = "meeting" | "coding" | "research" | "bizdev" | "infra" | "planning" | "admin";
//# sourceMappingURL=types.d.ts.map