# Sprint 9: Window Title Detection — Design

## Problem

The tracker captures `app_name` but `window_title` is always empty. This means:
- All browser time shows as "?" (uncategorized) — can't distinguish Gmail from GitHub
- The categorizer's browser title rules (`BROWSER_TITLE_RULES`) never fire
- VS Code file names, terminal commands, etc. are all lost

**Root cause:** The Quartz `kCGWindowName` API returns empty strings for most modern macOS apps (browsers, Electron apps, etc.).

## Solution: Hybrid Window Title Detection (Approach B)

Replace the single Quartz method with a 3-tier fallback chain in `window_macos.py`.

### Detection Chain

```
get_active_window() — called every 5 seconds
  │
  ├─ Step 1: Get app_name + pid (NSWorkspace — unchanged)
  │
  ├─ Step 2: Browser with AppleScript support?
  │    ├─ Chrome/Safari/Arc/Brave → osascript subprocess
  │    │   Returns: tab title + URL
  │    └─ Firefox/other browsers → skip to Step 3
  │
  ├─ Step 3: Accessibility API (AXTitle via pyobjc HIServices)
  │    Works for: Firefox, VS Code, terminals, most apps
  │    Requires: Accessibility permission for the Python process
  │
  └─ Step 4: Quartz kCGWindowName (existing code, final fallback)
```

### Supported Browsers

| Browser | Method | Gets Title | Gets URL |
|---------|--------|-----------|----------|
| Google Chrome | AppleScript | Yes | Yes |
| Safari | AppleScript | Yes | Yes |
| Arc | AppleScript | Yes | Yes |
| Brave Browser | AppleScript | Yes | Yes |
| Firefox | AX API | Yes (window title) | No |

### Window Title Storage Format

When URL is available (Chrome/Safari), stored as: `"page title | https://example.com/path"`

When only title available (Firefox/AX/Quartz), stored as: `"page title"` or `"window title"`

No DB schema changes — the existing `window_title` column holds both formats.

### Categorizer Impact

No code changes needed in `categorizer.py`. The existing `BROWSER_TITLE_RULES` already do substring matching on `window_title.lower()`. With richer titles:

- `"Inbox - Gmail | https://mail.google.com"` → matches `"gmail"` → admin
- `"Pull Request #42 - GitHub"` (Firefox) → matches `"github"` → coding
- `"Google Meet | https://meet.google.com/abc"` → matches `"meet.google.com"` → meeting

### Agent Integration

`get_active_window()` return type changes from `(app_name, title)` to `(app_name, title)` where title now includes URL suffix when available. The agent doesn't need to know about the URL — it's baked into the title string.

**Simplification:** Rather than changing the return type to a 3-tuple, `window_macos.py` handles the title+URL concatenation internally. `agent.py` sees the same `(app_name, window_title)` interface — just with richer titles.

### Accessibility Permission

- The tracker agent runs as a LaunchAgent (Python process)
- AX API requires the Python binary to have Accessibility permission
- On first run, if `AXIsProcessTrusted()` returns false, log a warning with instructions
- The tracker still works without it — just falls back to Quartz (empty titles, same as today)
- `setup.sh` should mention this permission in its output

### Performance

- AppleScript subprocess: ~50ms per call (Chrome/Safari only, every 5s poll = negligible)
- AX API: ~1-5ms per call (in-process, very fast)
- Total overhead: <100ms added to the 5-second poll cycle

### Files Changed

1. **`tracker/window_macos.py`** — Main changes:
   - Add `_get_browser_title_applescript(app_name)` — returns `(title, url)` or `None`
   - Add `_get_window_title_ax(pid)` — returns title string or `None`
   - Update `get_active_window()` to use the 3-tier fallback chain
   - Concatenate title + URL as `"title | url"` when URL available

2. **`tracker/agent.py`** — Minimal change:
   - No interface change needed (title+URL already combined in window_macos.py)

3. **`tests/test_categorizer.py`** — New tests:
   - Test categorizer with browser titles containing URLs (e.g., `"Gmail | https://mail.google.com"`)
   - Test categorizer with Firefox-style window titles (e.g., `"GitHub - Mozilla Firefox"`)
   - Test categorizer with title+URL format matching domain rules

### Future: Context Capture (Phase F — not this sprint)

The Vision Framework OCR approach was considered but deferred. It makes more sense as part of a future "context capture" feature that extracts detailed information about what the user was working on, not just the window title. This sprint focuses solely on getting window titles working.
