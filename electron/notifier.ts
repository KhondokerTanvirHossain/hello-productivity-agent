// electron/notifier.ts
import { Notification, BrowserWindow } from "electron";
import cron from "node-cron";

let cronJob: cron.ScheduledTask | null = null;

export function startNotifier(mainWindow: BrowserWindow): void {
  // Fire at 6pm every day
  cronJob = cron.schedule("0 18 * * *", () => {
    const notification = new Notification({
      title: "Time to review your day",
      body: "Click to open your daily review",
    });

    notification.on("click", () => {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("navigate", "/review");
    });

    notification.show();
  });
}

export function stopNotifier(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}
