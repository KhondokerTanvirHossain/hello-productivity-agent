"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTray = createTray;
// electron/tray.ts
const electron_1 = require("electron");
const ipc_1 = require("./ipc");
function createTray(mainWindow) {
    const icon = electron_1.nativeImage.createEmpty();
    const tray = new electron_1.Tray(icon);
    tray.setToolTip("Productivity Tracker");
    function buildMenu() {
        const paused = (0, ipc_1.isTrackerPaused)();
        return electron_1.Menu.buildFromTemplate([
            {
                label: "Open Dashboard",
                click: () => {
                    mainWindow.show();
                    mainWindow.focus();
                },
            },
            { type: "separator" },
            {
                label: paused ? "Resume Tracking" : "Pause Tracking",
                click: () => {
                    (0, ipc_1.setTrackerPaused)(!paused);
                    tray.setContextMenu(buildMenu());
                },
            },
            { type: "separator" },
            {
                label: "Quit",
                click: () => {
                    electron_1.app.isQuitting = true;
                    electron_1.app.quit();
                },
            },
        ]);
    }
    tray.setContextMenu(buildMenu());
    tray.on("click", () => {
        mainWindow.show();
        mainWindow.focus();
    });
    return tray;
}
//# sourceMappingURL=tray.js.map