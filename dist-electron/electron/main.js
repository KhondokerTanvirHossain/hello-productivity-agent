"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainWindow = void 0;
// electron/main.ts
const electron_1 = require("electron");
const path = __importStar(require("path"));
const ipc_1 = require("./ipc");
const tray_1 = require("./tray");
const notifier_1 = require("./notifier");
const db_1 = require("./db");
const migration_1 = require("./migration");
const tracker_1 = require("./tracker");
let mainWindow = null;
exports.mainWindow = mainWindow;
let tray = null;
function getDbPath() {
    return path.join(electron_1.app.getPath("userData"), "tracker.db");
}
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 900,
        height: 700,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "electron/preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // In dev, load from Vite dev server; in prod, load built files
    if (process.env.NODE_ENV === "development") {
        win.loadURL("http://localhost:5173");
    }
    else {
        win.loadFile(path.join(__dirname, "../dashboard/dist/index.html"));
    }
    // Hide instead of close
    win.on("close", (e) => {
        if (!electron_1.app.isQuitting) {
            e.preventDefault();
            win.hide();
        }
    });
    win.once("ready-to-show", () => {
        win.show();
    });
    return win;
}
electron_1.app.on("ready", async () => {
    // Migrate legacy data if present
    await (0, migration_1.migrateFromLegacyPath)(getDbPath());
    // Initialize database
    (0, db_1.initDb)(getDbPath());
    // Create window
    exports.mainWindow = mainWindow = createWindow();
    // Register IPC handlers
    (0, ipc_1.registerIpcHandlers)();
    // Create system tray
    tray = (0, tray_1.createTray)(mainWindow);
    // Start 6pm notification cron
    (0, notifier_1.startNotifier)(mainWindow);
    // Start background tracker
    (0, tracker_1.startTracker)();
    // Auto-launch on login
    electron_1.app.setLoginItemSettings({ openAtLogin: true });
});
electron_1.app.on("before-quit", () => {
    electron_1.app.isQuitting = true;
    (0, notifier_1.stopNotifier)();
    (0, tracker_1.stopTracker)();
    (0, db_1.closeDb)();
});
electron_1.app.on("window-all-closed", () => {
    // On macOS, don't quit when all windows closed (tray app)
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", () => {
    if (mainWindow) {
        mainWindow.show();
    }
});
//# sourceMappingURL=main.js.map