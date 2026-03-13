// electron/main.ts
import { app, BrowserWindow, Tray } from "electron";
import * as path from "path";
import { registerIpcHandlers } from "./ipc";
import { createTray } from "./tray";
import { startNotifier, stopNotifier } from "./notifier";
import { initDb, closeDb } from "./db";
import { migrateFromLegacyPath } from "./migration";
import { startTracker, stopTracker } from "./tracker";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function getDbPath(): string {
  return path.join(app.getPath("userData"), "tracker.db");
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In dev, load from Vite dev server; in prod, load built files
  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../../dashboard/dist/index.html"));
  }

  // Hide instead of close
  win.on("close", (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  return win;
}

app.on("ready", async () => {
  // Migrate legacy data if present
  await migrateFromLegacyPath(getDbPath());

  // Initialize database
  initDb(getDbPath());

  // Create window
  mainWindow = createWindow();

  // Register IPC handlers
  registerIpcHandlers();

  // Create system tray
  tray = createTray(mainWindow);

  // Start 6pm notification cron
  startNotifier(mainWindow);

  // Start background tracker
  startTracker();

  // Auto-launch on login
  app.setLoginItemSettings({ openAtLogin: true });
});

app.on("before-quit", () => {
  (app as any).isQuitting = true;
  stopNotifier();
  stopTracker();
  closeDb();
});

app.on("window-all-closed", () => {
  // On macOS, don't quit when all windows closed (tray app)
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

export { mainWindow };
