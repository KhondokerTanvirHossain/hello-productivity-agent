"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startNotifier = startNotifier;
exports.stopNotifier = stopNotifier;
// electron/notifier.ts
const electron_1 = require("electron");
const node_cron_1 = __importDefault(require("node-cron"));
let cronJob = null;
function startNotifier(mainWindow) {
    // Fire at 6pm every day
    cronJob = node_cron_1.default.schedule("0 18 * * *", () => {
        const notification = new electron_1.Notification({
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
function stopNotifier() {
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
    }
}
//# sourceMappingURL=notifier.js.map