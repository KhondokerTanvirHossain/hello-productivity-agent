# Sprint 8 Design — Live Today Page

## Scope

Make the Today page show live data by adding a `GET /blocks/today/live` endpoint that merges raw events on the fly. The Today page auto-refreshes every 60 seconds. The Review page stays unchanged (uses the 6pm snapshot).

## Files to Modify

| File | Change |
|------|--------|
| `api/routes.py` | Add `GET /blocks/today/live` endpoint |
| `dashboard/src/pages/Today.jsx` | Switch to `/blocks/today/live`, add 60s auto-refresh |
| `tests/test_api.py` | Add test for new endpoint |

## New Endpoint: GET /blocks/today/live

- Calls `merge_events_for_date(today)` on each request
- Returns same shape as `/blocks/today`: `{ date, blocks: [...] }`
- Merge is idempotent (deletes old blocks for date, re-creates from raw events)
- Fast — SQLite merge on local data takes <100ms

## Today.jsx Changes

- Fetch from `/blocks/today/live` instead of `/blocks/today`
- Add `setInterval` in useEffect that re-fetches every 60 seconds
- Clean up interval on unmount
- No other UI changes

## What Stays the Same

- Review page uses `GET /blocks/today` (6pm snapshot)
- 6pm EOD notification flow unchanged
- Weekly page unchanged

## Testing

- Add test for `/blocks/today/live` (inserts raw events, calls endpoint, verifies merged blocks returned)
- Existing merger tests cover merge logic

## Done Criteria

- Open `/today` → see live merged blocks from raw events
- Wait 60s → data auto-refreshes
- Review page still works with snapshot data
