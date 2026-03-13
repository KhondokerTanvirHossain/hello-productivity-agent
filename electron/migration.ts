// electron/migration.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Notification } from "electron";

const LEGACY_DIR = path.join(os.homedir(), ".productivity-tracker");

export async function migrateFromLegacyPath(newDbPath: string): Promise<void> {
  const legacyDbPath = path.join(LEGACY_DIR, "tracker.db");

  if (!fs.existsSync(legacyDbPath)) return;
  if (fs.existsSync(newDbPath)) return; // Already migrated

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
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: "Data Migrated",
      body: "Your productivity data has been moved to the new location.",
    });
    notification.show();
  }
}
