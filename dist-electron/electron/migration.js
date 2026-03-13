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
exports.migrateFromLegacyPath = migrateFromLegacyPath;
// electron/migration.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const electron_1 = require("electron");
const LEGACY_DIR = path.join(os.homedir(), ".productivity-tracker");
async function migrateFromLegacyPath(newDbPath) {
    const legacyDbPath = path.join(LEGACY_DIR, "tracker.db");
    if (!fs.existsSync(legacyDbPath))
        return;
    if (fs.existsSync(newDbPath))
        return; // Already migrated
    const newDir = path.dirname(newDbPath);
    fs.mkdirSync(newDir, { recursive: true });
    // Copy database
    fs.copyFileSync(legacyDbPath, newDbPath);
    // Copy config if present
    const legacyConfig = path.join(LEGACY_DIR, "config.json");
    if (fs.existsSync(legacyConfig)) {
        fs.copyFileSync(legacyConfig, path.join(newDir, "config.json"));
    }
    // Rename old directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = `${LEGACY_DIR}.bak-${timestamp}`;
    fs.renameSync(LEGACY_DIR, backupDir);
    // Show one-time notification
    if (electron_1.Notification.isSupported()) {
        const notification = new electron_1.Notification({
            title: "Data Migrated",
            body: "Your productivity data has been moved to the new location.",
        });
        notification.show();
    }
}
//# sourceMappingURL=migration.js.map