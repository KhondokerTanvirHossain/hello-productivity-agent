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
