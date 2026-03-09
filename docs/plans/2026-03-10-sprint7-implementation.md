# Sprint 7: LaunchAgent Setup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `setup.sh` (one-command install from fresh clone to auto-starting services) and `uninstall.sh` (clean teardown) for the productivity tracker.

**Architecture:** `setup.sh` detects the project root dynamically, creates the Python venv, installs all dependencies, generates 3 macOS LaunchAgent plist files via shell heredocs with interpolated paths, copies them to `~/Library/LaunchAgents/`, and loads them. `uninstall.sh` reverses this. No automated tests — manual verification only.

**Tech Stack:** Bash, macOS launchd/launchctl, plist XML

---

### Task 1: setup.sh

**Files:**
- Create: `scripts/setup.sh`

**Step 1: Write setup.sh**

```bash
#!/bin/bash
set -euo pipefail

# Detect project root from script location
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_UVICORN="$VENV_DIR/bin/uvicorn"
VITE_BIN="$PROJECT_DIR/dashboard/node_modules/.bin/vite"
DATA_DIR="$HOME/.productivity-tracker"
LOG_DIR="$DATA_DIR/logs"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

AGENT_PLIST="com.productivity-tracker.agent.plist"
API_PLIST="com.productivity-tracker.api.plist"
DASHBOARD_PLIST="com.productivity-tracker.dashboard.plist"

echo "=== Productivity Tracker Setup ==="
echo "Project: $PROJECT_DIR"
echo ""

# Check macOS
if [ "$(uname)" != "Darwin" ]; then
    echo "Error: This script only works on macOS."
    exit 1
fi

# Create data and log directories
echo "Creating data directory..."
mkdir -p "$LOG_DIR"

# Create Python venv if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
else
    echo "Python venv already exists, skipping creation."
fi

# Install Python dependencies
echo "Installing Python dependencies..."
"$VENV_DIR/bin/pip" install -q -r "$PROJECT_DIR/requirements.txt"

# Install dashboard dependencies
echo "Installing dashboard dependencies..."
cd "$PROJECT_DIR/dashboard" && npm install --silent
cd "$PROJECT_DIR"

# Unload existing plists if present (idempotent)
for plist in "$AGENT_PLIST" "$API_PLIST" "$DASHBOARD_PLIST"; do
    if [ -f "$LAUNCH_AGENTS_DIR/$plist" ]; then
        echo "Unloading existing $plist..."
        launchctl unload "$LAUNCH_AGENTS_DIR/$plist" 2>/dev/null || true
    fi
done

# Generate and install agent plist
echo "Installing LaunchAgent: tracker agent..."
cat > "$LAUNCH_AGENTS_DIR/$AGENT_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.productivity-tracker.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$VENV_PYTHON</string>
        <string>$PROJECT_DIR/tracker/agent.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/agent.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/agent-error.log</string>
</dict>
</plist>
EOF

# Generate and install API server plist
echo "Installing LaunchAgent: API server..."
cat > "$LAUNCH_AGENTS_DIR/$API_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.productivity-tracker.api</string>
    <key>ProgramArguments</key>
    <array>
        <string>$VENV_UVICORN</string>
        <string>api.server:app</string>
        <string>--port</string>
        <string>9147</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/api.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/api-error.log</string>
</dict>
</plist>
EOF

# Generate and install dashboard plist
echo "Installing LaunchAgent: dashboard..."
cat > "$LAUNCH_AGENTS_DIR/$DASHBOARD_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.productivity-tracker.dashboard</string>
    <key>ProgramArguments</key>
    <array>
        <string>$VITE_BIN</string>
        <string>--port</string>
        <string>5173</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR/dashboard</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/dashboard.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/dashboard-error.log</string>
</dict>
</plist>
EOF

# Load all plists
echo "Loading LaunchAgents..."
launchctl load "$LAUNCH_AGENTS_DIR/$AGENT_PLIST"
launchctl load "$LAUNCH_AGENTS_DIR/$API_PLIST"
launchctl load "$LAUNCH_AGENTS_DIR/$DASHBOARD_PLIST"

echo ""
echo "=== Setup Complete ==="
echo "Services installed and running:"
echo "  Tracker agent  → logging to $LOG_DIR/agent.log"
echo "  API server     → http://localhost:9147"
echo "  Dashboard      → http://localhost:5173"
echo ""
echo "All services will auto-start on login."
echo "To uninstall: $SCRIPT_DIR/uninstall.sh"
```

**Step 2: Make executable**

Run: `chmod +x scripts/setup.sh`

**Step 3: Commit**

```bash
git add scripts/setup.sh
git commit -m "feat: add setup.sh for one-command install and auto-start"
```

---

### Task 2: uninstall.sh

**Files:**
- Create: `scripts/uninstall.sh`

**Step 1: Write uninstall.sh**

```bash
#!/bin/bash
set -euo pipefail

LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

PLISTS=(
    "com.productivity-tracker.agent.plist"
    "com.productivity-tracker.api.plist"
    "com.productivity-tracker.dashboard.plist"
)

echo "=== Productivity Tracker Uninstall ==="
echo ""

for plist in "${PLISTS[@]}"; do
    plist_path="$LAUNCH_AGENTS_DIR/$plist"
    if [ -f "$plist_path" ]; then
        echo "Unloading $plist..."
        launchctl unload "$plist_path" 2>/dev/null || true
        rm "$plist_path"
        echo "  Removed $plist_path"
    else
        echo "  $plist not found, skipping."
    fi
done

echo ""
echo "=== Uninstall Complete ==="
echo "All LaunchAgents removed. Services will no longer auto-start."
echo ""
echo "Not removed:"
echo "  - Project files (this directory)"
echo "  - Database (~/.productivity-tracker/tracker.db)"
echo "  - Log files (~/.productivity-tracker/logs/)"
echo "  - Python venv (.venv/)"
echo "  - Node modules (dashboard/node_modules/)"
echo ""
echo "To reinstall: scripts/setup.sh"
```

**Step 2: Make executable**

Run: `chmod +x scripts/uninstall.sh`

**Step 3: Commit**

```bash
git add scripts/uninstall.sh
git commit -m "feat: add uninstall.sh to remove LaunchAgents"
```

---

### Task 3: Manual Verification

**Step 1: Run setup.sh**

Run: `scripts/setup.sh`
Expected: All steps complete, services running message displayed.

**Step 2: Verify plists installed**

Run: `ls ~/Library/LaunchAgents/com.productivity-tracker.*`
Expected: Three .plist files listed.

**Step 3: Verify services running**

Run: `launchctl list | grep productivity`
Expected: Three entries with PID numbers (not `-`).

**Step 4: Verify API responds**

Run: `curl -s http://localhost:9147/blocks/today | head -20`
Expected: JSON response with `date` and `blocks` fields.

**Step 5: Verify dashboard responds**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`
Expected: `200`

**Step 6: Run uninstall.sh**

Run: `scripts/uninstall.sh`
Expected: All three plists unloaded and removed.

**Step 7: Verify services stopped**

Run: `launchctl list | grep productivity`
Expected: No output (services gone).

**Step 8: Re-run setup.sh (idempotency)**

Run: `scripts/setup.sh`
Expected: Completes without errors, services running again.

**Step 9: Final cleanup — uninstall again**

Run: `scripts/uninstall.sh`
Expected: Clean removal.

**Step 10: Commit any fixes**

If any fixes were needed during verification:
```bash
git add scripts/setup.sh scripts/uninstall.sh
git commit -m "fix: address issues found during manual verification"
```

---

## Task Dependency Graph

```
Task 1 (setup.sh) → Task 2 (uninstall.sh) → Task 3 (manual verification)
```

All sequential. Task 2 uses the same plist names as Task 1. Task 3 tests both scripts.
