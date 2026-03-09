#!/bin/bash
set -euo pipefail

# Detect project root from script location
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_UVICORN="$VENV_DIR/bin/uvicorn"
VITE_BIN="$PROJECT_DIR/dashboard/node_modules/.bin/vite"
NODE_BIN="$(which node)"
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
        <string>-m</string>
        <string>tracker.agent</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PYTHONPATH</key>
        <string>$PROJECT_DIR</string>
    </dict>
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
        <string>$VENV_PYTHON</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>api.server:app</string>
        <string>--port</string>
        <string>9147</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PYTHONPATH</key>
        <string>$PROJECT_DIR</string>
    </dict>
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
        <string>$NODE_BIN</string>
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
